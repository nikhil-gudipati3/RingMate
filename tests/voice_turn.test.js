// Node tests for web/voice_turn.js (v4.0 TurnCore). Pure logic, no DOM.
const test = require('node:test');
const assert = require('node:assert/strict');
const { TurnCore, DEFAULT_ENDPOINT_MS, MAX_TURN_MS } = require('../web/voice_turn.js');

function makeCore(opts) {
  const events = [];
  let now = 0;
  const core = new TurnCore(Object.assign({
    now: () => now,
    endpointMs: 700,
    onEvent: (name, data) => events.push({ name, data }),
  }, opts || {}));
  return { core, events, setNow: (t) => { now = t; }, getNow: () => now };
}

test('constants: 700ms endpointing, 45s cap', () => {
  assert.equal(DEFAULT_ENDPOINT_MS, 700);
  assert.equal(MAX_TURN_MS, 45000);
});

test('VAD speech start begins capture', () => {
  const { core, events } = makeCore();
  core.vadSpeechStart();
  assert.equal(core.state, 'CAPTURING');
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'capture-start');
  assert.equal(events[0].data.manual, false);
});

test('VAD speech end -> endpointing -> submit after 700ms', () => {
  const { core, events, setNow } = makeCore();
  core.vadSpeechStart();
  setNow(1000);
  core.vadSpeechEnd();
  assert.equal(core.state, 'ENDPOINTING');
  setNow(1000 + 699);
  core.tick();
  assert.equal(core.state, 'ENDPOINTING'); // not yet
  setNow(1000 + 700);
  core.tick();
  assert.equal(core.state, 'SUBMITTING');
  const sub = events.find(e => e.name === 'submit');
  assert.ok(sub);
  assert.equal(sub.data.source, 'vad');
  assert.equal(sub.data.transcript, null);
});

test('speech restart during endpointing resumes capture', () => {
  const { core, events, setNow } = makeCore();
  core.vadSpeechStart();
  setNow(1000);
  core.vadSpeechEnd();
  assert.equal(core.state, 'ENDPOINTING');
  setNow(1200);
  core.vadSpeechStart(); // user kept talking
  assert.equal(core.state, 'CAPTURING');
  const cont = events.find(e => e.name === 'capture-continue');
  assert.ok(cont);
  setNow(5000);
  core.tick();
  assert.equal(core.state, 'CAPTURING'); // endpoint timer was cancelled
});

test('deepgram final submits immediately with transcript', () => {
  const { core, events } = makeCore();
  core.vadSpeechStart();
  core.deepgramFinal('send my resume');
  assert.equal(core.state, 'SUBMITTING');
  const sub = events.find(e => e.name === 'submit');
  assert.equal(sub.data.transcript, 'send my resume');
  assert.equal(sub.data.source, 'deepgram');
});

test('deepgram final during endpointing short-circuits the wait', () => {
  const { core, events, setNow } = makeCore();
  core.vadSpeechStart();
  setNow(1000);
  core.vadSpeechEnd();
  setNow(1100); // only 100ms into the 700ms endpoint window
  core.deepgramFinal('hello there');
  assert.equal(core.state, 'SUBMITTING');
});

test('deepgram interim only fires while capturing', () => {
  const { core, events } = makeCore();
  core.deepgramInterim('hel'); // LISTENING: ignored
  assert.equal(events.length, 0);
  core.vadSpeechStart();
  core.deepgramInterim('hello');
  const inter = events.find(e => e.name === 'interim');
  assert.ok(inter);
  assert.equal(inter.data.text, 'hello');
});

test('VAD misfire cancels the capture', () => {
  const { core, events } = makeCore();
  core.vadSpeechStart();
  core.vadMisfire();
  assert.equal(core.state, 'LISTENING');
  const c = events.find(e => e.name === 'capture-cancelled');
  assert.equal(c.data.reason, 'misfire');
});

test('manual hold-to-talk: release submits immediately, no endpointing', () => {
  const { core, events, setNow } = makeCore();
  core.manualStart();
  assert.equal(core.state, 'CAPTURING');
  assert.ok(core.isManual());
  setNow(5000);
  core.tick(); // endpointing must NOT apply to manual
  assert.equal(core.state, 'CAPTURING');
  core.manualStop();
  assert.equal(core.state, 'SUBMITTING');
  const sub = events.find(e => e.name === 'submit');
  assert.equal(sub.data.source, 'manual');
});

test('manual mode ignores VAD events', () => {
  const { core, events } = makeCore();
  core.manualStart();
  core.vadSpeechEnd(); // must not enter ENDPOINTING
  assert.equal(core.state, 'CAPTURING');
  core.vadMisfire(); // must not cancel
  assert.equal(core.state, 'CAPTURING');
  assert.equal(events.filter(e => e.name === 'capture-cancelled').length, 0);
});

test('45s of continuous capture cancels instead of submitting', () => {
  const { core, events, setNow } = makeCore();
  core.vadSpeechStart(); // t=0
  setNow(45000);
  core.tick();
  assert.equal(core.state, 'LISTENING');
  const c = events.find(e => e.name === 'capture-cancelled');
  assert.equal(c.data.reason, 'max-turn-noise');
  assert.equal(events.filter(e => e.name === 'submit').length, 0);
});

test('setEndpointMs extends the window while streaming STT is active', () => {
  const { core, events, setNow } = makeCore();
  core.setEndpointMs(2500);
  core.vadSpeechStart();
  setNow(1000);
  core.vadSpeechEnd();
  setNow(1000 + 700);
  core.tick();
  assert.equal(core.state, 'ENDPOINTING'); // not yet — extended window
  setNow(1000 + 2500);
  core.tick();
  assert.equal(core.state, 'SUBMITTING');
});

test('reset returns to listening', () => {
  const { core, events, setNow } = makeCore();
  core.setEndpointMs(2500);
  core.vadSpeechStart();
  setNow(1000);
  core.vadSpeechEnd();
  setNow(1000 + 700);
  core.tick();
  assert.equal(core.state, 'ENDPOINTING'); // not yet — extended window
  setNow(1000 + 2500);
  core.tick();
  assert.equal(core.state, 'SUBMITTING');
});

test('reset returns to listening', () => {
  const { core } = makeCore();
  core.vadSpeechStart();
  core.reset();
  assert.equal(core.state, 'LISTENING');
  assert.equal(core.isManual(), false);
});

test('events never throw back into the core', () => {
  const { core } = makeCore({
    onEvent: () => { throw new Error('boom'); },
  });
  core.vadSpeechStart(); // must not throw
  assert.equal(core.state, 'CAPTURING');
});
