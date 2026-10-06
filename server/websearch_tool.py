"""Keyless web search for RingMate.

Three sources, tried in order — no API keys needed:

1. **wttr.in** for weather questions ("weather in Hyderabad today").
2. **Wikipedia** (search + summary API) for factual questions
   ("capital of Telangana", "who is ...", "what is ...").
3. **DuckDuckGo Instant Answer API** as a last resort.

Defensive by design: timeouts, HTTP errors, and unexpected payloads all
degrade to {"ok": False} instead of raising, so search can never crash a
voice call.
"""
from __future__ import annotations

import difflib
import logging
import os
import re
import urllib.parse

import httpx

log = logging.getLogger("ringmate.websearch")

_WTTR_URL = "https://wttr.in"
_WIKI_API = "https://en.wikipedia.org/w/api.php"
_WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary"
_DDG_URL = "https://api.duckduckgo.com/"

_UA = {"User-Agent": "RingMate/1.0 (keyless web lookup)"}

_WEATHER_RE = re.compile(r"\bweather\b", re.IGNORECASE)
# "weather in hyderabad", "weather now in hyderabad", "weather at goa",
# "weather for delhi today", "whats the weather like in goa"
_WEATHER_IN_RE = re.compile(
    r"weather\s+(?:like\s+)?(?:now\s+|today\s+|tonight\s+|tomorrow\s+)?"
    r"(?:in|at|for)\s+([a-zA-Z][a-zA-Z .'-]*?)"
    r"(?:\s+today|\s+tomorrow|\s+now|\s+tonight)?\s*$",
    re.IGNORECASE,
)
# "hyderabad weather", "hyderabad weather today"
_WEATHER_BEFORE_RE = re.compile(
    r"^\s*(?:what(?:'s| is)|how(?:'s| is)|tell me)?\s*"
    r"([a-zA-Z][a-zA-Z .'-]*?)\s+(?:'s\s+)?weather(?:\s+today|\s+tomorrow|\s+now)?\s*$",
    re.IGNORECASE,
)
# Words joining several places: "hyderabad as well as dallas", "a, b and c".
_PLACE_SPLIT_RE = re.compile(
    r"\s+as well as\s+|\s*,\s*|\s+plus\s+|\s*&\s*|\s+and\s+", re.IGNORECASE)
_LEADING_PREP_RE = re.compile(r"^(?:in|at|for)\s+", re.IGNORECASE)


def _get(url: str, params: dict | None = None, timeout: float = 8.0) -> httpx.Response:
    resp = httpx.get(url, params=params, timeout=timeout, headers=_UA,
                     follow_redirects=True)
    resp.raise_for_status()
    return resp


# -- weather ---------------------------------------------------------------

def is_weather_query(query: str) -> bool:
    """True when the text asks about weather."""
    return bool(_WEATHER_RE.search(query or ""))


def requested_place(query: str) -> str | None:
    """The place phrase the user named in a weather question, if any."""
    return _place_chunk(query)


def home_city() -> str:
    """The user's home city, used as the weather default when no place is
    named (instead of wttr.in's IP geolocation, which is often wrong)."""
    return os.environ.get("USER_HOME_CITY", "Hyderabad").strip()

def _place_chunk(query: str) -> str | None:
    """The raw place phrase in a weather question, or None if none mentioned."""
    m = _WEATHER_IN_RE.search(query or "")
    if m:
        return m.group(1).strip(" .'-") or None
    m = _WEATHER_BEFORE_RE.search(query or "")
    if m:
        place = m.group(1).strip(" .'-")
        # Guard against the group swallowing the whole question when there is
        # no real place ("what is the weather" -> "what is the").
        if place.lower() in {"what is the", "whats the", "what is", "how is the",
                             "the", "today"}:
            return None
        return place or None
    return None


def _split_places(chunk: str) -> list[str]:
    """Split "hyderabad as well as in dallas" into ["hyderabad", "dallas"]."""
    parts: list[str] = []
    for bit in _PLACE_SPLIT_RE.split(chunk):
        bit = _LEADING_PREP_RE.sub("", bit.strip()).strip(" .'-")
        if bit and bit not in parts:
            parts.append(bit)
    return parts


def _weather_location_candidates(query: str) -> list[str]:
    """Ordered location guesses: the whole phrase first, then its parts.

    The whole phrase wins when it names one real place ("trinidad and
    tobago"); the parts are the fallback for several places
    ("hyderabad as well as in dallas").
    """
    chunk = _place_chunk(query)
    if not chunk:
        return []
    cands = [chunk]
    cands.extend(p for p in _split_places(chunk) if p != chunk)
    return cands


def _weather_location(query: str) -> str | None:
    """First place guess in a weather question, or None for 'here'."""
    cands = _weather_location_candidates(query)
    return cands[0] if cands else None


