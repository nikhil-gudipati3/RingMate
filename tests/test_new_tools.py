"""Tests for the new agent tools: calendar, web search, datetime, notes,
plus the streaming turn path used by the call UI."""
import pytest

from server.agent_core import (
    ACTION_AWAITING_CONFIRMATION,
    ACTION_NONE,
    AgentCore,
    instant_filler,
    split_sentences,
)
from server.queue_store import QueueStore


class FakeLLM:
    def __init__(self, script):
        self.script = list(script)

    def complete(self, messages, tools):
        assert self.script, "FakeLLM ran out of scripted decisions"
        return self.script.pop(0)


class FakeEmail:
    def __init__(self):
        self.sent = []

    def __call__(self, to, subject, body, attachment_path=None):
        self.sent.append({"to": to, "subject": subject, "body": body,
                          "attachment_path": attachment_path})
        return {"ok": True}


@pytest.fixture
def core(tmp_path):
    store = QueueStore(str(tmp_path / "newtools.db"), ttl_seconds=30)
    llm = FakeLLM([])
    email = FakeEmail()
    c = AgentCore(store, llm, email, user_email="me@example.com",
                  notes_path=str(tmp_path / "notes.json"),
                  wait_timeout=8, poll_interval=0.05)
    yield c, store, llm, email
    store.close()


def tool_call(name, arguments=None):
    return {"type": "tool_call", "name": name, "arguments": arguments or {}}


def test_get_datetime_answers_without_guessing(core):
    c, store, llm, email = core
    llm.script.append(tool_call("get_datetime"))
    out = c.handle_turn("t1", "what time is it")
    assert out["action"] == ACTION_NONE
    assert "It's" in out["reply_text"] and ":" in out["reply_text"]


def test_web_search_short_answer(core, monkeypatch):
    from server import websearch_tool
    monkeypatch.setattr(websearch_tool, "web_search",
                        lambda q, timeout=8.0: {"ok": True, "answer": "Paris is the capital of France. It is known for the Eiffel Tower. Extra third sentence.", "source": "Wikipedia", "related": []})
    c, store, llm, email = core
    llm.script.append(tool_call("web_search", {"query": "capital of France"}))
    out = c.handle_turn("t1", "what is the capital of France")
    assert "Paris" in out["reply_text"]
    assert "Extra third sentence" not in out["reply_text"]  # kept short for voice


def test_web_search_failure_is_graceful(core, monkeypatch):
    from server import websearch_tool
    monkeypatch.setattr(websearch_tool, "web_search",
                        lambda q, timeout=8.0: {"ok": False, "error": "search_unavailable"})
    c, store, llm, email = core
    llm.script.append(tool_call("web_search", {"query": "xyz"}))
    out = c.handle_turn("t1", "search for xyz")
    assert out["action"] == ACTION_NONE and "couldn't search" in out["reply_text"]


def test_check_calendar_lists_events(core, monkeypatch):
    from server import calendar_tool
    monkeypatch.setattr(calendar_tool, "check_calendar",
                        lambda url, day="today": {"ok": True, "day": "2026-09-27",
                                                 "events": [{"summary": "Team standup", "start": "10:00 AM", "all_day": False}]})
    c, store, llm, email = core
    llm.script.append(tool_call("check_calendar", {"day": "today"}))
    out = c.handle_turn("t1", "what's on my calendar today")
    assert "Team standup" in out["reply_text"]


def test_check_calendar_not_configured_is_graceful(core):
    c, store, llm, email = core
    llm.script.append(tool_call("check_calendar", {"day": "today"}))
    out = c.handle_turn("t1", "check my schedule")
    assert out["action"] == ACTION_NONE and "isn't connected" in out["reply_text"]


def test_save_and_read_notes_roundtrip(core):
    c, store, llm, email = core
    llm.script.append(tool_call("save_note", {"text": "buy milk tomorrow"}))
    out = c.handle_turn("t1", "remember that I need to buy milk tomorrow")
    assert "remember" in out["reply_text"].lower()
    llm.script.append(tool_call("read_notes"))
    out2 = c.handle_turn("t1", "what did I ask you to remember")
    assert "buy milk tomorrow" in out2["reply_text"]


def test_split_sentences():
    assert split_sentences("Hello! How are you? I'm fine.") == [
        "Hello!", "How are you?", "I'm fine."]
    assert split_sentences("") == []
    assert split_sentences("No punctuation here") == ["No punctuation here"]


def test_stream_emits_sentences_then_done(core):
    c, store, llm, email = core
    llm.script.append({"type": "text", "text": "Hello there! How can I help?"})
    events = list(c.handle_turn_stream("t1", "hi"))
    sentences = [e["text"] for e in events if e["type"] == "sentence"]
    done = [e for e in events if e["type"] == "done"]
    # instant filler first (masks the LLM round trip), then the real reply
    assert sentences[0] == instant_filler("hi")
    assert sentences[1:] == ["Hello there!", "How can I help?"]
    assert len(done) == 1 and done[0]["action"] == ACTION_NONE


def test_instant_filler_is_deterministic_and_short():
    # same text -> same filler; always short
    assert instant_filler("hello") == instant_filler("hello")
    assert len(instant_filler("hello").split()) <= 4


def test_stream_tool_call_gets_filler_first(core):
    c, store, llm, email = core
    llm.script.append(tool_call("get_datetime"))
    events = list(c.handle_turn_stream("t1", "what time is it"))
    # get_datetime is instant: no filler, just the answer sentences + done
    assert events[0]["type"] == "sentence"
    assert events[-1] == {"type": "done", "action": ACTION_NONE}


def test_stream_search_emits_filler_before_answer(core, monkeypatch):
    from server import websearch_tool
    monkeypatch.setattr(websearch_tool, "web_search",
                        lambda q, timeout=8.0: {"ok": True, "answer": "42.", "source": "", "related": []})
    c, store, llm, email = core
    llm.script.append(tool_call("web_search", {"query": "meaning of life"}))
    events = list(c.handle_turn_stream("t1", "what is the meaning of life"))
    sentences = [e["text"] for e in events if e["type"] == "sentence"]
    assert sentences[0] == instant_filler("what is the meaning of life")  # instant filler first
    assert len(sentences[1].split()) <= 5  # tool filler hides the network wait (language-aware)
    assert any("42" in s for s in sentences[2:])
    assert events[-1]["type"] == "done"


def test_stream_confirmation_yes_without_llm(core):
    c, store, llm, email = core
    # seed a pending confirmation directly (no LLM needed for yes/no)
    c._conversations["t1"] = {
        "history": [],
        "pending": {"command_id": 1,
                    "candidates": [{"name": "resume.pdf", "path": "/tmp/r.pdf"}]},
    }
    # laptop will never answer upload -> stream should still emit filler first
    events = list(c.handle_turn_stream("t1", "yes"))
    sentences = [e["text"] for e in events if e["type"] == "sentence"]
    assert sentences[0] == "Sending it now."
    assert events[-1]["type"] == "done"


def test_stream_text_reply_action(core):
    c, store, llm, email = core
    llm.script.append({"type": "text", "text": "Which file did you mean?"})
    events = list(c.handle_turn_stream("t1", "find my thing"))
    assert events[-1] == {"type": "done", "action": ACTION_NONE}
    assert any("Which file" in e["text"] for e in events if e["type"] == "sentence")
