"""Tests for server.exotel_voice — the Exotel AgentStream phone path.

All speech services are faked: no network calls, no real credentials.
Each async scenario runs inside a single asyncio.run() so loop-bound
primitives (asyncio.Event) stay consistent.
"""
import asyncio
import base64
import json
import math
import struct
import threading
import time
import wave
import io

import pytest

from server import exotel_voice
from server.exotel_voice import (
    BYTES_PER_SEC,
    OUT_CHUNK_BYTES,
    EndpointDetector,
    PhoneCallSession,
    SpeechQueue,
    build_clear_event,
    build_mark_event,
    build_media_event,
    check_basic_auth,
    chunk_pcm,
    decode_media_payload,
    mask_number,
    pad_tail,
    parse_exotel_event,
    pcm16_rms,
    phone_filler_for,
    resample_pcm16,
    stream_cartesia_sse,
    synthesize_cartesia_raw,
    transcribe_deepgram,
    wav_wrap_pcm16,
)


# --------------------------------------------------------------------------
# Fake audio helpers
# --------------------------------------------------------------------------

def make_tone_pcm(duration_ms: float, freq: float = 440.0,
                  amplitude: int = 8000, rate: int = 8000) -> bytes:
    n = int(rate * duration_ms / 1000)
    return struct.pack(
        f"<{n}h",
        *(int(amplitude * math.sin(2 * math.pi * freq * i / rate))
          for i in range(n)),
    )


def make_silence_pcm(duration_ms: float, rate: int = 8000) -> bytes:
    n = int(rate * duration_ms / 1000)
    return b"\x00" * (n * 2)


CHUNK = make_silence_pcm(200)          # 3200 bytes = one ~200 ms frame
SPEECH_CHUNK = make_tone_pcm(200)     # loud enough to trip the detector


def media_event(pcm: bytes, stream_sid: str = "MZtest") -> str:
    return json.dumps({
        "event": "media",
        "sequence_number": "3",
        "stream_sid": stream_sid,
        "media": {
            "chunk": "2",
            "timestamp": "200",
            "payload": base64.b64encode(pcm).decode("ascii"),
        },
    })


def start_event(stream_sid: str = "MZtest", call_sid: str = "CA123") -> str:
    return json.dumps({
        "event": "start",
        "sequence_number": "1",
        "stream_sid": stream_sid,
        "start": {
            "stream_sid": stream_sid,
            "call_sid": call_sid,
            "account_sid": "ACx",
            "from": "+919391840769",
            "to": "+9109513886363",
            "custom_parameters": {},
            "media_format": {"encoding": "audio/x-raw",
                             "sample_rate": "8000", "bit_rate": "16"},
        },
    })


# --------------------------------------------------------------------------
# Pure helpers
# --------------------------------------------------------------------------

def test_pcm16_rms_silence_is_zero():
    assert pcm16_rms(make_silence_pcm(200)) == 0.0
    assert pcm16_rms(b"") == 0.0


def test_pcm16_rms_tone_scales_with_amplitude():
    quiet = pcm16_rms(make_tone_pcm(200, amplitude=2000))
    loud = pcm16_rms(make_tone_pcm(200, amplitude=8000))
    assert quiet > 0
    assert loud > quiet * 3  # ~4x amplitude -> ~4x RMS


