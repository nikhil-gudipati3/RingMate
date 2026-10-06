# Exotel phone calling — setup guide

This connects a **real phone call** to RingMate through Exotel's AgentStream:
a caller dials your ExoPhone, Exotel opens a WebSocket to your server, and
RingMate talks back over the phone. The browser `/app/` experience is
untouched — this is a separate, server-side path.

```
Caller --phone--> ExoPhone 095-138-86363 --Exotel-->
    wss://<your-ngrok-host>/voice/exotel/stream --> RingMate server
```

## 1. What you need

- The RingMate server running on your laptop (same as for `/app/`).
- `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID` in `D:\ringmate\.env`
  (same keys the browser call UI already uses).
- Your Exotel **API key** and **API token** from
  `https://my.exotel.com/nocompany565/apisettings/site#api-credentials`.
- `ngrok` (to expose your laptop to Exotel).

## 2. Configure the server

Add to `D:\ringmate\.env` (never commit this file anywhere):

```
EXOTEL_API_KEY=<your Exotel API key>
EXOTEL_API_TOKEN=<your Exotel API token>
EXOTEL_ACCOUNT_SID=nocompany565
```

These stay **server-side only** — they are never sent to the browser.
(The `/web/voice_config` endpoint deliberately does not include them.)

## 3. Run the server and expose it

```powershell
# PowerShell 1 — the server (from D:\ringmate)
.\update.bat
.venv\Scripts\python -m uvicorn server.main:app --port 8000

# PowerShell 2 — public HTTPS/WSS URL for Exotel
ngrok http 8000
```

ngrok prints something like `https://abc123.ngrok.io`. Your AgentStream
WebSocket URL is:

```
wss://<EXOTEL_API_KEY>:<EXOTEL_API_TOKEN>@abc123.ngrok.io/voice/exotel/stream
```

(The `key:token@` part is how Exotel sends HTTP Basic auth — the server
checks it and rejects connections without it.)

Sanity check (booleans only, no secrets):

```
curl http://localhost:8000/voice/exotel/status
```

`auth_configured`, `stt_configured`, `tts_configured` should all be `true`.

## 4. Point Exotel at your server

1. In the Exotel dashboard, open **App Bazaar** and create a new flow
   (or edit the existing one).
2. Add a **Voicebot** applet (the bidirectional one — *not* the
   one-way Stream applet).
3. Configure it:
   - **URL**: the `wss://...` URL from step 3.
   - **Sample Rate**: `8000` (default — leave it; the server speaks 8 kHz).
   - **Authentication**: the credentials are already embedded in the URL;
     Exotel forwards them as an `Authorization: Basic` header.
4. Assign your ExoPhone (trial number `095-138-86363`) to this flow.
5. Keep the ngrok tunnel and the server running — if either stops, calls
   can't reach your laptop.

## 5. Test with a real phone call

1. From your mobile, dial **095-138-86363**.
2. Enter your PIN followed by `#` (trial numbers are shared, so Exotel
   asks for it).
3. You should hear RingMate's greeting ("Hello! I'm RingMate..."), then
   just talk. Try: *"what's the weather in Hyderabad"*.
4. Watch the server PowerShell window: each turn logs the transcript,
   the action, and the reply. Interrupt the bot mid-sentence to test
   barge-in — it should stop and listen.

## Notes and limitations

- **KYC**: Exotel documents that AgentStream access can require completed
  KYC. If the Voicebot applet refuses the WSS URL or the stream never
  connects while your KYC is still pending, that is expected — retry
  after approval. Everything server-side is already in place.
- **Trial number quirks**: callers hear "this is a trial number" and must
  enter the PIN. A rented ExoPhone (post-KYC) removes both.
- **Call length**: Exotel caps a stream session at 60 minutes.
- **Voice language**: the greeting follows `VOICE_LANGUAGE` (en/te/hi),
  but phone replies currently use the Cartesia voice. Telugu/Hindi
  replies work; the premium Sarvam voice used by `/app/` is not wired
  to the phone path yet (it returns MP3, the phone needs raw PCM).
- **One call at a time per conversation id**: each call gets its own
  `exotel:<call_sid>` conversation, separate from browser sessions.
- **DTMF**: keypad digits are logged but not acted on yet.
- If the caller hears silence: check the server log for
  `All phone TTS paths failed` (Cartesia key/voice missing and no ffmpeg
  for the Edge fallback), and confirm ngrok is still up.
