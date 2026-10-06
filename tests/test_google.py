"""Tests for Google OAuth, Calendar, and Drive modules."""
import json
import os
import tempfile

import pytest

from server import google_oauth


def test_oauth_not_configured_by_default(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    # No client_secret.json in cwd during tests.
    assert google_oauth.is_configured() is False


def test_oauth_configured_via_env(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-secret")
    assert google_oauth.is_configured() is True


def test_oauth_not_authorized_by_default(monkeypatch, tmp_path):
    monkeypatch.setenv("GOOGLE_TOKEN_PATH", str(tmp_path / "nope.json"))
    # Need to re-read the env var — module reads it at import. Patch directly.
    monkeypatch.setattr(google_oauth, "TOKEN_PATH", str(tmp_path / "nope.json"))
    assert google_oauth.is_authorized() is False


def test_oauth_authorized_with_token(monkeypatch, tmp_path):
    token_file = tmp_path / "token.json"
    token_file.write_text(json.dumps({"refresh_token": "fake-refresh"}))
    monkeypatch.setattr(google_oauth, "TOKEN_PATH", str(token_file))
    assert google_oauth.is_authorized() is True


def test_oauth_corrupt_token_treated_as_unauthorized(monkeypatch, tmp_path):
    token_file = tmp_path / "token.json"
    token_file.write_text("not json {{{")
    monkeypatch.setattr(google_oauth, "TOKEN_PATH", str(token_file))
    assert google_oauth.is_authorized() is False


def test_authorize_url_builds(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-secret")
    url = google_oauth.get_authorize_url("http://localhost:8000/web/oauth/callback")
    assert url.startswith("https://accounts.google.com/o/oauth2/auth?")
    assert "client_id=test-id" in url
    assert "scope=" in url
    assert "calendar" in url


def test_authorize_url_empty_when_not_configured(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    assert google_oauth.get_authorize_url("http://x/") == ""


def test_calendar_returns_error_when_not_connected(monkeypatch, tmp_path):
    from server import google_calendar
    monkeypatch.setattr(google_oauth, "TOKEN_PATH", str(tmp_path / "nope.json"))
    res = google_calendar.list_events("today")
    assert res["ok"] is False
    assert "not connected" in res["error"].lower()


def test_drive_returns_error_when_not_connected(monkeypatch, tmp_path):
    from server import google_drive
    monkeypatch.setattr(google_oauth, "TOKEN_PATH", str(tmp_path / "nope.json"))
    res = google_drive.search("resume")
    assert res["ok"] is False
    assert "not connected" in res["error"].lower()


def test_calendar_rfc3339_format():
    from server.google_calendar import _to_rfc3339
    out = _to_rfc3339("today", "18:30")
    assert "T18:30:00" in out
    assert out[10] == "T"
