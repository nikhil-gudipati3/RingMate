# RingMate BUILD_LOG

How the codebase was built, module by module. Read top-to-bottom for the story.

## Foundation (me)
- **Repo scaffold**: `ringmate/` with `server/`, `laptop_agent/`, `web/`, `tests/`,
  `eval/`, plus `requirements.txt`, `.gitignore`, `.env.example`. Venv at `.venv/`
  (system pip was locked by debian packages — venv is the documented path).
- **M1** `server/config.py`: fail-fast `Settings.load()` names every missing env var.
  Added `USER_EMAIL` (user's own inbox) after the Agent Core design needed it.
- **M5** `server/queue_store.py`: SQLite queue (`pending→claimed→done|expired`),
  atomic claim, 120s TTL expiry sweep, full `action_log`. Thread-safe.
- **M2** `server/tool_registry.py`: 4 tool schemas (OpenAI function format);
  `get_schedule` validates as "not implemented". Strict arg validation incl.
  email regex and enum checks.
- **API contract**: `server/agent_routes.py` (`/command`, `/agent/poll`,
  `/agent/result`, `/agent/upload`) written before the laptop agent so it had
  real endpoints to integrate against.
- Tests: 23 passed.

## Parallel build (4 subagents, me on M4)
- **M3** `server/llm_client.py` (subagent): OmniRoute primary + Gemini fallback,
  strict-JSON retry, never raises on garbage. 6 tests, mocked httpx.
- **M6** `server/email_tool.py` (subagent): Gmail SMTP+STARTTLS, MIME attachments,
  size guard before connecting. 5 tests, fake SMTP.
- **M8+M9** `laptop_agent/` (subagent): `safety.py` (path jail, size check, no
  write API by construction), `file_resolver.py` (ranked search), `agent.py`
  (poller with backoff). ~20-file fixture incl. tricky names. All green.
- **M10** `web/` (subagent): talk page + dark console per the design system
  (paper/ink/signal-orange, Clash Display + Inter + JetBrains Mono). Anti-slop
  audit: no gradients, no glassmorphism, no emoji icons.
- **M4** `server/agent_core.py` (me, hand-written loop): `handle_turn` with
  per-call conversation state, confirmation gate (file bytes move only after
  "yes"), laptop wait with expiry, graceful degradation. 8 tests with scripted
  LLM + simulated laptop incl. full find→confirm→upload→email thread.

## Fixes during integration
- `USER_EMAIL` added as required config; fixed my own test helpers that missed it.
- Added `python-multipart` to requirements (needed by `/agent/upload`).
- `httpx.Client()` crashed on this machine's `no_proxy` env format →
  `trust_env=False` default in `llm_client.py`.
- `web/app.js`: added per-page-load `call_id` so web confirmation is multi-turn safe.

## New agent abilities (no telephony)
- Removed Twilio entirely: `server/twilio_routes.py` deleted, no Twilio in
  `requirements.txt`, `.env.example`, tests, or docs. The demo call path is the
  browser voice UI (`web/` + `server/web_routes.py`) — no carrier, no ngrok.
- **M2** grew from 4 tools to 8: `check_calendar` (read-only Google Calendar via
  secret iCal URL, hand-written ICS parser, no new dependency), `web_search`
  (keyless DuckDuckGo instant answers), `get_datetime` (local clock),
  `save_note`/`read_notes` (local `notes.json`).
- **M4** `server/agent_core.py`: `handle_turn_stream` yields sentence events +
  done events; instant tools get spoken filler ("Checking your calendar.") while
  slow laptop/network work runs; `split_sentences` keeps replies TTS-friendly.

## Latency overhaul (browser voice pipeline)
- `POST /web/talk_stream`: SSE endpoint streaming
  `{"type":"sentence","text":...}` / `{"type":"done","action":...}` events.
- `/web/tts` responses cached on disk; the fixed greeting is pre-warmed at
  startup in a background thread.
- `web/app.js`: browser SpeechRecognition is the primary STT path (no upload),
  MediaRecorder + `/web/stt` (faster-whisper `tiny.en`) is the fallback; ordered
  sentence TTS queue fetches audio in parallel and plays strictly in order;
  silence-after-speech cut from 1.2s to 0.7s; listening resumes only after the
  stream and the TTS queue both drain.
- `/console/events` also reports `last_latency_s` and `server_time`.

## M11 eval update
- `eval/commands_40.json` → `eval/commands.json`, grown 40 → **50 cases**
  (10 new: calendar/search/datetime/notes/email).
- Harness installs deterministic fakes for `web_search`/`check_calendar` in
  oracle mode and scores the final tool call for multi-turn cases.
- Test suite: **105 passed, 1 skipped**.

## Verification
- `pytest tests/` (minus the live-server Selenium E2E): **105 passed, 1 skipped**
  (skip = permission test as root, legit).
- Eval oracle mode: **50/50 = 100%**.

## Left for the humans (needs your accounts)
1. ~~Twilio signup~~ — removed. Open the browser call UI on your phone instead.
2. Gmail app password + `USER_EMAIL` in `.env`.
3. OmniRoute (or Gemini/Groq) API key in `.env`.
4. Optional: Google Calendar secret iCal URL in `.env` (never commit it).
5. Run the real-LLM eval: `.venv/bin/python -m server.eval_harness` (target ≥90%).
6. One full voice-call rehearsal in the browser before demo day.

## v3 rewrite — smarter agent (2026-09-29)

**Why:** the file finder only matched literal substrings, gave up on any miss,
and the agent did too little. Rewrote the search and the agent brain.

**`laptop_agent/file_resolver.py` — token-based fuzzy search**
- Query is tokenized, filler words dropped ("send me my latest resume" → "resume").
- Filenames split on separators AND camelCase ("ProjectReport_Final.pdf" → report).
- Per-token scoring: exact (3) > prefix (2) > substring (1) > typo-tolerant fuzzy
  (difflib ≥ 0.8); short tokens (<3 chars) match exactly only.
- Whole-query contiguous bonuses keep exact filename hits ranked first.
- Generic words hint file types ("my photo" → images; "show my photos" lists all).
- `resolve()` = strong matches (every token matched); new `suggest()` = close
  partial matches for "did you mean ...?" prompts.

**`server/agent_core.py` — smarter conversations**
- New tools: `read_file` (speak a text file's contents), `list_files` (recent
  files), `calculate` (safe AST math — injection-proof), `delete_note`.
- "Did you mean ...?" flow: no strong match + suggestions → asks, and a "yes"
  sends the suggested file through the normal confirmation gate.
- Multiple matches → names top three, understands "the second one", then
  re-confirms the exact file before sending. Nothing is ever emailed without
  an explicit yes.
- Pending confirmations refactored into one shared `_handle_pending` used by
  both the plain and streaming turn paths; streaming speaks its filler
  ("Sending it now.") before the slow laptop work starts.
- Rewritten system prompt: keyword-only file queries, no guessing (web_search).

**`laptop_agent/agent.py`** — new `read_file` (text preview, binary refused) and
`list_files` commands; `find_file` reports now include `suggestions`.

**Strict testing**
- `tests/test_file_resolver.py`: 14 new smart-search tests (typos, stopwords,
  multi-word, camelCase, type hints, suggestions).
- `tests/test_agent_file_flow.py` (new, 20 tests): ordinal picks, suggestion
  flows, read/list/calculate/delete_note, calculator injection rejection,
  streaming filler order.
- `tests/test_e2e_file_flow.py` (new): REAL uvicorn server thread + REAL laptop
  agent subprocess + REAL files over HTTP — typo'd query ("resuem") finds the
  file, uploaded bytes verified byte-for-byte, text read aloud, recent files
  listed. Only the LLM and email are faked.
- Eval: 50 → **60 cases** (calculate, delete_note, read_file, list_files,
  suggestions, no-match); fake laptop handles the new commands.
- Test suite: **148 passed, 1 skipped**. Eval oracle: **60/60 = 100%**.

## v3.1 hotfix 2 (2026-09-30) — weather follow-ups + multi-city
Reported from real Windows 11 use: "weather in hyderabad as well as in dallas"
answered only Hyderabad; "what about dallas" and "whats the weather in america
dallas" also came back as Hyderabad weather.

- Added `update.bat`: after extracting a new zip OVER the old folder, double-click
  it and pip only downloads what is actually missing (reuses `.venv`), instead
  of reinstalling everything every time.

## v3.1 hotfix 3 (2026-09-30) — Gemini fallback URL bug
The Gemini fallback constant already contained `/chat/completions`, but `_post()`
appends that path itself, so the fallback always called
`.../chat/completions/chat/completions` and 404'd. Fixed `_GEMINI_URL` to the
bare base `https://generativelanguage.googleapis.com/v1beta/openai`.
To run Gemini as the primary LLM: set `OMNIROUTE_API_KEY` to the Gemini key,
`OMNIROUTE_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`,
`OMNIROUTE_MODEL=gemini-3.8-flash` (2.0-flash is retired), restart the server.

## v3.1 hotfix 4 (2026-09-30) — fast file send + email anyone
Nikhil: "send the resume" was slow (error, then "is this the file?", then yes
before anything sent) and he wants it instant. Also wants to email anyone:
"send hi to xyz@gmail.com" should just send it.
- `find_file` gained an optional `purpose` arg ("find"/"send", default "find").
  The prompt tells the model to pass `purpose="send"` when the user wants the
  file sent. Exactly one strong match is then emailed to USER_EMAIL immediately
  with no confirmation round-trip; several matches still ask the user to pick.
- `send_email` already sent to any address with no confirmation; the tool
  description and prompt now say so explicitly with the xyz@gmail.com example.
- Tests: 180 passed, 1 skipped (6 new: fast-path send, multi-match still asks,
  email-to-anyone, 3x purpose validation).

## v3.1 hotfix 5 (2026-09-30) — file recipient was ignored
Nikhil's screenshot: "can you send my resume to gbprasad903@gmail.com" emailed
the file to HIS OWN inbox. `_do_send_file` hardcoded USER_EMAIL and no
recipient could pass through.
- `find_file` gained an optional `to` email arg (validated like send_email).
  The prompt tells the model to pass it when the user names a recipient
  address, and to ask for the address when only a person's name is given.
- The recipient is threaded through every pending dict (fast path, ask flow,
  "the second one" re-pick) into `_do_send_file`, which now sends to
  `pending["to"] or USER_EMAIL` and names the destination in its reply.
- Tests: 185 passed, 1 skipped (5 new: named-recipient fast path, recipient
  preserved through ordinal pick, 3x `to` validation).

## v3.1 Plivo voice calling (2026-09-30)
Nikhil got a funded Plivo account and asked for real phone calling.
- New `server/plivo_voice.py`: inbound calls hit `POST /plivo/answer` ->
  greeting + `<GetInput inputType="speech" speechModel="phone_call">`; each
  utterance POSTs to `/plivo/hear` -> the SAME AgentCore brain -> `<Speak>`
  reply + listen again. "Goodbye" -> farewell + `<Hangup/>`;
  `/plivo/hangup` drops the call's conversation. Zero new dependencies.
- Config: `PLIVO_ENABLED`, `PLIVO_VOICE` (default Polly.Aditi); reuses
  existing `SERVER_PUBLIC_URL` for webhook URLs. AgentCore gained
  `drop_conversation()`. New `PLIVO_SETUP.md` (ngrok tunnel + console steps).
- Tests: 200 passed, 1 skipped (15 new Plivo tests).

- **multi-city questions**: the extractor only handled one place, and phrasings
  like "weather *now* in X" failed to parse at all (silently falling back to the
  IP location). The tool now tries the whole place phrase first ("trinidad and
  tobago" stays one place), then splits on "as well as / and / , / plus / &" and
  answers each city that wttr.in can resolve.
- **dropped city on follow-ups**: the local model sometimes emits just
  `query="weather"` for "what about dallas", which used to answer for the IP
  location. `_do_web_search` now rebuilds the query from the user's own words
  (each candidate validated against wttr.in, so junk never becomes an answer),
  and the tool prompt tells the model to write follow-ups as complete questions.
- Tests: **174 passed, 1 skipped** (5 new weather tests). Eval oracle still 60/60.

## v3.1 hotfix (2026-09-30) — web search + file lookup repairs
Reported from real Windows 11 use: web search always failed, and naming an
exact file ("python_introduction.txt") or a folder path ("D:\PythonCourseWork\Day-01")
found nothing.

- **web_search was dead**: it used only the DuckDuckGo Instant Answer API, which
  now returns empty results for virtually all queries (verified live: weather,
  pin codes, even "capital of france" all empty). Rewrote `server/websearch_tool.py`:
  weather questions go to wttr.in (live conditions), factual questions go to
  Wikipedia (search + summary API, with a relevance guard so a quirky top hit
  can't produce a wrong answer), DDG kept as a last resort. Same return shape,
  so the agent core is untouched.
- **exact filenames with extensions failed**: "python_introduction.txt" tokenized
  to [python, introduction, txt] and "txt" never matched the stem, so the strong
  match required the impossible. A trailing known-extension token is now treated
  as a file-type filter, not a filename token.
- **folder paths poisoned the search**: "D:\PythonCourseWork\Day-01" contributed
  junk tokens (d, course, work, day, 01) that could never all match. Absolute
  paths are now detected (`extract_path_hint`), stripped from filename matching,
  and handled directly: an allowed directory is listed ("what files are in
  D:\Work"), an allowed file is returned as-is, and a path outside
  `allowed_folders` reports `path_not_allowed` instead of a misleading
  "couldn't find anything" — the agent tells the user exactly which folder to
  add to `agent_config.json`.
- New laptop→server statuses `path_not_allowed` / `dir_listing` accepted by
  `/agent/result`, `AgentCore._wait_for_result`, and the find/read flows
  (directory listings support "the second one" picking like normal candidates).
- **Test-isolation bug fixed**: the eval harness permanently replaced
  `websearch_tool.web_search` with its oracle fake and never restored it, so
  any test running after it silently used the fake. Added
  `_uninstall_oracle_fakes()` and a fixture in `test_eval_harness.py` that
  restores the real tools.
- Tests: 169 passed, 1 skipped (pre-existing skip). New: `test_websearch_tool.py`
  (7), path-hint/dir-listing tests in `test_file_resolver.py` (9),
  `test_laptop_agent.py` (3), `test_agent_core.py` (3).

## v3.2.6 — Hold-to-Talk force-takeover + version line (2026-10-02)

**Bug Nikhil reported**: the v3.2.5 Talk button felt dead — pressing it during
a stuck transcription did nothing. Root cause: `manualTalkStart()` ignored
presses unless the call was in LISTENING, but during the noise loop the app
spends most of its time in TRANSCRIBING (slow Whisper on noise audio), so the
button appeared broken exactly when needed.

**Fixes**:
- `web/app.js`: Hold-to-Talk now **force-takes-over from any state** — it
  bumps the turn token (stale timers/STT/SSE results die), aborts an
  in-flight `/web/stt` (new `sttAbortCtrl`), stops recognizer/recorders/audio,
  then starts manual capture. It can never feel dead again.
- Turn-token guards added to the agent reply callbacks (`onSentence`,
  `onDone`, 120s watchdog) so a taken-over turn can't clobber the new one.
- Call-start log now prints `RingMate web v3.2.6` — if the line is missing,
  the browser is running cached old code (hard-refresh with Ctrl+Shift+R).
- Script cache-buster bumped to `?v=3.2.6`.

**Testing**: node voice_turn 21/21; pytest 194 passed, 1 skipped; real-Chrome
e2e 34/34 (A normal 10/10, B slow-STT 5/5, C truncated-SSE 5/5, D hold-to-talk
8/8, E take-over-mid-transcription 6/6), zero JS errors.

## v3.2.5 — background-noise loop fix + Hold-to-Talk button (2026-10-02)

**Bug Nikhil reported**: said "send resume", waited 2-3 minutes — no reply,
just endless listening; background noise kept the app busy with nothing to
show for it. Root cause: continuous room noise (fan hum) kept the VAD above
threshold, so `speechMs` blew past the 300ms blip filter, no 2s silence ever
arrived, and the capture ran to the 45s MAX_TURN cap — which *submitted* 45s
of fan noise to Whisper. Slow transcription → empty result → re-listen →
immediate re-trigger: an infinite transcribe-noise loop his real command
could never break through.

**Fixes**:
- `web/voice_turn.js`: hitting the 45s cap now *cancels* the capture
  (`cancel-capture`, reason `max-turn-noise`) instead of submitting — 45s of
  unbroken sound is noise, never a turn. The wedge is structurally gone.
- `web/app.js`: empty-transcript backoff — 3 empty turns in a row pauses VAD
  auto-capture (`vadBackoff`) with a clear status message; any real turn
  clears it. The loop cannot spin forever anymore.
- **Hold-to-Talk button** (`web/index.html`, `web/app.js`, `web/styles.css`):
  press-and-hold bypasses the VAD entirely; release submits immediately.
  Deterministic turn-taking for noisy rooms and live demos.
- Script cache-buster bumped to `?v=3.2.5`.

**Testing**: node voice_turn 21/21 (incl. new max-turn-noise cancel test);
pytest 194 passed, 1 skipped; real-Chrome e2e 19/19 + new Hold-to-Talk run
(press → fake-mic speech → release → Whisper transcript → agent reply →
listening), zero JS errors.

## v3.2.4 — post-transcription stall fix + on-page activity log (2026-10-01)

**Bug Nikhil reported**: the call showed "Transcribing…" after he spoke, then
never replied.

**Root cause (browser race)**: `submitTurn()` armed a 4s safety timer. On a
slower laptop Whisper takes longer than 4s, so the timer fired while
`/web/stt` was still working, moved the call back to listening, and the late
but valid transcript was then silently discarded (`finishSubmit` required
`callState === 'SUBMITTING'`).

**Fixes**:
- Turn tokens (`turnSeq`): every submitted turn mints a token; all safety
  timers and async completions carry it and are inert once the turn moves on.
  The submit safety timer is now 8s and cannot fire while Whisper is running
  (`transcribeAndSend` leaves SUBMITTING immediately for TRANSCRIBING).
- Typed/yes-no/composer messages enter through `sendTypedTurn()`, which mints
  its own token (and cancels any voice turn still resolving).
- Timeouts everywhere a stall was possible: `/web/stt` fetch (60s abort),
  `/web/talk_stream` (90s abort), agent watchdog (120s), TTS drain (90s),
  per-sentence TTS fetch (20s abort).
- A stream that ends without a `done` event is now treated as done instead of
  wedging the call in "thinking".
- `/web/stt` runs faster-whisper in a worker thread (`asyncio.to_thread`) so
  transcription no longer blocks the server's event loop.
- Noise-blip filter in `web/voice_turn.js`: utterances shorter than 300ms of
  real speech are cancelled, not submitted (a door slam no longer triggers a
  pointless transcription).
- **On-page activity log** (the website, not the dev console): a Log button
  with an unread badge opens a drawer showing timestamped lines for every
  voice action — mic ready, speech detected, turn submitted, backup recorder,
  `/web/stt` start/done, transcript text, agent sentences, server tool calls
  (new SSE `log` events from `handle_turn_stream`), TTS progress, timeouts and
  recoveries. Copy/Clear buttons included.
- Script cache-buster bumped to `?v=3.2.4`.

**Testing**: node voice_turn 21/21; pytest 194 passed, 1 skipped; real-Chrome
e2e (fake mic + recorded human speech, real faster-whisper, stub LLM)
**19/19 PASS**: normal voice turn (VAD hears speech → submits after 2s
silence → backup audio hits /web/stt → Whisper transcribes real words →
agent replies → back to listening, no stall), a 6s-delayed `/web/stt`
(the old 4s race repro — the turn still completes with a reply), a
truncated SSE stream (recovers to listening, no "thinking" wedge), the log
drawer contents ([mic]/[vad]/[turn]/[stt]/[sse]/[agent] all present), and
zero page JS errors in every run.

## v4.0 — pro voice rewrite (2026-10-02)
Complete rewrite of the browser voice pipeline. The v3.2.x incremental fixes
could not overcome Chrome SpeechRecognition's network failures on the user's
hardware, so the entire call feature was rebuilt on professional-grade
components:

- **Silero neural VAD** (self-hosted ONNX, `web/vendor/`): replaces the
  hand-written energy threshold. Knows speech from fan noise. 700ms
  endpointing (was 2000ms).
- **TurnCore** (`web/voice_turn.js`): pure state machine
  (LISTENING→CAPTURING→ENDPOINTING→SUBMITTING), 15/15 node tests.
- **VoiceEngine** (`web/voice4.js`): browser glue — VAD, WAV encoding,
  Deepgram Nova-3 streaming STT (optional via DEEPGRAM_API_KEY), Whisper
  fallback. Chrome SpeechRecognition removed entirely.
- **Server**: `/web/voice_config` serves keys to the local page;
  `WHISPER_MODEL` (default base.en), `TTS_VOICE` (default
  en-US-AvaMultilingualNeural — more natural than Jenny).
- **Hold-to-Talk**: deterministic manual path, takeover from any state.

Hardcore e2e (real Chrome + real speech + stub Deepgram WS): 24/24 PASS —
Deepgram streaming path (10/10), Whisper fallback with real Harvard-word
transcription (8/8), Hold-to-Talk (4/4), typed fallback (2/2), zero JS errors.
Pytest: 196 passed, 1 skipped. No secrets, no telephony in the ZIP.

Optional: add `DEEPGRAM_API_KEY=...` to `.env` and restart the server for
~1s turn latency (streaming STT). Without it, the local Whisper path works
with zero new signups.

## v4.0.1 — hotfix (2026-10-02)
From Nikhil's live log (call-ihiba2g):
- Whisper took 48s for a 4s clip (base.en too slow on his CPU) — default
  WHISPER_MODEL reverted to tiny.en. If still slow, DEEPGRAM_API_KEY is the
  real fix (streaming STT, ~1s turns).
- Hold-to-Talk captured empty audio when the VAD was paused (backoff) —
  startManual() now unpauses the VAD for the duration of the hold.
- Quick taps submitted empty turns — stopManual() now emits 'manual-empty'
  instead of submitting when no audio frames arrived.
- Manual safety: auto-submit after 15s if pointerup is lost.

## v4.0.2 — Deepgram key fix (2026-10-02)
Critical bug: /web/voice_config returned empty deepgramKey even with the key
in .env. Root cause: web_routes.py is imported in main.py BEFORE server.config
runs load_dotenv(), so the module-level os.environ.get("DEEPGRAM_API_KEY")
executed before .env was loaded. Fixed by reading all keys at request time
inside web_voice_config() instead of at import time.

## v4.0.3 — Talk button uses Deepgram (2026-10-02)
Nikhil's live log showed Deepgram streaming works (transcripts + replies),
but Hold-to-Talk releases were sent to the broken local Whisper (/web/stt)
instead of waiting for Deepgram's final. Fix: when Deepgram is connected,
stopManual() now waits up to 3s for Deepgram's speech_final instead of
immediately submitting to /web/stt. The /web/stt fallback only runs if
Deepgram doesn't finalize in time.

## v4.0.4 — file send reliability fix (2026-10-02)
Nikhil's report: "send resume" threw "something went wrong" after 10-20s,
while the "is this the file?" -> yes flow worked fine. Root cause: the
"instant send" fast path (purpose='send' + exactly 1 match -> email
immediately) was unreliable. Removed the fast path entirely — find_file with
purpose='send' now always asks "Is this the file?" and sends after the user
confirms, matching the proven working flow. Updated tool description, system
prompt, and 2 tests.

## v4.0.5 — Windows strftime crash fix (2026-10-02)
Nikhil's server traceback showed: ValueError: Invalid format string at
format_mtime() line 162. The code used dt.strftime("%-I:%M %p") — the %-I
flag (hour without leading zero) works on Linux/macOS but throws on Windows.
This crashed every "send resume" (and any file confirmation) on his laptop.
Fixed to use dt.strftime("%I:%M %p").lstrip("0") which works on all platforms.

## v4.0.6 — Deepgram Talk finalization fix (2026-10-03)
Nikhil's v4.0.5 log showed: Talk released -> "waiting for Deepgram final"
-> 3s timeout -> fell back to local Whisper. Root cause: stopManual()
re-paused the VAD immediately on release, which stopped audio frames flowing
to Deepgram — Deepgram never got the silence it needs to detect end-of-speech
and finalize. Fix: when waiting for Deepgram, keep the VAD running until
Deepgram finalizes or the 3s timeout fires; only then restore the pre-manual
VAD state. Also added a guard against duplicate release events (pointerup +
pointercancel both firing).

## v4.0.7 — Deepgram REST for Talk button (2026-10-03)
The WebSocket streaming finalization was unreliable for Hold-to-Talk:
Deepgram often didn't send speech_final within the 3s wait, forcing a
fallback to broken local Whisper. New approach: when Talk is released and a
Deepgram key is configured, the captured audio is POSTed directly to
Deepgram's REST /v1/listen endpoint (nova-3). This is deterministic — no
depending on streaming endpointing. 10s timeout falls back to local Whisper.
The WebSocket is still used for auto VAD mode (which was working).

## v4.0.8 — Cartesia TTS + persistent memory (2026-10-03)
- Cartesia Sonic-2 TTS: when CARTESIA_API_KEY and CARTESIA_VOICE_ID are set in
  .env, ALL voice output uses Cartesia (singular premium voice). Falls back to
  Edge TTS if Cartesia fails or is not configured. TTS never crashes a call.
- Persistent memory: new MemoryStore (memory.json) + remember_fact/recall_facts
  tools. The agent remembers user facts (name, preferences, teammates) across
  calls. Memory is injected into the system prompt. "Remember my name is Nikhil"
  -> recalled in future calls.
- 14 tools total (was 12). All 204 tests pass.

## v4.0.9 — TTS cache is provider-aware (2026-10-03)
The greeting/fillers were cached with Edge TTS before the Cartesia key was
added, so the greeting still used the old voice. The cache key now includes
the TTS provider + voice ID — switching providers automatically uses fresh
cache files. No manual cache clearing needed.

## v4.0.10 — send_email subject auto-generation (2026-10-03)
"Send an email to X saying Y" was failing because the LLM didn't know what
subject to use and asked for clarification instead. Now: subject is optional
in the tool schema; if omitted, the server auto-generates from the first 6
words of the body. The tool description has an explicit example for the
"saying Y" pattern with instruction to never ask for clarification.

## v4.0.11 — anti-hallucination guardrails (2026-10-03)
The agent claimed "Done, I moved it" for a calendar reschedule without calling
any tool (calendar is read-only). Added explicit guardrails: system prompt now
has a CRITICAL rule to never claim unperformed actions; check_calendar tool
description explicitly states it cannot modify events and to never claim it did.

## v4.0.12 — Google Calendar (write) + Drive search (2026-10-03)
- New OAuth2 flow: /web/oauth/authorize -> Google consent -> /web/oauth/callback.
  Refresh token saved to google_token.json (never in ZIP).
- New tools (18 total): create_event, cancel_event (with confirmation),
  reschedule_event, search_drive.
- Calendar is now fully writable via Google Calendar API (not just iCal read).
- Drive search via Google Drive API (readonly scope).
- Anti-hallucination guardrail kept: agent never claims unperformed actions.
- 215 tests pass (10 new Google module tests).

## v4.0.13 — calendar search fix + unified data source (2026-10-03)
- find_event now matches when ALL query words appear in the title (any order):
  "pankaj shivan" matches "meeting with pankaj and shivan". Was exact-substring.
- check_calendar now uses the Google Calendar API when OAuth is connected
  (same source as cancel/reschedule), falling back to iCal otherwise.
  Previously check_calendar (iCal) and cancel_event (API) could disagree.
- Windows-safe time formatting in the new calendar path (no %-I).

## v4.0.14 — send Drive files via email (2026-10-03)
- New send_drive_file tool (19 total): downloads from Drive, emails as attachment.
- Drive search results are now stored as pending state: "the first one",
  "send that to me", "yes, send it" all resolve correctly.
- Confirmation flow: after picking a file, asks "Should I send it to your
  email? Say yes, or name an address." Never sends without confirmation.
- Temp downloads are cleaned up after sending.

## v4.0.15 — multi-language voice support (Telugu + 10 Indic languages) (2026-10-03)
- VOICE_LANGUAGE env var (default "en"). Set to "te" for Telugu, "hi" for Hindi, etc.
- Deepgram Nova-3 STT now uses the configured language (Nova-3 supports Telugu,
  Hindi, Tamil, Bengali, Marathi, Kannada natively).
- Sarvam Bulbul v3 TTS for Indic languages (excellent Telugu voice "anushka").
  Falls back to Cartesia/Edge if SARVAM_API_KEY not set.
- TTS cache is language-aware (switching languages regenerates audio).
- System prompt: agent replies in the SAME language the user spoke.
- Supported: te (Telugu), hi (Hindi), ta (Tamil), kn (Kannada), ml (Malayalam),
  mr (Marathi), gu (Gujarati), pa (Punjabi), bn (Bengali), or (Odia).

## v4.0.16 — Sarvam speaker fix (2026-10-03)
"anushka" is not a valid bulbul:v3 speaker. Updated to confirmed speakers:
kavya (Telugu/Kannada), priya (Hindi/Tamil/Marathi), neha (Malayalam/Gujarati),
simran (Punjabi), pooja (Bengali).

## v4.0.17 — Telugu translations for all agent speech (2026-10-03)
- New server/lang.py: full Telugu + Hindi translations for every hardcoded
  agent response (fillers, file flow, calendar, Drive, notes, errors).
- instant_filler() and _tool_filler() are now language-aware.
- _do_find_file, _do_check_calendar, _do_get_datetime use translated strings.
- The agent no longer mixes English into Telugu calls.
- Note on voice quality: Sarvam Bulbul v3 is the best Telugu TTS available,
  but Indic TTS tech is still catching up to English (Cartesia) quality.

## v4.0.18 — full Telugu call experience (2026-10-03)
- Greeting is now language-aware: /web/greeting returns Telugu/Hindi/English
  based on VOICE_LANGUAGE. The call opens in Telugu, not English.
- LLM prompt strengthened: MUST translate tool outputs (weather, etc.) into
  the user's language. Added explicit Telugu example.
- Sarvam Telugu speaker changed from kavya to priya (testing alternative).
- All 215 tests pass.

## v4.0.19 — complete Telugu pending flows + feminine voice (2026-10-03)
- All pending confirmation strings now translated: "Just to be sure..." etc.
  no longer appear in English during Telugu calls.
- format_mtime is language-aware: dates like "Sep 30 at 12:11 PM" now render
  in Telugu ("సెప్ 30 న ... కి").
- Greeting uses feminine form: "సహాయకురాలిని" (not masculine "సహాయకుడిని").
- Hindi translations also updated to feminine ("सहायिका", "करूँगी").
- All 215 tests pass.
