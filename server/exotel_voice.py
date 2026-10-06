"""Exotel AgentStream phone voice path (v4.2.0 rebuild).

Lets a real phone caller talk to RingMate through Exotel's Voicebot applet:

    Caller -> ExoPhone -> Exotel -> wss://<server>/voice/exotel/stream

v4.2.0 architecture — one unified voice, zero overlap:
  * A strict per-call FIFO speech queue. Every utterance (greeting, filler,
    response) plays to COMPLETION. A response never preempts a filler; it
    waits its turn. The ONLY thing that interrupts playback is the caller's
    own barge-in. New-turn responses supersede stale queued ones, but never
    mid-utterance — only un-started queue items are dropped.
  * Smart contextual fillers: the instant a transcript is ready, an
    intent-aware filler ("Checking the weather in Hyderabad for you.") is
    queued while the agent works in parallel. The real response always waits
    for the filler to finish.
  * Streaming TTS: Cartesia's /tts/sse streams the first audio chunk long
    before synthesis completes; playback begins on first audio, not on full
    synthesis. Falls back to full-synthesis on any streaming failure.
  * Per-turn latency breakdown logging (stt / agent / tts-first-audio /
    tts-total) so improvements are measurable, not vibes.

The browser /app/ path is untouched: this module only *reads* shared pieces
(greeting text, AgentCore) and never changes /web/* behaviour.

Protocol reference: Exotel AgentStream developer guide
(https://developer.exotel.com/docs/agentstream/developer-guide).
Events Exotel -> us: connected / start / media / dtmf / mark / stop.
Events us -> Exotel: media / mark / clear.

All secrets come from the environment at call time (never import time —
server.config loads .env after this module may be imported):
    EXOTEL_API_KEY / EXOTEL_API_TOKEN   optional; when set, the WebSocket
                                        requires matching HTTP Basic auth
                                        (this is what the Voicebot applet
                                        sends when configured with
                                        wss://<key>:<token>@host/path).
    EXOTEL_ACCOUNT_SID                  optional; reserved for future
                                        outbound (Connect Voice AI) use.
    DEEPGRAM_API_KEY                    speech-to-text (shared with /app/).
    CARTESIA_API_KEY / CARTESIA_VOICE_ID text-to-speech, requested as raw
                                        8 kHz PCM so no resampling is needed.
"""
from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import io
import json
import logging
import math
import os
import re
import secrets
import shutil
import struct
import subprocess
import time
import wave

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

log = logging.getLogger("exotel_voice")

router = APIRouter()

# --------------------------------------------------------------------------
# Audio constants (Exotel AgentStream format)
# --------------------------------------------------------------------------
SAMPLE_RATE = 8000          # Hz
SAMPLE_WIDTH = 2            # 16-bit
CHANNELS = 1                # mono
BYTES_PER_SEC = SAMPLE_RATE * SAMPLE_WIDTH * CHANNELS  # 16000
# Outbound chunk: 3200 bytes = 200 ms of audio. Within Exotel's
# 3.2 KB - 100 KB window and a multiple of 320, as required.
OUT_CHUNK_BYTES = 3200
OUT_CHUNK_SEC = OUT_CHUNK_BYTES / BYTES_PER_SEC
# Pacing: send a touch faster than real time so we never fall behind the
# clock while staying well inside Exotel's tolerance.
PACE_FACTOR = 0.95

WS_PATH = "/voice/exotel/stream"

# Cartesia streaming TTS endpoint (Server-Sent Events).
CARTESIA_SSE_URL = "https://api.cartesia.ai/tts/sse"
CARTESIA_STREAM_TIMEOUT = 30.0


# --------------------------------------------------------------------------
# Pure helpers (no I/O — unit tested)
# --------------------------------------------------------------------------

def pcm16_rms(pcm: bytes) -> float:
    """Root-mean-square level of 16-bit LE mono PCM. 0.0 for empty input."""
    n = len(pcm) // 2
    if n == 0:
        return 0.0
    total = 0
    # struct.unpack is far faster than a Python loop over samples.
    for (sample,) in struct.iter_unpack("<h", pcm[: n * 2]):
        total += sample * sample
    return math.sqrt(total / n)


def resample_pcm16(pcm: bytes, src_rate: int, dst_rate: int = SAMPLE_RATE) -> bytes:
    """Linear-interpolation resample of 16-bit LE mono PCM. Pure stdlib."""
    if src_rate == dst_rate:
        return pcm
    n_src = len(pcm) // 2
    if n_src == 0:
        return b""
    src = struct.unpack(f"<{n_src}h", pcm[: n_src * 2])
    n_dst = max(1, round(n_src * dst_rate / src_rate))
    out = [0] * n_dst
    for i in range(n_dst):
        pos = i * (n_src - 1) / max(1, n_dst - 1) if n_dst > 1 else 0.0
        lo = int(pos)
        frac = pos - lo
        hi = min(lo + 1, n_src - 1)
        val = src[lo] + (src[hi] - src[lo]) * frac
        out[i] = int(max(-32768, min(32767, round(val))))
    return struct.pack(f"<{n_dst}h", *out)