# The local model sometimes drops the city on follow-ups ("what about dallas"
# -> query "weather"), which would silently answer for the IP location. These
# patterns pull place candidates out of the user's own words; each one is
# validated against wttr.in before use, so junk never becomes an answer.
_FOLLOWUP_PLACE_RES = [
    re.compile(r"\b(?:in|at|for|about)\s+([a-zA-Z][a-zA-Z .'-]*?)\s*[?.!]*$",
               re.IGNORECASE),
    re.compile(r"^\s*and\s+([a-zA-Z][a-zA-Z .'-]*?)\s*[?.!]*$",
               re.IGNORECASE),
]


def _followup_places(raw_text: str) -> list[str]:
    out: list[str] = []
    for rx in _FOLLOWUP_PLACE_RES:
        for m in rx.finditer(raw_text or ""):
            cand = _LEADING_PREP_RE.sub("", m.group(1).strip()).strip(" .'-")
            for bit in [cand, *_split_places(cand)]:
                if bit and bit not in out:
                    out.append(bit)
    return out


def repair_weather_query(query: str, raw_text: str, timeout: float = 5.0) -> str:
    """Rebuild a weather query when the model dropped the place name.

    Returns the query unchanged unless it is a weather question with no
    parseable place while the user's own words name a place wttr.in can
    resolve. Never raises.
    """
    try:
        if not _WEATHER_RE.search(query or ""):
            return query
        if _place_chunk(query):
            return query
        good: list[str] = []
        for cand in _followup_places(raw_text):
            hit = _wttr_search(cand, timeout=timeout)
            if cand not in good and hit and hit.get("ok"):
                good.append(cand)
            if len(good) >= 3:
                break
        if not good:
            return query
        return "weather in " + " as well as in ".join(good)
    except Exception:  # noqa: BLE001 - repair must never break a turn
        log.warning("weather query repair failed", exc_info=True)
        return query


def _place_matches(requested: str, place: str, country: str) -> bool:
    """Did wttr.in resolve to (something like) the requested place?

    Guards against wttr.in's aggressive fuzzy resolution: a garbled STT
    transcript like "buddlu" must never silently become weather for a
    random town. Matches when the resolved area or country is close to
    what was asked (difflib ratio >= 0.75) or one contains the other.
    When in doubt we clarify rather than answer confidently wrong.
    """
    req = (requested or "").strip().lower()
    if not req:
        return True  # nothing requested — nothing to contradict
    for candidate in (place, country):
        cand = (candidate or "").strip().lower()
        if not cand:
            continue
        if req == cand or req in cand or cand in req:
            return True
        if difflib.SequenceMatcher(None, req, cand).ratio() >= 0.75:
            return True
    return False


def _wttr_search(location: str | None, timeout: float = 8.0,
               _validate_as: str | None = None) -> dict | None:
    """Current weather from wttr.in. None when it can't answer.

    Returns {"ok": False, "error": "place_mismatch", ...} when wttr.in
    resolved to a place that clearly isn't what was asked — the caller
    must clarify instead of answering confidently for the wrong place.

    _validate_as: validate the resolution against this name instead of
    `location` (used by the ",India" retry so the added country suffix
    can't fake a country-only match).
    """
    loc = (location or "").strip()
    url = f"{_WTTR_URL}/{urllib.parse.quote(loc)}" if loc else _WTTR_URL
    try:
        data = _get(url, params={"format": "j1"}, timeout=timeout).json()
        current = (data.get("current_condition") or [{}])[0]
        area = (data.get("nearest_area") or [{}])[0]
    except Exception as exc:  # noqa: BLE001
        log.warning("wttr.in lookup failed: %s", exc)
        return None
    temp = current.get("temp_C")
    if temp is None:
        return None
    desc = (current.get("weatherDesc") or [{}])[0].get("value", "").lower()
    feels = current.get("FeelsLikeC")
    humidity = current.get("humidity")
    place = (area.get("areaName") or [{}])[0].get("value", "") or loc or "your area"
    country = (area.get("country") or [{}])[0].get("value", "")
    # Validate the resolution BEFORE building a confident answer.
    validate_name = _validate_as if _validate_as is not None else loc
    if validate_name and not _place_matches(validate_name, place, country):
        # wttr.in mis-resolves some bare city names ("Hyderabad" ->
        # "Husain Sawali Dargah") while "Hyderabad,India" resolves fine.
        # Retry with ",India" before declaring a mismatch.
        if "," not in loc and _validate_as is None:
            retry = _wttr_search(loc + ",India", timeout=timeout,
                                 _validate_as=loc)
            if retry and retry.get("ok"):
                return retry
        log.warning("wttr.in place mismatch: asked %r, resolved %r (%r)",
                    loc, place, country)
        return {"ok": False, "error": "place_mismatch", "requested": loc,
                "resolved": place, "source": "wttr.in", "related": []}
    where = f"{place}, {country}" if country and place != country else place
    bits = [desc.strip(), f"{temp}\u00b0C"]
    if feels and feels != temp:
        bits.append(f"feels like {feels}\u00b0C")
    if humidity:
        bits.append(f"humidity {humidity}%")
    answer = f"In {where} right now: {', '.join(b for b in bits if b)}."
    return {"ok": True, "answer": answer, "source": "wttr.in", "related": []}


