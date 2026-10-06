/* web/voice4.js — v4.0 VoiceEngine: professional-grade browser voice input.
 *
 * Pipeline:
 *   mic → Silero VAD (neural, self-hosted ONNX) → TurnCore state machine
 *     → Deepgram Nova-3 streaming STT (if DEEPGRAM_API_KEY configured)
 *     → faster-whisper fallback via /web/stt (VAD audio, WAV-encoded)
 *
 * Why this is pro-grade:
 * - The VAD is a neural model that knows speech from fan noise (no more
 *   energy-threshold noise loops).
 * - Endpointing is 700ms (was 2000ms) — no awkward gap when you stop talking.
 * - Deepgram streams interim transcripts (live captions) and finalizes the
 *   turn ~300ms after you stop (speech_final) — instant replies.
 * - Hold-to-Talk bypasses everything for deterministic demos.
 *
 * Talk to app.js through events: onEvent(name, data).
 *   'capture-start' {manual} | 'capture-cancelled' {reason} |
 *   'interim' {text} | 'submit' {transcript|null, audioBlob|null, source} |
 *   'vad-ready' {} | 'vad-failed' {error} |
 *   'deepgram-ready' {} | 'deepgram-failed' {error} | 'deepgram-final' {}
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.RingMateVoice = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TurnCore = null;
  try {
    if (typeof require !== 'undefined') {
      TurnCore = require('./voice_turn.js').TurnCore;
    } else if (root.RingMateTurnCore) {
      TurnCore = root.RingMateTurnCore.TurnCore;
    }
  } catch (e) {}

  var DG_URL = 'wss://api.deepgram.com/v1/listen';
  var DG_REST_BASE = 'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true';
  function dgRestUrl(lang) {
    return DG_REST_BASE + '&language=' + encodeURIComponent(lang || 'en');
  }

  function encodeWav(float32, sampleRate) {
    var buffer = new ArrayBuffer(44 + float32.length * 2);
    var view = new DataView(buffer);
    function wstr(off, s) {
      for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    }
    wstr(0, 'RIFF');
    view.setUint32(4, 36 + float32.length * 2, true);
    wstr(8, 'WAVE');
    wstr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    wstr(36, 'data');
    view.setUint32(40, float32.length * 2, true);
    for (var i = 0; i < float32.length; i++) {
      var s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  function floatTo16BitPCM(float32) {
    var out = new Int16Array(float32.length);
    for (var i = 0; i < float32.length; i++) {
      var s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out.buffer;
  }

  function concatFloat32(chunks) {
    var total = 0, i;
    for (i = 0; i < chunks.length; i++) total += chunks[i].length;
    var out = new Float32Array(total);
    var off = 0;
    for (i = 0; i < chunks.length; i++) {
      out.set(chunks[i], off);
      off += chunks[i].length;
    }
    return out;
  }

  function VoiceEngine(opts) {
    opts = opts || {};
    this.getMicStream = opts.getMicStream;       // () => MediaStream
    this.getConfig = opts.getConfig;             // () => {deepgramKey}
    this.onEvent = opts.onEvent || function () {};
    this.log = opts.log || function () {};
    // Test hook: e2e sets window.RINGMATE_DG_URL to point at a stub server.
    var winDgUrl = (typeof window !== 'undefined' && window.RINGMATE_DG_URL) || '';
    this.dgUrl = opts.dgUrl || winDgUrl || DG_URL;
    this.vad = null;
    this.core = null;
    this.dgSocket = null;
    this.dgReady = false;
    this.dgFailed = false;
    this.deepgramKey = '';
    this.audioChunks = [];   // Float32Array frames of the current capture
    this.tickTimer = null;
    this.keepAliveTimer = null;
    this.vadActive = false;
  }

  VoiceEngine.prototype._emit = function (name, data) {
    try { this.onEvent(name, data || {}); } catch (e) {}
  };

  VoiceEngine.prototype._log = function (level, tag, msg) {
    try { this.log(level, tag, msg); } catch (e) {}
  };

  // ---- lifecycle --------------------------------------------------------
  VoiceEngine.prototype.start = async function () {
    var cfg = this.getConfig ? this.getConfig() : {};
    this.deepgramKey = (cfg && cfg.deepgramKey) || '';
    this.voiceLanguage = (cfg && cfg.voiceLanguage) || 'en';
    var Core = TurnCore || (typeof RingMateTurnCore !== 'undefined' && RingMateTurnCore.TurnCore);
    if (!Core) throw new Error('TurnCore missing');
    var self = this;
    this.core = new Core({
      endpointMs: 700,
      onEvent: function (name, data) { self._onCoreEvent(name, data); },
    });
    await this._initVad();
    if (this.deepgramKey) this._connectDeepgram();
    this.tickTimer = setInterval(function () {
      try { self.core.tick(); } catch (e) {}
    }, 100);
    this._log('ok', 'vad', 'Voice engine ready (Silero neural VAD + ' +
      (this.deepgramKey ? 'Deepgram streaming' : 'local Whisper fallback') + ').');
  };

  VoiceEngine.prototype._initVad = async function () {
    var VadWeb = (typeof window !== 'undefined' && window.VadWeb) || null;
    if (!VadWeb) throw new Error('VAD bundle not loaded');
    var self = this;
    this.vad = await VadWeb.MicVAD.new({
      model: 'v6',
      baseAssetPath: '/app/vendor/',
      onnxWASMBasePath: '/app/vendor/',
      getStream: async function () { return self.getMicStream(); },
      // Tuned for a noisy room: strict onset, quick end, blips rejected.
      positiveSpeechThreshold: 0.6,
      negativeSpeechThreshold: 0.35,
      redemptionFrames: 4,    // ~384ms of non-speech before speech-end
      minSpeechFrames: 5,     // ~480ms of speech before it counts
      preSpeechPadFrames: 3,
      onSpeechStart: function () {
        self._log('info', 'vad', 'Speech detected (neural VAD) — capturing.');
        self.core.vadSpeechStart();
      },
      onSpeechEnd: function () {
        self.core.vadSpeechEnd();
      },
      onVADMisfire: function () {
        self._log('info', 'vad', 'VAD misfire (too short) — ignoring.');
        self.core.vadMisfire();
      },
      onFrameProcessed: function (probs, frame) {
        self._onFrame(frame);
      },
    });
    this._emit('vad-ready', {});
  };

  VoiceEngine.prototype._onFrame = function (frame) {
    // Accumulate 16kHz PCM while capturing; stream to Deepgram live.
    if (!this.core) return;
    var st = this.core.state;
    if (st !== 'CAPTURING' && st !== 'ENDPOINTING') return;
    this.audioChunks.push(frame.slice());
    if (this.dgReady && this.dgSocket && this.dgSocket.readyState === 1) {
      try { this.dgSocket.send(floatTo16BitPCM(frame)); } catch (e) {}
    }
  };

  VoiceEngine.prototype._onCoreEvent = function (name, data) {
    if (name === 'submit') {
      this._onSubmit(data);
    } else {
      if (name === 'capture-cancelled') this.audioChunks = [];
      this._emit(name, data);
    }
  };

  VoiceEngine.prototype._onSubmit = function (data) {
    // data: {transcript|null, source}. Attach the captured audio as WAV.
    var audio = this.audioChunks.length ? concatFloat32(this.audioChunks) : null;
    this.audioChunks = [];
    var blob = audio && audio.length > 800 ? encodeWav(audio, 16000) : null;
    this._emit('submit', {
      transcript: data.transcript || null,
      audioBlob: blob,
      source: data.source,
    });
  };

  VoiceEngine.prototype.setVadActive = function (active) {
    // app.js gates the VAD off while the agent thinks/speaks.
    if (!this.vad) return;
    if (active === this.vadActive) return;
    this.vadActive = active;
    try {
      if (active) this.vad.start();
      else this.vad.pause();
    } catch (e) {}
  };

  VoiceEngine.prototype.stop = function () {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
    try { if (this.dgSocket) this.dgSocket.close(); } catch (e) {}
    this.dgSocket = null;
    this.dgReady = false;
    try { if (this.vad) this.vad.destroy(); } catch (e) {}
    this.vad = null;
    this.core = null;
    this.audioChunks = [];
  };

  // ---- manual (Hold-to-Talk) ----------------------------------------------
  VoiceEngine.prototype.startManual = function () {
    if (!this.core) return;
    this.audioChunks = [];
    // Manual capture must work even when the VAD is paused (backoff/mute):
    // ensure frames flow while the button is held.
    this._wasVadActive = this.vadActive;
    this.setVadActive(true);
    this.core.manualStart();
    // Safety: if the pointerup is lost (browser quirk), auto-submit after
    // 15s rather than capturing forever.
    var self = this;
    if (this._manualTimer) clearTimeout(this._manualTimer);
    this._manualTimer = setTimeout(function () {
      self._manualTimer = null;
      if (self.core && self.core.isManual()) {
        self._log('warn', 'vad', 'Hold-to-Talk auto-released after 15s.');
        self.stopManual();
      }
    }, 15000);
  };

  VoiceEngine.prototype.stopManual = function () {
    if (!this.core) return;
    if (this._manualTimer) {
      clearTimeout(this._manualTimer);
      this._manualTimer = null;
    }
    if (!this.core.isManual()) return;
    // Guard against duplicate release events (pointerup + pointercancel).
    if (this._waitingForDg) return;
    // If the button was tapped too fast for any audio frames to arrive,
    // don't submit an empty turn — tell the UI to ask for a longer hold.
    if (this.audioChunks.length === 0) {
      if (this._wasVadActive === false) this.setVadActive(false);
      this._wasVadActive = undefined;
      this.core.reset();
      this._emit('manual-empty', {});
      return;
    }
    // If Deepgram is configured, send the captured audio to Deepgram's REST
    // API for transcription (more reliable than waiting for WebSocket final).
    if (this.deepgramKey && !this.dgFailed) {
      var self = this;
      this._waitingForDg = true;
      this._log('info', 'stt', 'Talk released — transcribing via Deepgram…');
      // Keep VAD running so the core stays in CAPTURING until we submit.
      this._transcribeViaDeepgramRest();
      // Safety timeout: fall back to local Whisper if Deepgram REST fails.
      if (this._dgWaitTimer) clearTimeout(this._dgWaitTimer);
      this._dgWaitTimer = setTimeout(function () {
        self._dgWaitTimer = null;
        if (self._waitingForDg) {
          self._waitingForDg = false;
          if (self._wasVadActive === false) self.setVadActive(false);
          self._wasVadActive = undefined;
          if (self.core && self.core.isManual()) {
            self._log('warn', 'stt', 'Deepgram REST timed out — falling back to local.');
            self.core.manualStop();
          }
        }
      }, 10000);
      return;
    }
    if (this._wasVadActive === false) this.setVadActive(false);
    this._wasVadActive = undefined;
    this.core.manualStop();
  };

  VoiceEngine.prototype._transcribeViaDeepgramRest = function () {
    var self = this;
    if (!this.core || !this.deepgramKey) {
      this._waitingForDg = false;
      return;
    }
    // Concatenate audio chunks into a single Float32Array, encode as WAV.
    var total = 0;
    for (var i = 0; i < this.audioChunks.length; i++) total += this.audioChunks[i].length;
    if (total === 0) {
      this._waitingForDg = false;
      if (this._wasVadActive === false) this.setVadActive(false);
      this._wasVadActive = undefined;
      this.core.reset();
      this._emit('manual-empty', {});
      return;
    }
    var pcm = new Float32Array(total);
    var off = 0;
    for (var j = 0; j < this.audioChunks.length; j++) {
      pcm.set(this.audioChunks[j], off);
      off += this.audioChunks[j].length;
    }
    var wav = encodeWav(pcm, 16000);
    fetch(dgRestUrl(self.voiceLanguage), {
      method: 'POST',
      headers: {
        'Authorization': 'Token ' + this.deepgramKey,
        'Content-Type': 'audio/wav',
      },
      body: wav,
    }).then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function (data) {
      if (!self._waitingForDg) return; // timed out or cancelled
      self._waitingForDg = false;
      if (self._dgWaitTimer) {
        clearTimeout(self._dgWaitTimer);
        self._dgWaitTimer = null;
      }
      if (self._wasVadActive === false) self.setVadActive(false);
      self._wasVadActive = undefined;
      var alt = data.results && data.results.channels &&
                data.results.channels[0].alternatives &&
                data.results.channels[0].alternatives[0];
      var text = (alt && alt.transcript) || '';
      if (text) {
        self._log('ok', 'stt', 'Deepgram REST: "' + text + '"');
        // Submit via the core's deepgram path (bypasses local Whisper).
        if (self.core.isManual()) {
          // Clear manual flag without submitting via Whisper.
          self.core._manual = false;
        }
        self.core.deepgramFinal(text);
      } else {
        self._log('info', 'stt', 'Deepgram REST: empty transcript.');
        if (self.core.isManual()) self.core.manualStop();
      }
    }).catch(function (err) {
      if (!self._waitingForDg) return;
      self._waitingForDg = false;
      if (self._dgWaitTimer) {
        clearTimeout(self._dgWaitTimer);
        self._dgWaitTimer = null;
      }
      if (self._wasVadActive === false) self.setVadActive(false);
      self._wasVadActive = undefined;
      self._log('warn', 'stt', 'Deepgram REST failed: ' + err.message + ' — falling back to local.');
      if (self.core && self.core.isManual()) self.core.manualStop();
    });
  };

  VoiceEngine.prototype.getState = function () {
    return this.core ? this.core.state : 'IDLE';
  };

  VoiceEngine.prototype.takeover = function () {
    // Force-abort any in-flight capture (Hold-to-Talk from another state).
    if (!this.core) return;
    this.audioChunks = [];
    // Cancel a pending Deepgram-wait from a previous Talk release.
    this._waitingForDg = false;
    if (this._dgWaitTimer) {
      clearTimeout(this._dgWaitTimer);
      this._dgWaitTimer = null;
    }
    this.core.reset();
    // Drop any half-streamed Deepgram audio for the old turn.
    try {
      if (this.dgSocket && this.dgSocket.readyState === 1) {
        this.dgSocket.send(JSON.stringify({ type: 'CloseStream' }));
      }
    } catch (e) {}
    this.ensureDeepgram();
  };

  VoiceEngine.prototype.isManual = function () {
    return this.core ? this.core.isManual() : false;
  };

  // ---- Deepgram streaming ---------------------------------------------------
  VoiceEngine.prototype._connectDeepgram = function () {
    var self = this;
    if (!this.deepgramKey || this.dgFailed) return;
    if (this.dgSocket && (this.dgSocket.readyState === 0 || this.dgSocket.readyState === 1)) return;
    var lang = this.voiceLanguage || 'en';
    var params = [
      'model=nova-3', 'language=' + encodeURIComponent(lang), 'encoding=linear16', 'sample_rate=16000',
      'channels=1', 'interim_results=true', 'endpointing=300',
      'utterance_end_ms=1000', 'smart_format=true',
    ].join('&');
    var url = this.dgUrl + (this.dgUrl.indexOf('?') === -1 ? '?' : '&') + params;
    this._log('info', 'stt', 'Connecting to Deepgram streaming (' + lang + ')…');
    var ws;
    try {
      ws = new WebSocket(url, ['token', this.deepgramKey]);
    } catch (e) {
      return this._deepgramFailed('connect threw: ' + e.message);
    }
    this.dgSocket = ws;
    ws.onopen = function () {
      self.dgReady = true;
      // While streaming, let Deepgram's own endpointing win: extend the VAD
      // window so a slow final still beats the local submit.
      try { if (self.core) self.core.setEndpointMs(2500); } catch (e) {}
      self._log('ok', 'stt', 'Deepgram streaming connected.');
      self._emit('deepgram-ready', {});
      if (!self.keepAliveTimer) {
        self.keepAliveTimer = setInterval(function () {
          try {
            if (self.dgSocket && self.dgSocket.readyState === 1) {
              self.dgSocket.send(JSON.stringify({ type: 'KeepAlive' }));
            }
          } catch (e) {}
        }, 8000);
      }
    };
    ws.onmessage = function (ev) {
      try { self._onDeepgramMessage(JSON.parse(ev.data)); } catch (e) {}
    };
    ws.onerror = function () {
      self._deepgramFailed('websocket error');
    };
    ws.onclose = function () {
      if (self.dgReady) self._log('warn', 'stt', 'Deepgram connection closed.');
      self.dgReady = false;
      self.dgSocket = null;
      try { if (self.core) self.core.setEndpointMs(700); } catch (e) {}
    };
  };

  VoiceEngine.prototype._deepgramFailed = function (why) {
    if (this.dgFailed) return;
    this.dgFailed = true; // fall back to local Whisper for the rest of the call
    this.dgReady = false;
    try { if (this.dgSocket) this.dgSocket.close(); } catch (e) {}
    this.dgSocket = null;
    this._log('warn', 'stt', 'Deepgram unavailable (' + why + ') — using local Whisper.');
    this._emit('deepgram-failed', { error: why });
    try { if (this.core) this.core.setEndpointMs(700); } catch (e) {}
  };

  VoiceEngine.prototype._onDeepgramMessage = function (msg) {
    if (!msg || !this.core) return;
    if (msg.type === 'Results') {
      var alt = msg.channel && msg.channel.alternatives && msg.channel.alternatives[0];
      var text = (alt && alt.transcript) || '';
      if (!text) return;
      if (msg.is_final) {
        if (msg.speech_final) {
          this._log('ok', 'stt', 'Deepgram final: "' + text + '"');
          // If we were waiting for this after a Talk release, cancel the
          // fallback timer and restore the pre-manual VAD state.
          if (this._waitingForDg) {
            this._waitingForDg = false;
            if (this._dgWaitTimer) {
              clearTimeout(this._dgWaitTimer);
              this._dgWaitTimer = null;
            }
            if (this._wasVadActive === false) this.setVadActive(false);
            this._wasVadActive = undefined;
          }
          this.core.deepgramFinal(text);
        } else {
          this.core.deepgramInterim(text);
        }
      } else {
        this.core.deepgramInterim(text);
      }
    }
  };

  VoiceEngine.prototype.ensureDeepgram = function () {
    if (this.deepgramKey && !this.dgFailed && !this.dgReady) this._connectDeepgram();
  };

  return {
    VoiceEngine: VoiceEngine,
    encodeWav: encodeWav,
  };
}));