def wav_wrap_pcm16(pcm: bytes, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Wrap raw 16-bit LE mono PCM in a WAV container (for Deepgram REST)."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(SAMPLE_WIDTH)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm)
    return buf.getvalue()


def chunk_pcm(pcm: bytes, size: int = OUT_CHUNK_BYTES) -> list[bytes]:
    """Split PCM into `size`-byte pieces (final piece may be shorter)."""
    return [pcm[i: i + size] for i in range(0, len(pcm), size)]


def pad_tail(piece: bytes, size: int = OUT_CHUNK_BYTES) -> bytes:
    """Pad a short final piece with silence to the required chunk size."""
    if len(piece) >= size:
        return piece
    return piece + b"\x00" * (size - len(piece))


def mask_number(number: str) -> str:
    """Mask a phone number for logs: keep only the last 4 digits."""
    digits = re.sub(r"\D", "", number or "")
    if len(digits) <= 4:
        return "****"
    return "*" * (len(digits) - 4) + digits[-4:]


# --------------------------------------------------------------------------
# Energy-based endpointing
# --------------------------------------------------------------------------

class EndpointDetector:
    """Speech/silence state machine over inbound PCM chunks.

    Emits "speech_start" on the idle->speech transition (used for barge-in)
    and "turn_end" after ~700 ms of trailing silence (or a max-turn guard).
    Short blips (< min_speech_ms of speech) are ignored. The 700 ms trailing
    silence matches the browser /app/ path's feel — fast enough to feel
    like a real call, long enough to survive natural pauses.
    """

    IDLE = "idle"
    SPEECH = "speech"

    def __init__(
        self,
        silence_ms: float = 700.0,
        min_speech_ms: float = 300.0,
        max_turn_ms: float = 20000.0,
        abs_floor: float = 300.0,
        floor_mult: float = 4.0,
        calibration_chunks: int = 5,
    ):
        self.silence_ms = silence_ms
        self.min_speech_ms = min_speech_ms
        self.max_turn_ms = max_turn_ms
        self.abs_floor = abs_floor
        self.floor_mult = floor_mult
        self.calibration_chunks = calibration_chunks
        self.state = self.IDLE
        self._noise_min: float | None = None
        self._calib_seen = 0
        self._speech_ms = 0.0
        self._silence_ms = 0.0

    def _threshold(self) -> float:
        if self._noise_min is None:
            return self.abs_floor
        return max(self._noise_min * self.floor_mult, self.abs_floor)

    def feed(self, pcm: bytes) -> str | None:
        """Feed one PCM chunk. Returns "speech_start" / "turn_end" / None."""
        chunk_ms = len(pcm) / BYTES_PER_SEC * 1000.0
        rms = pcm16_rms(pcm)

        if self._calib_seen < self.calibration_chunks:
            self._calib_seen += 1
            self._noise_min = rms if self._noise_min is None else min(self._noise_min, rms)

        voiced = rms >= self._threshold()

        if self.state == self.IDLE:
            if voiced:
                self.state = self.SPEECH
                self._speech_ms = chunk_ms
                self._silence_ms = 0.0
                return "speech_start"
            return None

        # state == SPEECH
        if voiced:
            self._speech_ms += chunk_ms
            self._silence_ms = 0.0
        else:
            self._silence_ms += chunk_ms

        if self._speech_ms >= self.max_turn_ms:
            self._reset()
            return "turn_end"
        if self._silence_ms >= self.silence_ms:
            if self._speech_ms >= self.min_speech_ms:
                self._reset()
                return "turn_end"
            # Blip: too short to be real speech — drop it, stay idle.
            self._reset()
            return None
        return None

    def _reset(self) -> None:
        self.state = self.IDLE
        self._speech_ms = 0.0
        self._silence_ms = 0.0


# --------------------------------------------------------------------------
# AgentStream message framing
# --------------------------------------------------------------------------

INBOUND_EVENTS = {"connected", "start", "media", "dtmf", "mark", "stop"}


def parse_exotel_event(raw: str) -> dict | None:
    """Parse one inbound WebSocket text frame. None = malformed/unknown."""
    try:
        msg = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(msg, dict) or msg.get("event") not in INBOUND_EVENTS:
        return None
    return msg


def decode_media_payload(msg: dict) -> bytes:
    """Base64-decode the PCM payload of an inbound `media` event."""
    try:
        return base64.b64decode(msg["media"]["payload"], validate=True)
    except (KeyError, TypeError, binascii.Error):
        return b""


def build_media_event(stream_sid: str, pcm: bytes) -> str:
    return json.dumps({
        "event": "media",
        "stream_sid": stream_sid,
        "media": {"payload": base64.b64encode(pcm).decode("ascii")},
    })


def build_mark_event(stream_sid: str, name: str) -> str:
    return json.dumps({
        "event": "mark",
        "stream_sid": stream_sid,
        "mark": {"name": name},
    })


def build_clear_event(stream_sid: str) -> str:
    return json.dumps({"event": "clear", "stream_sid": stream_sid})


def check_basic_auth(auth_header: str | None, api_key: str, api_token: str) -> bool:
    """Validate the `Authorization: Basic ...` header Exotel sends.

    When no API key is configured (local dev), auth is skipped — this is
    deliberate and logged at startup, never in production use.
    """
    if not api_key:
        return True
    if not auth_header or not auth_header.startswith("Basic "):
        return False
    expected = base64.b64encode(f"{api_key}:{api_token}".encode()).decode()
    return secrets.compare_digest(auth_header[6:].strip(), expected)


# --------------------------------------------------------------------------
# Smart contextual fillers
# --------------------------------------------------------------------------

_FILLER_STOPWORDS = frozenset(
    "the a an and for in of on is are was were how why when where who which "
    "that this with from about tell me give please my to do does did can could "
    "would will just now then there here it its it's what whats what's how's".split()
)
_FILLER_VERBS = frozenset(
    "send find search look get show email mail write compose check".split()
)


def _filler_keywords(transcript: str, limit: int = 2) -> str:
    """Content words for the file filler: 'send the resume' -> 'resume'."""
    words = re.findall(r"[a-zA-Z]{3,}", (transcript or "").lower())
    kept = [w for w in words
            if w not in _FILLER_STOPWORDS and w not in _FILLER_VERBS]
    return " ".join(kept[:limit])


def phone_filler_for(transcript: str) -> str:
    """Pick a MEANINGFUL filler naming what the agent is about to do.

    Called the instant a turn's transcript is ready, before the agent runs.
    The filler names the actual work ("Checking the weather in Hyderabad for
    you.") so the caller hears progress, not dead air — and the real
    response always waits for the filler to finish (see SpeechQueue).
    Language-aware via server.lang.t().
    """
    from server import websearch_tool
    from server.lang import t
    text = (transcript or "").lower()

    # Weather — name the place so the caller knows we heard it right.
    if re.search(r"\bweather\b", text):
        place = websearch_tool.requested_place(transcript)
        if place:
            return t("phone_filler_weather", place=place.strip().title())
        return t("phone_filler_weather_generic")
    # File search / send.
    if (re.search(r"\b(resume|file|document|pdf|photo|image|picture|report|"
                  r"sheet|note|presentation|ppt)\b", text)
            and re.search(r"\b(find|search|look|send|get|show|open)\b", text)):
        kw = _filler_keywords(transcript)
        if kw:
            return t("phone_filler_file", keywords=kw)
        return t("phone_filler_lookup")
    # Email.
    if re.search(r"\be-?mail\b", text) and re.search(
            r"\b(send|write|compose|draft)\b", text):
        return t("phone_filler_email")
    # Calendar.
    if re.search(r"\b(calendar|schedule|appointment|meeting)\b", text):
        return t("phone_filler_calendar")
    # Factual question — the agent may search or answer from knowledge.
    if text.rstrip().endswith("?") or re.match(
            r"\s*(what|who|when|where|why|how|which|is|are|do|does|did|can|could|"
            r"will|tell)\b", text):
        return t("phone_filler_lookup")
    return t("phone_filler_default")


# Pre-synthesized filler PCM cache: static fillers (no template params) are
# synthesized once at startup so the first audio of a turn is instant.
_FILLER_PCM_CACHE: dict[str, bytes] = {}


def _filler_cache_tag() -> str:
    tag_bits = (
        os.environ.get("CARTESIA_VOICE_ID", ""),
        os.environ.get("VOICE_LANGUAGE", "en"),
    )
    return hashlib.md5("|".join(tag_bits).encode()).hexdigest()[:12]


def get_filler_pcm(text: str) -> bytes | None:
    """Pre-synthesized PCM for a static filler, or None if not cached."""
    return _FILLER_PCM_CACHE.get(f"{_filler_cache_tag()}:{text}")


def warmup_phone_fillers() -> None:
    """Best-effort: pre-synthesize static filler PCM at startup.

    Only the templates without parameters are cached; contextual ones
    (weather place, file keywords) synthesize on demand via streaming TTS,
    which is fast for such short text.
    """
    from server.lang import t
    try:
        for key in ("phone_filler_email", "phone_filler_calendar",
                    "phone_filler_lookup", "phone_filler_default",
                    "phone_filler_weather_generic"):
            text = t(key)
            pcm = synthesize_phone_tts(text)
            if pcm:
                _FILLER_PCM_CACHE[f"{_filler_cache_tag()}:{text}"] = pcm
        log.info("Phone fillers warmed (%d cached)", len(_FILLER_PCM_CACHE))
    except Exception as exc:  # noqa: BLE001 — warmup must never break startup
        log.warning("Phone filler warmup failed: %s", exc)


# --------------------------------------------------------------------------
# Speech services (blocking — run in worker threads)
# --------------------------------------------------------------------------

def transcribe_deepgram(wav_bytes: bytes, api_key: str, language: str = "en",
                        timeout: float = 25.0) -> str:
    """Transcribe WAV audio via Deepgram's REST /listen API. Never raises."""
    if not api_key or not wav_bytes:
        return ""
    lang_map = {"te": "te", "hi": "hi", "ta": "ta", "kn": "kn", "ml": "ml"}
    lang = lang_map.get(language, "en")
    try:
        import httpx
        resp = httpx.post(
            "https://api.deepgram.com/v1/listen",
            params={"model": "nova-3", "language": lang, "smart_format": "true"},
            headers={"Authorization": f"Token {api_key}",
                     "Content-Type": "audio/wav"},
            content=wav_bytes,
            timeout=timeout,
        )
        if resp.status_code != 200:
            log.warning("Deepgram STT HTTP %s", resp.status_code)
            return ""
        data = resp.json()
        alts = data["results"]["channels"][0]["alternatives"]
        return (alts[0].get("transcript", "") if alts else "").strip()
    except Exception as exc:  # noqa: BLE001 — STT must never crash a call
        log.warning("Deepgram STT failed: %s", exc)
        return ""


def synthesize_cartesia_raw(text: str, api_key: str, voice_id: str,
                            timeout: float = 20.0) -> bytes:
    """Cartesia TTS requesting raw 8 kHz 16-bit PCM — the exact phone format.

    Returns b"" on any failure (never raises).
    """
    if not api_key or not voice_id or not text.strip():
        return b""
    try:
        import httpx
        resp = httpx.post(
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
                    "container": "raw",
                    "encoding": "pcm_s16le",
                    "sample_rate": SAMPLE_RATE,
                },
            },
            timeout=timeout,
        )
        if resp.status_code == 200 and resp.content:
            return resp.content
        log.warning("Cartesia TTS HTTP %s", resp.status_code)
        return b""
    except Exception as exc:  # noqa: BLE001 — TTS must never crash a call
        log.warning("Cartesia TTS failed: %s", exc)
        return b""


