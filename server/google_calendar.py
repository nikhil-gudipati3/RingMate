"""Google Calendar API: create, update, delete, and list events.

Uses the OAuth access token from google_oauth. All functions return dicts;
failures return {"ok": False, "error": ...} — never raise.
"""
from __future__ import annotations

import datetime
import logging

from server import google_oauth

log = logging.getLogger("ringmate.gcal")

_API = "https://www.googleapis.com/calendar/v3"


def _headers() -> dict | None:
    token = google_oauth.get_access_token()
    if not token:
        return None
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _api(method: str, path: str, **kwargs) -> dict:
    import httpx
    headers = _headers()
    if not headers:
        return {"ok": False, "error": "Google not connected. Visit /web/oauth/authorize first."}
    try:
        resp = httpx.request(method, _API + path, headers=headers, timeout=20.0, **kwargs)
        if resp.status_code in (200, 201):
            return {"ok": True, "data": resp.json()}
        if resp.status_code == 204:
            return {"ok": True, "data": {}}
        return {"ok": False, "error": f"Google API {resp.status_code}: {resp.text[:200]}"}
    except Exception as exc:  # noqa: BLE001
        log.warning("Calendar API call failed: %s", exc)
        return {"ok": False, "error": str(exc)}


def _to_rfc3339(day: str, time_str: str) -> str:
    """Combine a day ('today'/'tomorrow'/'YYYY-MM-DD') and 'HH:MM' into RFC3339."""
    today = datetime.date.today()
    if day == "today":
        d = today
    elif day == "tomorrow":
        d = today + datetime.timedelta(days=1)
    else:
        try:
            d = datetime.date.fromisoformat(day)
        except ValueError:
            d = today
    try:
        hh, mm = time_str.split(":")[:2]
        t = datetime.time(int(hh), int(mm))
    except (ValueError, IndexError):
        t = datetime.time(9, 0)
    dt = datetime.datetime.combine(d, t)
    # Use the server's local timezone offset.
    offset = datetime.datetime.now().astimezone().utcoffset() or datetime.timedelta()
    total_s = int(offset.total_seconds())
    sign = "+" if total_s >= 0 else "-"
    hrs, rem = divmod(abs(total_s), 3600)
    mins = rem // 60
    return dt.strftime("%Y-%m-%dT%H:%M:%S") + f"{sign}{hrs:02d}:{mins:02d}"


def list_events(day: str = "today", max_results: int = 10) -> dict:
    """List events for a day."""
    today = datetime.date.today()
    if day == "tomorrow":
        d = today + datetime.timedelta(days=1)
    elif day not in ("today",):
        try:
            d = datetime.date.fromisoformat(day)
        except ValueError:
            return {"ok": False, "error": f"Bad day: {day}"}
    else:
        d = today
    start = datetime.datetime.combine(d, datetime.time.min).isoformat() + "Z"
    end = datetime.datetime.combine(d, datetime.time.max).isoformat() + "Z"
    # Use local midnight converted to UTC properly.
    start_dt = datetime.datetime.combine(d, datetime.time.min).astimezone()
    end_dt = datetime.datetime.combine(d, datetime.time.max).astimezone()
    res = _api("GET", "/calendars/primary/events", params={
        "timeMin": start_dt.isoformat(),
        "timeMax": end_dt.isoformat(),
        "maxResults": max_results,
        "singleEvents": "true",
        "orderBy": "startTime",
    })
    if not res["ok"]:
        return res
    events = []
    for e in res["data"].get("items", []):
        start_info = e.get("start", {})
        events.append({
            "id": e.get("id", ""),
            "summary": e.get("summary", "(no title)"),
            "start": start_info.get("dateTime", start_info.get("date", "")),
            "end": e.get("end", {}).get("dateTime", ""),
        })
    return {"ok": True, "events": events}


def create_event(summary: str, day: str = "today", time_str: str = "09:00",
                 duration_min: int = 60, description: str = "") -> dict:
    """Create a calendar event."""
    start = _to_rfc3339(day, time_str)
    # Compute end from duration.
    try:
        start_dt = datetime.datetime.fromisoformat(start)
    except ValueError:
        return {"ok": False, "error": "Bad start time"}
    end_dt = start_dt + datetime.timedelta(minutes=max(15, duration_min))
    # Rebuild end with same offset.
    end = end_dt.isoformat()
    body = {
        "summary": summary[:200] or "Untitled",
        "start": {"dateTime": start, "timeZone": str(datetime.datetime.now().astimezone().tzinfo)},
        "end": {"dateTime": end, "timeZone": str(datetime.datetime.now().astimezone().tzinfo)},
    }
    if description:
        body["description"] = description[:1000]
    res = _api("POST", "/calendars/primary/events", json=body)
    if not res["ok"]:
        return res
    e = res["data"]
    return {"ok": True, "id": e.get("id", ""),
            "summary": e.get("summary", ""),
            "start": e.get("start", {}).get("dateTime", "")}


def find_event(query: str, day: str = "today") -> dict:
    """Find events matching a query on a given day. Returns list of matches.

    Matches when ALL significant words from the query appear in the event
    title (in any order). E.g. "pankaj shivan" matches "meeting with pankaj
    and shivan".
    """
    res = list_events(day, max_results=20)
    if not res["ok"]:
        return res
    # Split query into significant words (drop tiny filler words).
    qwords = [w for w in query.lower().split() if len(w) > 2]
    if not qwords:
        qwords = query.lower().split()
    matches = []
    for e in res["events"]:
        title = e["summary"].lower()
        if all(w in title for w in qwords):
            matches.append(e)
    return {"ok": True, "matches": matches}


def delete_event(event_id: str) -> dict:
    """Delete an event by ID."""
    return _api("DELETE", f"/calendars/primary/events/{event_id}")


def update_event(event_id: str, summary: str = "", day: str = "",
                 time_str: str = "") -> dict:
    """Update an event's title and/or time. Only provided fields change."""
    # Fetch current first.
    res = _api("GET", f"/calendars/primary/events/{event_id}")
    if not res["ok"]:
        return res
    body: dict = {}
    if summary:
        body["summary"] = summary[:200]
    if day or time_str:
        cur_start = res["data"].get("start", {}).get("dateTime", "")
        cur_day = cur_start[:10] if len(cur_start) >= 10 else "today"
        cur_time = cur_start[11:16] if len(cur_start) >= 16 else "09:00"
        new_day = day or cur_day
        new_time = time_str or cur_time
        new_start = _to_rfc3339(new_day, new_time)
        try:
            start_dt = datetime.datetime.fromisoformat(new_start)
        except ValueError:
            return {"ok": False, "error": "Bad new time"}
        # Keep original duration.
        cur_end = res["data"].get("end", {}).get("dateTime", "")
        try:
            duration = (datetime.datetime.fromisoformat(cur_end)
                        - datetime.datetime.fromisoformat(cur_start))
        except ValueError:
            duration = datetime.timedelta(hours=1)
        end_dt = start_dt + duration
        tz = str(datetime.datetime.now().astimezone().tzinfo)
        body["start"] = {"dateTime": new_start, "timeZone": tz}
        body["end"] = {"dateTime": end_dt.isoformat(), "timeZone": tz}
    if not body:
        return {"ok": False, "error": "Nothing to update"}
    res = _api("PATCH", f"/calendars/primary/events/{event_id}", json=body)
    if not res["ok"]:
        return res
    e = res["data"]
    return {"ok": True, "id": e.get("id", ""),
            "summary": e.get("summary", ""),
            "start": e.get("start", {}).get("dateTime", "")}
