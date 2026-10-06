"""Integration tests for the laptop agent against a real FastAPI TestClient.

requests.get/post are monkeypatched to route into the TestClient, so the
agent exercises the true server endpoints (/agent/poll, /agent/result,
/agent/upload) without a live network server.
"""
import json

import pytest
from fastapi.testclient import TestClient

from laptop_agent import agent as agent_mod


def _env(monkeypatch, tmp_path):
    for k, v in {
        "OMNIROUTE_API_KEY": "orkey",
        "OMNIROUTE_BASE_URL": "https://example.com/v1",
        "OMNIROUTE_MODEL": "test-model",
        "GMAIL_USER": "me@example.com",
        "GMAIL_APP_PASSWORD": "apppass",
        "USER_EMAIL": "me@example.com",
        "DB_PATH": str(tmp_path / "app.db"),
    }.items():
        monkeypatch.setenv(k, v)


@pytest.fixture
def client(monkeypatch, tmp_path):
    _env(monkeypatch, tmp_path)
    from server.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def server_url(monkeypatch, client):
    """Monkeypatch requests so the agent talks to the TestClient."""
    import requests as requests_mod

    base = "http://testserver"

    def fake_get(url, **kwargs):
        assert url.startswith(base), url
        return client.get(url[len(base):])

    def fake_post(url, **kwargs):
        assert url.startswith(base), url
        return client.post(
            url[len(base):],
            data=kwargs.get("data"),
            files=kwargs.get("files"),
            json=kwargs.get("json"),
        )

    monkeypatch.setattr(requests_mod, "get", fake_get)
    monkeypatch.setattr(requests_mod, "post", fake_post)
    return base


def _config(server_url, tmp_path, **over):
    docs = tmp_path / "docs"
    docs.mkdir(exist_ok=True)
    cfg = {
        "server_url": server_url,
        "allowed_folders": [str(docs)],
        "poll_seconds": 0.01,
        "max_file_mb": 20,
    }
    cfg.update(over)
    return cfg, docs


def _store():
    from server.main import app
    return app.state.store


def _enqueue(client, tool, args):
    r = client.post("/command", json={"tool": tool, "args": args})
    assert r.status_code == 200
    return r.json()["command_id"]


def test_run_once_idle(server_url, tmp_path):
    cfg, _docs = _config(server_url, tmp_path)
    assert agent_mod.run_once(cfg) == "idle"


def test_find_file_found(server_url, tmp_path, client):
    cfg, docs = _config(server_url, tmp_path)
    (docs / "resume_v3.pdf").write_bytes(b"fake-pdf-bytes")
    (docs / "old_resume.pdf").write_bytes(b"older")

    cmd_id = _enqueue(client, "find_file",
                      {"query": "resume", "file_type": "pdf", "sort": "recent"})

    assert agent_mod.run_once(cfg) == "handled:find_file"
    result = _store().get_result(cmd_id)
    assert result["status"] == "found"
    candidates = result["result"]["candidates"]
    assert candidates[0]["name"] == "resume_v3.pdf"
    assert candidates[0]["path"].endswith("resume_v3.pdf")  # path included (server-side)
    assert candidates[0]["size"] == len(b"fake-pdf-bytes")
    # queue is now empty
    assert agent_mod.run_once(cfg) == "idle"


def test_find_file_not_found(server_url, tmp_path, client):
    cfg, _docs = _config(server_url, tmp_path)
    cmd_id = _enqueue(client, "find_file", {"query": "zzz_no_such_file"})
    assert agent_mod.run_once(cfg) == "handled:find_file"
    result = _store().get_result(cmd_id)
    assert result["status"] == "not_found"
    assert result["result"]["candidates"] == []


def test_upload_file_success(server_url, tmp_path, client):
    cfg, docs = _config(server_url, tmp_path)
    payload = b"%PDF-1.4 fake resume content"
    target = docs / "resume_v3.pdf"
    target.write_bytes(payload)

    cmd_id = _enqueue(client, "upload_file",
                      {"path": str(target), "source_command_id": 7})
    assert agent_mod.run_once(cfg) == "handled:upload_file"

    result = _store().get_result(cmd_id)
    assert result["status"] == "done"  # server marks complete on upload
    saved = result["result"]["file_path"]
    with open(saved, "rb") as fh:
        assert fh.read() == payload


