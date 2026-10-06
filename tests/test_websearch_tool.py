"""Tests for server.websearch_tool — httpx is faked, no real network."""
import pytest

from server import websearch_tool


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def _fake_get_factory(routes):
    """routes: list of (url_substring, payload_or_exception)."""
    def fake_get(url, params=None, **kwargs):
        full = url + "?" + "&".join(f"{k}={v}" for k, v in (params or {}).items())
        for needle, payload in routes:
            if needle in full:
                if isinstance(payload, Exception):
                    raise payload
                return FakeResponse(payload)
        raise AssertionError(f"unexpected GET {full}")
    return fake_get


WTTR_J1 = {
    "current_condition": [{
        "temp_C": "29", "FeelsLikeC": "31",
        "weatherDesc": [{"value": "Sunny"}], "humidity": "42",
    }],
    "nearest_area": [{
        "areaName": [{"value": "Hyderabad"}],
        "country": [{"value": "India"}],
    }],
}

WIKI_SEARCH = {
    "query": {"search": [
        {"title": "Hyderabad"},
        {"title": "Telangana"},
    ]}
}
WIKI_SUMMARY = {
    "type": "standard",
    "extract": "Hyderabad is the capital and largest city of Telangana. "
               "It is a major center for technology. Extra third sentence.",
}


def test_weather_query_uses_wttr(monkeypatch):
    monkeypatch.setattr(
        websearch_tool.httpx, "get",
        _fake_get_factory([("wttr.in", WTTR_J1)]))
    res = websearch_tool.web_search("whats the weather in hyderabad today")
    assert res["ok"]
    assert "Hyderabad" in res["answer"]
    assert "29\u00b0C" in res["answer"]
    assert res["source"] == "wttr.in"


def test_weather_without_location_uses_home_city(monkeypatch):
    """No place named -> user's home city, not wttr.in's IP geolocation."""
    seen = {}

    def fake_get(url, params=None, **kwargs):
        seen["url"] = url
        return FakeResponse(WTTR_J1)

    monkeypatch.setattr(websearch_tool.httpx, "get", fake_get)
    monkeypatch.setenv("USER_HOME_CITY", "Hyderabad")
    res = websearch_tool.web_search("what is the weather")
    assert res["ok"]
    assert "Hyderabad" in seen["url"]
    assert "Hyderabad" in res["answer"]


def test_weather_location_extraction():
    assert websearch_tool._weather_location(
        "whats the weather in hyderabad today") == "hyderabad"
    assert websearch_tool._weather_location("hyderabad weather") == "hyderabad"
    assert websearch_tool._weather_location("weather for delhi") == "delhi"
    assert websearch_tool._weather_location("what is the weather") is None
    # "now" between weather and the preposition used to break extraction.
    assert websearch_tool._weather_location(
        "whats the weather now in hyderabad") == "hyderabad"


def test_weather_location_candidates_multi_city():
    assert websearch_tool._weather_location_candidates(
        "whats the weather now in hyderabad as well as in dallas") == [
        "hyderabad as well as in dallas", "hyderabad", "dallas"]
    assert websearch_tool._weather_location_candidates(
        "weather in hyderabad and dallas") == [
        "hyderabad and dallas", "hyderabad", "dallas"]
    # One real place containing "and" stays one candidate.
    assert websearch_tool._weather_location_candidates(
        "weather in trinidad and tobago") == [
        "trinidad and tobago", "trinidad", "tobago"]
    assert websearch_tool._place_chunk("weather in america dallas") == \
        "america dallas"


WTTR_DALLAS = {
    "current_condition": [{
        "temp_C": "28", "FeelsLikeC": "28",
        "weatherDesc": [{"value": "Sunny"}], "humidity": "35",
    }],
    "nearest_area": [{
        "areaName": [{"value": "Dallas"}],
        "country": [{"value": "United States of America"}],
    }],
}


