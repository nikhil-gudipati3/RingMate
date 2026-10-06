"""Web routes: talk-page backend and the live console API.

POST /web/talk     {"text": ..., "call_id": ...} -> {"reply_text": ...}
GET  /console/events -> {"commands": [...], "log": [...], "status": {...}}

The talk page shares the exact same Agent Core as the phone call — the only
difference is the transport. `call_id` should be one stable id per browser
session (the page generates it) so multi-turn confirmation works.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import tempfile
import time
from pathlib import Path
from fastapi import APIRouter, File, Request, Response, UploadFile
from fastapi.responses import StreamingResponse

router = APIRouter(tags=["web"])

log = logging.getLogger("ringmate.web")

# Must match the greeting spoken by web/app.js on call start — pre-generated
# at startup so the first thing the caller hears has zero synthesis delay.
def get_greeting_text() -> str:
    """Language-aware greeting (feminine voice)."""
    from server.lang import get_lang
    lang = get_lang()
    if lang == "te":
        return "నమస్కారం! నేను రింగ్‌మేట్, మీ వ్యక్తిగత సహాయకురాలిని. నేను మీకు ఎలా సహాయపడగలను?"
    if lang == "hi":
        return "नमस्ते! मैं रिंगमेट हूँ, आपकी निजी सहायिका। मैं आपकी कैसे मदद कर सकती हूँ?"
    return "Hello! I'm RingMate, your personal assistant. How can I help you?"


GREETING_TEXT = "Hello! I'm RingMate, your personal assistant. How can I help you?"

_WEB_DEFAULT_CALL = "web-default"
_AUDIO_CACHE_DIR = Path("/tmp/ringmate_tts_cache")
_AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

_WHISPER_MODEL = None
_WHISPER_MODEL_NAME = os.environ.get("WHISPER_MODEL", "tiny.en")
_TTS_VOICE = os.environ.get("TTS_VOICE", "en-US-AvaMultilingualNeural")
_DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
_CARTESIA_API_KEY = os.environ.get("CARTESIA_API_KEY", "")
_CARTESIA_VOICE_ID = os.environ.get("CARTESIA_VOICE_ID", "")


@router.get("/web/greeting")
def web_greeting():
    """Language-aware greeting text."""
    return {"text": get_greeting_text()}


@router.get("/web/voice_config")
async def web_voice_config():
    """Tell the call page which pro voice services are configured.

    Keys are served to the local page only (this is a personal demo setup):
    the browser uses them to reach Deepgram/Cartesia directly for minimum
    latency. Empty string = not configured = local fallback path.
    """
    # Read at request time (not import time): web_routes is imported before
    # server.config runs load_dotenv(), so module-level reads miss .env keys.
    return {
        "deepgram_key": os.environ.get("DEEPGRAM_API_KEY", ""),
        "cartesia_key": os.environ.get("CARTESIA_API_KEY", ""),
        "cartesia_voice_id": os.environ.get("CARTESIA_VOICE_ID", ""),
        "whisper_model": os.environ.get("WHISPER_MODEL", "tiny.en"),
        "tts_voice": os.environ.get("TTS_VOICE", "en-US-AvaMultilingualNeural"),
        "voice_language": os.environ.get("VOICE_LANGUAGE", "en"),
        "sarvam_key": os.environ.get("SARVAM_API_KEY", ""),
    }


def get_whisper_model():
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        from faster_whisper import WhisperModel
        _WHISPER_MODEL = WhisperModel(_WHISPER_MODEL_NAME, device="cpu", compute_type="int8")
    return _WHISPER_MODEL


@router.post("/web/stt")
async def web_stt(file: UploadFile = File(...)):
    """Transcribe user-spoken audio using local faster-whisper (tiny.en).

    Whisper is CPU-bound, so the blocking transcription runs in a worker
    thread — never on the asyncio event loop, which would stall every other
    request (talk_stream, TTS, …) for the whole transcription.
    """
    try:
        content = await file.read()
        if not content:
            return {"text": ""}

        suffix = Path(file.filename or "audio.webm").suffix or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        def _transcribe(path: str) -> str:
            try:
                model = get_whisper_model()
                segments, _ = model.transcribe(path, beam_size=1)
                return " ".join(s.text for s in segments).strip()
            finally:
                try:
                    Path(path).unlink(missing_ok=True)
                except Exception:
                    pass

        text = await asyncio.to_thread(_transcribe, tmp_path)
        return {"text": text}
    except Exception as exc:
        return {"text": "", "error": str(exc)}


def _clean_tts_text(text: str) -> str:
    return re.sub(r'[*_#`~]', '', text).strip()


def _tts_provider_tag() -> str:
    """Cache-busting tag: changes when the TTS voice/provider/language changes."""
    voice_lang = os.environ.get("VOICE_LANGUAGE", "en")
    sarvam_key = os.environ.get("SARVAM_API_KEY", "")
    if voice_lang != "en" and sarvam_key:
        return f"sarvam-{voice_lang}"
    cartesia_key = os.environ.get("CARTESIA_API_KEY", "")
    cartesia_voice = os.environ.get("CARTESIA_VOICE_ID", "")
    if cartesia_key and cartesia_voice:
        return "cartesia-" + hashlib.md5(cartesia_voice.encode()).hexdigest()[:8]
    return "edge-" + hashlib.md5(_TTS_VOICE.encode()).hexdigest()[:8]


def _tts_cache_path(clean_text: str) -> Path:
    tag = _tts_provider_tag()
    cache_key = hashlib.md5((tag + ":" + clean_text).encode("utf-8")).hexdigest()
    return _AUDIO_CACHE_DIR / f"{tag}-{cache_key}.mp3"


async def _synthesize_tts(clean_text: str) -> bytes:
    """Synthesize speech; Cartesia first (premium voice), Edge TTS fallback.

    Returns b"" on any failure — TTS must never crash a call.
    """
    voice_lang = os.environ.get("VOICE_LANGUAGE", "en")
    # For Indic languages, prefer Sarvam Bulbul v3 (excellent Telugu/Hindi/etc).
    if voice_lang != "en":
        sarvam_key = os.environ.get("SARVAM_API_KEY", "")
        if sarvam_key:
            audio = await _synthesize_sarvam(clean_text, sarvam_key, voice_lang)
            if audio:
                return audio
            log.warning("Sarvam TTS failed, falling back to Cartesia/Edge")
    # Try Cartesia first if configured (singular premium voice for everything).
    cartesia_key = os.environ.get("CARTESIA_API_KEY", "")
    cartesia_voice = os.environ.get("CARTESIA_VOICE_ID", "")
    if cartesia_key and cartesia_voice:
        audio = await _synthesize_cartesia(clean_text, cartesia_key, cartesia_voice)
        if audio:
            return audio
        log.warning("Cartesia TTS failed, falling back to Edge TTS")
    # Fallback: Edge TTS (free, reliable).
    try:
        import edge_tts
        communicate = edge_tts.Communicate(clean_text, _TTS_VOICE)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        return audio_data
    except Exception as exc:  # noqa: BLE001 — TTS must never crash a call
        log.warning("TTS synthesis failed: %s", exc)
        return b""


async def _synthesize_sarvam(text: str, api_key: str, lang: str) -> bytes:
    """Synthesize via Sarvam Bulbul v3; returns b"" on failure.

    lang: 'te', 'hi', 'ta', etc. Maps to BCP-47 like 'te-IN'.
    """
    import base64
    # Map short codes to Sarvam's expected format.
    lang_map = {
        "te": "te-IN", "hi": "hi-IN", "ta": "ta-IN", "kn": "kn-IN",
        "ml": "ml-IN", "mr": "mr-IN", "gu": "gu-IN", "pa": "pa-IN",
        "bn": "bn-IN", "or": "od-IN",
    }
    target_lang = lang_map.get(lang, "te-IN")
    # Speakers confirmed compatible with bulbul:v3 (from Sarvam API error).
    speaker_map = {
        "te-IN": "priya", "hi-IN": "priya", "ta-IN": "priya",
        "kn-IN": "kavya", "ml-IN": "neha", "mr-IN": "priya",
        "gu-IN": "neha", "pa-IN": "simran", "bn-IN": "pooja",
    }
    speaker = speaker_map.get(target_lang, "priya")
    try:
        import httpx
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={"api-subscription-key": api_key},
                json={
                    "inputs": [text],
                    "target_language_code": target_lang,
                    "speaker": speaker,
                    "model": "bulbul:v3",
                    "output_audio_codec": "mp3",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                audios = data.get("audios", [])
                if audios:
                    return base64.b64decode(audios[0])
            log.warning("Sarvam TTS HTTP %s: %s", resp.status_code, resp.text[:200])
            return b""
    except Exception as exc:  # noqa: BLE001
        log.warning("Sarvam TTS error: %s", exc)
        return b""


async def _synthesize_cartesia(text: str, api_key: str, voice_id: str) -> bytes:
    """Synthesize via Cartesia Sonic-2; returns b"" on failure."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.cartesia.ai/tts/bytes",
                headers={
                    "X-API-Key": api_key,
                    "Cartesia-Version": "2024-06-30",
                    "Content-Type": "application/json",
                },
                json={
                    "model_id": "sonic-2",
                    "transcript": text,
                    "voice": {"mode": "id", "id": voice_id},
                    "output_format": {
                        "container": "mp3",
                        "encoding": "mp3",
                        "sample_rate": 44100,
                    },
                },
            )
            if resp.status_code == 200:
                return resp.content
            log.warning("Cartesia TTS HTTP %s: %s", resp.status_code, resp.text[:200])
            return b""
    except Exception as exc:  # noqa: BLE001
        log.warning("Cartesia TTS error: %s", exc)
        return b""