async def stream_cartesia_sse(text: str, api_key: str, voice_id: str,
                              timeout: float = CARTESIA_STREAM_TIMEOUT):
    """Stream raw 8 kHz PCM from Cartesia's /tts/sse endpoint.

    Async generator yielding PCM chunks as they are generated — the first
    chunk typically arrives long before synthesis completes. Yields nothing
    (never raises) when streaming is unavailable, so the caller can fall
    back to full synthesis.
    """
    clean = _clean_tts_text(text)
    if not api_key or not voice_id or not clean:
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                CARTESIA_SSE_URL,
                headers={
                    "X-API-Key": api_key,
                    "Cartesia-Version": "2024-06-30",
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                },
                json={
                    "model_id": "sonic-2",
                    "transcript": clean,
                    "voice": {"mode": "id", "id": voice_id},
                    "language": "en",
                    "output_format": {
                        "container": "raw",
                        "encoding": "pcm_s16le",
                        "sample_rate": SAMPLE_RATE,
                    },
                },
            ) as resp:
                if resp.status_code != 200:
                    log.warning("Cartesia SSE HTTP %s", resp.status_code)
                    return
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    try:
                        payload = json.loads(line[5:].strip())
                    except (json.JSONDecodeError, TypeError):
                        continue
                    ptype = payload.get("type")
                    if ptype == "chunk":
                        data = payload.get("data")
                        if data:
                            try:
                                chunk = base64.b64decode(data)
                            except (binascii.Error, TypeError):
                                continue
                            if chunk:
                                yield chunk
                        if payload.get("done"):
                            break
                    elif ptype in ("done", "error"):
                        if ptype == "error":
                            log.warning("Cartesia SSE error event: %s",
                                        str(payload)[:200])
                        break
    except Exception as exc:  # noqa: BLE001 — streaming is best-effort
        log.warning("Cartesia SSE streaming failed: %s", exc)
        return


