'use strict';
/* Phase 6 tests: redaction, retry, coalescing/idempotent sync, offline recovery, no storage writes. Run: node tests/ops.test.js */
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const Ops = require('../ops.js');
let n = 0; const ok = () => { n++; };
const SECRET = 'my-secret-answer-42 alice@example.com';

// ---- redaction: untrusted fields never survive ----
const rep = Ops.createReporter({ screen: () => 'report', versions: () => ({ scoring: '1.0.0' }), online: () => true });
const ev = rep.report('error', { name: 'TypeError', message: SECRET, stack: 'TypeError: ' + SECRET + '\n    at f (https://x.app/app-core.js?token=abc:192:9)', code: 'ok_code', answers: [1, 2, 3], email: 'alice@example.com' });
const json = JSON.stringify(ev);
assert.ok(!json.includes('secret') && !json.includes('alice') && !json.includes('token') && !json.includes('answers'), 'event leaked untrusted data'); ok();
assert.equal(ev.at, 'app-core.js:192'); assert.equal(ev.name, 'TypeError'); assert.equal(ev.screen, 'report'); assert.match(ev.id, /^r-[0-9a-f]{12}$/); assert.equal(ev.v.scoring, '1.0.0'); ok();
assert.deepEqual(Object.keys(ev).sort(), ['app', 'at', 'code', 'id', 'kind', 't', 'name', 'online', 'screen', 'v'].sort()); ok();   // fixed shape: adding a field is a reviewed decision
const ev2 = rep.report('weird-kind', { name: 'EvilError<script>', code: 'has spaces & symbols!' });
assert.equal(ev2.kind, 'error'); assert.equal(ev2.name, 'Error'); assert.equal(ev2.code, ''); ok();
const ev3 = Ops.redact('render', { code: 'x' }, { screen: '<img src=x>' }); assert.equal(ev3.screen, ''); ok();
assert.equal(Ops.where('no file here'), ''); assert.equal(Ops.where('', 5), ''); ok();

// ---- flood protection + bounded buffer ----
const flood = Ops.createReporter({}); let sent = 0; const flood2 = Ops.createReporter({ send: () => sent++ });
for (let i = 0; i < 100; i++) flood.report('render', { name: 'Error', code: 'same' });
assert.equal(flood.events().length, 3, 'identical errors must be capped at 3'); ok();
for (let i = 0; i < 100; i++) flood2.report('error', { name: 'Error', code: 'c' + i });
assert.equal(sent, 20, 'at most 20 events sent per session'); assert.ok(flood2.events().length <= 50); ok();
assert.ok(!JSON.parse(rep.diagnostics()).events.some(e => JSON.stringify(e).includes('secret'))); ok();


// ---- regression: the browser wiring must read the REAL ProfileSchema export (an earlier build called a non-existent versions())
(function () {
  const src = fs.readFileSync(path.join(__dirname, '..', 'ops.js'), 'utf8');
  assert.ok(/ProfileSchema\.VERSIONS/.test(src) && !/ProfileSchema\.versions/.test(src), 'ops.js must use ProfileSchema.VERSIONS'); ok();
  const ps = fs.readFileSync(path.join(__dirname, '..', 'profile-schema.js'), 'utf8');
  assert.ok(/VERSIONS: VERSIONS/.test(ps), 'profile-schema.js must export VERSIONS'); ok();
  let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { return; }
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/', runScripts: 'outside-only' });
  const w = dom.window; w.eval(fs.readFileSync(path.join(__dirname, '..', 'core-logic.js'), 'utf8')); w.eval(ps); w.eval(src);
  const e = w.PsycheOps.report('error', { name: 'TypeError', code: 'versions_check' });
  assert.ok(e && e.v && e.v.scoring === '1.0.0' && e.v.narrative, 'events from the real page carry engine versions'); ok(); w.close();
})();