def warmup_tts_cache() -> None:
    """Best-effort: pre-generate the call greeting + instant fillers.

    Runs in a background thread at startup; network failure just means the
    first call synthesizes on demand as before. Pre-caching the 2-word
    fillers means the first audio of every turn serves from disk instantly.
    """
    import asyncio
    from server.lang import t

    fillers = (t("filler_on_it"), t("filler_one_moment"), t("filler_let_me_check"))
    texts = [get_greeting_text()] + [_clean_tts_text(f) for f in fillers]
    for text in texts:
        clean = _clean_tts_text(text)
        dest = _tts_cache_path(clean)
        if dest.exists():
            continue
        audio = asyncio.run(_synthesize_tts(clean))
        if audio:
            try:
                dest.write_bytes(audio)
            except OSError:
                pass


@router.get("/web/tts")
async def web_tts(text: str = ""):
    """Generate high-quality neural voice audio for spoken replies."""
    clean_text = _clean_tts_text(text)
    if not clean_text:
        return Response(content=b"", media_type="audio/mpeg", status_code=204)

    cache_file = _tts_cache_path(clean_text)
    if cache_file.exists():
        return Response(content=cache_file.read_bytes(), media_type="audio/mpeg")

    audio_data = await _synthesize_tts(clean_text)
    if audio_data:
        try:
            cache_file.write_bytes(audio_data)
        except OSError:
            pass
        return Response(content=audio_data, media_type="audio/mpeg")

    return Response(content=b"", media_type="audio/mpeg", status_code=204)