def _edge_tts_mp3(text: str) -> bytes:
    """Edge TTS fallback (MP3). Never raises."""
    try:
        import asyncio as _asyncio
        import edge_tts

        async def _run() -> bytes:
            data = b""
            voice = os.environ.get("TTS_VOICE", "en-US-AvaMultilingualNeural")
            async for chunk in edge_tts.Communicate(text, voice).stream():
                if chunk["type"] == "audio":
                    data += chunk["data"]
            return data

        return _asyncio.run(_run())
    except Exception as exc:  # noqa: BLE001
        log.warning("Edge TTS failed: %s", exc)
        return b""


def _mp3_to_pcm8k(mp3: bytes) -> bytes:
    """Decode MP3 and resample to 8 kHz 16-bit mono PCM via ffmpeg.

    Returns b"" when ffmpeg is unavailable (never raises).
    """
    if not mp3 or not shutil.which("ffmpeg"):
        return b""
    try:
        proc = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error",
             "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar",
             str(SAMPLE_RATE), "pipe:1"],
            input=mp3, capture_output=True, timeout=60,
        )
        if proc.returncode != 0:
            log.warning("ffmpeg decode failed: %s", proc.stderr[:200])
            return b""
        return proc.stdout
    except Exception as exc:  # noqa: BLE001
        log.warning("ffmpeg decode error: %s", exc)
        return b""


def _clean_tts_text(text: str) -> str:
    return re.sub(r"[*_#`~]", "", text or "").strip()


def synthesize_phone_tts(text: str) -> bytes:
    """Phone-ready TTS: 8 kHz 16-bit mono PCM. Never raises.

    Path 1 (primary): Cartesia with raw PCM output at exactly 8 kHz —
    no decoding or resampling needed.
    Path 2 (fallback): Edge TTS MP3 decoded+resampled via ffmpeg.
    Returns b"" if nothing works (caller hears a brief silence; logged).
    """
    clean = _clean_tts_text(text)
    if not clean:
        return b""
    # Env is read here, not at import: .env loads after module import.
    cartesia_key = os.environ.get("CARTESIA_API_KEY", "")
    cartesia_voice = os.environ.get("CARTESIA_VOICE_ID", "")
    pcm = synthesize_cartesia_raw(clean, cartesia_key, cartesia_voice)
    if pcm:
        return pcm
    log.warning("Cartesia phone TTS unavailable, trying Edge TTS fallback")
    mp3 = _edge_tts_mp3(clean)
    pcm = _mp3_to_pcm8k(mp3)
    if not pcm:
        log.error("All phone TTS paths failed for %d chars", len(clean))
    return pcm


async def stream_phone_tts(text: str):
    """Best-effort streaming phone TTS: 8 kHz PCM chunks, as generated.

    Async generator. Tries Cartesia SSE first (first audio arrives far
    sooner than full synthesis); on any streaming failure falls back to
    the full-synthesis path yielded as a single chunk. Yields nothing
    (never raises) only when every path fails.
    """
    clean = _clean_tts_text(text)
    if not clean:
        return
    cartesia_key = os.environ.get("CARTESIA_API_KEY", "")
    cartesia_voice = os.environ.get("CARTESIA_VOICE_ID", "")
    got_any = False
    async for chunk in stream_cartesia_sse(clean, cartesia_key, cartesia_voice):
        got_any = True
        yield chunk
    if not got_any:
        log.info("Cartesia SSE yielded nothing; falling back to full synthesis")
        pcm = await asyncio.to_thread(synthesize_phone_tts, clean)
        if pcm:
            yield pcm


