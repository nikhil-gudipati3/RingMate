"""Tests for server.agent_core — scripted LLM, real queue, simulated laptop."""
import threading
import time

import pytest

from server.agent_core import (
    ACTION_AWAITING_CONFIRMATION,
    ACTION_EMAIL_SENT,
    ACTION_FILE_SENT,
    ACTION_LAPTOP_UNREACHABLE,
    ACTION_NONE,
    AgentCore,
    classify_confirmation,
)
from server.queue_store import QueueStore


class FakeLLM:
    """Returns canned decisions in order, like a scripted actor."""

    def __init__(self, script):
        self.script = list(script)
        self.calls = []

    def complete(self, messages, tools):
        self.calls.append((messages, tools))
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
    store = QueueStore(str(tmp_path / "core.db"), ttl_seconds=30)
    llm = FakeLLM([])
    email = FakeEmail()
    c = AgentCore(store, llm, email, user_email="me@example.com",
                  wait_timeout=8, poll_interval=0.05)
    yield c, store, llm, email
    store.close()


def run_in_thread(fn):
    box = {}
    t = threading.Thread(target=lambda: box.update(fn()))
    t.start()
    return t, box


def laptop_answer(store, tool, status, data, timeout=10):
    """Simulate the laptop: claim the next `tool` command and complete it."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        cmd = store.poll_next()
        if cmd and cmd["tool"] == tool:
            store.complete(cmd["command_id"], status, data)
            return cmd
        time.sleep(0.05)
    raise TimeoutError(f"laptop never saw a {tool} command")


# -- confirmation classifier ------------------------------------------------
def test_classify_confirmation():
    assert classify_confirmation("yes") == "yes"
    assert classify_confirmation("Yeah, send it!") == "yes"
    assert classify_confirmation("no") == "no"
    assert classify_confirmation("no, don't send") == "no"
    assert classify_confirmation("hmm, maybe later") == "unclear"


# -- email flow --------------------------------------------------------------
def test_send_email_flow(core):
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "send_email",
                       "arguments": {"to": "prasad@example.com",
                                     "subject": "Demo", "body": "Ready"}})
    out = c.handle_turn("call1", "email Prasad that the demo is ready")
    assert out["action"] == ACTION_EMAIL_SENT
    assert "prasad@example.com" in out["reply_text"]
    assert len(email.sent) == 1
    assert email.sent[0]["to"] == "prasad@example.com"


def test_llm_text_passthrough(core):
    c, store, llm, email = core
    llm.script.append({"type": "text", "text": "Hello! How can I help?"})
    out = c.handle_turn("call1", "hi")
    assert out["reply_text"] == "Hello! How can I help?"
    assert out["action"] == ACTION_NONE


# -- file flow: find -> confirm yes -> upload -> email ------------------------
def _do_find(c, store, llm, mtime=None):
    llm.script.append({"type": "tool_call", "name": "find_file",
                       "arguments": {"query": "resume", "sort": "recent"}})
    t, box = run_in_thread(lambda: c.handle_turn("call1", "send me my latest resume"))
    laptop_answer(store, "find_file", "found", {"candidates": [
        {"name": "resume_v3.pdf", "path": "/tmp/resume_v3.pdf",
         "size": 1024, "mtime": mtime or time.time()}]})
    t.join(timeout=15)
    assert not t.is_alive()
    return box


def test_find_confirm_yes_sends_file(core, tmp_path):
    c, store, llm, email = core
    box = _do_find(c, store, llm)
    assert box["action"] == ACTION_AWAITING_CONFIRMATION
    assert "resume_v3.pdf" in box["reply_text"]

    # user says yes -> laptop uploads -> email with attachment
    t, box2 = run_in_thread(lambda: c.handle_turn("call1", "yes"))
    fake_pdf = tmp_path / "resume_v3.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4 fake")
    laptop_answer(store, "upload_file", "done",
                  {"file_path": str(fake_pdf), "size": 13})
    t.join(timeout=15)
    assert not t.is_alive()
    assert box2["action"] == ACTION_FILE_SENT
    assert "resume_v3.pdf" in box2["reply_text"]
    assert len(email.sent) == 1
    assert email.sent[0]["to"] == "me@example.com"  # user's own inbox
    assert email.sent[0]["attachment_path"] == str(fake_pdf)


def test_confirm_no_sends_nothing(core):
    c, store, llm, email = core
    _do_find(c, store, llm)
    out = c.handle_turn("call1", "no, that's the wrong one")
    assert "won't do that" in out["reply_text"]
    assert email.sent == []
    # pending cleared: a new "yes" must not trigger a send
    out2 = c.handle_turn("call1", "yes")
    assert email.sent == []


def test_find_file_not_found(core):
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "find_file",
                       "arguments": {"query": "unicorn"}})
    t, box = run_in_thread(lambda: c.handle_turn("call1", "send me the unicorn file"))
    laptop_answer(store, "find_file", "not_found", {})
    t.join(timeout=15)
    assert "couldn't find" in box["reply_text"]


def test_find_file_laptop_offline(core):
    c, store, llm, email = core
    c.wait_timeout = 1.0
    llm.script.append({"type": "tool_call", "name": "find_file",
                       "arguments": {"query": "resume"}})
    out = c.handle_turn("call1", "send me my resume")  # no laptop answers
    assert out["action"] == ACTION_LAPTOP_UNREACHABLE
    assert "laptop" in out["reply_text"]


def test_send_file_without_pending_is_refused(core):
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "send_file",
                       "arguments": {"command_id": 999}})
    out = c.handle_turn("call1", "send it")
    assert email.sent == []
    assert "confirmation" in out["reply_text"]


# -- v3.1: path hints -----------------------------------------------------------
def _do_find_with_laptop(core, store, llm, query, status, data):
    llm.script.append({"type": "tool_call", "name": "find_file",
                       "arguments": {"query": query}})
    t, box = run_in_thread(lambda: core.handle_turn("call1", query))
    laptop_answer(store, "find_file", status, data)
    t.join(timeout=15)
    assert not t.is_alive()
    return box


def test_find_file_path_not_allowed_explains(core):
    c, store, llm, email = core
    box = _do_find_with_laptop(
        c, store, llm, "send me a.txt from D:\\Nope\\Folder",
        "path_not_allowed", {"path": "D:\\Nope\\Folder"})
    assert box["action"] == ACTION_NONE
    assert "isn't in my allowed folders" in box["reply_text"]
    assert "agent_config.json" in box["reply_text"]


def test_find_file_dir_listing_names_files(core):
    c, store, llm, email = core
    box = _do_find_with_laptop(
        c, store, llm, "what files are in D:\\Work",
        "dir_listing", {"path": "D:\\Work", "files": [
            {"name": "a.txt", "path": "D:\\Work\\a.txt",
             "size": 10, "mtime": time.time()},
            {"name": "b.txt", "path": "D:\\Work\\b.txt",
             "size": 10, "mtime": time.time()},
        ]})
    assert box["action"] == ACTION_AWAITING_CONFIRMATION
    assert "a.txt" in box["reply_text"] and "b.txt" in box["reply_text"]
    # user can pick "the second one" from the listing
    out = c.handle_turn("call1", "the second one")
    assert "b.txt" in out["reply_text"]


def test_find_file_dir_listing_empty(core):
    c, store, llm, email = core
    box = _do_find_with_laptop(
        c, store, llm, "what files are in D:\\Empty",
        "dir_listing", {"path": "D:\\Empty", "files": []})
    assert box["action"] == ACTION_NONE
    assert "empty" in box["reply_text"]


def test_web_search_followup_repairs_dropped_city(core, monkeypatch):
    """The model sometimes emits query="weather" for "what about dallas".

    The repair step rebuilds the query from the user's own words instead of
    silently answering for the IP location (Hyderabad)."""
    from server import websearch_tool

    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "web_search",
                       "arguments": {"query": "weather"}})

    def fake_wttr(loc, timeout=8.0):
        if loc == "dallas":
            return {"ok": True,
                    "answer": "In Dallas, United States right now: sunny, 28°C.",
                    "source": "wttr.in", "related": []}
        return None

    monkeypatch.setattr(websearch_tool, "_wttr_search", fake_wttr)
    out = c.handle_turn("call1", "what about dallas")
    assert "Dallas" in out["reply_text"]


# -- v3.1 hotfix 4: fast send path -------------------------------------------
def test_send_intent_single_match_asks_for_confirmation(core, tmp_path):
    """purpose='send' + exactly one strong match -> asks 'is this the file?'
    (the old instant-send fast path was removed for reliability)."""
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "find_file",
                       "arguments": {"query": "resume", "purpose": "send"}})
    t, box = run_in_thread(lambda: c.handle_turn("call1", "send me my resume"))
    laptop_answer(store, "find_file", "found", {"candidates": [
        {"name": "resume.pdf", "path": "/tmp/resume.pdf",
         "size": 1024, "mtime": time.time()}]})
    t.join(timeout=15)
    assert not t.is_alive()
    assert box["action"] == ACTION_AWAITING_CONFIRMATION
    assert "Is this the file?" in box["reply_text"]
    assert len(email.sent) == 0  # nothing sent until user confirms


def test_send_intent_multiple_matches_still_asks(core):
    """purpose='send' + several matches -> still asks the user to pick one."""
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "find_file",
                       "arguments": {"query": "resume", "purpose": "send"}})
    t, box = run_in_thread(lambda: c.handle_turn("call1", "send me my resume"))
    laptop_answer(store, "find_file", "found", {"candidates": [
        {"name": "resume_2024.pdf", "path": "/tmp/a", "size": 1, "mtime": time.time()},
        {"name": "resume_2025.pdf", "path": "/tmp/b", "size": 1, "mtime": time.time()}]})
    t.join(timeout=15)
    assert not t.is_alive()
    assert box["action"] == ACTION_AWAITING_CONFIRMATION
    assert email.sent == []


def test_send_email_to_any_address(core):
    """'send hi to xyz@gmail.com' -> plain email straight to that address."""
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "send_email",
                       "arguments": {"to": "xyz@gmail.com",
                                     "subject": "Hi", "body": "hi"}})
    out = c.handle_turn("call1", "send hi to xyz@gmail.com")
    assert out["action"] == ACTION_EMAIL_SENT
    assert len(email.sent) == 1
    assert email.sent[0]["to"] == "xyz@gmail.com"
    assert email.sent[0]["body"] == "hi"


# -- v3.1 hotfix 5: file recipient -------------------------------------------
def test_send_file_to_named_recipient(core, tmp_path):
    """'send my resume to X@gmail.com' -> asks confirmation, then emails THAT address."""
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "find_file",
                       "arguments": {"query": "resume", "purpose": "send",
                                     "to": "gbprasad903@gmail.com"}})
    t, box = run_in_thread(lambda: c.handle_turn("call1", "send my resume to gbprasad903@gmail.com"))
    laptop_answer(store, "find_file", "found", {"candidates": [
        {"name": "resume.pdf", "path": "/tmp/resume.pdf",
         "size": 1024, "mtime": time.time()}]})
    t.join(timeout=15)
    assert not t.is_alive()
    # Now asks for confirmation (no more instant fast path)
    assert box["action"] == ACTION_AWAITING_CONFIRMATION
    assert "Is this the file?" in box["reply_text"]
    assert len(email.sent) == 0
    # User confirms -> it sends to the named recipient
    llm.script.append({"type": "tool_call", "name": "send_file", "arguments": {}})
    t2, box2 = run_in_thread(lambda: c.handle_turn("call1", "yes"))
    fake_pdf = tmp_path / "resume.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4 fake")
    laptop_answer(store, "upload_file", "done",
                  {"file_path": str(fake_pdf), "size": 13})
    t2.join(timeout=15)
    assert not t2.is_alive()
    assert box2["action"] == ACTION_FILE_SENT
    assert "gbprasad903@gmail.com" in box2["reply_text"]
    assert len(email.sent) == 1
    assert email.sent[0]["to"] == "gbprasad903@gmail.com"


def test_send_recipient_preserved_through_ordinal_pick(core, tmp_path):
    """Recipient survives the 'the second one' -> yes flow."""
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "find_file",
                       "arguments": {"query": "resume", "purpose": "send",
                                     "to": "friend@example.com"}})
    t, box = run_in_thread(lambda: c.handle_turn("call1", "send my resume to friend@example.com"))
    laptop_answer(store, "find_file", "found", {"candidates": [
        {"name": "resume_2024.pdf", "path": "/tmp/a", "size": 1, "mtime": time.time()},
        {"name": "resume_2025.pdf", "path": "/tmp/b", "size": 1, "mtime": time.time()}]})
    t.join(timeout=15)
    assert box["action"] == ACTION_AWAITING_CONFIRMATION

    t2, box2 = run_in_thread(lambda: c.handle_turn("call1", "the second one"))
    t2.join(timeout=15)
    assert "resume_2025.pdf" in box2["reply_text"]

    t3, box3 = run_in_thread(lambda: c.handle_turn("call1", "yes"))
    fake_pdf = tmp_path / "resume_2025.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4 fake")
    laptop_answer(store, "upload_file", "done",
                  {"file_path": str(fake_pdf), "size": 13})
    t3.join(timeout=15)
    assert not t3.is_alive()
    assert box3["action"] == ACTION_FILE_SENT
    assert len(email.sent) == 1
    assert email.sent[0]["to"] == "friend@example.com"


# -- v4.2.0: knowledge-first + junk filter ------------------------------------

def test_is_junk_answer_detects_irrelevant_result():
    from server.agent_core import _is_junk_answer
    # The "what is cricket" embarrassment: no query keyword in the answer.
    assert _is_junk_answer(
        "whats the score of virat kohli in yesterday match",
        "Cricket is a bat-and-ball game played between two teams.")
    assert _is_junk_answer(
        "who won the 2023 cricket world cup",
        "Paris is the capital of France.")
    # Relevant answers pass.
    assert not _is_junk_answer(
        "who is the prime minister of india",
        "Narendra Modi is the Prime Minister of India since 2014.")
    assert not _is_junk_answer(
        "capital of france", "Paris is the capital of France.")
    # No significant keywords -> never junk (can't judge).
    assert not _is_junk_answer("what is it", "Something unrelated here.")


def test_web_search_drops_junk_result(core, monkeypatch):
    """An irrelevant search result is never read aloud."""
    from server import websearch_tool

    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "web_search",
                       "arguments": {"query": "virat kohli score yesterday match"}})
    monkeypatch.setattr(
        websearch_tool, "web_search",
        lambda q, timeout=8.0: {"ok": True,
                               "answer": ("Cricket is a bat-and-ball game played "
                                          "between two teams of eleven players "
                                          "on a field at the centre of which is "
                                          "a 22-yard pitch with a wicket at each "
                                          "end, each comprising two bails "
                                          "balanced on three stumps."),
                               "source": "Wikipedia", "related": []})
    out = c.handle_turn("call1", "what was virat kohlis score yesterday")
    assert "cricket is a bat-and-ball" not in out["reply_text"].lower()
    assert "couldn't find a clear answer" in out["reply_text"]


def test_web_search_place_mismatch_clarifies(core, monkeypatch):
    """Garbled place -> 'Did you mean Hyderabad?' instead of a wrong answer."""
    from server import websearch_tool

    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "web_search",
                       "arguments": {"query": "weather in buddlu"}})
    monkeypatch.setattr(
        websearch_tool, "web_search",
        lambda q, timeout=8.0: {"ok": False, "error": "place_mismatch",
                               "requested": "buddlu", "resolved": "Budaun"})
    monkeypatch.setenv("USER_HOME_CITY", "Hyderabad")
    out = c.handle_turn("call1", "whats the weather in buddlu")
    assert "Did you mean Hyderabad?" in out["reply_text"]
    assert "Budaun" not in out["reply_text"]