def test_weather_two_cities_answered(monkeypatch):
    monkeypatch.setattr(
        websearch_tool.httpx, "get",
        _fake_get_factory([
            # whole multi-city phrase resolves to nothing...
            ("hyderabad%20as%20well", Exception("no such place")),
            ("dallas", WTTR_DALLAS),
            ("hyderabad", WTTR_J1),
        ]))
    res = websearch_tool.web_search(
        "whats the weather now in hyderabad as well as in dallas")
    assert res["ok"]
    assert "Hyderabad" in res["answer"]
    assert "Dallas" in res["answer"]
    assert res["source"] == "wttr.in"


def test_weather_phrase_resolving_to_one_place(monkeypatch):
    # "america dallas" is one place (Dallas, USA), not two lookups.
    seen = []

    def fake_get(url, params=None, **kwargs):
        seen.append(url)
        return FakeResponse(WTTR_DALLAS)

    monkeypatch.setattr(websearch_tool.httpx, "get", fake_get)
    res = websearch_tool.web_search("whats the weather in america dallas")
    assert res["ok"]
    assert "Dallas" in res["answer"]
    assert len(seen) == 1  # whole phrase answered, no split lookups


def test_repair_weather_query_restores_dropped_city(monkeypatch):
    def fake_wttr(loc, timeout=5.0):
        return {"ok": True} if loc == "dallas" else None

    monkeypatch.setattr(websearch_tool, "_wttr_search", fake_wttr)
    # Follow-up where the model dropped the city: rebuilt from user words.
    assert websearch_tool.repair_weather_query(
        "weather", "what about dallas") == "weather in dallas"
    # Query already names a place: untouched.
    assert websearch_tool.repair_weather_query(
        "weather in hyderabad", "what about dallas") == "weather in hyderabad"
    # No place anywhere: untouched (IP-location fallback still applies).
    assert websearch_tool.repair_weather_query(
        "weather", "what is the weather") == "weather"
    # Not a weather question: untouched.
    assert websearch_tool.repair_weather_query(
        "capital of france", "what about dallas") == "capital of france"
    # Junk candidate that wttr.in rejects: untouched, never crashes.
    assert websearch_tool.repair_weather_query(
        "weather", "tell me about the weather in general") == "weather"


def test_factual_query_uses_wikipedia(monkeypatch):
    monkeypatch.setattr(
        websearch_tool.httpx, "get",
        _fake_get_factory([
            ("w/api.php", WIKI_SEARCH),
            ("rest_v1/page/summary", WIKI_SUMMARY),
        ]))
    res = websearch_tool.web_search("capital of Telangana")
    assert res["ok"]
    assert res["answer"].startswith(
        "Hyderabad is the capital and largest city of Telangana.")
    assert "Extra third sentence" not in res["answer"]  # trimmed to 2 sentences
    assert res["source"] == "Wikipedia"


def test_wikipedia_skips_irrelevant_top_hit(monkeypatch):
    search = {"query": {"search": [
        {"title": "List of chess grandmasters"},
        {"title": "Postal Index Number"},
    ]}}
    summaries = {
        "List_of_chess_grandmasters": {
            "type": "standard",
            "extract": "The following people have all been grandmasters of chess."},
        "Postal_Index_Number": {
            "type": "standard",
            "extract": "A Postal Index Number (PIN) is a six-digit code used by India Post."},
    }

    def fake_get(url, params=None, **kwargs):
        if "w/api.php" in url:
            return FakeResponse(search)
        for key, payload in summaries.items():
            if key in url:
                return FakeResponse(payload)
        raise AssertionError(url)

    monkeypatch.setattr(websearch_tool.httpx, "get", fake_get)
    res = websearch_tool.web_search("hyderabad pin code 500011")
    assert res["ok"]
    assert "Postal Index Number" in res["answer"]


def test_ddg_fallback_when_wikipedia_empty(monkeypatch):
    monkeypatch.setattr(
        websearch_tool.httpx, "get",
        _fake_get_factory([
            ("w/api.php", {"query": {"search": []}}),
            ("duckduckgo.com", {"AbstractText": "Paris is the capital of France.",
                                "AbstractSource": "Wikipedia",
                                "RelatedTopics": []}),
        ]))
    res = websearch_tool.web_search("capital of france")
    assert res["ok"]
    assert "Paris" in res["answer"]