def _sse(obj: dict) -> str:
    return "data: " + json.dumps(obj) + "\n\n"


@router.post("/web/talk_stream")
def web_talk_stream(request: Request, payload: dict):
    """Streaming chat endpoint for the call UI (Server-Sent Events).

    Emits {"type": "sentence", "text": ...} as reply sentences are ready, then
    {"type": "done", "action": ...}. The browser starts TTS on the first
    sentence while later ones are still being produced — this is what makes
    the call feel instant.
    """
    core = request.app.state.agent_core
    text = str(payload.get("text") or "").strip()
    call_id = str(payload.get("call_id") or _WEB_DEFAULT_CALL)

    def gen():
        start = time.time()
        try:
            if core is None:
                yield _sse({"type": "sentence", "text": "Sorry, I'm not set up yet."})
                yield _sse({"type": "done", "action": "none"})
                return
            if not text:
                yield _sse({"type": "sentence",
                            "text": "I didn't catch that. Could you try again?"})
                yield _sse({"type": "done", "action": "none"})
                return
            for event in core.handle_turn_stream(call_id, text):
                yield _sse(event)
        except Exception:  # noqa: BLE001
            log.exception("talk_stream failed")
            yield _sse({"type": "sentence",
                        "text": "Sorry, something went wrong on my end."})
            yield _sse({"type": "done", "action": "none"})
        finally:
            request.app.state.last_latency_s = round(time.time() - start, 2)

    return StreamingResponse(gen(), media_type="text/event-stream")


