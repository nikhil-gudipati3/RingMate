"""Tests for server.queue_store — the command queue + action log."""
import time

import pytest

from server import queue_store
from server.queue_store import QueueStore


@pytest.fixture
def store(tmp_path):
    s = QueueStore(str(tmp_path / "q.db"), ttl_seconds=120)
    yield s
    s.close()


def test_enqueue_poll_complete_cycle(store):
    cid = store.enqueue("find_file", {"query": "resume"}, call_id="call1")
    assert isinstance(cid, int)

    cmd = store.poll_next()
    assert cmd is not None
    assert cmd["command_id"] == cid
    assert cmd["tool"] == "find_file"
    assert cmd["args"] == {"query": "resume"}

    # claimed -> not returned again
    assert store.poll_next() is None

    store.complete(cid, queue_store.FOUND, {"files": ["resume_v3.pdf"]})
    res = store.get_result(cid)
    assert res["status"] == queue_store.FOUND
    assert res["result"] == {"files": ["resume_v3.pdf"]}


def test_poll_empty_returns_none(store):
    assert store.poll_next() is None


def test_oldest_first(store):
    c1 = store.enqueue("find_file", {"query": "a"})
    c2 = store.enqueue("find_file", {"query": "b"})
    assert store.poll_next()["command_id"] == c1
    assert store.poll_next()["command_id"] == c2


def test_expiry_sweep(store, tmp_path):
    short = QueueStore(str(tmp_path / "short.db"), ttl_seconds=0.05)
    try:
        cid = short.enqueue("find_file", {"query": "x"})
        time.sleep(0.1)
        assert short.poll_next() is None  # expired, not claimable
        assert short.expire_sweep() == 1
        res = short.get_result(cid)
        assert res["status"] == queue_store.EXPIRED
    finally:
        short.close()


def test_action_log_records_everything(store):
    cid = store.enqueue("send_email", {"to": "a@b.com"}, call_id="c9")
    store.poll_next()
    store.complete(cid, queue_store.DONE)
    log = store.recent_log(limit=10)
    actions = [e["action"] for e in log]
    assert "enqueue" in actions and "claimed" in actions and "complete" in actions


def test_recent_commands(store):
    store.enqueue("find_file", {"query": "resume"})
    cmds = store.recent_commands()
    assert len(cmds) == 1
    assert cmds[0]["tool"] == "find_file"
    assert cmds[0]["status"] == queue_store.PENDING