// ---- retry ----
(async () => {
  const noSleep = () => Promise.resolve();
  let calls = 0;
  let r = await Ops.retry(() => { calls++; return Promise.resolve(calls < 3 ? { error: 'x', transient: true } : { error: null }); }, { tries: 3, sleep: noSleep });
  assert.equal(r.error, null); assert.equal(calls, 3); ok();
  calls = 0; r = await Ops.retry(() => { calls++; return Promise.resolve({ error: 'permission', transient: false }); }, { tries: 3, sleep: noSleep });
  assert.equal(calls, 1, 'non-transient errors are never retried'); assert.ok(r.error); ok();
  calls = 0; r = await Ops.retry(() => { calls++; return Promise.resolve({ error: 'net', transient: true }); }, { tries: 3, sleep: noSleep });
  assert.equal(calls, 3); assert.ok(r.error, 'gives up after max tries and reports the error'); ok();
  calls = 0; r = await Ops.retry(() => { calls++; return Promise.reject(new Error('Failed to fetch')); }, { tries: 2, sleep: noSleep });
  assert.equal(calls, 2); assert.ok(r.error); ok();
  calls = 0; let allow = true;
  r = await Ops.retry(() => { calls++; allow = false; return Promise.resolve({ error: 'net', transient: true }); }, { tries: 5, sleep: noSleep, canRetry: () => allow });
  assert.equal(calls, 1, 'retry stops when the user signed out / went offline'); ok();
  const delays = []; await Ops.retry(() => Promise.resolve({ error: 'n', transient: true }), { tries: 4, baseMs: 100, sleep: ms => { delays.push(ms); return Promise.resolve(); } });
  assert.deepEqual(delays, [100, 200, 400]); ok();
  assert.ok(Ops.isTransient({ status: 503 })); assert.ok(Ops.isTransient({ status: 429 })); assert.ok(Ops.isTransient(new Error('Failed to fetch'))); ok();
  assert.ok(!Ops.isTransient({ message: 'new row violates row-level security policy' })); assert.ok(!Ops.isTransient({ message: 'JWT expired' })); assert.ok(!Ops.isTransient(null)); ok();

  // ---- coalescing: duplicate/rapid saves => one in flight + one trailing; latest wins; replay-safe ----
  const co = Ops.createCoalescer(); const writes = []; let live = 0, maxLive = 0;
  const mk = v => () => new Promise(res => { live++; maxLive = Math.max(maxLive, live); setTimeout(() => { writes.push(v); live--; res({ error: null, v }); }, 15); });
  const out = await Promise.all([co('k', mk('a')), co('k', mk('b')), co('k', mk('c')), co('k', mk('d'))]);
  assert.deepEqual(writes, ['a', 'd'], 'first runs, intermediate calls dropped, latest runs once'); assert.equal(maxLive, 1, 'never two concurrent writes'); ok();
  assert.equal(out[3].v, 'd'); ok();
  const failing = () => Promise.reject(new Error('boom')); await assert.rejects(co('f', failing)); const after = await co('f', () => Promise.resolve(7)); assert.equal(after, 7, 'a failure does not wedge the queue'); ok();
  const other = await Promise.all([co('x', mk('x1')), co('y', mk('y1'))]); assert.equal(other.length, 2); ok();

  // ---- fallback ----
  assert.equal(Ops.withFallback(() => { throw new Error(SECRET); }, 'fb', e => rep.report('error', { name: e.name })), 'fb'); ok();
  assert.equal(Ops.withFallback(() => 5, 'fb'), 5); ok();

  // ---- static guarantees ----
  const src = fs.readFileSync(path.join(__dirname, '..', 'ops.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(src), 'ops.js must not persist anything'); ok();
  assert.ok(!/\.message/.test(src.replace(/err && \(err\.message \|\| err\.code\)/, '')), 'ops.js must never read error messages into events (only isTransient inspects them)'); ok();
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.indexOf('ops.js') > -1 && html.indexOf('ops.js') < html.indexOf('app-core.js') && html.indexOf('ops.js') < html.indexOf('auth.js'), 'ops.js must load before auth/app code'); ok();
  assert.ok(/connect-src 'self' https:\/\/\*\.supabase\.co;/.test(html), 'default CSP sends nothing except Supabase (telemetry endpoint is opt-in and must be added deliberately)'); ok();
  const app = fs.readFileSync(path.join(__dirname, '..', 'app-core.js'), 'utf8');
  assert.ok(/PsycheOps\.sync\('push-result'/.test(app) && /PsycheOps\.retry\(/.test(app), 'pushResult must be coalesced + retried'); ok();
  assert.ok(/addEventListener\('online'[\s\S]{0,200}pushResult\(\)/.test(app), 'back-online must resume sync'); ok();
  assert.ok(/uid && state\.result && state\.resultOwner === uid|state\.resultOwner !== uid\) return Promise\.resolve/.test(app), 'a retry must never upload after account switch'); ok();
  const cfgSrc = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8'); assert.ok(!/TELEMETRY_URL\s*:/.test(cfgSrc), 'telemetry must be off by default'); ok();

  console.log('Operations/resilience tests passed (' + n + ' assertions).');
})().catch(e => { console.error(e); process.exit(1); });
