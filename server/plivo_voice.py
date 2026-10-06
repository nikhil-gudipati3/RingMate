"""Plivo voice calling for RingMate (turn-based, zero new dependencies).

Two ways to talk on a real phone:

INBOUND (needs a rented Plivo number):
1. Someone dials your Plivo number.
2. Plivo POSTs to ``/plivo/answer`` -> we return XML: a spoken greeting plus
   a ``<GetInput inputType="speech">`` that listens to the caller.
3. Plivo transcribes the speech and POSTs the text to ``/plivo/hear``.
4. We run the SAME AgentCore brain used by the browser UI and reply with XML:
   ``<Speak>`` the answer, then another ``<GetInput>`` to keep talking.
5. When the caller says goodbye we ``<Speak>`` a farewell and ``<Hangup/>``.
6. Plivo POSTs to ``/plivo/hangup`` at the end; we drop the call's memory.

OUTBOUND "call me" (no rented number needed — works on a trial account):
1. You verify your own mobile number in the Plivo console (OTP, no documents).
2. ``POST /plivo/call`` (or the "Call my phone" button on the web UI) tells
   the Plivo Calls API to ring your phone, using your verified number as the
   caller ID.
3. When you answer, Plivo fetches ``/plivo/answer`` and the same
   greet -> listen -> ``/plivo/hear`` conversation loop runs.

Setup (done once, see PLIVO_SETUP.md):
  * ``PLIVO_ENABLED=true`` and ``SERVER_PUBLIC_URL=https://<your-ngrok>.ngrok-free.dev``
  * Inbound: Plivo application Answer URL = ``.../plivo/answer``,
    Hangup URL = ``.../plivo/hangup``; attach the app to your Plivo number.
  * Outbound: ``PLIVO_AUTH_ID`` + ``PLIVO_AUTH_TOKEN`` from the console
    dashboard, ``PLIVO_CALLER_ID`` = your verified mobile, ``PLIVO_CALL_TO``
    = the number to ring.

Security note: Plivo signs webhooks (X-Plivo-Signature-V3). Signature
validation is intentionally NOT enforced here — this is a college demo
running behind a rotating ngrok URL. Do not expose these endpoints on a
permanent public server without adding it.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request
from xml.sax.saxutils import escape

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response

log = logging.getLogger("ringmate.plivo")

router = APIRouter(tags=["plivo"])

_GREETING = "Hi, this is RingMate. What can I do for you?"
_LISTEN_PROMPT = "I'm listening."
_FAREWELL = "Goodbye. Talk to you soon."
_SILENCE_ENDING = "I didn't catch that. Goodbye."
_REPROMPT = "Sorry, I didn't hear anything. Please go ahead."

# If the caller says any of these, we end the call politely.
_GOODBYE_PHRASES = (
    "goodbye", "bye", "hang up", "end the call", "that's all", "thats all",
    "that is all", "see you",
)

# Phrases that help Plivo's speech recognition with RingMate's vocabulary.
_ASR_HINTS = ("resume,email,weather,calendar,note,file,send,time,date,"
              "remind,find,call")


def plivo_call_id(call_uuid: str) -> str:
    """Conversation key for a Plivo call (keeps phone chats separate)."""
    return f"plivo:{call_uuid}"


def is_goodbye(speech: str) -> bool:
    lowered = (speech or "").lower()
    return any(phrase in lowered for phrase in _GOODBYE_PHRASES)


def _speak(text: str, voice: str) -> str:
    return f'<Speak voice="{escape(voice)}">{escape(text)}</Speak>'


def _listen(action_url: str, voice: str, prompt: str = _LISTEN_PROMPT) -> str:
    return (
        f'<GetInput action="{escape(action_url)}" method="POST" '
        f'inputType="speech" language="en-US" speechModel="phone_call" '
        f'executionTimeout="20" hints="{escape(_ASR_HINTS)}">'
        f"{_speak(prompt, voice)}</GetInput>"
    )


def _xml(body: str) -> Response:
    return Response(content=f"<Response>{body}</Response>",
                    media_type="application/xml")


def build_answer_xml(public_url: str, voice: str) -> str:
    """XML for an incoming call: greet, then start listening in a loop."""
    hear_url = public_url.rstrip("/") + "/plivo/hear"
    return (
        _speak(_GREETING, voice)
        + _listen(hear_url, voice)
        + _speak(_SILENCE_ENDING, voice)
        + "<Hangup/>"
    )


def build_turn_xml(reply_text: str, public_url: str, voice: str) -> str:
    """XML after the brain answered: speak the reply, then listen again."""
    hear_url = public_url.rstrip("/") + "/plivo/hear"
    return _speak(reply_text, voice) + _listen(hear_url, voice)


def build_farewell_xml(voice: str) -> str:
    return _speak(_FAREWELL, voice) + "<Hangup/>"


def build_reprompt_xml(public_url: str, voice: str) -> str:
    """Heard nothing intelligible — ask the caller to speak again."""
    hear_url = public_url.rstrip("/") + "/plivo/hear"
    return _listen(hear_url, voice, prompt=_REPROMPT)


def _plivo_settings(request: Request) -> tuple[str, str]:
    """Return (public_url, voice); raise 404 if voice calling is off."""
    settings = request.app.state.settings
    public_url = (settings.server_public_url or "").strip().rstrip("/")
    if not getattr(settings, "plivo_enabled", False) or not public_url:
        raise HTTPException(
            404,
            "Plivo voice calling is not configured. Set PLIVO_ENABLED=true and "
            "SERVER_PUBLIC_URL in .env, then restart the server.",
        )
    return public_url, settings.plivo_voice or "Polly.Aditi"


def _get_core(request: Request):
    core = request.app.state.agent_core
    if core is None:
        raise HTTPException(500, "Server not initialised")
    return core


def process_heard_speech(core, call_uuid: str, speech: str,
                         public_url: str, voice: str) -> str:
    """One caller utterance -> Plivo XML. Blocking; call from a thread."""
    speech = (speech or "").strip()
    if not speech:
        return build_reprompt_xml(public_url, voice)
    if is_goodbye(speech):
        core.drop_conversation(plivo_call_id(call_uuid))
        return build_farewell_xml(voice)
    result = core.handle_turn(plivo_call_id(call_uuid), speech)
    reply = (result.get("reply_text") or "").strip()
    if not reply:
        reply = "Sorry, I couldn't work that out. Could you say it again?"
    return build_turn_xml(reply, public_url, voice)


@router.post("/plivo/answer")
async def plivo_answer(request: Request):
    """Plivo calls this when the phone starts ringing."""
    form = await request.form()
    call_uuid = form.get("CallUUID", "?")
    log.info("Plivo inbound call ringing: CallUUID=%s From=%s", call_uuid,
             form.get("From", "?"))
    public_url, voice = _plivo_settings(request)
    return _xml(build_answer_xml(public_url, voice))


@router.post("/plivo/hear")
async def plivo_hear(request: Request):
    """Plivo POSTs the caller's transcribed speech here each turn."""
    form = await request.form()
    call_uuid = str(form.get("CallUUID", "") or "")
    speech = str(form.get("Speech", "") or "")
    if not call_uuid:
        raise HTTPException(400, "Missing CallUUID")
    public_url, voice = _plivo_settings(request)
    core = _get_core(request)
    # handle_turn can wait on the laptop queue; keep the event loop free.
    body = await asyncio.to_thread(process_heard_speech, core, call_uuid,
                                   speech, public_url, voice)
    return _xml(body)


