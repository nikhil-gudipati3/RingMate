"""LLM client: primary OmniRoute endpoint with automatic Gemini fallback.

Other modules use exactly this interface:
    client = LLMClient(api_key=..., base_url=..., model=..., fallback_api_key=...)
    result = client.complete(messages, tools)
    # {"type": "tool_call", "name": str, "arguments": dict}
    # or {"type": "text", "text": str}
"""

from __future__ import annotations

import json
import logging

import httpx

logger = logging.getLogger(__name__)

_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
_STRICT_JSON_NUDGE = "Respond with strict JSON only."
_GRACEFUL_TEXT = "I didn't quite get that \u2014 could you say it differently?"


class LLMClient:
    """OpenAI-compatible chat-completions client with fallback and defensive parsing."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        fallback_api_key: str = "",
        timeout: float = 30.0,
        http_client: httpx.Client | None = None,
    ) -> None:
        """Store credentials/endpoints; keys are never logged or hardcoded."""
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._fallback_api_key = fallback_api_key
        self._timeout = timeout
        # trust_env=False: proxy env vars (e.g. oddly-formatted no_proxy lists)
        # must never crash client construction. Callers needing proxies can
        # inject their own configured httpx.Client.
        self._http = http_client or httpx.Client(trust_env=False)
        self._owns_client = http_client is None
        self._last_provider = "none"

    @property
    def last_provider(self) -> str:
        """Return which provider answered the last call: omniroute, gemini, or none."""
        return self._last_provider

    def complete(self, messages: list[dict], tools: list[dict]) -> dict:
        """Run one LLM turn; never raise on provider failure or model garbage."""
        data, provider, url, key = self._fetch(messages, tools)
        if data is None:
            return self._graceful("no LLM provider reachable")
        parsed = self._parse_message(data)
        if parsed is None:
            logger.warning("Unparsable output from %s; retrying once with strict-JSON nudge.", provider)
            nudged = [{"role": "system", "content": _STRICT_JSON_NUDGE}] + list(messages)
            try:
                data = self._post(url, key, nudged, tools)
            except httpx.HTTPError as exc:
                logger.warning("Strict-JSON retry request failed: %s", exc)
                return self._graceful("retry request failed")
            parsed = self._parse_message(data)
            if parsed is None:
                return self._graceful("unparsable output after retry")
        self._last_provider = provider
        logger.info("LLM turn answered by provider=%s", provider)
        return parsed

    def close(self) -> None:
        """Close the owned HTTP client, if this instance created it."""
        if self._owns_client:
            self._http.close()

    def _fetch(self, messages: list[dict], tools: list[dict]) -> tuple[dict | None, str, str, str]:
        """Try primary, then Gemini fallback on any transport/HTTP failure."""
        try:
            data = self._post(self._base_url, self._api_key, messages, tools)
            return data, "omniroute", self._base_url, self._api_key
        except httpx.HTTPError as exc:
            logger.warning("Primary LLM provider (omniroute) failed: %s", exc)
        if self._fallback_api_key:
            try:
                data = self._post(_GEMINI_URL, self._fallback_api_key, messages, tools)
                return data, "gemini", _GEMINI_URL, self._fallback_api_key
            except httpx.HTTPError as exc:
                logger.warning("Fallback LLM provider (gemini) failed: %s", exc)
        return None, "none", "", ""

    def _post(self, base_url: str, api_key: str, messages: list[dict], tools: list[dict]) -> dict:
        """POST a chat-completions request; raise httpx.HTTPError on any failure."""
        url = f"{base_url}/chat/completions"
        payload = {"model": self._model, "messages": messages, "tools": tools, "tool_choice": "auto"}
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        response = self._http.post(url, json=payload, headers=headers, timeout=self._timeout)
        response.raise_for_status()
        try:
            return response.json()
        except ValueError as exc:
            raise httpx.DecodingError(f"Invalid JSON in LLM response: {exc}", request=response.request)

    def _parse_message(self, data: dict) -> dict | None:
        """Parse an OpenAI chat-completions payload; return None if unusable."""
        try:
            message = data["choices"][0]["message"]
        except (KeyError, IndexError, TypeError):
            return None
        tool_calls = message.get("tool_calls") or []
        if tool_calls:
            try:
                function = tool_calls[0]["function"]
                name = function["name"]
                arguments = json.loads(function.get("arguments") or "{}")
            except (KeyError, TypeError, json.JSONDecodeError):
                return None
            if not isinstance(name, str) or not name or not isinstance(arguments, dict):
                return None
            return {"type": "tool_call", "name": name, "arguments": arguments}
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return {"type": "text", "text": content}
        if isinstance(content, list):
            text = "".join(part.get("text", "") for part in content if isinstance(part, dict))
            if text.strip():
                return {"type": "text", "text": text}
        return None

    def _graceful(self, reason: str) -> dict:
        """Return the graceful fallback text; never raise."""
        self._last_provider = "none"
        logger.warning("LLM unavailable (%s); returning graceful fallback text.", reason)
        return {"type": "text", "text": _GRACEFUL_TEXT}
