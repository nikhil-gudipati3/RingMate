"""Tests for the Plivo inbound voice calling flow (server/plivo_voice.py)."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server import plivo_voice
from server.config import Settings

PUB = "https://abc123.ngrok-free.app"
VOICE = "Polly.Aditi"


# -- pure XML builders -------------------------------------------------------
def test_answer_xml_greets_and_listens():
    xml = plivo_voice.build_answer_xml(PUB, VOICE)
    assert "<Speak" in xml and "RingMate" in xml
    assert "<GetInput" in xml
    assert f'action="{PUB}/plivo/hear"' in xml
    assert 'inputType="speech"' in xml
    assert 'speechModel="phone_call"' in xml
    assert "<Hangup/>" in xml  # silence fallback at the end


def test_turn_xml_speaks_reply_then_listens_again():
    xml = plivo_voice.build_turn_xml("It's 5 pm.", PUB, VOICE)
    assert "It&apos;s 5 pm." not in xml  # apostrophe needs no escaping
    assert "It's 5 pm." in xml
    assert xml.index("<Speak") < xml.index("<GetInput")


def test_turn_xml_escapes_reply():
    xml = plivo_voice.build_turn_xml("Fish & chips <yum>", PUB, VOICE)
    assert "Fish &amp; chips &lt;yum&gt;" in xml


def test_farewell_xml_hangs_up_without_listening():
    xml = plivo_voice.build_farewell_xml(VOICE)
    assert "Goodbye" in xml and "<Hangup/>" in xml
    assert "<GetInput" not in xml


def test_reprompt_xml_asks_to_repeat():
    xml = plivo_voice.build_reprompt_xml(PUB, VOICE)
    assert "<GetInput" in xml and "didn't hear" in xml


def test_goodbye_detection():
    assert plivo_voice.is_goodbye("thanks, goodbye!")
    assert plivo_voice.is_goodbye("ok bye")
    assert plivo_voice.is_goodbye("that's all for now")
    assert not plivo_voice.is_goodbye("what is the weather today")
    assert not plivo_voice.is_goodbye("")


def test_plivo_call_id_namespaces_conversations():
    assert plivo_voice.plivo_call_id("uuid-1") == "plivo:uuid-1"


# -- routes ------------------------------------------------------------------
class StubCore:
    def __init__(self, reply="It's 5 pm."):
        self.reply = reply
        self.turns = []
        self.dropped = []

    def handle_turn(self, call_id, user_text):
        self.turns.append((call_id, user_text))
        return {"reply_text": self.reply, "action": "none"}

    def drop_conversation(self, call_id):
        self.dropped.append(call_id)


def _client(core, plivo_enabled=True, public_url=PUB):
    app = FastAPI()
    app.state.settings = Settings(
        omniroute_api_key="k", omniroute_base_url="u", omniroute_model="m",
        gmail_user="g", gmail_app_password="p", user_email="u@e.com",
        server_public_url=public_url, plivo_enabled=plivo_enabled,
        plivo_voice=VOICE)
    app.state.agent_core = core
    app.include_router(plivo_voice.router)
    return TestClient(app, raise_server_exceptions=False)


def test_answer_route_disabled_returns_404():
    client = _client(StubCore(), plivo_enabled=False)
    r = client.post("/plivo/answer", data={"CallUUID": "x"})
    assert r.status_code == 404


def test_answer_route_needs_public_url():
    client = _client(StubCore(), public_url="")
    r = client.post("/plivo/answer", data={"CallUUID": "x"})
    assert r.status_code == 404


def test_answer_route_returns_xml():
    client = _client(StubCore())
    r = client.post("/plivo/answer", data={"CallUUID": "u1", "From": "+911234"})
    assert r.status_code == 200
    assert "application/xml" in r.headers["content-type"]
    assert "<Response>" in r.text and "<GetInput" in r.text


def test_hear_route_runs_brain_and_speaks_reply():
    core = StubCore(reply="Sunny, 32 degrees.")
    client = _client(core)
    r = client.post("/plivo/hear",
                    data={"CallUUID": "u1", "Speech": "weather in hyderabad"})
    assert r.status_code == 200
    assert "Sunny, 32 degrees." in r.text
    assert "<GetInput" in r.text  # conversation continues
    assert core.turns == [("plivo:u1", "weather in hyderabad")]


def test_hear_route_goodbye_hangs_up_and_drops_memory():
    core = StubCore()
    client = _client(core)
    r = client.post("/plivo/hear", data={"CallUUID": "u1", "Speech": "goodbye"})
    assert r.status_code == 200
    assert "<Hangup/>" in r.text and "<GetInput" not in r.text
    assert core.dropped == ["plivo:u1"]
    assert core.turns == []  # brain not consulted for a farewell


def test_hear_route_empty_speech_reprompts():
    core = StubCore()
    client = _client(core)
    r = client.post("/plivo/hear", data={"CallUUID": "u1", "Speech": ""})
    assert r.status_code == 200
    assert "didn't hear" in r.text and "<GetInput" in r.text
    assert core.turns == []


def test_hear_route_requires_call_uuid():
    client = _client(StubCore())
    r = client.post("/plivo/hear", data={"Speech": "hello"})
    assert r.status_code == 400


def test_hangup_route_drops_conversation():
    core = StubCore()
    client = _client(core)
    r = client.post("/plivo/hangup", data={"CallUUID": "u9"})
    assert r.status_code == 200
    assert core.dropped == ["plivo:u9"]


# -- outbound "call me" --------------------------------------------------------
def _call_client(core, **overrides):
    kwargs = dict(
        omniroute_api_key="k", omniroute_base_url="u", omniroute_model="m",
        gmail_user="g", gmail_app_password="p", user_email="u@e.com",
        server_public_url=PUB, plivo_enabled=True, plivo_voice=VOICE,
        plivo_auth_id="authid", plivo_auth_token="authtoken",
        plivo_caller_id="+919876543210", plivo_call_to="+919876543211")
    kwargs.update(overrides)
    app = FastAPI()
    app.state.settings = Settings(**kwargs)
    app.state.agent_core = core
    app.include_router(plivo_voice.router)
    return TestClient(app, raise_server_exceptions=False)


def test_valid_phone_accepts_e164():
    assert plivo_voice.valid_phone("+919876543210")
    assert plivo_voice.valid_phone("+12025551234")


def test_valid_phone_rejects_junk():
    assert not plivo_voice.valid_phone("")
    assert not plivo_voice.valid_phone("9876543210")  # missing +
    assert not plivo_voice.valid_phone("+91-98765-43210")
    assert not plivo_voice.valid_phone("+123")  # too short
    assert not plivo_voice.valid_phone("+1" + "2" * 16)  # too long


def test_call_route_disabled_returns_404():
    client = _call_client(StubCore(), plivo_enabled=False)
    r = client.post("/plivo/call", json={"to": "+919876543211"})
    assert r.status_code == 404


def test_call_route_needs_auth_credentials():
    client = _call_client(StubCore(), plivo_auth_id="", plivo_auth_token="")
    r = client.post("/plivo/call", json={"to": "+919876543211"})
    assert r.status_code == 400
    assert "PLIVO_AUTH_ID" in r.json()["detail"]


def test_call_route_rejects_bad_number():
    client = _call_client(StubCore(), plivo_call_to="")
    r = client.post("/plivo/call", json={"to": "not-a-number"})
    assert r.status_code == 400


def test_call_route_uses_configured_defaults(monkeypatch):
    seen = {}

    def fake_place(auth_id, auth_token, from_number, to_number, answer_url,
                   timeout=30):
        seen.update(from_number=from_number, to_number=to_number,
                    answer_url=answer_url, auth_id=auth_id)
        return "call-uuid-123"

    monkeypatch.setattr(plivo_voice, "place_outbound_call", fake_place)
    client = _call_client(StubCore())
    r = client.post("/plivo/call", json={})  # no body: use .env defaults
    assert r.status_code == 200
    assert r.json() == {"ok": True, "call_uuid": "call-uuid-123",
                        "to": "+919876543211"}
    assert seen["from_number"] == "+919876543210"  # PLIVO_CALLER_ID
    assert seen["to_number"] == "+919876543211"  # PLIVO_CALL_TO
    assert seen["answer_url"] == PUB + "/plivo/answer"
    assert seen["auth_id"] == "authid"


def test_call_route_body_overrides_defaults(monkeypatch):
    seen = {}

    def fake_place(auth_id, auth_token, from_number, to_number, answer_url,
                   timeout=30):
        seen.update(from_number=from_number, to_number=to_number)
        return "uuid-9"

    monkeypatch.setattr(plivo_voice, "place_outbound_call", fake_place)
    client = _call_client(StubCore())
    r = client.post("/plivo/call",
                    json={"to": "+14155551234", "from": "+14155559999"})
    assert r.status_code == 200
    assert seen["to_number"] == "+14155551234"
    assert seen["from_number"] == "+14155559999"


def test_call_route_plivo_error_becomes_502(monkeypatch):
    def fake_place(*args, **kwargs):
        raise plivo_voice.PlivoApiError("Plivo rejected the call (HTTP 401)")

    monkeypatch.setattr(plivo_voice, "place_outbound_call", fake_place)
    client = _call_client(StubCore())
    r = client.post("/plivo/call", json={"to": "+919876543211"})
    assert r.status_code == 502
    assert "Plivo rejected" in r.json()["detail"]


def test_place_outbound_call_posts_to_plivo_api(monkeypatch):
    import io
    import urllib.request

    captured = {}

    class FakeResp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return b'{"call_uuid": "abc-123"}'

    def fake_urlopen(req, timeout=None):
        captured["url"] = req.full_url
        captured["auth"] = req.headers.get("Authorization")
        captured["body"] = req.data.decode()
        return FakeResp()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    uuid = plivo_voice.place_outbound_call(
        "myid", "mytoken", "+91111", "+91222",
        "https://x.ngrok-free.dev/plivo/answer")
    assert uuid == "abc-123"
    assert captured["url"] == "https://api.plivo.com/v1/Account/myid/Call/"
    assert captured["auth"].startswith("Basic ")
    assert "from=%2B91111" in captured["body"]
    assert "to=%2B91222" in captured["body"]
    assert "answer_url=" in captured["body"] and "answer_method=POST" in captured["body"]


def test_place_outbound_call_raises_on_http_error(monkeypatch):
    import urllib.error
    import urllib.request

    def fake_urlopen(req, timeout=None):
        raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized",
                                     {}, None)

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(plivo_voice.PlivoApiError) as exc:
        plivo_voice.place_outbound_call("id", "tok", "+91111", "+91222",
                                        "https://x/plivo/answer")
    assert "401" in str(exc.value)