# In-memory cache of the greeting PCM so callers hear it instantly.
_GREETING_CACHE: dict[str, bytes] = {}


def get_greeting_pcm() -> bytes:
    """Language-aware greeting as 8 kHz PCM, cached per provider tag."""
    from server.web_routes import get_greeting_text  # local import: no cycle
    tag_bits = (
        os.environ.get("CARTESIA_VOICE_ID", ""),
        os.environ.get("VOICE_LANGUAGE", "en"),
        get_greeting_text(),
    )
    tag = hashlib.md5("|".join(tag_bits).encode()).hexdigest()[:12]
    if tag not in _GREETING_CACHE:
        _GREETING_CACHE[tag] = synthesize_phone_tts(get_greeting_text())
    return _GREETING_CACHE[tag]


def warmup_phone_greeting() -> None:
    """Best-effort: pre-synthesize the greeting PCM at startup (thread-safe)."""
    try:
        pcm = get_greeting_pcm()
        log.info("Phone greeting warmed (%d bytes)", len(pcm))
    except Exception as exc:  # noqa: BLE001 — warmup must never break startup
        log.warning("Phone greeting warmup failed: %s", exc)


def warmup_phone_voice() -> None:
    """Warm everything the phone path needs at startup: greeting + fillers."""
    warmup_phone_greeting()
    warmup_phone_fillers()


# --------------------------------------------------------------------------
# Strict FIFO speech queue — one unified voice, zero overlap
# --------------------------------------------------------------------------

# Item kinds. "greeting" plays once at call start; "filler" is the instant
# contextual progress sentence; "response" is the agent's real reply.
_KIND_GREETING = "greeting"
_KIND_FILLER = "filler"
_KIND_RESPONSE = "response"


class _SpeechItem:
    __slots__ = ("kind", "text", "turn_seq", "pcm")

    def __init__(self, kind: str, text: str, turn_seq: int,
                 pcm: bytes | None = None):
        self.kind = kind
        self.text = text
        self.turn_seq = turn_seq
        # Pre-synthesized PCM (greeting / cached filler): played directly,
        # skipping TTS entirely.
        self.pcm = pcm


