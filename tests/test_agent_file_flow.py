"""Strict tests for the smarter RingMate agent: suggestions, ordinal picks,
read_file / list_files / calculate / delete_note flows, and the safe calculator.
"""
import threading
import time

import pytest

from server.agent_core import (
    ACTION_AWAITING_CONFIRMATION,
    ACTION_CLARIFY,
    ACTION_FILE_SENT,
    ACTION_LAPTOP_UNREACHABLE,
    ACTION_NONE,
    AgentCore,
    calculate_expression,
    pick_ordinal,
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
    store = QueueStore(str(tmp_path / "flow.db"), ttl_seconds=30)
    llm = FakeLLM([])
    email = FakeEmail()
    c = AgentCore(store, llm, email, user_email="me@example.com",
                  notes_path=str(tmp_path / "notes.json"),
                  wait_timeout=8, poll_interval=0.05)
    yield c, store, llm, email
    store.close()


def run_in_thread(fn):
    box = {}
    t = threading.Thread(target=lambda: box.update(fn()))
    t.start()
    return t, box


def laptop_answer(store, tool, status, data, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        cmd = store.poll_next()
        if cmd and cmd["tool"] == tool:
            store.complete(cmd["command_id"], status, data)
            return cmd
        time.sleep(0.05)
    raise TimeoutError(f"laptop never saw a {tool} command")


def _find(c, store, llm, query="resume", candidates=None, suggestions=None,
          status="found"):
    llm.script.append({"type": "tool_call", "name": "find_file",
                       "arguments": {"query": query, "sort": "recent"}})
    t, box = run_in_thread(lambda: c.handle_turn("call1", f"send me {query}"))
    laptop_answer(store, "find_file", status,
                  {"candidates": candidates or [], "suggestions": suggestions or []})
    t.join(timeout=15)
    assert not t.is_alive()
    return box


def _cands():
    now = time.time()
    return [
        {"name": "resume_v3.pdf", "path": "/tmp/resume_v3.pdf",
         "size": 1024, "mtime": now},
        {"name": "resume_v2.pdf", "path": "/tmp/resume_v2.pdf",
         "size": 900, "mtime": now - 86400},
    ]


# -- ordinal selection ------------------------------------------------------
def test_pick_ordinal():
    assert pick_ordinal("the first one") == 0
    assert pick_ordinal("second") == 1
    assert pick_ordinal("the 3rd one please") == 2
    assert pick_ordinal("the last one") == -1
    assert pick_ordinal("yes please") is None
    assert pick_ordinal("no") is None


def test_ordinal_selects_then_reconfirms_before_send(core, tmp_path):
    c, store, llm, email = core
    box = _find(c, store, llm, candidates=_cands())
    assert box["action"] == ACTION_AWAITING_CONFIRMATION
    # "the second one" picks resume_v2.pdf and re-asks for that exact file
    out = c.handle_turn("call1", "the second one")
    assert out["action"] == ACTION_AWAITING_CONFIRMATION
    assert "resume_v2.pdf" in out["reply_text"]
    assert email.sent == []  # NOT sent yet — exact file still unconfirmed
    # now yes -> sends the second file
    t, box2 = run_in_thread(lambda: c.handle_turn("call1", "yes"))
    fake = tmp_path / "resume_v2.pdf"
    fake.write_bytes(b"%PDF fake")
    laptop_answer(store, "upload_file", "done",
                  {"file_path": str(fake), "size": 9})
    t.join(timeout=15)
    assert not t.is_alive()
    assert box2["action"] == ACTION_FILE_SENT
    assert "resume_v2.pdf" in box2["reply_text"]
    assert email.sent[0]["attachment_path"] == str(fake)


def test_ordinal_out_of_range_reasks(core):
    c, store, llm, email = core
    _find(c, store, llm, candidates=_cands())
    out = c.handle_turn("call1", "the fifth one")
    assert out["action"] == ACTION_AWAITING_CONFIRMATION
    assert "yes or no" in out["reply_text"]


# -- suggestion flow: "did you mean ...?" -----------------------------------
def test_suggestion_asked_when_no_strong_match(core):
    c, store, llm, email = core
    box = _find(c, store, llm, query="resumex", candidates=[],
                suggestions=[{"name": "resume_v3.pdf", "path": "/tmp/resume_v3.pdf",
                              "size": 1, "mtime": time.time()}],
                status="not_found")
    assert box["action"] == ACTION_AWAITING_CONFIRMATION
    assert "Did you mean" in box["reply_text"]
    assert "resume_v3.pdf" in box["reply_text"]
    assert email.sent == []


def test_suggestion_yes_sends_suggested_file(core, tmp_path):
    c, store, llm, email = core
    _find(c, store, llm, query="resumex", candidates=[],
          suggestions=[{"name": "resume_v3.pdf", "path": "/tmp/resume_v3.pdf",
                        "size": 1, "mtime": time.time()}],
          status="not_found")
    t, box = run_in_thread(lambda: c.handle_turn("call1", "yes"))
    fake = tmp_path / "resume_v3.pdf"
    fake.write_bytes(b"%PDF fake")
    laptop_answer(store, "upload_file", "done",
                  {"file_path": str(fake), "size": 9})
    t.join(timeout=15)
    assert not t.is_alive()
    assert box["action"] == ACTION_FILE_SENT
    assert email.sent[0]["attachment_path"] == str(fake)


def test_no_match_no_suggestions_helpful_reply(core):
    c, store, llm, email = core
    box = _find(c, store, llm, query="zzz_nope", candidates=[],
                suggestions=[], status="not_found")
    assert box["action"] == ACTION_NONE
    assert "couldn't find anything like zzz_nope" in box["reply_text"]
    assert email.sent == []


def test_single_candidate_asks_is_this_the_file(core):
    c, store, llm, email = core
    box = _find(c, store, llm, candidates=_cands()[:1])
    assert box["action"] == ACTION_AWAITING_CONFIRMATION
    assert "Is this the file?" in box["reply_text"]


# -- read_file flow ----------------------------------------------------------
def _read(c, store, llm, query="meeting notes", candidates=None, suggestions=None,
          status="found"):
    llm.script.append({"type": "tool_call", "name": "read_file",
                       "arguments": {"query": query}})
    t, box = run_in_thread(lambda: c.handle_turn("call1", f"read {query}"))
    laptop_answer(store, "find_file", status,
                  {"candidates": candidates or [], "suggestions": suggestions or []})
    return t, box


def test_read_single_candidate_speaks_content(core):
    c, store, llm, email = core
    t, box = _read(c, store, llm, candidates=[
        {"name": "meeting_notes.txt", "path": "/tmp/meeting_notes.txt",
         "size": 50, "mtime": time.time()}])
    laptop_answer(store, "read_file", "done",
                  {"name": "meeting_notes.txt",
                   "content": "Buy milk. Call Prasad about the demo.",
                   "truncated": False})
    t.join(timeout=15)
    assert not t.is_alive()
    assert box["action"] == ACTION_NONE
    assert "meeting_notes.txt" in box["reply_text"]
    assert "Buy milk" in box["reply_text"]
    assert email.sent == []  # reading never emails


def test_read_multiple_asks_which_then_ordinal_reads(core):
    c, store, llm, email = core
    t, box = _read(c, store, llm, query="resume", candidates=_cands())
    t.join(timeout=15)
    assert box["action"] == ACTION_AWAITING_CONFIRMATION
    assert "first" in box["reply_text"] and "second" in box["reply_text"]
    t2, box2 = run_in_thread(lambda: c.handle_turn("call1", "the second one"))
    laptop_answer(store, "read_file", "done",
                  {"name": "resume_v2.pdf",
                   "content": "Second resume contents here.",
                   "truncated": False})
    t2.join(timeout=15)
    assert not t2.is_alive()
    assert "resume_v2.pdf" in box2["reply_text"]


def test_read_binary_file_graceful(core):
    c, store, llm, email = core
    t, box = _read(c, store, llm, candidates=[
        {"name": "photo.jpg", "path": "/tmp/photo.jpg",
         "size": 5000, "mtime": time.time()}])
    laptop_answer(store, "read_file", "error", {"error": "not a readable text file"})
    t.join(timeout=15)
    assert not t.is_alive()
    assert "couldn't read photo.jpg" in box["reply_text"]


# -- list_files flow ----------------------------------------------------------
def test_list_files_flow(core):
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "list_files",
                       "arguments": {"limit": 5}})
    t, box = run_in_thread(lambda: c.handle_turn("call1", "what are my recent files"))
    laptop_answer(store, "list_files", "done", {"files": [
        {"name": "budget.xlsx", "mtime": time.time()},
        {"name": "todo.md", "mtime": time.time() - 60}]})
    t.join(timeout=15)
    assert not t.is_alive()
    assert "budget.xlsx" in box["reply_text"]
    assert "todo.md" in box["reply_text"]