def test_upload_file_blocked_path(server_url, tmp_path, client):
    cfg, _docs = _config(server_url, tmp_path)
    cmd_id = _enqueue(client, "upload_file",
                      {"path": "/etc/hostname", "source_command_id": 1})
    outcome = agent_mod.run_once(cfg)
    assert outcome.startswith("error:")
    result = _store().get_result(cmd_id)
    assert result["status"] == "error"
    assert "outside allowed folders" in result["result"]["error"]


def test_upload_file_oversize_blocked(server_url, tmp_path, client):
    cfg, docs = _config(server_url, tmp_path, max_file_mb=0)
    target = docs / "big.pdf"
    target.write_bytes(b"x" * 100)
    cmd_id = _enqueue(client, "upload_file",
                      {"path": str(target), "source_command_id": 1})
    assert agent_mod.run_once(cfg).startswith("error:")
    assert _store().get_result(cmd_id)["status"] == "error"


def test_unknown_tool_reported(server_url, tmp_path, client):
    cfg, _docs = _config(server_url, tmp_path)
    cmd_id = _enqueue(client, "brew_coffee", {})
    assert agent_mod.run_once(cfg).startswith("error:unknown-tool")
    assert _store().get_result(cmd_id)["status"] == "error"


def test_server_down_returns_error_without_raising(tmp_path):
    # No monkeypatching here: real requests against a dead port.
    cfg = {
        "server_url": "http://127.0.0.1:9",
        "allowed_folders": [str(tmp_path)],
        "poll_seconds": 0.01,
        "max_file_mb": 20,
    }
    outcome = agent_mod.run_once(cfg)
    assert outcome.startswith("error:")


def test_load_config_defaults(tmp_path):
    cfg = agent_mod.load_config(tmp_path / "missing.json")
    assert cfg["server_url"] == "http://127.0.0.1:8000"
    assert cfg["allowed_folders"] == []
    assert cfg["poll_seconds"] == 3
    assert cfg["max_file_mb"] == 20


def test_load_config_file(tmp_path):
    p = tmp_path / "agent_config.json"
    p.write_text(json.dumps({
        "server_url": "http://example.com:9000/",
        "allowed_folders": ["/tmp/docs"],
        "poll_seconds": 5,
        "max_file_mb": 50,
    }))
    cfg = agent_mod.load_config(p)
    assert cfg["server_url"] == "http://example.com:9000"  # trailing slash stripped
    assert cfg["allowed_folders"] == ["/tmp/docs"]
    assert cfg["poll_seconds"] == 5
    assert cfg["max_file_mb"] == 50


def test_find_file_path_not_allowed(server_url, tmp_path, client):
    cfg, _docs = _config(server_url, tmp_path)
    cmd_id = _enqueue(client, "find_file",
                      {"query": "send me a.txt from D:\\Nope\\Folder"})
    assert agent_mod.run_once(cfg) == "handled:find_file"
    result = _store().get_result(cmd_id)
    assert result["status"] == "path_not_allowed"
    assert "D:\\Nope\\Folder" in result["result"]["path"]


def test_find_file_dir_listing(server_url, tmp_path, client):
    cfg, docs = _config(server_url, tmp_path)
    (docs / "alpha.txt").write_bytes(b"a")
    (docs / "beta.txt").write_bytes(b"b")
    cmd_id = _enqueue(client, "find_file",
                      {"query": f"what files are in {docs}"})
    assert agent_mod.run_once(cfg) == "handled:find_file"
    result = _store().get_result(cmd_id)
    assert result["status"] == "dir_listing"
    names = [f["name"] for f in result["result"]["files"]]
    assert names == ["alpha.txt", "beta.txt"]


def test_find_file_exact_path_allowed(server_url, tmp_path, client):
    cfg, docs = _config(server_url, tmp_path)
    target = docs / "exact.txt"
    target.write_bytes(b"data")
    cmd_id = _enqueue(client, "find_file",
                      {"query": f"send {target} to my mail"})
    assert agent_mod.run_once(cfg) == "handled:find_file"
    result = _store().get_result(cmd_id)
    assert result["status"] == "found"
    assert result["result"]["candidates"][0]["name"] == "exact.txt"
