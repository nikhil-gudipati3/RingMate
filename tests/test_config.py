"""Tests for server.config — fail-fast settings loading."""
import pytest

from server.config import ConfigError, Settings


def _set_env(monkeypatch, tmp_path, **overrides):
    base = {
        "OMNIROUTE_API_KEY": "orkey",
        "OMNIROUTE_BASE_URL": "https://example.com/v1",
        "OMNIROUTE_MODEL": "test-model",
        "GMAIL_USER": "me@example.com",
        "GMAIL_APP_PASSWORD": "apppass",
        "USER_EMAIL": "me@example.com",
        "DB_PATH": str(tmp_path / "test.db"),
    }
    base.update(overrides)
    for k, v in base.items():
        monkeypatch.setenv(k, v)


def test_load_ok(monkeypatch, tmp_path):
    _set_env(monkeypatch, tmp_path)
    s = Settings.load()
    assert s.omniroute_api_key == "orkey"
    assert s.laptop_poll_seconds == 3
    assert s.command_ttl_seconds == 120


def test_missing_required_names_the_variable(monkeypatch, tmp_path):
    _set_env(monkeypatch, tmp_path)
    monkeypatch.delenv("GMAIL_APP_PASSWORD")
    with pytest.raises(ConfigError) as exc:
        Settings.load()
    assert "GMAIL_APP_PASSWORD" in str(exc.value)


def test_optional_defaults(monkeypatch, tmp_path):
    _set_env(monkeypatch, tmp_path)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    s = Settings.load()
    assert s.gemini_api_key == ""


def test_bad_number_rejected(monkeypatch, tmp_path):
    _set_env(monkeypatch, tmp_path, LAPTOP_POLL_SECONDS="notanumber")
    with pytest.raises(ConfigError):
        Settings.load()