@router.post("/plivo/hangup")
async def plivo_hangup(request: Request):
    """Call ended — forget this call's conversation."""
    form = await request.form()
    call_uuid = str(form.get("CallUUID", "") or "")
    if call_uuid:
        try:
            _get_core(request).drop_conversation(plivo_call_id(call_uuid))
        except HTTPException:
            pass
    return _xml("")


# -- outbound "call me" --------------------------------------------------------
class PlivoApiError(RuntimeError):
    """The Plivo Calls API rejected the request or was unreachable."""


_PHONE_RE = re.compile(r"^\+\d{7,15}$")


def valid_phone(number: str) -> bool:
    """Loose E.164 check: '+' followed by 7-15 digits."""
    return bool(_PHONE_RE.match((number or "").strip()))


def place_outbound_call(auth_id: str, auth_token: str, from_number: str,
                        to_number: str, answer_url: str,
                        timeout: int = 30) -> str:
    """Ask Plivo to ring ``to_number``; return the Plivo call UUID.

    Blocking (uses stdlib urllib); call from a thread. Raises
    :class:`PlivoApiError` when Plivo rejects the call or cannot be reached.
    """
    endpoint = (f"https://api.plivo.com/v1/Account/{auth_id}/Call/")
    payload = urllib.parse.urlencode({
        "from": from_number,
        "to": to_number,
        "answer_url": answer_url,
        "answer_method": "POST",
    }).encode()
    credentials = base64.b64encode(
        f"{auth_id}:{auth_token}".encode()).decode()
    req = urllib.request.Request(
        endpoint, data=payload, method="POST",
        headers={"Authorization": f"Basic {credentials}",
                 "Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:300]
        raise PlivoApiError(
            f"Plivo rejected the call (HTTP {exc.code}): {detail}") from exc
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise PlivoApiError(f"Could not reach Plivo: {exc}") from exc
    call_uuid = str(body.get("call_uuid") or body.get("request_uuid") or "")
    if not call_uuid:
        raise PlivoApiError(f"Plivo gave no call id: {str(body)[:200]}")
    return call_uuid


def _outbound_settings(request: Request) -> tuple[str, str, str, str, str]:
    """Return (public_url, voice, auth_id, auth_token); 404/400 if unusable."""
    public_url, voice = _plivo_settings(request)
    settings = request.app.state.settings
    auth_id = (getattr(settings, "plivo_auth_id", "") or "").strip()
    auth_token = (getattr(settings, "plivo_auth_token", "") or "").strip()
    if not auth_id or not auth_token:
        raise HTTPException(
            400,
            "Outbound calling needs PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN in "
            ".env (copy them from the Plivo console dashboard), then restart "
            "the server.",
        )
    return public_url, voice, auth_id, auth_token


@router.post("/plivo/call")
async def plivo_call(request: Request):
    """Ring a phone (outbound). Body: {"to": "+91...", "from": "+91..."}.

    ``to`` defaults to PLIVO_CALL_TO, ``from`` to PLIVO_CALLER_ID (your
    verified number) and finally to ``to``. Returns {"ok": true, "call_uuid"}.
    """
    try:
        body = await request.json()
    except (ValueError, json.JSONDecodeError):
        body = {}
    if not isinstance(body, dict):
        body = {}
    public_url, _voice, auth_id, auth_token = _outbound_settings(request)
    settings = request.app.state.settings
    to_number = str(body.get("to") or getattr(settings, "plivo_call_to", "")
                    or "").strip()
    from_number = str(body.get("from")
                      or getattr(settings, "plivo_caller_id", "")
                      or to_number).strip()
    if not valid_phone(to_number):
        raise HTTPException(
            400,
            "Give a destination number like +919876543210 — in the request "
            'body as {"to": "+91..."} or as PLIVO_CALL_TO in .env.',
        )
    if not valid_phone(from_number):
        raise HTTPException(
            400,
            "The caller ID must be a verified Plivo caller ID like "
            '+919876543210 — set PLIVO_CALLER_ID in .env (verify your own '
            "mobile number in the Plivo console first).",
        )
    answer_url = public_url.rstrip("/") + "/plivo/answer"
    log.info("Plivo outbound call: From=%s To=%s", from_number, to_number)
    try:
        call_uuid = await asyncio.to_thread(
            place_outbound_call, auth_id, auth_token,
            from_number, to_number, answer_url)
    except PlivoApiError as exc:
        raise HTTPException(502, str(exc)) from exc
    return JSONResponse({"ok": True, "call_uuid": call_uuid,
                         "to": to_number})
