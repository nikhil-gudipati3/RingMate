"""Google OAuth2 flow for RingMate: Calendar + Drive API access.

One-time setup: user visits /web/oauth/authorize, signs in with Google,
approves scopes. The refresh token is saved to google_token.json (never in
the ZIP). All subsequent API calls use the refresh token to get fresh access
tokens automatically.

Scopes:
- https://www.googleapis.com/auth/calendar (full calendar write)
- https://www.googleapis.com/auth/drive.readonly (search + download files)
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.parse

log = logging.getLogger("ringmate.google_oauth")

# Scopes: Calendar full access, Drive read-only.
SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive.readonly",
]

TOKEN_PATH = os.environ.get("GOOGLE_TOKEN_PATH", "google_token.json")

_auth_state: dict[str, str] = {}
_lock = threading.Lock()


def _client_config() -> dict:
    """Load client_id/secret from env or the downloaded JSON file."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    if client_id and client_secret:
        return {"client_id": client_id, "client_secret": client_secret}
    # Fall back to a client_secret JSON file if present.
    for name in ("client_secret.json", "google_client_secret.json"):
        if os.path.exists(name):
            try:
                with open(name, encoding="utf-8") as fh:
                    data = json.load(fh)
                cfg = data.get("web") or data.get("installed") or {}
                if cfg.get("client_id"):
                    return {"client_id": cfg["client_id"],
                            "client_secret": cfg.get("client_secret", "")}
            except (json.JSONDecodeError, OSError):
                pass
    return {}


def is_configured() -> bool:
    cfg = _client_config()
    return bool(cfg.get("client_id") and cfg.get("client_secret"))


def is_authorized() -> bool:
    """True if we have a refresh token on disk."""
    try:
        with open(TOKEN_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
        return bool(data.get("refresh_token"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return False


def get_authorize_url(redirect_uri: str) -> str:
    """Build the Google consent URL. Returns '' if not configured."""
    cfg = _client_config()
    if not cfg.get("client_id"):
        return ""
    import secrets
    state = secrets.token_urlsafe(16)
    with _lock:
        _auth_state[state] = redirect_uri
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/auth?" + urllib.parse.urlencode(params)


def exchange_code(code: str, redirect_uri: str) -> dict:
    """Exchange an auth code for tokens. Saves refresh token to disk."""
    import httpx
    cfg = _client_config()
    try:
        resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
            timeout=15.0,
        )
        data = resp.json()
    except Exception as exc:  # noqa: BLE001
        log.warning("Token exchange failed: %s", exc)
        return {"ok": False, "error": str(exc)}
    if "refresh_token" not in data:
        return {"ok": False,
                "error": data.get("error_description", "No refresh token returned")}
    # Save tokens.
    to_save = {
        "refresh_token": data["refresh_token"],
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "saved_at": time.strftime("%Y-%m-%d %H:%M"),
    }
    try:
        tmp = TOKEN_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(to_save, fh, indent=1)
        os.replace(tmp, TOKEN_PATH)
    except OSError as exc:
        return {"ok": False, "error": f"Could not save token: {exc}"}
    return {"ok": True}


def get_access_token() -> str:
    """Get a fresh access token using the saved refresh token. Returns '' on failure."""
    try:
        with open(TOKEN_PATH, encoding="utf-8") as fh:
            saved = json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return ""
    refresh = saved.get("refresh_token", "")
    if not refresh:
        return ""
    import httpx
    try:
        resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": saved["client_id"],
                "client_secret": saved["client_secret"],
                "refresh_token": refresh,
                "grant_type": "refresh_token",
            },
            timeout=15.0,
        )
        data = resp.json()
        return data.get("access_token", "")
    except Exception as exc:  # noqa: BLE001
        log.warning("Access token refresh failed: %s", exc)
        return ""


def revoke() -> bool:
    """Delete the saved token (disconnect Google)."""
    try:
        os.unlink(TOKEN_PATH)
        return True
    except OSError:
        return False