def test_list_files_laptop_offline(core):
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "list_files",
                       "arguments": {"limit": 5}})
    # never answer the laptop -> wait_timeout path (short timeout here)
    c.wait_timeout = 0.3
    out = c.handle_turn("call1", "what are my recent files")
    assert out["action"] == ACTION_LAPTOP_UNREACHABLE


# -- calculate ---------------------------------------------------------------
def test_calculate_expression_basics():
    assert calculate_expression("15 * 240 / 100") == (True, 36)
    assert calculate_expression("sqrt(144) + 5") == (True, 17)
    assert calculate_expression("2 ** 10") == (True, 1024)
    assert calculate_expression("7 / 2") == (True, 3.5)
    assert calculate_expression("(3 + 4) * 2") == (True, 14)


def test_calculate_rejects_injection():
    for evil in ["__import__('os').system('id')", "import os",
                 "open('/etc/passwd').read()", "().__class__",
                 "eval('1+1')", "[1,2,3][0]", "True and True"]:
        ok, _ = calculate_expression(evil)
        assert not ok, f"should reject: {evil}"


def test_calculate_division_by_zero():
    ok, _ = calculate_expression("7 / 0")
    assert not ok


def test_calculate_flow(core):
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "calculate",
                       "arguments": {"expression": "15 * 240 / 100"}})
    out = c.handle_turn("call1", "what is 15 percent of 240")
    assert out["action"] == ACTION_NONE
    assert "36" in out["reply_text"]


