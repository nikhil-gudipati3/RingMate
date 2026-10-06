"""Tests for server.web_routes — /web/talk and /console/events."""
import pytest
from fastapi.testclient import TestClient


def _env(monkeypatch, tmp_path):
    for k, v in {
        "OMNIROUTE_API_KEY": "orkey",
        "OMNIROUTE_BASE_URL": "https://example.com/v1",
        "OMNIROUTE_MODEL": "test-model",
        "GMAIL_USER": "me@example.com",
        "GMAIL_APP_PASSWORD": "apppass",
        "USER_EMAIL": "me@example.com",
        "DB_PATH": str(tmp_path / "web.db"),
    }.items():
        monkeypatch.setenv(k, v)


class FakeCore:
    def __init__(self):
        self.turns = []

    def handle_turn(self, call_id, text):
        self.turns.append((call_id, text))
        return {"reply_text": f"echo:{text}", "action": "none"}


@pytest.fixture
def client(monkeypatch, tmp_path):
    _env(monkeypatch, tmp_path)
    from server.main import app
    with TestClient(app) as c:
        app.state.agent_core = FakeCore()
        yield c


def test_web_talk_echoes(client):
    r = client.post("/web/talk", json={"text": "hello", "call_id": "sess1"})
    assert r.status_code == 200
    body = r.json()
    assert body["reply_text"] == "echo:hello"
    assert body["call_id"] == "sess1"


def test_web_talk_empty_text(client):
    r = client.post("/web/talk", json={"text": "   "})
    assert "didn't catch" in r.json()["reply_text"]


def test_web_talk_multiturn_same_session(client):
    from server.main import app
    client.post("/web/talk", json={"text": "one", "call_id": "s9"})
    client.post("/web/talk", json={"text": "two", "call_id": "s9"})
    turns = app.state.agent_core.turns
    assert [t[0] for t in turns] == ["s9", "s9"]


def test_console_events_shape(client):
    r = client.get("/console/events")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"commands", "log", "status"}
    assert set(body["status"]) == {"laptop_last_seen", "model", "provider",
                                     "queue_pending", "last_latency_s", "server_time"}
