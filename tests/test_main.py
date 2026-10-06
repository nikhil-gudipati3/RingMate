"""Smoke test: the FastAPI app boots and /health answers."""
from fastapi.testclient import TestClient


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


def test_health(monkeypatch, tmp_path):
    _env(monkeypatch, tmp_path)
    from server.main import app
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