class SpeechQueue:
    """Strict per-call FIFO speech queue: one voice, no overlap, ever.

    A single worker plays utterances one at a time, each to COMPLETION
    (verified by Exotel's mark echo, with a watchdog fallback). A response
    NEVER preempts a filler or another response — it waits its turn.

    The only thing that interrupts playback is the caller's barge-in
    (interrupt()): the current utterance stops, the queue drains, and a
    `clear` event tells Exotel to flush its playout buffer.

    Stale responses (an older turn's reply that hasn't started playing when
    a newer turn's reply arrives) are dropped from the queue — but an
    utterance already playing always finishes.
    """

    def __init__(self, stream_sid: str, send, tts_stream_fn=None):
        self.stream_sid = stream_sid
        # send: async callable taking a JSON string (websocket.send_text).
        self._send = send
        # tts_stream_fn: async generator fn(text) yielding PCM chunks.
        self._tts_stream_fn = tts_stream_fn or stream_phone_tts
        self._queue: asyncio.Queue[_SpeechItem] = asyncio.Queue()
        self._worker: asyncio.Task | None = None
        self._stopped = False
        self._playing = False
        self._interrupt = asyncio.Event()
        self._mark_echo = asyncio.Event()
        self._expected_mark = ""
        # Highest turn_seq whose response has been enqueued; older queued
        # responses are stale and get dropped.
        self._latest_response_seq = -1
        self.items_played = 0  # observability for tests/logs

    # -- public API ----------------------------------------------------
    def start(self) -> None:
        """Start the worker. Idempotent; call once per call."""
        if self._worker is None or self._worker.done():
            self._stopped = False
            self._worker = asyncio.create_task(self._run())

    def speak(self, text: str, kind: str = _KIND_RESPONSE, turn_seq: int = 0,
              pcm: bytes | None = None) -> None:
        """Enqueue an utterance. Never blocks, never preempts.

        For responses: drops queued-but-unstarted responses from older
        turns (they belong to superseded turns). Fillers and the greeting
        are never dropped by newer arrivals.
        """
        if self._stopped:
            return
        if kind == _KIND_RESPONSE:
            self._latest_response_seq = max(self._latest_response_seq, turn_seq)
            self._drop_stale_responses(turn_seq)
        self._queue.put_nowait(_SpeechItem(kind, text, turn_seq, pcm))

    def on_mark(self, name: str) -> None:
        """Route an inbound Exotel mark echo to the waiting worker."""
        if name and name == self._expected_mark:
            self._mark_echo.set()

    @property
    def playing(self) -> bool:
        return self._playing

    @property
    def depth(self) -> int:
        return self._queue.qsize()

    async def interrupt(self) -> None:
        """Caller barged in: stop the current utterance, drain the queue.

        Sends `clear` so Exotel flushes its playout buffer too.
        """
        self._interrupt.set()
        self._mark_echo.set()  # release a worker stuck waiting for echo
        # Drain everything queued (they belong to the interrupted moment).
        while True:
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            else:
                self._queue.task_done()
        try:
            await self._send(build_clear_event(self.stream_sid))
        except Exception as exc:  # noqa: BLE001
            log.warning("Failed to send clear event: %s", exc)
        self._playing = False

    async def stop(self) -> None:
        """End of call: stop the worker and release everything."""
        self._stopped = True
        self._interrupt.set()
        self._mark_echo.set()
        if self._worker is not None:
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass
            self._worker = None
        self._playing = False

    # -- internals -----------------------------------------------------
    def _drop_stale_responses(self, turn_seq: int) -> None:
        """Drop queued (un-started) responses older than turn_seq.

        Runs synchronously on the event loop with no awaits — atomic
        against the worker.
        """
        kept: list[_SpeechItem] = []
        while True:
            try:
                item = self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            self._queue.task_done()
            if item.kind == _KIND_RESPONSE and item.turn_seq < turn_seq:
                log.info("Dropping stale queued response from turn %d "
                         "(superseded by turn %d)", item.turn_seq, turn_seq)
                continue
            kept.append(item)
        for item in kept:
            self._queue.put_nowait(item)

    async def _run(self) -> None:
        try:
            while not self._stopped:
                item = await self._queue.get()
                try:
                    # A newer response may have superseded this one while it
                    # waited (e.g. enqueued just before the worker woke).
                    if (item.kind == _KIND_RESPONSE
                            and item.turn_seq < self._latest_response_seq):
                        log.info("Skipping stale response from turn %d",
                                 item.turn_seq)
                        continue
                    if await self._play_item(item):
                        self.items_played += 1
                finally:
                    self._queue.task_done()
        except asyncio.CancelledError:
            pass

    async def _play_item(self, item: _SpeechItem) -> bool:
        """Play one utterance to completion. Only interrupt() can stop it.

        Returns True when the utterance played fully (mark sent), False
        when it was interrupted or produced no audio.
        """
        self._playing = True
        self._interrupt.clear()
        total_sent = 0
        first_audio_at: float | None = None
        t_start = time.monotonic()
        try:
            if item.pcm:
                chunks = self._pcm_chunks(iter([item.pcm]))
            else:
                chunks = self._pcm_chunks(
                    self._tts_stream_fn(item.text))
            buf = bytearray()
            async for piece in self._paced_pieces(chunks, buf):
                if self._interrupt.is_set():
                    log.info("Playback interrupted mid-utterance (%s turn %d)",
                             item.kind, item.turn_seq)
                    return False
                try:
                    await self._send(build_media_event(self.stream_sid, piece))
                except Exception as exc:  # noqa: BLE001
                    log.warning("Send media failed: %s", exc)
                    return False
                if first_audio_at is None:
                    first_audio_at = time.monotonic()
                total_sent += len(piece)
            if self._interrupt.is_set():
                return False
            if total_sent == 0:
                log.warning("No audio produced for %s turn %d; skipping",
                            item.kind, item.turn_seq)
                return False
            # Mark AFTER the final chunk — this is the completion signal.
            # (Regression guard for the v4.1.0 truncation bug: the mark must
            # never be sent before the last byte is on the wire.)
            mark_name = f"{item.kind}-{item.turn_seq}-{int(t_start * 1000)}"
            self._expected_mark = mark_name
            self._mark_echo.clear()
            try:
                await self._send(build_mark_event(self.stream_sid, mark_name))
            except Exception as exc:  # noqa: BLE001
                log.warning("Send mark failed: %s", exc)
                return False
            # Wait for Exotel's echo; watchdog keeps the queue moving if it
            # never comes.
            audio_sec = total_sent / BYTES_PER_SEC
            timeout = max(10.0, audio_sec + 8.0)
            try:
                await asyncio.wait_for(self._mark_echo.wait(), timeout=timeout)
            except asyncio.TimeoutError:
                log.warning("Mark echo timed out on %s (%s); continuing",
                            self.stream_sid, mark_name)
            log.info("Utterance done: %s turn %d, %d bytes (%.1fs audio)%s",
                     item.kind, item.turn_seq, total_sent, audio_sec,
                     "" if first_audio_at is None else
                     f", first audio +{(first_audio_at - t_start) * 1000:.0f}ms")
            return True
        finally:
            self._expected_mark = ""
            self._playing = False

    async def _pcm_chunks(self, source):
        """Normalize a PCM source (sync iterable or async generator) into
        an async stream of raw PCM chunks."""
        if hasattr(source, "__aiter__"):
            async for chunk in source:
                if chunk:
                    yield bytes(chunk)
        else:
            for chunk in source:
                if chunk:
                    yield bytes(chunk)

    async def _paced_pieces(self, chunks, buf: bytearray):
        """Carve the PCM stream into paced 3200-byte pieces.

        Yields each piece after a real-time pacing sleep so Exotel receives
        audio at speaking pace. The final piece is silence-padded to the
        required chunk size.
        """
        async for chunk in chunks:
            if self._interrupt.is_set():
                return
            # Keep PCM16 frame alignment: never split a 2-byte sample.
            if len(chunk) % 2:
                chunk = chunk[:-1]
            buf.extend(chunk)
            while len(buf) >= OUT_CHUNK_BYTES:
                if self._interrupt.is_set():
                    return
                piece = bytes(buf[:OUT_CHUNK_BYTES])
                del buf[:OUT_CHUNK_BYTES]
                yield piece
                await asyncio.sleep(OUT_CHUNK_SEC * PACE_FACTOR)
        # Flush the tail (pad to the Exotel-required chunk size).
        if buf and not self._interrupt.is_set():
            tail = bytes(buf)
            if len(tail) % 2:
                tail = tail[:-1]
            if tail:
                yield pad_tail(tail)