# -- delete_note --------------------------------------------------------------
def test_delete_note_flow(core):
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "save_note",
                       "arguments": {"text": "buy milk tomorrow"}})
    c.handle_turn("call1", "remember to buy milk tomorrow")
    llm.script.append({"type": "tool_call", "name": "delete_note",
                       "arguments": {"query": "milk"}})
    out = c.handle_turn("call1", "forget about the milk")
    assert "forgotten" in out["reply_text"]
    assert c.notes.list() == []


def test_delete_note_no_match(core):
    c, store, llm, email = core
    llm.script.append({"type": "tool_call", "name": "delete_note",
                       "arguments": {"query": "spaceship"}})
    out = c.handle_turn("call1", "forget the spaceship")
    assert "couldn't find a note" in out["reply_text"]


def test_delete_note_multiple_matches_asks(core):
    c, store, llm, email = core
    for text in ["buy milk", "buy bread"]:
        llm.script.append({"type": "tool_call", "name": "save_note",
                           "arguments": {"text": text}})
        c.handle_turn("call1", f"remember {text}")
    llm.script.append({"type": "tool_call", "name": "delete_note",
                       "arguments": {"query": "buy"}})
    out = c.handle_turn("call1", "forget the buy stuff")
    assert out["action"] == ACTION_CLARIFY
    assert len(c.notes.list()) == 2  # nothing deleted when ambiguous


# -- streaming pending filler --------------------------------------------------
def test_stream_pending_yes_yields_filler_first(core):
    c, store, llm, email = core
    box = _find(c, store, llm, candidates=_cands()[:1])
    assert box["action"] == ACTION_AWAITING_CONFIRMATION
    events = list(c.handle_turn_stream("call1", "yes"))
    # laptop never answers upload -> stream ends with unreachable; filler first.
    assert events[0] == {"type": "sentence", "text": "Sending it now."}
    assert events[-1]["type"] == "done"
