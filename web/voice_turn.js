/* web/voice_turn.js — v4.0 TurnCore: pure turn-taking state machine.
 *
 * Driven by a neural VAD (Silero) and/or a streaming STT (Deepgram), NOT by
 * raw microphone energy. This is the professional-grade turn-taking core:
 *
 *   LISTENING → CAPTURING → ENDPOINTING → SUBMITTING
 *
 * - CAPTURING begins on VAD speech onset (a neural model that knows the
 *   difference between a voice and a fan — energy thresholding is gone).
 * - ENDPOINTING: after VAD speech end, wait endpointMs (default 700ms) for
 *   the user to continue. A streaming STT can short-circuit this via
 *   deepgramFinal() (its own 300ms endpointing already fired).
 * - SUBMITTING hands the turn to the app via onEvent('submit', ...).
 * - Manual mode (Hold-to-Talk): release = submit immediately, no endpointing.
 * - Safety: 45s of continuous capture with no endpoint is cancelled, never
 *   submitted (that was the v3 transcribe-noise wedge).
 *
 * Pure logic: no DOM, no timers of its own. The host calls tick(nowMs) on an
 * interval and pushes VAD / STT / manual events. All side effects go out
 * through onEvent(name, data). Tested by tests/voice_turn.test.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.RingMateTurnCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_ENDPOINT_MS = 700;   // pro conversational endpointing (was 2000)
  var MAX_TURN_MS = 45000;         // safety cap: continuous sound = noise

  function TurnCore(opts) {
    opts = opts || {};
    this.state = 'LISTENING';
    this.endpointMs = opts.endpointMs || DEFAULT_ENDPOINT_MS;
    this.maxTurnMs = opts.maxTurnMs || MAX_TURN_MS;
    this.onEvent = opts.onEvent || function () {};
    this._now = opts.now || Date.now;
    this._manual = false;
    this._captureStartAt = 0;
    this._endpointAt = 0;
  }

  TurnCore.prototype._emit = function (name, data) {
    try { this.onEvent(name, data || {}); } catch (e) {}
  };

  // --- VAD events -------------------------------------------------------
  TurnCore.prototype.vadSpeechStart = function () {
    if (this._manual) return; // manual mode owns the turn
    if (this.state === 'LISTENING') {
      this.state = 'CAPTURING';
      this._captureStartAt = this._now();
      this._emit('capture-start', { manual: false });
    } else if (this.state === 'ENDPOINTING') {
      // User kept talking through the endpoint pause — keep capturing.
      this.state = 'CAPTURING';
      this._endpointAt = 0;
      this._emit('capture-continue', {});
    }
  };

  TurnCore.prototype.vadSpeechEnd = function () {
    if (this._manual) return;
    if (this.state === 'CAPTURING') {
      this.state = 'ENDPOINTING';
      this._endpointAt = this._now() + this.endpointMs;
    }
  };

  TurnCore.prototype.vadMisfire = function () {
    if (this._manual) return;
    if (this.state === 'CAPTURING' || this.state === 'ENDPOINTING') {
      this.state = 'LISTENING';
      this._endpointAt = 0;
      this._emit('capture-cancelled', { reason: 'misfire' });
    }
  };

  // --- streaming STT events ---------------------------------------------
  TurnCore.prototype.deepgramInterim = function (text) {
    if (this.state === 'CAPTURING' || this.state === 'ENDPOINTING') {
      this._emit('interim', { text: text });
    }
  };

  TurnCore.prototype.deepgramFinal = function (text) {
    if (this.state === 'CAPTURING' || this.state === 'ENDPOINTING') {
      this._submit(text, 'deepgram');
    }
  };

  // --- manual (Hold-to-Talk) --------------------------------------------
  TurnCore.prototype.manualStart = function () {
    this._manual = true;
    this.state = 'CAPTURING';
    this._captureStartAt = this._now();
    this._endpointAt = 0;
    this._emit('capture-start', { manual: true });
  };

  TurnCore.prototype.manualStop = function () {
    if (!this._manual) return;
    this._manual = false;
    this._submit(null, 'manual');
  };

  // --- lifecycle ----------------------------------------------------------
  TurnCore.prototype.isManual = function () { return this._manual; };

  TurnCore.prototype.setEndpointMs = function (ms) {
    // The engine extends this while a streaming STT is active, so the
    // streamer's own endpointing (faster than the VAD window) wins.
    this.endpointMs = ms;
  };

  TurnCore.prototype.reset = function () {
    // Back to listening after the app finished the turn (or a takeover).
    this.state = 'LISTENING';
    this._manual = false;
    this._endpointAt = 0;
    this._captureStartAt = 0;
  };

  TurnCore.prototype._submit = function (transcript, source) {
    this.state = 'SUBMITTING';
    this._manual = false;
    this._endpointAt = 0;
    this._emit('submit', { transcript: transcript, source: source });
  };

  TurnCore.prototype.tick = function (nowMs) {
    var now = (typeof nowMs === 'number') ? nowMs : this._now();
    if (this.state === 'ENDPOINTING' && now >= this._endpointAt) {
      // User really stopped: hand the audio to the app for transcription.
      this._submit(null, 'vad');
      return;
    }
    if (this.state === 'CAPTURING' && !this._manual &&
        now - this._captureStartAt >= this.maxTurnMs) {
      // 45s of continuous sound with no endpoint = background noise, never
      // a turn. Cancel it — submitting would wedge Whisper on noise audio.
      this.state = 'LISTENING';
      this._endpointAt = 0;
      this._emit('capture-cancelled', { reason: 'max-turn-noise' });
    }
  };

  return {
    TurnCore: TurnCore,
    DEFAULT_ENDPOINT_MS: DEFAULT_ENDPOINT_MS,
    MAX_TURN_MS: MAX_TURN_MS,
  };
}));