# --------------------------------------------------------------------------
# Per-call session
# --------------------------------------------------------------------------

class PhoneCallSession:
    """State for one live Exotel call.

    `send` is an async callable taking a JSON string (normally
    `websocket.send_text`; injectable for tests). `stt_fn` is a blocking
    callable (injectable); `agent_fn` is the AgentCore.handle_turn callable;
    `tts_stream_fn` is an async-generator callable (injectable for tests).
    """

    def __init__(
        self,
        stream_sid: str,
        send,
        stt_fn=None,
        agent_fn=None,
        tts_stream_fn=None,
        store=None,
    ):
        self.stream_sid = stream_sid
        self._send = send
        self._stt_fn = stt_fn or self._default_stt
        self._agent_fn = agent_fn
        self._store = store
        self.speech = SpeechQueue(stream_sid, send, tts_stream_fn=tts_stream_fn)
        self.call_sid = ""
        self.from_number = ""
        self.call_id = f"exotel:{stream_sid}"  # AgentCore conversation key
        self.detector = EndpointDetector()
        self._turn_audio = bytearray()
        self._turn_seq = 0
        # Epoch: bumped on every barge-in and every new turn. A turn whose
        # agent result arrives under an old epoch is dropped — this is what
        # stops a superseded turn's reply from playing after the caller
        # moved on.
        self._epoch = 0
        self._ended = False
        self._dtmf_digits = ""

    # -- defaults ------------------------------------------------------
    @staticmethod
    def _default_stt(wav_bytes: bytes) -> str:
        key = os.environ.get("DEEPGRAM_API_KEY", "")
        lang = os.environ.get("VOICE_LANGUAGE", "en")
        return transcribe_deepgram(wav_bytes, key, language=lang)

    # -- event dispatch ------------------------------------------------
    async def handle_raw(self, raw: str) -> None:
        msg = parse_exotel_event(raw)
        if msg is None:
            log.warning("Ignoring malformed frame on %s", self.stream_sid)
            return
        event = msg["event"]
        if event == "start":
            await self._on_start(msg)
        elif event == "media":
            await self._on_media(msg)
        elif event == "dtmf":
            digit = (msg.get("dtmf") or {}).get("digit", "")
            self._dtmf_digits += str(digit)
            log.info("DTMF %s... on %s", mask_number(self._dtmf_digits)[-6:], self.stream_sid)
        elif event == "mark":
            name = (msg.get("mark") or {}).get("name", "")
            log.info("Playback finished (%s) on %s", name, self.stream_sid)
            self.speech.on_mark(name)
        elif event == "stop":
            await self._on_stop(msg)
        # "connected" needs no action.

    async def _on_start(self, msg: dict) -> None:
        start = msg.get("start") or {}
        self.call_sid = str(start.get("call_sid") or "")
        self.from_number = str(start.get("from") or "")
        if self.call_sid:
            self.call_id = f"exotel:{self.call_sid}"
        log.info("Call started: %s from %s",
                 self.call_id, mask_number(self.from_number))
        if self._store is not None:
            try:
                self._store.log(self.call_id, "system", "call_started",
                                f"from={mask_number(self.from_number)}")
            except Exception:  # noqa: BLE001 — logging must not break calls
                pass
        # Start the speech worker, then greet through the queue so the
        # caller never hears dead air. The greeting plays to completion;
        # only the caller's barge-in can cut it.
        self.speech.start()
        greeting_pcm = await asyncio.to_thread(get_greeting_pcm)
        if greeting_pcm:
            self.speech.speak("", kind=_KIND_GREETING, turn_seq=0,
                              pcm=greeting_pcm)
        else:
            log.error("No greeting audio; caller will hear silence until first turn")

    async def _on_media(self, msg: dict) -> None:
        pcm = decode_media_payload(msg)
        if not pcm:
            return
        signal = self.detector.feed(pcm)
        if signal == "speech_start":
            await self._barge_in()
        if self.detector.state == EndpointDetector.SPEECH or signal == "turn_end":
            self._turn_audio.extend(pcm)
        if signal == "turn_end":
            audio = bytes(self._turn_audio)
            self._turn_audio.clear()
            if len(audio) >= BYTES_PER_SEC // 2:  # >= 0.5 s of audio
                self._turn_seq += 1
                self._epoch += 1
                asyncio.create_task(
                    self._process_turn(self._turn_seq, self._epoch, audio))
            else:
                log.info("Dropping short turn (%d bytes)", len(audio))

    async def _on_stop(self, msg: dict) -> None:
        reason = ((msg.get("stop") or {}).get("reason")) or "unknown"
        log.info("Call ended: %s (%s)", self.call_id, reason)
        self._ended = True
        await self.speech.stop()

    # -- barge-in -------------------------------------------------------
    async def _barge_in(self) -> None:
        """Caller started speaking: stop bot audio, clear the queue.

        The epoch bump drops any in-flight agent work from before the
        interruption, so a superseded turn's reply can never play after
        the caller moved on.
        """
        self._epoch += 1
        if not self.speech.playing and self.speech.depth == 0:
            return
        log.info("Barge-in on %s: clearing bot audio", self.stream_sid)
        await self.speech.interrupt()

    # -- turn pipeline --------------------------------------------------
    async def _process_turn(self, turn_seq: int, epoch: int, audio: bytes) -> None:
        if self._ended:
            return
        t_turn = time.monotonic()
        wav = wav_wrap_pcm16(audio)
        text = await asyncio.to_thread(self._stt_fn, wav)
        stt_ms = (time.monotonic() - t_turn) * 1000
        text = (text or "").strip()
        if not text:
            log.info("Turn %d: empty transcript, skipping", turn_seq)
            return
        if epoch != self._epoch or self._ended:
            log.info("Turn %d: superseded before agent ran; dropping", turn_seq)
            return
        log.info("Turn %d caller: %s", turn_seq, text)

        # 1. Smart filler FIRST — queued instantly, names the real work.
        filler = phone_filler_for(text)
        filler_pcm = get_filler_pcm(filler)
        self.speech.speak(filler, kind=_KIND_FILLER, turn_seq=turn_seq,
                          pcm=filler_pcm)
        t_agent = time.monotonic()

        # 2. Agent runs IN PARALLEL with the filler playing.
        if self._agent_fn is None:
            log.error("No agent_fn configured; cannot answer turn %d", turn_seq)
            return
        try:
            result = await asyncio.to_thread(self._agent_fn, self.call_id, text)
        except Exception:  # noqa: BLE001 — agent must never crash the call
            log.exception("Agent turn %d failed", turn_seq)
            result = {"reply_text": "Sorry, I had trouble with that. Could you say it again?",
                      "action": "error"}
        agent_ms = (time.monotonic() - t_agent) * 1000
        reply = (result or {}).get("reply_text", "") or "..."
        action = (result or {}).get("action", "")
        log.info("Turn %d reply (action=%s): %s", turn_seq, action, reply)
        if self._store is not None:
            try:
                self._store.log(self.call_id, "agent", f"phone_turn:{action}", reply)
            except Exception:  # noqa: BLE001
                pass

        # 3. Superseded while thinking? Drop — never play a stale reply.
        if epoch != self._epoch or self._ended:
            log.info("Turn %d: superseded during agent run; dropping reply",
                     turn_seq)
            return

        # 4. Response queues BEHIND the filler. The queue guarantees the
        # filler finishes first — no mid-word cutoffs, ever.
        t_tts = time.monotonic()
        self.speech.speak(reply, kind=_KIND_RESPONSE, turn_seq=turn_seq)
        log.info("phone_latency turn=%d stt=%.0fms agent=%.0fms "
                 "filler_queued_at=%.0fms",
                 turn_seq, stt_ms, agent_ms,
                 (t_tts - t_turn) * 1000)


