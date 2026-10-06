# RingMate — Voice-First Personal AI Assistant

Talk to it over a **real phone call** or in a browser voice call: *"send me my latest resume"* — it finds the file on your laptop, asks for confirmation, and emails it to you. It can also check your Google Calendar, remember notes and facts about you, look up live information on the web, and speak Telugu and nine other Indian languages.

## Two ways to talk

| | Browser calling | Phone calling |
|---|---|---|
| How | Open `/app/`, press Talk | Dial the Exotel number, enter PIN |
| Speech input | Deepgram Nova-3 streaming STT, Silero v6 voice detection in-browser | Deepgram Nova-3 via Exotel AgentStream |
| Speech output | Cartesia Sonic-2, streamed sentence by sentence | Cartesia Sonic-2 over the phone line |
| Best for | Demos with visible logs | Real-world use — no app, no laptop needed |

One Agent Core serves both paths. The browser UI is untouched by phone-call changes.

## Architecture

```
BROWSER ──mic──▶ Silero VAD ──▶ Deepgram Nova-3 ──▶ POST /web/talk_stream (SSE)
    │      Cartesia Sonic-2 sentences, played in order
    ▼
FASTAPI SERVER ◀──poll── LAPTOP AGENT
  Agent Core (LLM tool loop)        │ searches allowed folders
  SQLite command queue              │ read-only by construction
  Gmail email tool                  │ file bytes move only after "yes"
    ▲
    │ WebSocket (AgentStream)
EXOTEL ──phone call──▶ Deepgram STT ──▶ Agent Core ──▶ Cartesia TTS ──▶ phone
```

The laptop polls the server (every ~3s) because home routers block incoming connections. File **bytes only move after the user says "yes"** — before that, only the file name travels.

## Low-latency voice pipeline

Replies start in under half a second because nothing waits for the whole turn:

1. **Smart fillers** — the agent says something meaningful instantly ("Checking the weather in Hyderabad for you") while it works, synthesized in parallel with the real answer.
2. **Streaming TTS** — Cartesia sends audio chunks as they're generated; playback starts with the first chunk, not the finished file.
3. **Strict speech queue** — filler always finishes fully before the answer begins; only your interruption (barge-in) can cut speech off. No mid-word cutoffs, no truncated replies.
4. **Knowledge-first answers** — the agent answers from its own knowledge for general facts and only searches the web for live/time-sensitive info. Irrelevant search results are discarded, never read aloud.

## Setup

```bash
cd ringmate
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # then fill in your keys (see below)
```

`.env` needs:

- `OMNIROUTE_API_KEY` + `OMNIROUTE_BASE_URL` + `OMNIROUTE_MODEL` (LLM gateway)
- `DEEPGRAM_API_KEY` (speech-to-text; free tier at deepgram.com)
- `CARTESIA_API_KEY` (text-to-speech)
- `GMAIL_USER` + `GMAIL_APP_PASSWORD` (Google Account → Security → App passwords)
- `USER_EMAIL` (your own inbox — confirmed files go here)
- `GOOGLE_CALENDAR_ICAL_URL` (optional, read-only: Google Calendar → Settings → your calendar → **Secret address in iCal format**). Treat this URL like a password — never commit it.
- `EXOTEL_API_KEY` + `EXOTEL_API_TOKEN` (for phone calling — server-side only, never in browser code)

## Run

```powershell
# 1. Server (D:\ringmate)
.venv\Scripts\python -m uvicorn server.main:app --port 8000

# 2. Laptop agent (D:\ringmate\laptop_agent)
..\.venv\Scripts\python agent.py

# 3. Phone calling: expose the server, then point Exotel at it
cloudflared.exe tunnel --url http://localhost:8000
# Copy the https://*.trycloudflare.com URL, then in the Exotel flow editor
# set the Voicebot applet's Stream URL to:
#   wss://<API_KEY>:<API_TOKEN>@<tunnel-host>/voice/exotel/stream
# (A Build-ExotelUrl.ps1 helper script builds this URL from your .env.)

# 4. Browser calling: http://localhost:8000/app/
#    Live console (for demo projection): http://localhost:8000/app/console.html
```

