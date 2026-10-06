"""Tests for server.calendar_tool — hand-written ICS parsing + day filtering."""
import datetime

from server import calendar_tool

ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:1@test
DTSTAMP:20260927T000000Z
DTSTART:20260927T100000Z
DTEND:20260927T110000Z
SUMMARY:Team standup
END:VEVENT
BEGIN:VEVENT
UID:2@test
DTSTAMP:20260927T000000Z
DTSTART;VALUE=DATE:20260928
SUMMARY:Holiday\\, office closed
END:VEVENT
BEGIN:VEVENT
UID:3@test
DTSTAMP:20260927T000000Z
DTSTART;TZID=Asia/Kolkata:20260927T153000
DTEND;TZID=Asia/Kolkata:20260927T160000
SUMMARY:Call with Prasad
END:VEVENT
END:VCALENDAR
"""


def test_parse_ical_events():
    events = calendar_tool.parse_ical_events(ICS)
    assert len(events) == 3
    by_title = {e["summary"]: e for e in events}
    assert by_title["Team standup"]["start"].tzinfo is not None
    assert by_title["Holiday, office closed"]["all_day"] is True
    assert by_title["Call with Prasad"]["start"].utcoffset() == datetime.timedelta(hours=5, minutes=30)


def test_unfold_continuation_lines():
    folded = "BEGIN:VEVENT\r\nSUMMARY:Long title that \r\n continues here\r\nDTSTART:20260927T100000Z\r\nEND:VEVENT"
    events = calendar_tool.parse_ical_events(folded)
    assert events[0]["summary"] == "Long title that continues here"


def test_events_filtered_to_day(monkeypatch):
    monkeypatch.setattr(calendar_tool, "fetch_ical", lambda url, timeout=10.0: ICS)
    res = calendar_tool.check_calendar("https://example.com/secret.ics", day="2026-09-27")
    assert res["ok"] is True
    titles = [e["summary"] for e in res["events"]]
    assert "Team standup" in titles
    assert "Call with Prasad" in titles
    assert "Holiday, office closed" not in titles  # that's the 28th


def test_empty_day_ok(monkeypatch):
    monkeypatch.setattr(calendar_tool, "fetch_ical", lambda url, timeout=10.0: ICS)
    res = calendar_tool.check_calendar("https://example.com/secret.ics", day="2026-09-30")
    assert res["ok"] is True and res["events"] == []


def test_not_configured():
    res = calendar_tool.check_calendar("", day="today")
    assert res["ok"] is False and res["error"] == "not_configured"


def test_bad_day_string(monkeypatch):
    monkeypatch.setattr(calendar_tool, "fetch_ical", lambda url, timeout=10.0: ICS)
    res = calendar_tool.check_calendar("https://example.com/x.ics", day="someday")
    assert res["ok"] is False and res["error"] == "bad_day"


def test_fetch_failure_is_graceful(monkeypatch):
    monkeypatch.setattr(calendar_tool, "fetch_ical", lambda url, timeout=10.0: "")
    res = calendar_tool.check_calendar("https://example.com/x.ics", day="today")
    assert res["ok"] is False and res["error"] == "fetch_failed"


def test_malformed_ical_never_raises():
    assert calendar_tool.parse_ical_events("not an ics file at all") == []
    assert calendar_tool.parse_ical_events("") == []