# Session factory hook: tests monkeypatch this to inject fakes.
_SESSION_FACTORY = None


def _make_session(websocket: WebSocket):
    if _SESSION_FACTORY is not None:
        return _SESSION_FACTORY(websocket)
    app = websocket.app
    agent_core = getattr(app.state, "agent_core", None)
    store = getattr(app.state, "store", None)
    return PhoneCallSession(
        stream_sid="",
        send=websocket.send_text,
        agent_fn=(agent_core.handle_turn if agent_core is not None else None),
        store=store,
    )


# --------------------------------------------------------------------------
# WebSocket endpoint
# --------------------------------------------------------------------------

@router.websocket(WS_PATH)
async def exotel_stream(websocket: WebSocket):
    """AgentStream endpoint. Exotel is the client; we stream audio both ways."""
    api_key = os.environ.get("EXOTEL_API_KEY", "")
    api_token = os.environ.get("EXOTEL_API_TOKEN", "")
    if not api_key:
        log.warning("EXOTEL_API_KEY not set: WebSocket auth disabled (dev mode)")
    if not check_basic_auth(websocket.headers.get("authorization"), api_key, api_token):
        log.warning("Rejecting AgentStream connection: bad/missing auth")
        await websocket.close(code=4401)
        return
    await websocket.accept()
    session = _make_session(websocket)
    log.info("AgentStream connected from %s", websocket.client)
    try:
        while True:
            raw = await websocket.receive_text()
            # The first `start` event carries the real stream_sid; adopt it.
            msg = parse_exotel_event(raw)
            if msg and msg["event"] == "start" and not session.stream_sid:
                sid = str((msg.get("start") or {}).get("stream_sid") or "")
                if sid:
                    session.stream_sid = sid
                    session.call_id = f"exotel:{sid}"
                    # Re-point the queue at the real stream sid.
                    session.speech.stream_sid = sid
            await session.handle_raw(raw)
    except WebSocketDisconnect:
        log.info("AgentStream disconnected: %s", session.call_id)
    except Exception:  # noqa: BLE001 — never leak a traceback to the socket
        log.exception("AgentStream error on %s", session.call_id)
    finally:
        await session._on_stop({"stop": {"reason": "disconnect"}})


@router.get("/voice/exotel/status")
def exotel_status() -> dict:
    """Operational status. Reports booleans only — never secret values."""
    return {
        "enabled": True,
        "stream_path": WS_PATH,
        "auth_configured": bool(os.environ.get("EXOTEL_API_KEY", "")),
        "account_configured": bool(os.environ.get("EXOTEL_ACCOUNT_SID", "")),
        "stt_configured": bool(os.environ.get("DEEPGRAM_API_KEY", "")),
        "tts_configured": bool(os.environ.get("CARTESIA_API_KEY", "")
                               and os.environ.get("CARTESIA_VOICE_ID", "")),
        "ffmpeg_available": bool(shutil.which("ffmpeg")),
    }
