"""Tests for server.llm_client using httpx.MockTransport (no real network)."""

import json

import httpx
import pytest

from server.llm_client import LLMClient

BASE_URL = "https://omniroute.example.com/v1"
MODEL = "test-model"
GRACEFUL = "I didn't quite get that \u2014 could you say it differently?"

MESSAGES = [{"role": "user", "content": "send me my latest resume"}]
TOOLS = [{"type": "function", "function": {"name": "find_file", "parameters": {"type": "object"}}}]


def _tool_call_body(name="find_file", arguments=None):
    """Build a canned OpenAI chat-completions response carrying a tool call."""
    return {
        "id": "chatcmpl-1",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_1",
                            "type": "function",
                            "function": {
                                "name": name,
                                "arguments": json.dumps(arguments if arguments is not None else {"query": "resume", "type": "pdf"}),
                            },
                        }
                    ],
                },
                "finish_reason": "tool_calls",
            }
        ],
    }


def _text_body(text="Hello! How can I help?"):
    """Build a canned OpenAI chat-completions response carrying plain text."""
    return {
        "id": "chatcmpl-2",
        "choices": [
            {"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}
        ],
    }


def _make_client(handler, **kwargs):
    """Build an LLMClient whose HTTP layer is the given mock handler."""
    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    return LLMClient(api_key="primary-key", base_url=BASE_URL, model=MODEL, http_client=http_client, **kwargs)


def test_tool_call_parsed_from_primary():
    """A well-formed tool call is parsed; provider recorded as omniroute."""
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["payload"] = json.loads(request.content.decode())
        return httpx.Response(200, json=_tool_call_body())

    client = _make_client(handler)
    result = client.complete(MESSAGES, TOOLS)

    assert result == {"type": "tool_call", "name": "find_file", "arguments": {"query": "resume", "type": "pdf"}}
    assert client.last_provider == "omniroute"
    assert seen["url"] == f"{BASE_URL}/chat/completions"
    assert seen["auth"] == "Bearer primary-key"
    assert seen["payload"]["model"] == MODEL
    assert seen["payload"]["tool_choice"] == "auto"
    assert seen["payload"]["messages"] == MESSAGES


def test_plain_text_response_parsed():
    """A text-only model reply is returned as type text."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_text_body("Sure, I can help with that."))

    client = _make_client(handler)
    result = client.complete(MESSAGES, TOOLS)

    assert result == {"type": "text", "text": "Sure, I can help with that."}
    assert client.last_provider == "omniroute"


def test_primary_500_falls_back_to_gemini():
    """HTTP 500 on primary triggers the Gemini fallback with the fallback key."""
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if "generativelanguage.googleapis.com" in request.url.host:
            seen["fallback_auth"] = request.headers["authorization"]
            seen["fallback_url"] = str(request.url)
            return httpx.Response(200, json=_tool_call_body(arguments={"to": "a@b.com"}))
        return httpx.Response(500, json={"error": "primary exploded"})

    client = _make_client(handler, fallback_api_key="fallback-key")
    result = client.complete(MESSAGES, TOOLS)

    assert result == {"type": "tool_call", "name": "find_file", "arguments": {"to": "a@b.com"}}
    assert client.last_provider == "gemini"
    assert seen["fallback_auth"] == "Bearer fallback-key"
    assert seen["fallback_url"].startswith("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions")


def test_garbage_tool_args_retries_once_then_graceful():
    """Non-JSON tool arguments trigger exactly one retry, then graceful text, no exception."""
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(json.loads(request.content.decode())["messages"])
        body = _tool_call_body()
        body["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"] = "{not valid json"
        return httpx.Response(200, json=body)

    client = _make_client(handler)  # no fallback key: exactly one retry expected
    result = client.complete(MESSAGES, TOOLS)

    assert result == {"type": "text", "text": GRACEFUL}
    assert len(calls) == 2
    assert calls[1][0] == {"role": "system", "content": "Respond with strict JSON only."}
    assert calls[1][1:] == MESSAGES


def test_primary_fails_without_fallback_key_returns_graceful():
    """Primary down and no fallback configured: graceful text, no exception."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": "down"})

    client = _make_client(handler)
    result = client.complete(MESSAGES, TOOLS)

    assert result == {"type": "text", "text": GRACEFUL}
    assert client.last_provider == "none"


def test_primary_timeout_falls_back_to_gemini():
    """A transport-level timeout on primary also triggers the Gemini fallback."""
    def handler(request: httpx.Request) -> httpx.Response:
        if "generativelanguage.googleapis.com" in request.url.host:
            return httpx.Response(200, json=_text_body("Fallback here."))
        raise httpx.ConnectTimeout("connection timed out")

    client = _make_client(handler, fallback_api_key="fallback-key")
    result = client.complete(MESSAGES, TOOLS)

    assert result == {"type": "text", "text": "Fallback here."}
    assert client.last_provider == "gemini"
