"""Read-only Google Calendar lookup via the calendar's secret iCal URL.

In Google Calendar: Settings > your calendar > "Secret address in iCal
format" > copy it into GOOGLE_CALENDAR_ICAL_URL in .env. No OAuth, no API
key — the URL itself is the credential, and access is read-only.

The ICS feed is parsed with a small hand-written parser (no new
dependencies). All functions are defensive: they never raise — they return
{"ok": False, "error": ...} on any failure.
"""
from __future__ import annotations

import datetime as _dt
import logging
import re

import httpx

log = logging.getLogger("ringmate.calendar")


def _unfold(text: str) -> list[str]:
    """Join ICS folded lines (continuation lines start with space/tab)."""
    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.rstrip("\r\n")
        if line[:1] in (" ", "\t") and lines:
            lines[-1] += line[1:]
        else:
            lines.append(line)
    return lines


def _parse_dt(value: str, params: str) -> _dt.datetime | None:
    """Parse an ICS DATE-TIME or DATE value into an aware datetime (UTC)."""
    value = value.strip()
    try:
        if params.upper().startswith("VALUE=DATE") or re.fullmatch(r"\d{8}", value):
            d = _dt.datetime.strptime(value, "%Y%m%d").date()
            return _dt.datetime(d.year, d.month, d.day, tzinfo=_dt.timezone.utc)
        # DATE-TIME, possibly with Z suffix or TZID param
        m = re.match(r"(\d{8})T(\d{6})(Z?)", value)
        if not m:
            return None
        naive = _dt.datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")
        if m.group(3) == "Z":
            return naive.replace(tzinfo=_dt.timezone.utc)
        tzid = re.search(r"TZID=([^;:]+)", params, re.IGNORECASE)
        if tzid:
            try:
                from zoneinfo import ZoneInfo
                return naive.replace(tzinfo=ZoneInfo(tzid.group(1)))
            except Exception:
                pass
        # Floating time: assume UTC rather than crash.
        return naive.replace(tzinfo=_dt.timezone.utc)
    except (ValueError, OverflowError):
        return None


def parse_ical_events(ical_text: str) -> list[dict]:
    """Parse VEVENTs from ICS text -> [{summary, start, end, all_day}]."""
    events: list[dict] = []
    in_event: dict | None = None
    for line in _unfold(ical_text):
        if line == "BEGIN:VEVENT":
            in_event = {}
        elif line == "END:VEVENT":
            if in_event and in_event.get("start"):
                in_event.setdefault("summary", "(no title)")
                in_event.setdefault("all_day", False)
                events.append(in_event)
            in_event = None
        elif in_event is not None and ":" in line:
            prop, _, val = line.partition(":")
            name, _, params = prop.partition(";")
            name = name.upper()
            if name == "SUMMARY":
                in_event["summary"] = val.replace("\\,", ",").replace("\\n", " ").strip()
            elif name == "DTSTART":
                dt = _parse_dt(val, params)
                if dt:
                    in_event["start"] = dt
                    in_event["all_day"] = bool(re.fullmatch(r"\d{8}", val.strip()))
            elif name == "DTEND":
                dt = _parse_dt(val, params)
                if dt:
                    in_event["end"] = dt
    return events


def _resolve_day(day: str) -> _dt.date | None:
    day = (day or "today").strip().lower()
    today = _dt.date.today()
    if day in ("today",):
        return today
    if day in ("tomorrow",):
        return today + _dt.timedelta(days=1)
    if day in ("yesterday",):
        return today - _dt.timedelta(days=1)
    try:
        return _dt.date.fromisoformat(day)
    except ValueError:
        return None


def fetch_ical(url: str, timeout: float = 10.0) -> str:
    """Download the ICS feed; returns '' on any failure."""
    try:
        resp = httpx.get(url, timeout=timeout, follow_redirects=True,
                         headers={"User-Agent": "RingMate/1.0"})
        resp.raise_for_status()
        return resp.text
    except Exception as exc:  # noqa: BLE001 — calendar must never crash a call
        log.warning("Calendar fetch failed: %s", exc)
        return ""


def check_calendar(ical_url: str, day: str = "today") -> dict:
    """Return the user's events for a day.

    {"ok": True, "day": "2026-09-27", "events": [{"summary", "start", "all_day"}]}
    or {"ok": False, "error": "..."}.
    """
    if not ical_url:
        return {"ok": False, "error": "not_configured",
                "message": "Google Calendar isn't connected yet."}
    target = _resolve_day(day)
    if target is None:
        return {"ok": False, "error": "bad_day",
                "message": f"I didn't understand the day '{day}'."}
    ical_text = fetch_ical(ical_url)
    if not ical_text:
        return {"ok": False, "error": "fetch_failed",
                "message": "I couldn't reach your calendar right now."}
    events = parse_ical_events(ical_text)
    day_events = [e for e in events if e["start"].date() == target]
    day_events.sort(key=lambda e: e["start"])
    out = []
    for e in day_events:
        start = e["start"].astimezone()
        out.append({
            "summary": e["summary"],
            "start": start.strftime("%I:%M %p").lstrip("0"),
            "all_day": e["all_day"],
        })
    return {"ok": True, "day": target.isoformat(), "events": out}
