/* ==========================================================================
   RingMate — web UI logic (talk page + phone call interface + console)
   Endpoints:
     POST /web/talk        {text, call_id}   -> {reply_text, action, call_id}
     POST /web/talk_stream {text, call_id}   -> SSE: sentence/done events
     POST /web/stt         multipart file    -> {text}  (whisper fallback)
     GET  /web/tts?text=...                 -> audio/mpeg MP3 stream
     GET  /console/events                   -> {commands:[...], log:[...], status:{...}}

   Voice pipeline (v4.0, pro-grade):
     mic -> Silero neural VAD (self-hosted, web/voice4.js) -> TurnCore
       -> Deepgram Nova-3 streaming STT (if DEEPGRAM_API_KEY) or
          VAD audio -> /web/stt (faster-whisper)
       -> /web/talk_stream (SSE sentences) -> per-sentence /web/tts fetched
          in parallel -> ordered audio queue plays them back-to-back.
     The first sentence starts playing while later ones are still arriving.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------- shared helpers ---------------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function fetchJSON(url, options, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 15000);
    try {
      const res = await fetch(url, Object.assign({ signal: ctrl.signal }, options || {}));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function relTime(iso) {
    if (!iso) return 'never';
    const d = new Date(iso).getTime();
    if (isNaN(d)) return String(iso);
    const s = Math.max(0, Math.round((Date.now() - d) / 1000));
    if (s < 5) return 'just now';
    if (s < 60) return s + 's ago';
    const m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    return Math.round(m / 60) + 'h ago';
  }

  function formatTimer(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ==================================================================
     TALK PAGE & PHONE CALL CONTROLLER
     ================================================================== */
  function initTalkPage() {
    var startCallBtn = document.getElementById('start-call-btn');
    if (!startCallBtn) return; // not the talk page

    // Home elements
    var transcript = document.getElementById('transcript');
    var emptyNote = document.getElementById('transcript-empty');
    var composer = document.getElementById('composer');
    var composerInput = document.getElementById('composer-input');
    var statusPill = document.getElementById('status-pill');
    var statusText = document.getElementById('status-text');
    var muteBtn = document.getElementById('mute-btn');
    var iconOn = document.getElementById('icon-sound-on');
    var iconOff = document.getElementById('icon-sound-off');

    // Phone call overlay elements
    var phoneOverlay = document.getElementById('phone-call-overlay');
    var phoneCard = document.querySelector('.phone-call-card');
    var phoneCloseBtn = document.getElementById('phone-close-btn');
    var phoneHangupBtn = document.getElementById('phone-hangup-btn');
    var phoneMuteBtn = document.getElementById('phone-mute-btn');
    var phoneTalkBtn = document.getElementById('phone-talk-btn');
    var phoneTimer = document.getElementById('phone-call-timer');
    var phoneStatus = document.getElementById('phone-call-status');
    var phoneAgentMsg = document.getElementById('phone-last-agent-msg');
    var phoneUserMsg = document.getElementById('phone-last-user-msg');
    var phoneActions = document.getElementById('phone-actions');
    var phoneBtnYes = document.getElementById('phone-btn-yes');
    var phoneBtnNo = document.getElementById('phone-btn-no');
    var phoneComposer = document.getElementById('phone-composer');
    var phoneInput = document.getElementById('phone-input');
    var phoneMicOn = document.getElementById('phone-mic-icon-on');
    var phoneMicOff = document.getElementById('phone-mic-icon-off');
    var phoneWaveCanvas = document.getElementById('phone-wave');

    // On-page real-time activity log: every voice action is recorded here in
    // plain language, so a glitch can be traced without opening devtools.
    var phoneLogBtn = document.getElementById('phone-log-btn');
    var phoneLogDrawer = document.getElementById('phone-log-drawer');
    var phoneLogList = document.getElementById('phone-log-list');
    var phoneLogCount = document.getElementById('phone-log-count');
    var logEntries = [];
    var LOG_MAX = 400;
    var logUnread = 0;

    function logTime(d) {
      function p(n) { return (n < 10 ? '0' : '') + n; }
      return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function logEvent(level, tag, msg) {
      var entry = { t: logTime(new Date()), level: level, tag: tag, msg: String(msg) };
      logEntries.push(entry);
      if (logEntries.length > LOG_MAX) logEntries.splice(0, logEntries.length - LOG_MAX);
      try {
        if (phoneLogList) {
          var stick = phoneLogList.scrollHeight - phoneLogList.scrollTop - phoneLogList.clientHeight < 60;
          var div = document.createElement('div');
          div.className = 'plog-line plog-' + level;
          div.textContent = entry.t + ' [' + entry.tag + '] ' + entry.msg;
          phoneLogList.appendChild(div);
          while (phoneLogList.children.length > LOG_MAX) {
            phoneLogList.removeChild(phoneLogList.firstChild);
          }
          if (stick) phoneLogList.scrollTop = phoneLogList.scrollHeight;
        }
        if (phoneLogDrawer && phoneLogDrawer.hasAttribute('hidden') && phoneLogCount) {
          logUnread++;
          phoneLogCount.textContent = logUnread > 99 ? '99+' : String(logUnread);
          phoneLogCount.style.display = 'inline-block';
        }
      } catch (e) {}
      if (level === 'error') {
        try { console.warn('[ringmate][' + tag + '] ' + msg); } catch (e) {}
      }
    }

    function setLogOpen(open) {
      if (!phoneLogDrawer) return;
      if (open) phoneLogDrawer.removeAttribute('hidden');
      else phoneLogDrawer.setAttribute('hidden', '');
      logUnread = 0;
      if (phoneLogCount) phoneLogCount.style.display = 'none';
    }

    function copyLog() {
      var text = logEntries.map(function (e) {
        return e.t + ' [' + e.level.toUpperCase() + '][' + e.tag + '] ' + e.msg;
      }).join('\n');
      function done(ok) {
        logEvent('info', 'log', ok
          ? 'Log copied to clipboard (' + logEntries.length + ' lines).'
          : 'Copy failed — long-press the log to select it manually.');
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); },
            function () { done(false); });
        } else {
          done(false);
        }
      } catch (e) { done(false); }
    }

    // Call state
    var inCall = false;
    var callSeconds = 0;
    var callTimerInterval = null;
    var currentCallId = 'call-' + Math.random().toString(36).slice(2, 9);
    var audioOutputMuted = false;
    var micMuted = false;
    var currentAudio = null;

    // Voice turn-taking state machine.
    //   IDLE -> CONNECTING -> LISTENING <-> CAPTURING -> SUBMITTING
    //        -> THINKING -> SPEAKING -> LISTENING ...
    // The neural VAD (Silero, see web/voice4.js) plus the TurnCore state
    // machine (web/voice_turn.js) is the single turn-taker: ~700ms of
    // silence after speech auto-submits the turn — there is no Done button.
    // Streaming STT (Deepgram, when configured) transcribes live; VAD audio
    // via server Whisper is the fallback. VAD is gated OFF while
    // THINKING/SPEAKING so our own voice never re-triggers capture.
    var callState = 'IDLE';
    var mediaStream = null;
    var audioContext = null;
    var analyser = null;
    // Turn token: every onEngineSubmit() mints a new id. Stale timers and
    // late async results from an older turn are ignored, so a slow /web/stt
    // can never have its transcript dropped by a safety timeout (that was
    // the "transcribing but no reply" bug).
    var turnSeq = 0;
    var turnSettled = true;  // false while a submitted turn is still resolving
    var emptySttStreak = 0;  // consecutive empty Whisper transcripts (noise?)
    var vadBackoff = false;  // true after 3 empty turns: VAD auto-capture
                             // pauses (room noise loop) until a real turn lands
    var sttAbortCtrl = null;  // AbortController of the in-flight /web/stt
    var waveRAF = 0;
    var wavePhase = 0;

    function vadHearing() {
      return inCall && !micMuted && (callState === 'LISTENING' || callState === 'CAPTURING');
    }

    // Ordered TTS playout queue (per-sentence fetch, strict in-order play)
    var ttsQueue = [];          // [{text, url, failed, consumed}]
    var ttsPlaying = false;
    var streamDone = false;     // /web/talk_stream finished for this turn
    var ttsDrainedCallbacks = [];

    /* ---------- Visualizer Canvas ---------- */
    function startWaveform() {
      if (waveRAF) cancelAnimationFrame(waveRAF);
      function frame() {
        waveRAF = requestAnimationFrame(frame);
        wavePhase += 0.08;
        if (!phoneWaveCanvas) return;
        var ctx = phoneWaveCanvas.getContext('2d');
        var W = phoneWaveCanvas.width;
        var H = phoneWaveCanvas.height;
        ctx.clearRect(0, 0, W, H);

        var bars = 32;
        var bw = W / bars;

        // If audioContext + analyser available, get frequency data
        var freqData = null;
        if (analyser && vadHearing()) {
          freqData = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(freqData);
        }

        ctx.fillStyle = '#FF4D00';
        for (var i = 0; i < bars; i++) {
          var norm = i / bars;
          var bell = Math.sin(norm * Math.PI);
          var amp = 0.2;

          if (freqData && freqData.length) {
            var fIdx = Math.floor((i / bars) * (freqData.length / 2));
            amp = Math.max(0.15, (freqData[fIdx] || 0) / 255);
          } else if (phoneCard && phoneCard.classList.contains('speaking')) {
            var s1 = Math.sin(wavePhase + i * 0.4);
            var s2 = Math.cos(wavePhase * 0.7 + i * 0.25);
            amp = Math.abs(s1 * 0.65 + s2 * 0.35);
          } else if (vadHearing()) {
            amp = Math.abs(Math.sin(wavePhase * 0.6 + i * 0.3)) * 0.3 + 0.1;
          }

          var h = Math.max(4, amp * bell * H * 0.88);
          var x = i * bw + bw * 0.22;
          var w = bw * 0.56;
          var y = (H - h) / 2;

          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, w, h, w / 2);
          else ctx.rect(x, y, w, h);
          ctx.fill();
        }
      }
      frame();
    }

    function stopWaveform() {
      if (waveRAF) cancelAnimationFrame(waveRAF);
      waveRAF = 0;
      if (phoneWaveCanvas) {
        var ctx = phoneWaveCanvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, phoneWaveCanvas.width, phoneWaveCanvas.height);
      }
    }

    /* ---------- Neural Voice Output (/web/tts) ---------- */
    var audioPlayPromise = null;

    function stopVoice() {
      if (currentAudio) {
        var a = currentAudio;
        currentAudio = null;
        if (phoneCard) phoneCard.classList.remove('speaking');
        if (audioPlayPromise) {
          audioPlayPromise.then(function () {
            try { a.pause(); a.currentTime = 0; } catch (e) {}
          }).catch(function () {});
        } else {
          try { a.pause(); a.currentTime = 0; } catch (e) {}
        }
      }
    }

    /* ---------- Ordered TTS playout queue ----------
       Each reply sentence is fetched from /web/tts the moment it arrives
       (parallel fetches) but played strictly in order, back-to-back. The
       first sentence starts playing while later ones are still arriving. */
    function enqueueSentenceAudio(text) {
      var item = { text: text, url: null, failed: false, consumed: false };
      ttsQueue.push(item);
      var n = ttsQueue.length;
      logEvent('info', 'tts', 'Sentence #' + n + ': fetching voice audio…');
      // Abort a hung TTS fetch after 20s: a stuck download must never wedge
      // the call in SPEAKING (the drain callback would never fire).
      var ctrl = (typeof window.AbortController !== 'undefined')
        ? new AbortController() : null;
      var abortTimer = setTimeout(function () {
        if (ctrl) { try { ctrl.abort(); } catch (e) {} }
      }, 20000);
      function settle(ok, blob) {
        clearTimeout(abortTimer);
        if (ok && blob && blob.size > 500) {
          item.url = URL.createObjectURL(blob);
          logEvent('ok', 'tts', 'Sentence #' + n + ': audio ready (' +
            Math.round(blob.size / 1024) + ' KB).');
        } else {
          item.failed = true;
          logEvent('warn', 'tts', 'Sentence #' + n + ': voice audio failed — speaking skipped, text shown.');
        }
        pumpTtsQueue();
      }
      var fetchOpts = ctrl ? { signal: ctrl.signal } : {};
      fetch('/web/tts?text=' + encodeURIComponent(text), fetchOpts)
        .then(function (res) {
          if (!res.ok) throw new Error('TTS HTTP ' + res.status);
          return res.blob();
        })
        .then(function (blob) { settle(true, blob); })
        .catch(function () { settle(false, null); });
      pumpTtsQueue();
    }

    function pumpTtsQueue() {
      if (ttsPlaying) return;
      var next = null;
      for (var i = 0; i < ttsQueue.length; i++) {
        if (ttsQueue[i].consumed) continue;
        if (ttsQueue[i].url || ttsQueue[i].failed) { next = ttsQueue[i]; break; }
        break; // earlier sentence not ready yet — keep order
      }
      if (!next) { checkTtsDrained(); return; }
      next.consumed = true;
      if (next.failed || audioOutputMuted || !next.url) {
        pumpTtsQueue();
        return;
      }
      ttsPlaying = true;
      callState = 'SPEAKING'; // gate the VAD off while our voice plays
      if (phoneCard) phoneCard.classList.add('speaking');
      if (phoneStatus) phoneStatus.textContent = 'RingMate is speaking…';

      var audio = new Audio(next.url);
      currentAudio = audio;
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        ttsPlaying = false;
        if (currentAudio === audio) currentAudio = null;
        try { URL.revokeObjectURL(next.url); } catch (e) {}
        if (phoneCard) phoneCard.classList.remove('speaking');
        pumpTtsQueue();
      }
      audio.onended = finish;
      audio.onerror = finish;
      setTimeout(finish, Math.max(4000, next.text.length * 160)); // safety
      try {
        var p = audio.play();
        if (p !== undefined) p.catch(finish);
      } catch (e) { finish(); }
    }

    function checkTtsDrained() {
      if (streamDone && !ttsPlaying &&
          ttsQueue.every(function (it) { return it.consumed; })) {
        ttsQueue = [];
        var cbs = ttsDrainedCallbacks;
        ttsDrainedCallbacks = [];
        cbs.forEach(function (cb) { try { cb(); } catch (e) {} });
      }
    }

    function whenTtsDrained(cb) {
      if (streamDone && !ttsPlaying && ttsQueue.length === 0) {
        setTimeout(cb, 0);
        return;
      }
      ttsDrainedCallbacks.push(cb);
    }

    function stopAllAudio() {
      stopVoice();
      ttsQueue.forEach(function (it) {
        if (it.url) { try { URL.revokeObjectURL(it.url); } catch (e) {} }
      });
      ttsQueue = [];
      ttsPlaying = false;
      streamDone = false;
      ttsDrainedCallbacks = [];
    }

    /* ---------- Streaming talk endpoint (SSE) ---------- */
    function streamTalk(text, callId, handlers) {
      // The stream MUST always settle: a 90s abort guards a hung server, and
      // a stream that closes without a done event is treated as done — the
      // call can never wedge in THINKING again.
      var ctrl = (typeof window.AbortController !== 'undefined') ? new AbortController() : null;
      var timer = setTimeout(function () {
        logEvent('error', 'sse', 'No complete reply after 90s — aborting the stream.');
        if (ctrl) { try { ctrl.abort(); } catch (e) {} }
      }, 90000);
      var gotDone = false;
      var nSent = 0;
      logEvent('info', 'sse', 'Opening /web/talk_stream…');
      var opts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, call_id: callId })
      };
      if (ctrl) opts.signal = ctrl.signal;
      return fetch('/web/talk_stream', opts).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        logEvent('ok', 'sse', 'Stream opened (HTTP 200).');
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buf = '';
        function handleChunk(chunk) {
          var lines = chunk.split('\n');
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.indexOf('data:') === 0) {
              try {
                var evt = JSON.parse(line.slice(5));
                if (evt.type === 'sentence' && evt.text) {
                  nSent++;
                  handlers.onSentence(evt.text);
                } else if (evt.type === 'log' && evt.text) {
                  // Server-side agent events (tool calls, email sends…):
                  // shown in the log, never spoken.
                  logEvent('agent', 'server', evt.text);
                } else if (evt.type === 'done') {
                  gotDone = true;
                  clearTimeout(timer);
                  logEvent('ok', 'sse', 'Stream done (' + nSent + ' sentences).');
                  handlers.onDone(evt.action);
                }
              } catch (e) { /* ignore malformed chunk */ }
            }
          }
        }
        function read() {
          return reader.read().then(function (result) {
            if (result.done) {
              clearTimeout(timer);
              if (!gotDone) {
                logEvent('warn', 'sse', 'Stream closed without a done event — recovering as done.');
                try { handlers.onDone(); } catch (e) {}
              }
              return;
            }
            buf += decoder.decode(result.value, { stream: true });
            var idx;
            while ((idx = buf.indexOf('\n\n')) !== -1) {
              var chunk = buf.slice(0, idx);
              buf = buf.slice(idx + 2);
              handleChunk(chunk);
            }
            return read();
          });
        }
        return read();
      }).catch(function (err) {
        clearTimeout(timer);
        var emsg = (err && err.name === 'AbortError') ? 'timed out after 90s'
          : String((err && err.message) || err);
        logEvent('error', 'sse', 'Stream failed: ' + emsg);
        throw err;
      });
    }

    /* ---------- Transcript UI ---------- */
    function highlightFiles(htmlEscaped) {
      return htmlEscaped.replace(/([A-Za-z0-9_\-]+\.(?:pdf|docx?|xlsx?|pptx?|txt|csv|png|jpe?g|zip))/g,
        '<span class="file-name">$1</span>');
    }

    function looksLikeConfirmation(text) {
      var s = String(text).toLowerCase();
      if (/should i send|shall i send|want me to send|please confirm|confirm\?/.test(s)) return true;
      if (/\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpe?g|zip)\b/.test(s) && s.indexOf('?') !== -1) return true;
      return false;
    }

    function addBubble(who, text, opts) {
      opts = opts || {};
      if (emptyNote) emptyNote.style.display = 'none';
      var div = document.createElement('div');
      div.className = 'bubble ' + who + (opts.error ? ' error' : '');
      div.innerHTML = highlightFiles(esc(text));

      if (who === 'agent' && !opts.error && looksLikeConfirmation(text)) {
        var actions = document.createElement('div');
        actions.className = 'confirm-actions';
        var yes = document.createElement('button');
        yes.className = 'btn btn-yes';
        yes.type = 'button';
        yes.textContent = 'Yes, send it';
        var no = document.createElement('button');
        no.className = 'btn btn-no';
        no.type = 'button';
        no.textContent = 'No';

        yes.addEventListener('click', function () {
          yes.disabled = true; no.disabled = true;
          sendTypedTurn('yes');
        });
        no.addEventListener('click', function () {
          yes.disabled = true; no.disabled = true;
          sendTypedTurn('no');
        });
        actions.appendChild(yes);
        actions.appendChild(no);
        div.appendChild(actions);
      }

      transcript.appendChild(div);
      if (typeof div.scrollIntoView === 'function') {
        try { div.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
      }
    }

    /* ---------- Phone Call Lifecycle ---------- */
    async function startPhoneCall() {
      if (inCall) return;
      inCall = true;
      callSeconds = 0;
      currentCallId = 'call-' + Math.random().toString(36).slice(2, 9);
      callState = 'CONNECTING';
      logEvent('info', 'call', 'Call started (id ' + currentCallId + ').');
      logEvent('info', 'call', 'RingMate web v4.2.1 (Silero neural VAD + phone calling) — if you do not see this line, hard-refresh (Ctrl+Shift+R).');

      // Open Phone Overlay
      phoneOverlay.style.display = 'flex';
      phoneTimer.textContent = '00:00';
      phoneStatus.textContent = 'Connecting…';
      phoneUserMsg.style.display = 'none';
      phoneActions.style.display = 'none';

      // Initial Greeting (language-aware from server).
      var greeting = "Hello! I'm RingMate, your personal assistant. How can I help you?";
      try {
        var gres = await fetch('/web/greeting');
        if (gres.ok) {
          var gj = await gres.json();
          if (gj.text) greeting = gj.text;
        }
      } catch (e) {}
      phoneAgentMsg.innerHTML = highlightFiles(esc(greeting));
      addBubble('agent', greeting);

      // Start Call Timer
      if (callTimerInterval) clearInterval(callTimerInterval);
      callTimerInterval = setInterval(function () {
        callSeconds++;
        phoneTimer.textContent = formatTimer(callSeconds);
      }, 1000);

      startWaveform();

      // 1. Mic FIRST. The old bug: listening began before the mic stream
      //    existed, so the call never heard the user until mute was toggled.
      try {
        if (!mediaStream && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
        }
      } catch (err) {
        logEvent('error', 'mic', 'Microphone permission not granted: ' +
          String((err && err.message) || err) + ' — voice input will not work.');
        mediaStream = null;
      }
      if (mediaStream) {
        setupAudioAnalyser(mediaStream);
        logEvent('ok', 'mic', 'Microphone ready — loading voice engine…');
        if (phoneStatus) phoneStatus.textContent = 'Loading voice engine…';
        await initVoiceEngine();
      }

      // 2. Greet through the ordered TTS queue (greeting MP3 is pre-cached
      //    server-side, so this starts with ~zero synthesis delay).
      callState = 'SPEAKING';
      streamDone = true;
      ttsQueue = [];
      ttsPlaying = false;
      ttsDrainedCallbacks = [];
      enqueueSentenceAudio(greeting);
      whenTtsDrained(function () {
        if (!inCall) return;
        if (!mediaStream) {
          callState = 'LISTENING';
          if (phoneStatus) phoneStatus.textContent = 'Mic blocked — type below instead';
          return;
        }
        beginListen();
      });
    }

    function endPhoneCall() {
      if (!inCall) return;
      inCall = false;
      callState = 'IDLE';
      vadBackoff = false;
      if (phoneTalkBtn) phoneTalkBtn.classList.remove('active');
      logEvent('info', 'call', 'Call ended after ' + formatTimer(callSeconds) + '.');

      if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
      }

      if (voiceEngine) {
        try { voiceEngine.stop(); } catch (e) {}
        voiceEngine = null;
      }
      stopAllAudio();
      stopWaveform();

      if (phoneCard) {
        phoneCard.classList.remove('speaking', 'listening');
      }

      phoneOverlay.style.display = 'none';
      addBubble('agent', "Call ended.");
    }

    /* ---------- Audio Recording & VAD (Silence Detection) ---------- */
    function setupAudioAnalyser(stream) {
      try {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        var src = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
      } catch (e) {
        console.warn('AudioAnalyser setup failed:', e);
      }
    }

    /* ---------- v4.0 voice engine: Silero neural VAD + streaming STT ----------
       web/voice4.js owns the ears (VAD, turn-taking, Deepgram/Whisper);
       here is the wiring into the call UI and the agent pipeline.
       Engine events -> onEngineEvent(); transcripts -> onEngineSubmit(). */
    var voiceEngine = null;
    var voiceConfig = { deepgramKey: '', cartesiaKey: '', cartesiaVoiceId: '', voiceLanguage: 'en' };
    var engineInterimEl = null;

    async function initVoiceEngine() {
      // Which pro services are configured? (keys live in .env, served to the
      // local page only — never committed.)
      try {
        var res = await fetch('/web/voice_config');
        if (res.ok) {
          var cfg = await res.json();
          voiceConfig.deepgramKey = cfg.deepgram_key || '';
          voiceConfig.cartesiaKey = cfg.cartesia_key || '';
          voiceConfig.cartesiaVoiceId = cfg.cartesia_voice_id || '';
          voiceConfig.voiceLanguage = cfg.voice_language || 'en';
        }
      } catch (e) {}
      var VE = window.RingMateVoice && window.RingMateVoice.VoiceEngine;
      if (!VE) {
        logEvent('error', 'vad', 'Voice engine failed to load — use the Talk button or type.');
        return false;
      }
      voiceEngine = new VE({
        getMicStream: function () { return mediaStream; },
        getConfig: function () { return voiceConfig; },
        log: logEvent,
        onEvent: onEngineEvent,
      });
      try {
        await voiceEngine.start();
      } catch (e) {
        logEvent('error', 'vad', 'Voice engine failed to start: ' + (e && e.message || e) +
          ' — Talk button and typing still work.');
        voiceEngine = null;
        return false;
      }
      // Debug hook for automated tests.
      window.RingMateDebug = { getEngine: function () { return voiceEngine; } };
      return true;
    }

    function onEngineEvent(name, data) {
      data = data || {};
      if (name === 'capture-start') {
        if (phoneStatus && !voiceEngine.isManual()) {
          phoneStatus.textContent = 'Listening to you…';
        }
        if (phoneCard) {
          phoneCard.classList.remove('listening');
          phoneCard.classList.add('speaking');
        }
      } else if (name === 'capture-cancelled') {
        logEvent('info', 'vad', 'Capture cancelled (' + (data.reason || 'misfire') + ') — listening.');
        beginListen();
      } else if (name === 'interim') {
        // Live captions while the user speaks (Deepgram interim results).
        if (phoneUserMsg && data.text) {
          phoneUserMsg.style.display = 'block';
          phoneUserMsg.textContent = '“' + data.text + '…”';
        }
      } else if (name === 'submit') {
        onEngineSubmit(data);
      } else if (name === 'manual-empty') {
        logEvent('warn', 'vad', 'Talk button released too fast — hold it while you speak.');
        if (phoneStatus) phoneStatus.textContent = 'Hold TALK while you speak, then release';
        beginListen();
      } else if (name === 'vad-failed' || name === 'deepgram-failed') {
        // Already logged by the engine; local fallbacks keep working.
      }
    }

    function onEngineSubmit(data) {
      // data: {transcript|null, audioBlob|null, source}
      if (!inCall) return;
      turnSeq++;
      turnSettled = false;
      var myTurn = turnSeq;
      callState = 'TRANSCRIBING';
      if (phoneCard) phoneCard.classList.remove('listening', 'speaking');
      if (voiceEngine) voiceEngine.setVadActive(false);
      var src = data.source || 'vad';
      logEvent('info', 'turn', 'Turn #' + myTurn + ' submitted (' + src + ').');
      if (phoneStatus) phoneStatus.textContent = 'Transcribing…';
      if (data.transcript) {
        // Deepgram already transcribed it — straight to the agent.
        logEvent('ok', 'stt', 'Heard via Deepgram: "' + data.transcript + '"');
        emptySttStreak = 0;
        vadBackoff = false;
        finishSubmit(data.transcript, myTurn);
      } else if (data.audioBlob) {
        // Local Whisper fallback on the VAD-captured audio.
        transcribeAndSend(data.audioBlob, myTurn);
      } else {
        logEvent('warn', 'turn', 'Empty capture — back to listening.');
        finishSubmit('', myTurn);
      }
      // Safety: never hang in TRANSCRIBING.
      setTimeout(function () {
        if (myTurn !== turnSeq || turnSettled || callState !== 'TRANSCRIBING') return;
        logEvent('warn', 'turn', 'Transcription safety timeout — forcing resolve.');
        finishSubmit('', myTurn);
      }, 70000);
    }

    function beginListen() {
      if (!inCall) return;
      callState = 'LISTENING';
      if (voiceEngine) {
        try { voiceEngine.core.reset(); } catch (e) {}
        // Backoff: after repeated empty turns (noise loop), auto-capture
        // stays off until a real turn lands via Hold-to-Talk.
        voiceEngine.setVadActive(!micMuted && !vadBackoff);
      }
      logEvent('info', 'state', 'Listening — speak now.');
      if (phoneCard) {
        phoneCard.classList.remove('speaking');
        phoneCard.classList.add('listening');
      }
      if (phoneUserMsg && !voiceEngine) {
        // engine-less fallback: clear any interim caption
      }
      if (phoneStatus) {
        phoneStatus.textContent = micMuted ? 'Microphone muted'
          : (vadBackoff ? 'Only hearing background noise — hold TALK to speak'
                        : 'Listening… (speak now)');
      }
    }

    // Hold-to-Talk: deterministic manual turn. Takeover works from any state.
    function manualTalkStart() {
      if (!inCall || micMuted || !voiceEngine) return;
      if (voiceEngine.isManual()) return;
      var st = voiceEngine.getState();
      if (st !== 'LISTENING' && st !== 'CAPTURING') {
        // Force-takeover: kill the in-flight turn via the turn token.
        turnSeq++;
        turnSettled = true;
        try { voiceEngine.takeover(); } catch (e) {}
        logEvent('warn', 'turn', 'Hold-to-Talk took over — cancelled the in-flight turn.');
      }
      if (phoneTalkBtn) phoneTalkBtn.classList.add('active');
      if (phoneStatus) phoneStatus.textContent = 'Talking… (release to send)';
      logEvent('info', 'vad', 'Hold-to-Talk pressed — capturing manually.');
      voiceEngine.startManual();
    }

    function manualTalkStop() {
      if (!voiceEngine || !voiceEngine.isManual()) return;
      if (phoneTalkBtn) phoneTalkBtn.classList.remove('active');
      if (!inCall) return;
      logEvent('info', 'vad', 'Hold-to-Talk released — submitting turn.');
      voiceEngine.stopManual();
    }
    function finishSubmit(text, myTurn) {
      if (!inCall || myTurn !== turnSeq) return;
      text = String(text || '').trim();
      if (!text) {
        // The turn captured nothing usable (room noise, mic bump). Count it:
        // three in a row means the VAD is looping on background noise, so
        // pause auto-capture until a real turn lands. The Hold-to-Talk
        // button keeps working during the pause.
        emptySttStreak++;
        if (emptySttStreak >= 3 && !vadBackoff) {
          vadBackoff = true;
          logEvent('warn', 'vad', 'Heard nothing useful ' + emptySttStreak +
            ' times in a row — pausing auto-listen. Hold the TALK button to speak.');
        }
        beginListen(); // a blip of noise, not a turn — keep listening
        return;
      }
      emptySttStreak = 0;
      vadBackoff = false; // a real turn landed — auto-listen is trustworthy again
      sendTurn(text, myTurn);
    }
    /* ---------- Transcribe & Execute Turn ---------- */
    // Typed messages (composer, in-call typing, yes/no confirmations) enter
    // the turn pipeline directly: they mint their own turn token, which also
    // cancels any voice turn still resolving.
    function sendTypedTurn(text) {
      text = String(text || '').trim();
      if (!text || !inCall) return;
      turnSeq++;
      turnSettled = true;
      var myTurn = turnSeq;
      logEvent('info', 'turn', 'Typed message sent as turn #' + myTurn + '.');
      sendTurn(text, myTurn);
    }
    async function transcribeAndSend(blob, myTurn) {
      if (!inCall || myTurn !== turnSeq) return;
      // Leave SUBMITTING immediately: the submit safety timer must not fire
      // while Whisper is still working (slow laptops take >8s).
      callState = 'TRANSCRIBING';

      if (phoneStatus) phoneStatus.textContent = 'Transcribing…';
      var kb = Math.round(blob.size / 1024);
      logEvent('info', 'stt', 'Sending ' + kb + ' KB of audio to /web/stt…');
      var formData = new FormData();
      formData.append('file', blob, 'speech.webm');
      var ctrl = (typeof window.AbortController !== 'undefined') ? new AbortController() : null;
      sttAbortCtrl = ctrl; // Hold-to-Talk can abort a stuck transcription
      var timer = setTimeout(function () {
        logEvent('error', 'stt', '/web/stt timed out after 60s — aborting.');
        if (ctrl) { try { ctrl.abort(); } catch (e) {} }
      }, 60000);
      var t0 = Date.now();
      try {
        var opts = { method: 'POST', body: formData };
        if (ctrl) opts.signal = ctrl.signal;
        var sttRes = await fetch('/web/stt', opts);
        if (!sttRes.ok) throw new Error('HTTP ' + sttRes.status);
        var sttData = await sttRes.json();
        var userText = sttData && sttData.text ? sttData.text.trim() : '';
        var ms = Date.now() - t0;
        if (userText) {
          logEvent('ok', 'stt', 'Heard in ' + ms + ' ms: "' + userText + '"');
        } else {
          // finishSubmit() counts the streak and engages the noise backoff.
          var coming = emptySttStreak + 1;
          var hint = coming >= 3
            ? ' (' + coming + ' in a row — the mic may be hearing room noise)'
            : '';
          logEvent('info', 'stt', 'Empty transcript in ' + ms + ' ms — background noise, ignoring.' + hint);
        }
        if (myTurn !== turnSeq || !inCall) {
          logEvent('warn', 'stt', 'Late transcript arrived after the turn moved on — dropped.');
          return;
        }
        // Hand the transcript to the turn pipeline (it filters empty blips).
        finishSubmit(userText, myTurn);
      } catch (err) {
        var emsg = (err && err.name === 'AbortError') ? 'timed out' : String((err && err.message) || err);
        logEvent('error', 'stt', 'Transcription failed: ' + emsg + ' — back to listening.');
        if (myTurn !== turnSeq || !inCall) return;
        finishSubmit('', myTurn);
      } finally {
        clearTimeout(timer);
        if (sttAbortCtrl === ctrl) sttAbortCtrl = null;
      }
    }

    async function sendTurn(text, myTurn) {
      text = String(text || '').trim();
      if (!text) return;
      if (myTurn !== turnSeq || !inCall) return;

      // Leave the listening states: gate the VAD off while we think/speak.
      if (voiceEngine) voiceEngine.setVadActive(false);
      stopAllAudio();
      streamDone = false;
      callState = 'THINKING';

      // Display in phone screen and home transcript
      phoneUserMsg.style.display = 'block';
      phoneUserMsg.textContent = '“' + text + '”';
      addBubble('user', text);
      if (phoneInput) phoneInput.value = '';
      if (composerInput) composerInput.value = '';
      phoneActions.style.display = 'none';

      if (phoneStatus) phoneStatus.textContent = 'RingMate is thinking…';
      phoneAgentMsg.textContent = 'Thinking…';
      logEvent('info', 'agent', 'You said: "' + text + '" — asking RingMate…');

      var isHangup = /^(bye|goodbye|hang up|end call|cancel call)$/i.test(text);
      var sentences = [];

      // Last resort: if the server never answers at all, never wedge the
      // call in THINKING — go back to listening so the user can retry.
      var watchdog = setTimeout(function () {
        if (!inCall || streamDone || myTurn !== turnSeq) return;
        logEvent('error', 'agent', 'No reply from the server after 120s — listening again.');
        if (phoneStatus) phoneStatus.textContent = 'Reply timed out — listening again…';
        beginListen();
      }, 120000);

      function onSentence(sentence) {
        if (!inCall || myTurn !== turnSeq) return; // stale turn (taken over) — ignore
        sentences.push(sentence);
        logEvent('info', 'agent', 'Reply sentence #' + sentences.length + ': "' +
          (sentence.length > 90 ? sentence.slice(0, 90) + '…' : sentence) + '"');
        var partial = sentences.join(' ');
        phoneAgentMsg.innerHTML = highlightFiles(esc(partial));
        // Start speaking this sentence NOW — don't wait for the rest.
        enqueueSentenceAudio(sentence);
        if (looksLikeConfirmation(sentence)) {
          phoneActions.style.display = 'flex';
        }
      }

      function onDone() {
        clearTimeout(watchdog);
        if (!inCall || myTurn !== turnSeq) return; // stale turn (taken over) — ignore
        streamDone = true;
        var reply = sentences.join(' ').trim() || "I didn't get a reply. Please try again.";
        if (!sentences.length) {
          phoneAgentMsg.textContent = reply;
        }
        addBubble('agent', reply);
        logEvent('ok', 'agent', 'Full reply ready (' + sentences.length + ' sentences) — speaking.');
        checkTtsDrained();
        var drained = false;
        whenTtsDrained(function () {
          drained = true;
          if (!inCall) return;
          if (isHangup) {
            endPhoneCall();
          } else {
            beginListen();
          }
        });
        // Last resort: the reply arrived but audio never drained — recover.
        setTimeout(function () {
          if (!drained && inCall && (callState === 'THINKING' || callState === 'SPEAKING')) {
            logEvent('error', 'agent', 'Audio did not finish — forcing back to listening.');
            beginListen();
          }
        }, 90000);
      }

      try {
        await streamTalk(text, currentCallId, { onSentence: onSentence, onDone: onDone });
      } catch (err) {
        clearTimeout(watchdog);
        streamDone = true;
        var errMsg = "Sorry — I couldn't reach the server. Is it running?";
        phoneAgentMsg.textContent = errMsg;
        addBubble('agent', errMsg, { error: true });
        // Never wedge the call in THINKING: go back to listening so the
        // user can retry instead of staring at a dead call.
        if (inCall) {
          if (phoneStatus) phoneStatus.textContent = 'Connection lost — listening again…';
          beginListen();
        } else if (phoneStatus) {
          phoneStatus.textContent = 'Network error';
        }
      }
    }

    /* ---------- Event Listeners ---------- */
    startCallBtn.addEventListener('click', function (e) {
      e.preventDefault();
      startPhoneCall();
    });

    phoneHangupBtn.addEventListener('click', function (e) {
      e.preventDefault();
      endPhoneCall();
    });

    phoneCloseBtn.addEventListener('click', function (e) {
      e.preventDefault();
      endPhoneCall();
    });

    // Activity log drawer controls.
    if (phoneLogBtn) {
      phoneLogBtn.addEventListener('click', function (e) {
        e.preventDefault();
        setLogOpen(phoneLogDrawer && phoneLogDrawer.hasAttribute('hidden'));
      });
    }
    var logCloseBtn = document.getElementById('phone-log-close');
    if (logCloseBtn) {
      logCloseBtn.addEventListener('click', function (e) {
        e.preventDefault();
        setLogOpen(false);
      });
    }
    var logClearBtn = document.getElementById('phone-log-clear');
    if (logClearBtn) {
      logClearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        logEntries = [];
        if (phoneLogList) phoneLogList.innerHTML = '';
        logEvent('info', 'log', 'Log cleared.');
      });
    }
    var logCopyBtn = document.getElementById('phone-log-copy');
    if (logCopyBtn) {
      logCopyBtn.addEventListener('click', function (e) {
        e.preventDefault();
        copyLog();
      });
    }

    phoneMuteBtn.addEventListener('click', function (e) {
      e.preventDefault();
      micMuted = !micMuted;
      phoneMuteBtn.classList.toggle('muted', micMuted);
      if (mediaStream) {
        mediaStream.getAudioTracks().forEach(function (t) { t.enabled = !micMuted; });
      }
      if (phoneMicOn) phoneMicOn.style.display = micMuted ? 'none' : '';
      if (phoneMicOff) phoneMicOff.style.display = micMuted ? '' : 'none';
      if (micMuted) {
        if (voiceEngine) voiceEngine.setVadActive(false);
        logEvent('info', 'mic', 'Microphone muted.');
        if (phoneStatus) phoneStatus.textContent = 'Microphone muted';
      } else {
        logEvent('info', 'mic', 'Microphone unmuted — listening.');
        if (phoneStatus) phoneStatus.textContent = 'Listening… (speak now)';
        if (voiceEngine && inCall && callState === 'LISTENING') {
          voiceEngine.setVadActive(true);
        }
      }
    });

    // Hold-to-Talk button: press-and-hold bypasses the VAD entirely.
    if (phoneTalkBtn) {
      phoneTalkBtn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        manualTalkStart();
      });
      var talkEnd = function (e) {
        if (e) e.preventDefault();
        manualTalkStop();
      };
      phoneTalkBtn.addEventListener('pointerup', talkEnd);
      phoneTalkBtn.addEventListener('pointercancel', talkEnd);
      phoneTalkBtn.addEventListener('pointerleave', talkEnd);
      // No context menu on long-press (mobile).
      phoneTalkBtn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }

    phoneBtnYes.addEventListener('click', function () {
      phoneActions.style.display = 'none';
      sendTypedTurn('yes');
    });

    phoneBtnNo.addEventListener('click', function () {
      phoneActions.style.display = 'none';
      sendTypedTurn('no');
    });

    phoneComposer.addEventListener('submit', function (e) {
      e.preventDefault();
      if (phoneInput && phoneInput.value.trim()) {
        sendTypedTurn(phoneInput.value.trim());
      }
    });

    var btnPhoneSend = document.getElementById('btn-phone-send');
    if (btnPhoneSend) {
      btnPhoneSend.addEventListener('click', function (e) {
        e.preventDefault();
        if (phoneInput && phoneInput.value.trim()) {
          sendTypedTurn(phoneInput.value.trim());
        }
      });
    }

    if (phoneInput) {
      phoneInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (phoneInput.value.trim()) {
            sendTypedTurn(phoneInput.value.trim());
          }
        }
      });
    }

    composer.addEventListener('submit', function (e) {
      e.preventDefault();
      if (composerInput.value.trim()) {
        sendTypedTurn(composerInput.value.trim());
      }
    });

    muteBtn.addEventListener('click', function () {
      audioOutputMuted = !audioOutputMuted;
      if (audioOutputMuted) stopVoice();
      muteBtn.classList.toggle('muted', audioOutputMuted);
      muteBtn.setAttribute('aria-pressed', audioOutputMuted ? 'true' : 'false');
      muteBtn.title = audioOutputMuted ? 'Unmute voice replies' : 'Mute voice replies';
      if (iconOn) iconOn.style.display = audioOutputMuted ? 'none' : '';
      if (iconOff) iconOff.style.display = audioOutputMuted ? '' : 'none';
    });

    /* ---------- Server Status Pill ---------- */
    function refreshStatus() {
      fetchJSON('/console/events', {}, 8000).then(function (data) {
        statusPill.classList.remove('offline');
        var lap = data && data.status && data.status.laptop_last_seen;
        var live = lap && (Date.now() - new Date(lap).getTime() < 60000);
        statusText.textContent = live ? 'Online · laptop live' : 'Online';
        statusPill.title = live ? 'Server and laptop agent are reachable'
                                : 'Server reachable' + (lap ? ' · laptop last seen ' + relTime(lap) : ' · laptop not seen yet');
      }).catch(function () {
        statusPill.classList.add('offline');
        statusText.textContent = 'Offline';
        statusPill.title = 'Cannot reach the server';
      });
    }
    refreshStatus();
    setInterval(refreshStatus, 15000);

    // Expose helpers on window
    window.startRingMateCall = startPhoneCall;
    window.endRingMateCall = endPhoneCall;
    window.sendRingMateTurn = sendTypedTurn;
    window.__ringmateReady = true;
  }

  /* ==================================================================
     CONSOLE PAGE
     ================================================================== */
  function initConsolePage() {
    var queueList = document.getElementById('queue-list');
    if (!queueList) return;

    var logStream = document.getElementById('log-stream');
    var statusRows = document.getElementById('status-rows');
    var queueCount = document.getElementById('queue-count');
    var pill = document.getElementById('console-status-pill');
    var pillText = document.getElementById('console-status-text');

    function badge(status) {
      var s = String(status || 'pending').toLowerCase();
      var cls = ['pending', 'claimed', 'done', 'expired'].indexOf(s) !== -1 ? s : 'pending';
      return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
    }

    function renderQueue(commands) {
      commands = Array.isArray(commands) ? commands : [];
      queueCount.textContent = commands.length ? '· ' + commands.length : '';
      if (!commands.length) {
        queueList.innerHTML = '<li class="console-empty">Queue is empty. Nothing waiting for the laptop.</li>';
        return;
      }
      queueList.innerHTML = commands.map(function (c) {
        var args = c.args;
        if (args && typeof args === 'object') {
          try { args = JSON.stringify(args); } catch (e) { args = String(args); }
        }
        return '<li class="queue-item">' +
          '<span class="q-tool">' + esc(c.tool || 'unknown') + '</span>' + badge(c.status) +
          '<br><span class="q-id">#' + esc(c.command_id != null ? c.command_id : c.id) + '</span>' +
          (args ? '<span class="q-args">' + esc(args) + '</span>' : '') +
          '</li>';
      }).join('');
    }

    function renderLog(log) {
      log = Array.isArray(log) ? log : [];
      var stick = logStream.scrollTop + logStream.clientHeight >= logStream.scrollHeight - 40;
      if (!log.length) {
        logStream.innerHTML = '<li class="console-empty">No actions yet. Talk to the assistant and watch this space.</li>';
        return;
      }
      logStream.innerHTML = log.map(function (e) {
        var actor = String(e.actor || 'server').toLowerCase();
        var acls = actor.indexOf('laptop') !== -1 ? 'actor-laptop'
                 : actor.indexOf('agent') !== -1 ? 'actor-agent' : 'actor-server';
        return '<li class="log-line">' +
          '<span class="ts">' + esc(e.ts || e.time || '') + '</span>' +
          '<span class="' + acls + '">' + esc(e.actor || 'server') + '</span>' +
          ' · ' + esc(e.action || '') +
          (e.detail ? '<span class="detail">' + esc(typeof e.detail === 'object' ? JSON.stringify(e.detail) : e.detail) + '</span>' : '') +
          '</li>';
      }).join('');
      if (stick) logStream.scrollTop = logStream.scrollHeight;
    }

    function row(k, v, cls) {
      return '<div class="status-row"><span class="k">' + esc(k) + '</span>' +
             '<span class="v' + (cls ? ' ' + cls : '') + '">' + esc(v) + '</span></div>';
    }

    function renderStatus(status) {
      status = status || {};
      var lap = status.laptop_last_seen;
      var lapMs = lap ? Date.now() - new Date(lap).getTime() : Infinity;
      var html = '';
      html += row('Laptop agent', isFinite(lapMs) ? relTime(lap) : 'not seen yet', isFinite(lapMs) && lapMs < 60000 ? 'good' : 'warn');
      html += row('Model', status.model || '—');
      html += row('Provider', status.provider || '—');
      html += row('Last turn latency', status.last_latency_s != null ? Number(status.last_latency_s).toFixed(1) + 's' : '—');
      html += row('Server time', status.server_time || new Date().toLocaleTimeString());
      statusRows.innerHTML = html;
    }

    function poll() {
      fetchJSON('/console/events', {}, 8000).then(function (data) {
        pill.classList.remove('offline');
        pillText.textContent = 'Connected';
        renderQueue(data.commands);
        renderLog(data.log);
        renderStatus(data.status);
      }).catch(function () {
        pill.classList.add('offline');
        pillText.textContent = 'Disconnected';
      });
    }

    poll();
    setInterval(poll, 2000);
  }

  /* ---------- Boot ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initTalkPage();
      initConsolePage();
    });
  } else {
    initTalkPage();
    initConsolePage();
  }
})();