def test_all_sources_fail_gracefully(monkeypatch):
    def boom(url, params=None, **kwargs):
        raise ConnectionError("no network")

    monkeypatch.setattr(websearch_tool.httpx, "get", boom)
    assert websearch_tool.web_search("capital of france") == {
        "ok": False, "error": "no_results"}
    assert websearch_tool.web_search("   ") == {
        "ok": False, "error": "empty query"}


# --------------------------------------------------------------------------
# v4.2.0: place validation (garbled STT must never become a random town)
# --------------------------------------------------------------------------

def _wttr_payload(area_name, country, temp="28"):
    return {
        "current_condition": [{
            "temp_C": temp, "FeelsLikeC": temp,
            "weatherDesc": [{"value": "Sunny"}], "humidity": "50",
        }],
        "nearest_area": [{
            "areaName": [{"value": area_name}],
            "country": [{"value": country}],
        }],
    }


def test_place_matches_unit():
    m = websearch_tool._place_matches
    assert m("hyderabad", "Hyderabad", "India")
    assert m("dallas", "Dallas", "United States of America")
    assert m("india", "New Delhi", "India")          # country match
    assert m("new york", "New York", "United States of America")
    assert m("", "Hyderabad", "India")               # nothing requested
    assert not m("buddlu", "Budaun", "India")        # garbled STT
    assert not m("xyzzy", "Hyderabad", "India")


def test_weather_india_retry_on_bare_mismatch(monkeypatch):
    """wttr.in mis-resolves bare "Hyderabad" -> retry "Hyderabad,India" works."""
    def fake_get(url, params=None, **kwargs):
        if "%2CIndia" in url or ",India" in url:
            return FakeResponse(_wttr_payload("Hyderabad", "India", temp="31"))
        return FakeResponse(_wttr_payload("Husain Sawali Dargah", "India"))
    monkeypatch.setattr(websearch_tool.httpx, "get", fake_get)
    res = websearch_tool.web_search("whats the weather in hyderabad")
    assert res["ok"] is True
    assert "Hyderabad" in res["answer"]
    assert "31\u00b0C" in res["answer"]


def test_weather_place_mismatch_rejected(monkeypatch):
    """'buddlu' (garbled Hyderabad) must not return weather for Budaun."""
    monkeypatch.setattr(
        websearch_tool.httpx, "get",
        _fake_get_factory([("wttr.in", _wttr_payload("Budaun", "India"))]))
    res = websearch_tool.web_search("whats the weather in buddlu")
    assert res["ok"] is False
    assert res["error"] == "place_mismatch"
    assert res["requested"] == "buddlu"


def test_weather_country_name_not_a_mismatch(monkeypatch):
    """'weather in india' resolving to New Delhi is fine (country match)."""
    monkeypatch.setattr(
        websearch_tool.httpx, "get",
        _fake_get_factory([("wttr.in", _wttr_payload("New Delhi", "India"))]))
    res = websearch_tool.web_search("whats the weather in india")
    assert res["ok"]
    assert "New Delhi" in res["answer"]


def test_weather_mismatch_fail_fast_keeps_requested(monkeypatch):
    monkeypatch.setattr(
        websearch_tool.httpx, "get",
        _fake_get_factory([("wttr.in", _wttr_payload("Budaun", "India"))]))
    res = websearch_tool.web_search("buddlu weather")
    assert res["error"] == "place_mismatch"


def test_repair_rejects_mismatched_candidate(monkeypatch):
    def fake_wttr(loc, timeout=5.0):
        if loc == "dallas":
            return {"ok": True}
        if loc == "buddlu":
            return {"ok": False, "error": "place_mismatch"}
        return None

    monkeypatch.setattr(websearch_tool, "_wttr_search", fake_wttr)
    # Garbled candidate is no longer accepted as "validated".
    assert websearch_tool.repair_weather_query(
        "weather", "what about buddlu") == "weather"
    assert websearch_tool.repair_weather_query(
        "weather", "what about dallas") == "weather in dallas"