# -- wikipedia --------------------------------------------------------------

def _first_sentences(text: str, n: int = 2) -> str:
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", text.strip()) if p.strip()]
    return " ".join(parts[:n]).strip()


def _wikipedia_search(query: str, timeout: float = 8.0) -> dict | None:
    """Factual answer from Wikipedia. None when it can't answer."""
    try:
        found = _get(
            _WIKI_API,
            params={"action": "query", "list": "search", "srsearch": query,
                    "format": "json", "srlimit": 3},
            timeout=timeout,
        ).json()
        hits = ((found.get("query") or {}).get("search") or [])
    except Exception as exc:  # noqa: BLE001
        log.warning("Wikipedia lookup failed: %s", exc)
        return None
    if not hits:
        return None
    # Significant query words; the chosen article must mention at least one,
    # so a quirky top hit can't produce an unrelated answer.
    keywords = [t for t in re.findall(r"[a-z0-9]{3,}", query.lower())]
    related = [h["title"] for h in hits[1:] if h.get("title")]
    for hit in hits:
        title = hit.get("title", "")
        try:
            summary = _get(
                f"{_WIKI_SUMMARY}/{urllib.parse.quote(title.replace(' ', '_'))}",
                timeout=timeout,
            ).json()
        except Exception as exc:  # noqa: BLE001
            log.warning("Wikipedia summary failed: %s", exc)
            continue
        if summary.get("type") == "disambiguation":
            continue
        extract = (summary.get("extract") or "").strip()
        if not extract:
            continue
        haystack = f"{title}\n{extract}".lower()
        if keywords and not any(k in haystack for k in keywords):
            continue
        return {"ok": True, "answer": _first_sentences(extract),
                "source": "Wikipedia", "related": related}
    return None


# -- duckduckgo instant answer (last resort) ----------------------------------

def _ddg_instant(query: str, timeout: float = 8.0) -> dict | None:
    try:
        data = _get(
            _DDG_URL,
            params={"q": query, "format": "json", "no_html": "1",
                    "skip_disambig": "1"},
            timeout=timeout,
        ).json()
    except Exception as exc:  # noqa: BLE001
        log.warning("DDG instant answer failed: %s", exc)
        return None
    answer = (data.get("AbstractText") or "").strip()
    source = (data.get("AbstractSource") or "").strip()
    related: list[str] = []
    for item in data.get("RelatedTopics") or []:
        if isinstance(item, dict):
            text = (item.get("Text") or "").strip()
            if text:
                related.append(text)
        if len(related) >= 3:
            break
    if not answer and not related:
        return None
    return {"ok": True, "answer": answer, "source": source, "related": related}


# -- public entry point ---------------------------------------------------------

def web_search(query: str, timeout: float = 8.0) -> dict:
    """Search the web.

    {"ok": True, "answer": str, "source": str, "related": [str]}
    or {"ok": False, "error": str}.
    """
    query = (query or "").strip()
    if not query:
        return {"ok": False, "error": "empty query"}

    if _WEATHER_RE.search(query):
        # One question can name several places ("weather in hyderabad as well
        # as in dallas"): try the whole phrase first (it may be one real
        # place, e.g. "trinidad and tobago"), then each part on its own.
        chunk = _place_chunk(query)
        if chunk is None:
            # No place named ("what's the weather"): default to the user's
            # home city instead of wttr.in's IP geolocation.
            targets: list[str | None] = [home_city() or None]
        else:
            whole = _wttr_search(chunk, timeout=timeout)
            if whole and whole.get("ok"):
                return whole
            if whole and whole.get("error") == "place_mismatch":
                # Fail fast with the mismatch info so the agent clarifies
                # instead of answering for a random place.
                return whole
            targets = _split_places(chunk) or [chunk]
        answers = []
        first_error: dict | None = None
        for loc in targets[:3]:
            hit = _wttr_search(loc, timeout=timeout)
            if hit and hit.get("ok"):
                answers.append(hit["answer"])
            elif hit and first_error is None:
                first_error = hit
        if not answers:
            if first_error is not None:
                first_error = dict(first_error)
                first_error.setdefault("requested",
                                       chunk or (targets[0] if targets else ""))
                return first_error
            return {"ok": False, "error": "no_results"}
        # Weather questions never fall through to Wikipedia (it has no live
        # weather); report honestly instead.
        return {"ok": True, "answer": " ".join(answers),
                "source": "wttr.in", "related": []}

    for attempt in (_wikipedia_search, _ddg_instant):
        try:
            hit = attempt(query, timeout=timeout)
        except Exception as exc:  # noqa: BLE001 - never crash the call
            log.warning("Web search attempt failed: %s", exc)
            hit = None
        if hit:
            return hit
    return {"ok": False, "error": "no_results"}