def test_resample_16k_to_8k_halves_length():
    pcm16 = make_tone_pcm(1000, rate=16000)
    pcm8 = resample_pcm16(pcm16, 16000, 8000)
    assert abs(len(pcm8) - len(pcm16) // 2) <= 2
    # Energy preserved through resampling.
    assert abs(pcm16_rms(pcm8) - pcm16_rms(pcm16)) / pcm16_rms(pcm16) < 0.10


def test_resample_same_rate_is_passthrough():
    pcm = make_tone_pcm(200)
    assert resample_pcm16(pcm, 8000, 8000) == pcm


def test_resample_empty():
    assert resample_pcm16(b"", 16000, 8000) == b""


def test_wav_wrap_roundtrip():
    pcm = make_tone_pcm(300)
    wav_bytes = wav_wrap_pcm16(pcm)
    assert wav_bytes[:4] == b"RIFF"
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav:
        assert wav.getnchannels() == 1
        assert wav.getsampwidth() == 2
        assert wav.getframerate() == 8000
        assert wav.readframes(wav.getnframes()) == pcm


def test_chunk_pcm():
    pcm = b"\x01\x02" * 5000  # 10000 bytes
    pieces = chunk_pcm(pcm, 3200)
    assert [len(p) for p in pieces] == [3200, 3200, 3200, 400]
    assert b"".join(pieces) == pcm


def test_mask_number():
    assert mask_number("+919391840769") == "********0769"
    assert mask_number("") == "****"
    # Never leak the full number.
    assert "9391840769" not in mask_number("+919391840769")


# --------------------------------------------------------------------------
# Endpointing
# --------------------------------------------------------------------------

def test_detector_emits_speech_start_and_turn_end():
    det = EndpointDetector()
    for _ in range(5):                      # calibration silence
        assert det.feed(CHUNK) is None
    assert det.feed(SPEECH_CHUNK) == "speech_start"
    det.feed(SPEECH_CHUNK)
    det.feed(SPEECH_CHUNK)                  # 600 ms of speech
    for _ in range(3):                      # 600 ms trailing silence
        assert det.feed(CHUNK) is None
    assert det.feed(CHUNK) == "turn_end"     # 800 ms >= 700 ms -> turn end


def test_detector_turn_end_timing_is_700ms():
    """Trailing silence threshold matches the browser path's feel (~700ms)."""
    det = EndpointDetector()
    assert det.silence_ms == 700.0
    for _ in range(5):
        det.feed(CHUNK)
    det.feed(SPEECH_CHUNK)
    det.feed(SPEECH_CHUNK)
    # 600 ms of silence: not yet.
    assert det.feed(CHUNK) is None
    assert det.feed(CHUNK) is None
    assert det.feed(CHUNK) is None
    # 800 ms: turn ends.
    assert det.feed(CHUNK) == "turn_end"


def test_detector_ignores_short_blip():
    det = EndpointDetector()
    for _ in range(5):
        det.feed(CHUNK)
    det.feed(SPEECH_CHUNK)                  # single 200 ms blip (< 300 ms min)
    results = [det.feed(CHUNK) for _ in range(6)]
    assert all(r is None for r in results)
    assert det.state == EndpointDetector.IDLE


def test_detector_max_turn_guard():
    det = EndpointDetector(max_turn_ms=1000.0)
    for _ in range(5):
        det.feed(CHUNK)
    result = None
    for _ in range(10):                     # 2000 ms of continuous speech
        result = det.feed(SPEECH_CHUNK)
        if result == "turn_end":
            break
    assert result == "turn_end"


def test_detector_silence_only_never_fires():
    det = EndpointDetector()
    assert all(det.feed(CHUNK) is None for _ in range(30))


# --------------------------------------------------------------------------
# Message framing
# --------------------------------------------------------------------------

def test_parse_valid_events():
    assert parse_exotel_event(start_event())["event"] == "start"
    assert parse_exotel_event(media_event(CHUNK))["event"] == "media"
    assert parse_exotel_event('{"event": "stop"}')["event"] == "stop"
    assert parse_exotel_event('{"event": "connected"}')["event"] == "connected"


def test_parse_rejects_garbage():
    assert parse_exotel_event("not json") is None
    assert parse_exotel_event('{"event": "nonsense"}') is None
    assert parse_exotel_event('["event"]') is None
    assert parse_exotel_event("") is None


def test_decode_media_payload_roundtrip():
    pcm = make_tone_pcm(200)
    assert decode_media_payload(parse_exotel_event(media_event(pcm))) == pcm


def test_decode_media_payload_bad():
    assert decode_media_payload({"event": "media"}) == b""
    assert decode_media_payload(
        {"event": "media", "media": {"payload": "!!!"}}) == b""


def test_build_media_event_shape():
    pcm = make_tone_pcm(200)
    msg = json.loads(build_media_event("MZX", pcm))
    assert msg["event"] == "media"
    assert msg["stream_sid"] == "MZX"
    assert base64.b64decode(msg["media"]["payload"]) == pcm


def test_build_mark_and_clear_shapes():
    mark = json.loads(build_mark_event("MZX", "turn-1-end"))
    assert mark == {"event": "mark", "stream_sid": "MZX",
                    "mark": {"name": "turn-1-end"}}
    clear = json.loads(build_clear_event("MZX"))
    assert clear == {"event": "clear", "stream_sid": "MZX"}


def test_check_basic_auth():
    good = "Basic " + base64.b64encode(b"key123:tok456").decode()
    assert check_basic_auth(good, "key123", "tok456") is True
    bad = "Basic " + base64.b64encode(b"key123:wrong").decode()
    assert check_basic_auth(bad, "key123", "tok456") is False
    assert check_basic_auth(None, "key123", "tok456") is False
    assert check_basic_auth("Bearer x", "key123", "tok456") is False
    # Dev mode: no key configured -> allowed (logged at startup).
    assert check_basic_auth(None, "", "") is True


def test_speech_services_fail_closed_without_keys():
    # No network must be touched when keys are absent.
    assert transcribe_deepgram(b"RIFF....", "") == ""
    assert transcribe_deepgram(b"", "some-key") == ""
    assert synthesize_cartesia_raw("hello", "", "") == b""
    assert synthesize_cartesia_raw("", "k", "v") == b""


# --------------------------------------------------------------------------
# Mocked end-to-end turn: audio in -> filler + agent -> queued audio out
# --------------------------------------------------------------------------

class _StreamFakes:
    """Fakes for the v4.2.0 queue architecture.

    tts_stream yields the mapped PCM in two chunks (simulating streaming
    TTS); unmapped texts get default_pcm.
    """

    def __init__(self, pcm_map=None, default_pcm=None):
        self.sent: list[str] = []
        self.agent_calls: list[tuple] = []
        self.stt_wavs: list[bytes] = []
        self.pcm_map = pcm_map or {}
        self.default_pcm = default_pcm if default_pcm is not None \
            else make_tone_pcm(400)
        self.stream_calls: list[str] = []

    async def send(self, text: str):
        self.sent.append(text)

    def stt(self, wav: bytes) -> str:
        self.stt_wavs.append(wav)
        return "hello ringmate"

    def agent(self, call_id: str, text: str) -> dict:
        self.agent_calls.append((call_id, text))
        return {"reply_text": "Hi there!", "action": "none"}

    async def tts_stream(self, text: str):
        self.stream_calls.append(text)
        pcm = self.pcm_map.get(text, self.default_pcm)
        mid = len(pcm) // 2
        yield pcm[:mid]
        await asyncio.sleep(0)
        yield pcm[mid:]

    def media_payloads(self) -> list[bytes]:
        return [base64.b64decode(json.loads(s)["media"]["payload"])
                for s in self.sent
                if json.loads(s).get("event") == "media"]

    def marks(self) -> list[dict]:
        return [json.loads(s) for s in self.sent
                if json.loads(s).get("event") == "mark"]

    def clears(self) -> list[dict]:
        return [json.loads(s) for s in self.sent
                if json.loads(s).get("event") == "clear"]


def _make_session(fakes: _StreamFakes, stream_sid: str = "MZtest",
                  auto_mark_echo: bool = True) -> PhoneCallSession:
    """Session whose fake send echoes marks back (like Exotel would)."""
    session = PhoneCallSession(
        stream_sid=stream_sid, send=fakes.send,
        stt_fn=fakes.stt, agent_fn=fakes.agent,
        tts_stream_fn=fakes.tts_stream,
    )
    if auto_mark_echo:
        orig_send = fakes.send

        async def _send_and_echo(text: str):
            await orig_send(text)
            msg = json.loads(text)
            if msg.get("event") == "mark":
                session.speech.on_mark(msg["mark"]["name"])

        fakes.send = _send_and_echo
        session._send = _send_and_echo
        session.speech._send = _send_and_echo
    return session


def _drive_speech(session: PhoneCallSession, sid: str,
                  n_silence: int = 5, n_speech: int = 4,
                  n_trailing: int = 6):
    """Feed calibration silence, speech, trailing silence (returns a coro)."""
    async def _go():
        for _ in range(n_silence):
            await session.handle_raw(media_event(CHUNK, sid))
        for _ in range(n_speech):
            await session.handle_raw(media_event(SPEECH_CHUNK, sid))
        for _ in range(n_trailing):
            await session.handle_raw(media_event(CHUNK, sid))
    return _go()


async def _wait_for_mark(fakes: _StreamFakes, prefix: str, timeout: float = 20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if any(m["mark"]["name"].startswith(prefix) for m in fakes.marks()):
            return True
        await asyncio.sleep(0.05)
    return False


def _run_turn(greeting_pcm: bytes = b""):
    """Drive one full mocked call: start -> speech -> silence -> reply."""
    async def _scenario():
        filler_pcm = make_tone_pcm(200)   # 3200 bytes = 1 outbound chunk
        reply_pcm = make_tone_pcm(400)    # 6400 bytes = 2 outbound chunks
        fakes = _StreamFakes(pcm_map={"Hi there!": reply_pcm})
        # The default filler for "hello ringmate" is "Working on it."
        fakes.pcm_map["Working on it."] = filler_pcm
        session = _make_session(fakes)
        await session.handle_raw(start_event())
        await _drive_speech(session, session.stream_sid)
        # Wait for the response (not the filler) to finish playing.
        assert await _wait_for_mark(fakes, "response-1-")
        await session.handle_raw('{"event": "stop", "stop": {"reason": "callended"}}')
        return fakes, session

    return asyncio.run(_scenario())


@pytest.fixture
def no_greeting(monkeypatch):
    monkeypatch.setattr(exotel_voice, "get_greeting_pcm", lambda: b"")


def test_mocked_turn_end_to_end(no_greeting):
    fakes, session = _run_turn()

    # Agent got the transcript on a per-call conversation id.
    assert fakes.agent_calls == [("exotel:CA123", "hello ringmate")]
    assert session.call_id == "exotel:CA123"

    # STT received a valid WAV wrapping the caller's audio.
    assert len(fakes.stt_wavs) == 1
    assert fakes.stt_wavs[0][:4] == b"RIFF"

    # Filler played FIRST and fully, response played AFTER — strict order,
    # no overlap. Payloads reassemble to the exact TTS PCM (no truncation).
    payloads = fakes.media_payloads()
    filler_pcm = make_tone_pcm(200)
    reply_pcm = make_tone_pcm(400)
    assert b"".join(payloads) == filler_pcm + reply_pcm

    # Both utterances closed with their own mark (mark after final chunk).
    marks = fakes.marks()
    assert any(m["mark"]["name"].startswith("filler-1-") for m in marks)
    assert any(m["mark"]["name"].startswith("response-1-") for m in marks)


def test_outbound_chunks_meet_exotel_bounds(no_greeting):
    """Every chunk: 3.2 KB - 100 KB and a multiple of 320 bytes."""
    fakes, _ = _run_turn()
    for raw in fakes.sent:
        msg = json.loads(raw)
        if msg.get("event") != "media":
            continue
        n = len(base64.b64decode(msg["media"]["payload"]))
        assert 3200 <= n <= 100000, f"chunk size {n} out of bounds"
        assert n % 320 == 0, f"chunk size {n} not a multiple of 320"


def test_barge_in_sends_clear_and_drops_queue(no_greeting):
    async def _scenario():
        async def slow_stream(text: str):
            # 10 slow chunks so the utterance is mid-flight when we barge in.
            for _ in range(10):
                await asyncio.sleep(0.05)
                yield make_tone_pcm(200)

        fakes = _StreamFakes()
        session = _make_session(fakes, stream_sid="MZb")
        await session.handle_raw(start_event(stream_sid="MZb"))
        for _ in range(5):
            await session.handle_raw(media_event(CHUNK, "MZb"))
        session.speech._tts_stream_fn = slow_stream
        # Queue a long response plus two more behind it.
        session.speech.speak("long reply here", kind="response", turn_seq=1)
        session.speech.speak("second", kind="response", turn_seq=1)
        session.speech.speak("third", kind="response", turn_seq=1)
        deadline = time.time() + 10
        while not session.speech.playing and time.time() < deadline:
            await asyncio.sleep(0.05)
        assert session.speech.playing is True
        # Caller interrupts mid-utterance.
        await session.handle_raw(media_event(SPEECH_CHUNK, "MZb"))
        await asyncio.sleep(0.3)
        return fakes, session

    fakes, session = asyncio.run(_scenario())
    clears = fakes.clears()
    assert len(clears) >= 1
    assert clears[0]["stream_sid"] == "MZb"
    assert session.speech.playing is False
    # The queued (un-started) utterances were dropped, never played.
    assert session.speech.depth == 0
    # Only the interrupted first utterance produced audio; 2nd/3rd never did.
    assert session.speech.items_played == 0  # first item never completed


def test_empty_transcript_produces_no_reply(no_greeting):
    async def _scenario():
        fakes = _StreamFakes()
        fakes.stt = lambda wav: "   "  # nothing heard
        session = _make_session(fakes, stream_sid="MZe")
        await session.handle_raw(start_event(stream_sid="MZe"))
        await _drive_speech(session, "MZe", n_trailing=8)
        await asyncio.sleep(1.0)  # let the background task run
        return fakes

    fakes = asyncio.run(_scenario())
    assert fakes.agent_calls == []          # agent never invoked
    assert fakes.media_payloads() == []     # no audio sent back


# --------------------------------------------------------------------------
# WebSocket endpoint smoke test (dev mode: no EXOTEL_API_KEY in env)
# --------------------------------------------------------------------------

def _test_env(monkeypatch, tmp_path):
    for k, v in {
        "OMNIROUTE_API_KEY": "orkey",
        "OMNIROUTE_BASE_URL": "https://example.com/v1",
        "OMNIROUTE_MODEL": "test-model",
        "GMAIL_USER": "me@example.com",
        "GMAIL_APP_PASSWORD": "apppass",
        "USER_EMAIL": "me@example.com",
        "DB_PATH": str(tmp_path / "exotel.db"),
    }.items():
        monkeypatch.setenv(k, v)
    monkeypatch.delenv("EXOTEL_API_KEY", raising=False)
    monkeypatch.delenv("EXOTEL_API_TOKEN", raising=False)


@pytest.fixture
def ws_client(monkeypatch, tmp_path):
    _test_env(monkeypatch, tmp_path)
    monkeypatch.setattr(exotel_voice, "get_greeting_pcm", lambda: b"")
    monkeypatch.setattr(exotel_voice, "warmup_phone_greeting", lambda: None)

    fakes = _StreamFakes(default_pcm=make_tone_pcm(400))

    def _factory(websocket):
        return PhoneCallSession(
            stream_sid="", send=websocket.send_text,
            stt_fn=fakes.stt, agent_fn=fakes.agent,
            tts_stream_fn=fakes.tts_stream,
        )

    monkeypatch.setattr(exotel_voice, "_SESSION_FACTORY", _factory)
    from fastapi.testclient import TestClient
    from server.main import app
    with TestClient(app) as client:
        yield client, fakes
    monkeypatch.setattr(exotel_voice, "_SESSION_FACTORY", None)


def test_websocket_full_call_flow(ws_client):
    client, fakes = ws_client
    received: list[str] = []

    def _drain(ws):
        try:
            for _ in range(10):
                received.append(ws.receive_text())
        except Exception:  # noqa: BLE001 — socket closed / test over
            pass

    with client.websocket_connect("/voice/exotel/stream") as ws:
        ws.send_text(start_event(stream_sid="MZws", call_sid="CAws"))
        for _ in range(5):
            ws.send_text(media_event(CHUNK, "MZws"))
        for _ in range(4):
            ws.send_text(media_event(SPEECH_CHUNK, "MZws"))
        for _ in range(6):
            ws.send_text(media_event(CHUNK, "MZws"))
        t = threading.Thread(target=_drain, args=(ws,), daemon=True)
        t.start()
        t.join(timeout=20)

    kinds = [json.loads(r).get("event") for r in received]
    assert "media" in kinds, f"no bot audio received; got {kinds}"
    marks = [json.loads(r) for r in received
             if json.loads(r).get("event") == "mark"]
    assert any(m["mark"]["name"].startswith("response-1-") for m in marks)
    assert fakes.agent_calls == [("exotel:CAws", "hello ringmate")]


def test_websocket_rejects_bad_auth(monkeypatch, tmp_path):
    _test_env(monkeypatch, tmp_path)
    monkeypatch.setenv("EXOTEL_API_KEY", "realkey")
    monkeypatch.setenv("EXOTEL_API_TOKEN", "realtoken")
    monkeypatch.setattr(exotel_voice, "warmup_phone_greeting", lambda: None)
    from fastapi.testclient import TestClient
    from server.main import app
    with TestClient(app) as client:
        # No Authorization header -> server closes the socket during connect.
        with pytest.raises(Exception):
            with client.websocket_connect("/voice/exotel/stream"):
                pass


def test_status_endpoint_reports_booleans_only(monkeypatch, tmp_path):
    _test_env(monkeypatch, tmp_path)
    monkeypatch.setenv("EXOTEL_API_KEY", "realkey")
    monkeypatch.setattr(exotel_voice, "warmup_phone_greeting", lambda: None)
    from fastapi.testclient import TestClient
    from server.main import app
    with TestClient(app) as client:
        body = client.get("/voice/exotel/status").json()
    assert body["auth_configured"] is True
    assert body["stt_configured"] is False
    # No secret values anywhere in the response.
    blob = json.dumps(body)
    assert "realkey" not in blob


# --------------------------------------------------------------------------
# v4.2.0: strict FIFO speech queue — one voice, zero overlap
# --------------------------------------------------------------------------

def _echo_queue(stream_sid="MZq", tts_stream_fn=None):
    """SpeechQueue whose fake send echoes marks back immediately."""
    sent: list[str] = []
    holder: dict = {}

    async def send(text: str):
        sent.append(text)
        msg = json.loads(text)
        if msg.get("event") == "mark" and "q" in holder:
            holder["q"].on_mark(msg["mark"]["name"])

    q = SpeechQueue(stream_sid, send, tts_stream_fn=tts_stream_fn)
    holder["q"] = q
    return q, sent


async def _wait_until(pred, timeout=15.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if pred():
            return True
        await asyncio.sleep(0.02)
    return False


def _events(sent):
    return [(json.loads(s).get("event"),
             json.loads(s).get("mark", {}).get("name", "")) for s in sent]


def test_queue_fifo_strict_order():
    async def _scenario():
        async def tts(text):
            yield {"a": make_tone_pcm(200), "b": make_tone_pcm(400),
                   "c": make_tone_pcm(200)}[text]

        q, sent = _echo_queue(tts_stream_fn=tts)
        q.start()
        # Same-turn fillers are never stale-dropped: pure FIFO order test.
        q.speak("a", kind="filler", turn_seq=1)
        q.speak("b", kind="filler", turn_seq=1)
        q.speak("c", kind="filler", turn_seq=1)
        assert await _wait_until(lambda: q.items_played == 3)
        await q.stop()
        return sent

    sent = asyncio.run(_scenario())
    payloads = [base64.b64decode(json.loads(s)["media"]["payload"])
                for s in sent if json.loads(s).get("event") == "media"]
    # Strict FIFO: a, then b, then c — byte-exact, in order.
    assert b"".join(payloads) == (make_tone_pcm(200) + make_tone_pcm(400)
                                 + make_tone_pcm(200))


def test_queue_no_overlap_invariant():
    """Utterance N+1's first audio goes out only after N's mark."""
    async def _scenario():
        media_times = []
        mark_times = []

        async def tts(text):
            yield make_tone_pcm(400)

        q, sent = _echo_queue(tts_stream_fn=tts)

        orig_send = q._send

        async def timed_send(text):
            msg = json.loads(text)
            if msg.get("event") == "media":
                media_times.append(time.monotonic())
            elif msg.get("event") == "mark":
                mark_times.append(time.monotonic())
            await orig_send(text)

        q._send = timed_send
        q.start()
        q.speak("first", kind="filler", turn_seq=1)
        q.speak("second", kind="filler", turn_seq=1)
        assert await _wait_until(lambda: q.items_played == 2)
        await q.stop()
        return media_times, mark_times

    media_times, mark_times = asyncio.run(_scenario())
    # 2 filler utterances x 2 chunks each = 4 media events, 2 marks.
    assert len(media_times) == 4
    assert len(mark_times) == 2
    # The 3rd media event (second utterance's first chunk) comes only
    # after the first utterance's mark.
    assert media_times[2] >= mark_times[0], \
        "second utterance audio started before first finished"


def test_queue_drops_stale_responses():
    """Older turn's un-started response is dropped when a newer one arrives."""
    async def _scenario():
        seen = []

        async def tts(text):
            seen.append(text)
            yield make_tone_pcm(200)

        q, sent = _echo_queue(tts_stream_fn=tts)
        # Worker NOT started yet: both responses queue up.
        q.speak("old reply", kind="response", turn_seq=1)
        q.speak("new reply", kind="response", turn_seq=2)
        q.start()
        assert await _wait_until(lambda: q.items_played == 1)
        await q.stop()
        return seen

    seen = asyncio.run(_scenario())
    assert seen == ["new reply"]  # stale turn-1 response never synthesized


def test_queue_greeting_never_dropped_as_stale():
    async def _scenario():
        seen = []

        async def tts(text):
            seen.append(text)
            yield make_tone_pcm(200)

        q, sent = _echo_queue(tts_stream_fn=tts)
        q.speak("", kind="greeting", turn_seq=0, pcm=make_tone_pcm(200))
        q.speak("reply", kind="response", turn_seq=5)
        q.start()
        assert await _wait_until(lambda: q.items_played == 2)
        await q.stop()
        return sent

    sent = asyncio.run(_scenario())
    # Both played: greeting first, then the response.
    assert len([s for s in sent if json.loads(s).get("event") == "media"]) == 2
    marks = [json.loads(s)["mark"]["name"] for s in sent
             if json.loads(s).get("event") == "mark"]
    assert marks[0].startswith("greeting-")
    assert marks[1].startswith("response-")


def test_epoch_drop_in_process_turn(no_greeting):
    """A turn superseded mid-agent-run never speaks its reply."""
    async def _scenario():
        fakes = _StreamFakes()
        release = threading.Event()
        started = threading.Event()

        def slow_agent(call_id, text):
            started.set()
            assert release.wait(timeout=15)
            return {"reply_text": "Hi there!", "action": "none"}

        fakes.agent = slow_agent
        session = _make_session(fakes, stream_sid="MZe")
        await session.handle_raw(start_event(stream_sid="MZe"))
        for _ in range(5):
            await session.handle_raw(media_event(CHUNK, "MZe"))
        for _ in range(4):
            await session.handle_raw(media_event(SPEECH_CHUNK, "MZe"))
        for _ in range(6):
            await session.handle_raw(media_event(CHUNK, "MZe"))
        # Agent is now thinking (epoch 1)... (poll async: blocking wait would
        # stall the event loop and the turn task could never run)
        assert await _wait_until(lambda: started.is_set(), timeout=10)
        # ...caller barges in with a short interjection (epoch 2) but does
        # NOT complete a new turn (only 600ms of trailing silence < 700ms),
        # so no new turn spawns — the old turn is simply superseded.
        await session.handle_raw(media_event(SPEECH_CHUNK, "MZe"))
        for _ in range(3):
            await session.handle_raw(media_event(CHUNK, "MZe"))
        release.set()
        await asyncio.sleep(1.5)  # let the stale turn finish
        await session.handle_raw('{"event": "stop", "stop": {"reason": "x"}}')
        return fakes

    fakes = asyncio.run(_scenario())
    # The superseded turn's reply was never synthesized...
    assert "Hi there!" not in fakes.stream_calls
    # ...but the barge-in turn's filler was (proves the new turn proceeded).
    assert any("Working on it." in c for c in fakes.stream_calls)


# --------------------------------------------------------------------------
# v4.2.0: smart contextual fillers
# --------------------------------------------------------------------------

def test_phone_filler_intents():
    assert phone_filler_for("whats the weather in hyderabad") == \
        "Checking the weather in Hyderabad for you."
    assert phone_filler_for("weather") == "Checking the weather for you."
    assert "resume" in phone_filler_for("send the resume to prasad").lower()
    assert "laptop" in phone_filler_for("find my passport photo").lower()
    assert phone_filler_for("send an email to prasad") == \
        "Composing that email now."
    assert phone_filler_for("whats on my calendar today") == \
        "Checking your calendar."
    assert phone_filler_for("who is the prime minister of india?") == \
        "Looking that up for you."
    assert phone_filler_for("hello ringmate") == "Working on it."
    assert phone_filler_for("") == "Working on it."


def test_phone_filler_never_empty_or_none():
    for text in ["weather in ", "send", "?", "   ", "tell me a joke"]:
        filler = phone_filler_for(text)
        assert isinstance(filler, str) and filler.strip()


# --------------------------------------------------------------------------
# v4.2.0: streaming TTS
# --------------------------------------------------------------------------

class _FakeSSEStream:
    def __init__(self, lines, status=200):
        self._lines = lines
        self.status_code = status

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def aiter_lines(self):
        for line, delay in self._lines:
            if delay:
                await asyncio.sleep(delay)
            yield line


class _FakeSSEClient:
    def __init__(self, lines, status=200):
        self._lines = lines
        self._status = status

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def stream(self, *args, **kwargs):
        return _FakeSSEStream(self._lines, self._status)


def _sse_lines_for(chunks, delays=None):
    lines = []
    for i, pcm in enumerate(chunks):
        b64 = base64.b64encode(pcm).decode()
        lines.append((f'data: {{"type": "chunk", "data": "{b64}", '
                      f'"done": false, "step_time": 10}}', 0))
        if delays:
            lines.append(("", delays[i]))
    lines.append(('data: {"type": "done", "done": true}', 0))
    return lines


def test_sse_parses_chunk_events(monkeypatch):
    c1, c2 = make_tone_pcm(200), make_tone_pcm(200)

    def fake_client(*a, **k):
        return _FakeSSEClient(_sse_lines_for([c1, c2]))

    monkeypatch.setattr("httpx.AsyncClient", fake_client)

    async def _go():
        return [c async for c in stream_cartesia_sse("hello", "k", "v")]

    assert asyncio.run(_go()) == [c1, c2]


def test_sse_http_error_yields_nothing(monkeypatch):
    def fake_client(*a, **k):
        return _FakeSSEClient([], status=500)

    monkeypatch.setattr("httpx.AsyncClient", fake_client)

    async def _go():
        return [c async for c in stream_cartesia_sse("hello", "k", "v")]

    assert asyncio.run(_go()) == []


def test_sse_first_chunk_before_stream_end(monkeypatch):
    """Streaming actually streams: first audio well before the last byte."""
    c1, c2 = make_tone_pcm(200), make_tone_pcm(200)

    def fake_client(*a, **k):
        return _FakeSSEClient(_sse_lines_for([c1, c2], delays=[0.4, 0.0]))

    monkeypatch.setattr("httpx.AsyncClient", fake_client)
    times = {}

    async def _go():
        t0 = time.monotonic()
        async for _ in stream_cartesia_sse("hello", "k", "v"):
            if "first" not in times:
                times["first"] = time.monotonic() - t0
        times["total"] = time.monotonic() - t0

    asyncio.run(_go())
    assert times["first"] < 0.25
    assert times["total"] >= 0.35
    assert times["first"] < times["total"] - 0.1


def test_full_pcm_plays_to_last_byte_truncation_regression():
    """Every synthesized byte reaches the caller; mark comes last."""
    pcm = make_tone_pcm(1000)  # 16000 bytes = exactly 5 outbound chunks

    async def odd_stream(text):
        for i in range(0, len(pcm), 1000):
            yield pcm[i:i + 1000]

    async def _scenario():
        q, sent = _echo_queue(tts_stream_fn=odd_stream)
        q.start()
        q.speak("long reply", kind="response", turn_seq=7)
        assert await _wait_until(lambda: q.items_played == 1)
        await q.stop()
        return sent

    sent = asyncio.run(_scenario())
    payloads = [base64.b64decode(json.loads(s)["media"]["payload"])
                for s in sent if json.loads(s).get("event") == "media"]
    assert b"".join(payloads) == pcm  # last byte included, nothing extra
    kinds = [json.loads(s).get("event") for s in sent]
    last_media = max(i for i, k in enumerate(kinds) if k == "media")
    mark_at = next(i for i, k in enumerate(kinds) if k == "mark")
    assert mark_at > last_media  # mark strictly after the final chunk


def test_tts_fallback_when_streaming_fails(monkeypatch):
    """SSE yields nothing -> full-synthesis fallback still speaks."""
    def fake_client(*a, **k):
        return _FakeSSEClient([], status=500)

    monkeypatch.setattr("httpx.AsyncClient", fake_client)
    fallback_pcm = make_tone_pcm(200)
    monkeypatch.setattr(exotel_voice, "synthesize_phone_tts",
                        lambda text: fallback_pcm)

    async def _scenario():
        q, sent = _echo_queue()  # default stream_phone_tts
        q.start()
        q.speak("hello", kind="response", turn_seq=1)
        assert await _wait_until(lambda: q.items_played == 1)
        await q.stop()
        return sent

    sent = asyncio.run(_scenario())
    payloads = [base64.b64decode(json.loads(s)["media"]["payload"])
                for s in sent if json.loads(s).get("event") == "media"]
    assert b"".join(payloads) == fallback_pcm


# --------------------------------------------------------------------------
# v4.2.0: latency breakdown logging
# --------------------------------------------------------------------------

def test_latency_breakdown_logged(no_greeting, caplog):
    import logging
    caplog.set_level(logging.INFO, logger="exotel_voice")
    fakes, session = _run_turn()
    assert fakes.agent_calls  # turn actually ran
    assert "phone_latency" in caplog.text
    assert "stt=" in caplog.text and "agent=" in caplog.text
    # Per-utterance first-audio timing from the worker.
    assert "first audio" in caplog.text