> Cloudflare quick tunnels get a new URL on every restart — leave the tunnel running, or re-run the applet update each time.

## Test

```bash
.venv/bin/python -m pytest tests/ -q            # 269 tests, all modules
.venv/bin/python -m server.eval_harness oracle  # 50-command harness, scripted LLM
.venv/bin/python -m server.eval_harness         # same, with your REAL LLM key
```

## Demo (5 tasks)

1. **Phone call** — dial in: *"What's the weather in Hyderabad?"*
2. **Send a file** — *"Send my resume to me"* → *"Is this the file?"* → *"Yes."*
3. **Calendar** — *"What's on my schedule today?"*
4. **Telugu** — *"ఈరోజు డేట్ ఏంటి?"*
5. **Memory** — *"Remember that my demo is tomorrow"* … later: *"What do you remember about me?"*

## Agent tools (19)

| Tool | What it does |
|---|---|
| `send_email` | Send a plain email (with optional file attachment) |
| `find_file` | Smart search of allowed laptop folders (typo-tolerant, understands "my latest resume"); warns when a named folder is not in the allowed list |
| `send_file` | Ask-to-confirm ("Is this the file?"), then upload + email a file |
| `read_file` | Read a text file's contents aloud as a short preview |
| `list_files` | List the most recently modified files |
| `search_drive` / `send_drive_file` | Find and send files from Google Drive |
| `calculate` | Safe math evaluator — no code execution |
| `check_calendar` | Read-only Google Calendar lookup (today/tomorrow/ISO date) |
| `create_event` / `reschedule_event` / `cancel_event` | Manage calendar events (always confirms first) |
| `web_search` | Live weather via wttr.in (multi-city supported), facts via Wikipedia |
| `get_datetime` | Current date/time, answered locally |
| `save_note` / `read_notes` / `delete_note` | Short-term notes |
| `remember_fact` / `recall_facts` | Long-term memory about the user, across calls |

When several files match, the agent names the top three and lets you pick ("the second one") before confirming the exact file — a file is never emailed without a recorded "yes".

## Modules & team

| Module | Files | Owner |
|---|---|---|
| Server, config, queue, agent routes | `server/main.py, config.py, queue_store.py, agent_routes.py` | Nikhil — AI Agent Developer |
| Agent Core ⭐ (LLM tool loop) | `server/agent_core.py` | Nikhil |
| Exotel phone voice path | `server/exotel_voice.py` | Nikhil |
| Web search, calendar, notes | `server/websearch_tool.py, calendar_tool.py, notes_tool.py` | Nikhil |
| Email delivery | `server/email_tool.py` | Tharun — Voice & API Specialist |
| Web UI + voice pipeline | `web/`, `server/web_routes.py` | Tharun |
| Laptop agent, file resolver, offline queue | `laptop_agent/` | Prasad — Backend Developer |

## Safety rules (enforced in code, not just docs)

- Laptop agent is read-only: only files inside configured `allowed_folders`; `..` escapes and symlink escapes blocked.
- Attachment size limit (`MAX_ATTACHMENT_MB`).
- No file is emailed without a recorded "yes" (AgentCore confirmation gate).
- Exotel credentials live server-side only — never in browser JavaScript.
- Every action is written to the SQLite `action_log`.

## Known limitations

- Real LLM + Gmail + Deepgram + Cartesia need the human's keys (see Setup) — tests use fakes.
- `web_search` uses keyless sources (Wikipedia, DuckDuckGo instant answers) — fine for weather and general facts, weak for live scores or breaking news.
- Cloudflare quick tunnels change URL on restart (see Run).
- Single-process in-memory conversation state (fine for the demo, not for scale).
