"""Fail-fast configuration. Every secret comes from the environment (.env).

Importing this module is safe (no validation at import time). Call
``Settings.load()`` at startup — it raises ConfigError naming every missing
variable instead of failing mysteriously mid-call.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


class ConfigError(RuntimeError):
    """Raised when required configuration is missing."""


@dataclass
class Settings:
    omniroute_api_key: str = ""
    omniroute_base_url: str = ""
    omniroute_model: str = ""
    gemini_api_key: str = ""
    gmail_user: str = ""
    gmail_app_password: str = ""
    user_email: str = ""  # the user's own inbox — files are sent here
    laptop_poll_seconds: int = 3
    command_ttl_seconds: int = 120
    db_path: str = "ringmate.db"
    max_attachment_mb: int = 20
    google_calendar_ical_url: str = ""  # optional: secret iCal URL, read-only
    notes_path: str = "notes.json"

    # Exotel phone calling (AgentStream). All optional: the browser /app/
    # path works without them; the /voice/exotel/* routes need the API key
    # for WebSocket auth. Added 2026-10-05 when real phone calling became a
    # project requirement (see tests/test_no_telephony.py for the policy).
    exotel_api_key: str = ""
    exotel_api_token: str = ""
    exotel_account_sid: str = ""

    # (env name, attribute, required?)
    _FIELDS = (
        ("OMNIROUTE_API_KEY", "omniroute_api_key", True),
        ("OMNIROUTE_BASE_URL", "omniroute_base_url", True),
        ("OMNIROUTE_MODEL", "omniroute_model", True),
        ("GEMINI_API_KEY", "gemini_api_key", False),
        ("GMAIL_USER", "gmail_user", True),
        ("GMAIL_APP_PASSWORD", "gmail_app_password", True),
        ("USER_EMAIL", "user_email", True),
        ("LAPTOP_POLL_SECONDS", "laptop_poll_seconds", False),
        ("COMMAND_TTL_SECONDS", "command_ttl_seconds", False),
        ("DB_PATH", "db_path", False),
        ("MAX_ATTACHMENT_MB", "max_attachment_mb", False),
        ("GOOGLE_CALENDAR_ICAL_URL", "google_calendar_ical_url", False),
        ("NOTES_PATH", "notes_path", False),
        ("EXOTEL_API_KEY", "exotel_api_key", False),
        ("EXOTEL_API_TOKEN", "exotel_api_token", False),
        ("EXOTEL_ACCOUNT_SID", "exotel_account_sid", False),
    )

    @classmethod
    def load(cls) -> "Settings":
        """Load settings from the environment, failing fast on missing secrets."""
        values: dict = {}
        missing: list[str] = []
        for env_name, attr, required in cls._FIELDS:
            raw = os.environ.get(env_name, "").strip()
            if required and not raw:
                missing.append(env_name)
            values[attr] = raw
        if missing:
            raise ConfigError(
                "Missing required configuration: " + ", ".join(missing)
                + ". Copy .env.example to .env and fill them in."
            )
        try:
            values["laptop_poll_seconds"] = int(values["laptop_poll_seconds"] or 3)
            values["command_ttl_seconds"] = int(values["command_ttl_seconds"] or 120)
            values["max_attachment_mb"] = int(values["max_attachment_mb"] or 20)
        except ValueError as exc:
            raise ConfigError(f"Numeric config value is not a number: {exc}") from exc
        return cls(**values)
