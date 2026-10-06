"""Tests for the persistent memory system (MemoryStore + agent tools)."""
import os
import tempfile

import pytest

from server.memory_tool import MemoryStore


@pytest.fixture
def mem_path():
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    os.unlink(path)
    yield path
    if os.path.exists(path):
        os.unlink(path)


def test_remember_and_recall(mem_path):
    m = MemoryStore(mem_path)
    res = m.remember("user_name", "Nikhil", "identity")
    assert res["ok"] is True
    res = m.recall("user_name")
    assert res["ok"] is True
    assert res["fact"]["value"] == "Nikhil"
    assert res["fact"]["category"] == "identity"


def test_recall_all(mem_path):
    m = MemoryStore(mem_path)
    m.remember("user_name", "Nikhil")
    m.remember("favorite_food", "Biryani", "preference")
    res = m.recall()
    assert res["ok"] is True
    assert "user_name" in res["facts"]
    assert "favorite_food" in res["facts"]


def test_recall_missing(mem_path):
    m = MemoryStore(mem_path)
    res = m.recall("nonexistent")
    assert res["ok"] is False


def test_forget(mem_path):
    m = MemoryStore(mem_path)
    m.remember("temp", "value")
    assert m.forget("temp")["ok"] is True
    assert m.recall("temp")["ok"] is False
    assert m.forget("temp")["ok"] is False


def test_corrupt_file_treated_as_empty(mem_path):
    with open(mem_path, "w") as f:
        f.write("not valid json {{{")
    m = MemoryStore(mem_path)
    res = m.recall()
    assert res["ok"] is True
    assert res["facts"] == {}


def test_empty_key_value_rejected(mem_path):
    m = MemoryStore(mem_path)
    assert m.remember("", "value")["ok"] is False
    assert m.remember("key", "")["ok"] is False


def test_get_context_string(mem_path):
    m = MemoryStore(mem_path)
    assert m.get_context_string() == ""
    m.remember("user_name", "Nikhil")
    ctx = m.get_context_string()
    assert "Nikhil" in ctx
    assert "user name" in ctx


def test_key_normalization(mem_path):
    m = MemoryStore(mem_path)
    m.remember("User Name", "Nikhil")
    res = m.recall("user_name")
    assert res["ok"] is True
    assert res["fact"]["value"] == "Nikhil"