@router.post("/web/talk")
def web_talk(request: Request, payload: dict):
    """Chat endpoint for the web-mic page."""
    core = request.app.state.agent_core
    if core is None:
        return {"reply_text": "Sorry, I'm not set up yet."}
    text = str(payload.get("text") or "").strip()
    if not text:
        return {"reply_text": "I didn't catch that. Could you try again?"}
    call_id = str(payload.get("call_id") or _WEB_DEFAULT_CALL)
    start = time.time()
    try:
        out = core.handle_turn(call_id, text)
    except Exception:  # noqa: BLE001
        return {"reply_text": "Sorry, something went wrong on my end."}
    finally:
        request.app.state.last_latency_s = round(time.time() - start, 2)
    return {"reply_text": out["reply_text"], "action": out["action"], "call_id": call_id}


@router.get("/web/oauth/authorize")
def oauth_authorize(request: Request):
    """Start the Google OAuth flow. Redirects to Google's consent screen."""
    from server import google_oauth
    from fastapi.responses import RedirectResponse, PlainTextResponse
    if not google_oauth.is_configured():
        return PlainTextResponse(
            "Google OAuth not configured. Set GOOGLE_CLIENT_ID and "
            "GOOGLE_CLIENT_SECRET in .env (from your client_secret JSON).",
            status_code=500)
    redirect_uri = str(request.base_url).rstrip("/") + "/web/oauth/callback"
    url = google_oauth.get_authorize_url(redirect_uri)
    if not url:
        return PlainTextResponse("Could not build authorize URL.", status_code=500)
    return RedirectResponse(url)


@router.get("/web/oauth/callback")
def oauth_callback(request: Request, code: str = "", state: str = ""):
    """Google redirects here after consent. Exchanges the code for tokens."""
    from server import google_oauth
    from fastapi.responses import HTMLResponse
    redirect_uri = str(request.base_url).rstrip("/") + "/web/oauth/callback"
    if not code:
        return HTMLResponse("<h2>Authorization failed</h2><p>No code returned.</p>",
                            status_code=400)
    res = google_oauth.exchange_code(code, redirect_uri)
    if res["ok"]:
        return HTMLResponse(
            "<h2>✅ Google connected!</h2>"
            "<p>RingMate can now manage your Calendar and search your Drive.</p>"
            "<p>You can close this tab and go back to the call.</p>")
    return HTMLResponse(
        f"<h2>Authorization failed</h2><p>{res.get('error', 'Unknown error')}</p>",
        status_code=400)


@router.get("/web/oauth/status")
def oauth_status():
    """Check Google connection status."""
    from server import google_oauth
    return {
        "configured": google_oauth.is_configured(),
        "authorized": google_oauth.is_authorized(),
    }


@router.get("/console/events")
def console_events(request: Request):
    """Live feed for the demo console page: queue, action log, agent status."""
    store = request.app.state.store
    settings = request.app.state.settings
    core = request.app.state.agent_core

    laptop_last_seen = getattr(request.app.state, "last_laptop_poll", None)
    if not laptop_last_seen:
        for entry in store.recent_log(limit=100):
            if entry["actor"] == "laptop":
                laptop_last_seen = entry["ts"]
                break

    provider = "none"
    if core is not None and getattr(core, "llm", None) is not None:
        provider = core.llm.last_provider

    return {
        "commands": store.recent_commands(limit=20),
        "log": store.recent_log(limit=50),
        "status": {
            "laptop_last_seen": laptop_last_seen,
            "model": settings.omniroute_model if settings else "",
            "provider": provider,
            "queue_pending": sum(1 for c in store.recent_commands(limit=50)
                                 if c["status"] == "pending"),
            "last_latency_s": getattr(request.app.state, "last_latency_s", None),
            "server_time": time.strftime("%H:%M:%S"),
        },
    }
