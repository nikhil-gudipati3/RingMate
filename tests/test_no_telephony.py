"""Telephony boundary tests.

POLICY CHANGE — 2026-10-05 (deliberate, not accidental):
Nikhil's professor now requires REAL phone calling as RingMate's core
differentiator, which supersedes the 2026-09-30 decision that removed all
telephony (Plivo). The sanctioned path is Exotel AgentStream, implemented
server-side in server/exotel_voice.py:

  * ALLOWED: Exotel code, but ONLY on the server (server/, tests/, docs/).
    Exotel credentials must never reach the browser.
  * BANNED FOREVER: Plivo (dead provider — Verified Caller ID is US-only;
    reintroducing it would fail the same way).
  * ALLOWED: ngrok references (needed to expose the AgentStream WSS URL;
    previously banned only because it existed for Plivo webhooks).

These tests pin the new boundary: Exotel may exist server-side, Plivo may
not exist anywhere, and no telephony secret may leak to browser code.
"""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Plivo is gone for good — any mention outside this file and BUILD_LOG.md
# (the historical record) fails the suite.
BANNED_PLIVO = re.compile(r"plivo", re.IGNORECASE)

# Secrets that must never appear in browser-served files (web/) or be sent
# to the browser by /web/voice_config. (Values themselves live only in .env,
# which is never scanned here and never shipped.)
BANNED_BROWSER_SECRETS = re.compile(
    r"EXOTEL_API_KEY|EXOTEL_API_TOKEN|api\.exotel\.com.*key|"
    r"wss://[^\"' ]*:[^\"' ]*@",
    re.IGNORECASE,
)

SKIP_DIRS = {"__pycache__", ".git"}
# BUILD_LOG.md is the historical record; this file documents the policy.
SKIP_FILES = {"BUILD_LOG.md", "test_no_telephony.py"}

SCANNED_EXTS = {".py", ".js", ".html", ".css", ".md", ".txt", ".bat"}


def _scanned_files():
    for path in REPO.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in SCANNED_EXTS:
            continue
        if path.name in SKIP_FILES:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path


def _all_route_paths():
    """All registered route paths, unwrapping _IncludedRouter entries."""
    import server.main as main

    paths = set()

    def _walk(routes):
        for r in routes:
            p = getattr(r, "path", "")
            if p:
                paths.add(p)
            orig = getattr(r, "original_router", None)
            if orig is not None:
                _walk(getattr(orig, "routes", []))

    _walk(main.app.routes)
    return paths


def test_no_plivo_references_anywhere():
    offenders = []
    for path in _scanned_files():
        try:
            text = path.read_text(encoding="utf-8", errors="strict")
        except (UnicodeDecodeError, OSError):
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if BANNED_PLIVO.search(line):
                offenders.append(f"{path.relative_to(REPO)}:{i}: {line.strip()[:100]}")
    assert not offenders, (
        "Plivo references found (Plivo is a dead provider — do not reintroduce):\n"
        + "\n".join(offenders)
    )


def test_no_plivo_routes_registered():
    route_paths = _all_route_paths()
    assert not any(p.startswith("/plivo") for p in route_paths), (
        "Plivo routes still registered: "
        + str(sorted(p for p in route_paths if p.startswith("/plivo")))
    )


def test_settings_have_no_plivo_fields():
    from server.config import Settings

    import dataclasses

    fields = {f.name for f in dataclasses.fields(Settings)}
    bad = {f for f in fields if "plivo" in f}
    assert not bad, f"Plivo settings still present: {bad}"
    env_names = [e for e, _, _ in Settings._FIELDS]
    bad_env = [e for e in env_names if "PLIVO" in e]
    assert not bad_env, f"Plivo env vars still present: {bad_env}"


def test_exotel_code_is_server_side_only():
    """Exotel may live in server/, tests/, docs/ — never in web/."""
    offenders = []
    web_dir = REPO / "web"
    for path in web_dir.rglob("*"):
        if not path.is_file() or path.suffix not in SCANNED_EXTS:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="strict")
        except (UnicodeDecodeError, OSError):
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if "exotel" in line.lower():
                offenders.append(f"{path.relative_to(REPO)}:{i}: {line.strip()[:100]}")
    assert not offenders, (
        "Exotel references found in browser-served web/ files "
        "(telephony must stay server-side):\n" + "\n".join(offenders)
    )


def test_no_telephony_secrets_leak_to_browser():
    """No Exotel credential may appear in web/ or in /web/voice_config."""
    offenders = []
    web_dir = REPO / "web"
    for path in web_dir.rglob("*"):
        if not path.is_file() or path.suffix not in SCANNED_EXTS:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="strict")
        except (UnicodeDecodeError, OSError):
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if BANNED_BROWSER_SECRETS.search(line):
                offenders.append(f"{path.relative_to(REPO)}:{i}: {line.strip()[:100]}")
    assert not offenders, (
        "Telephony secrets found in browser-served files:\n" + "\n".join(offenders)
    )

    # /web/voice_config serves provider keys to browser JS. It must never
    # grow an exotel entry.
    import inspect
    import server.web_routes as web_routes

    source = inspect.getsource(web_routes.web_voice_config)
    assert "exotel" not in source.lower(), (
        "/web/voice_config must never expose Exotel credentials to the browser"
    )


def test_exotel_routes_are_not_under_web_or_app():
    """The phone path must not disturb the browser UI routes."""
    route_paths = _all_route_paths()
    exotel_paths = sorted(p for p in route_paths if "exotel" in p.lower())
    assert exotel_paths, "Exotel routes missing — the phone path is not wired up"
    for p in exotel_paths:
        assert not p.startswith("/web/") and not p.startswith("/app"), (
            f"Exotel route {p!r} collides with the browser UI namespace"
        )


def test_exotel_settings_exist_and_are_optional():
    """EXOTEL_* settings exist for server-side use and never break startup."""
    from server.config import Settings

    fields = {f.name: f for f in __import__("dataclasses").fields(Settings)}
    for name in ("exotel_api_key", "exotel_api_token", "exotel_account_sid"):
        assert name in fields, f"Settings missing {name}"
    required = {env for env, _, req in Settings._FIELDS if req}
    assert not ({"EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_ACCOUNT_SID"} & required), (
        "Exotel settings must be optional so the browser path works without them"
    )
