/* Integration: assessment -> result -> persistence -> reload -> sync, in jsdom.
   Run: node tests/integration.test.js  (needs `npm install` for jsdom) */
const assert = require('assert'), fs = require('fs'), path = require('path');
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { console.log('SKIP integration tests: jsdom not installed (npm install).'); process.exit(0); }
const DIR = path.join(__dirname, '..');
const FILES = ['config.js', 'ops.js', 'auth.js', 'core-logic.js', 'profile-schema.js', 'privacy-local.js', 'share-policy.js', 'text-dedupe.js', 'implications_data.js', 'deep-analysis.js', 'traits-engine.js', 'engine-plus.js', 'group-insights.js', 'social-plus.js', 'trait-duo.js', 'intelligence-engine.js', 'ux.js', 'app-core.js'];
const KEY = 'psyche_core_v1';

function boot(opts) {
  opts = opts || {};
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/scrollTo|Not implemented: (HTMLCanvas|window\.print)/.test(e.message)) errs.push(e.message); });
  vc.on('error', e => errs.push(String(e)));
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8').replace(/<script src="[^"]*"><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost:8000/', runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
  const w = dom.window;
  if (opts.storage !== undefined) w.localStorage.setItem(KEY, typeof opts.storage === 'string' ? opts.storage : JSON.stringify(opts.storage));
  w.__PSYCHE_TEST__ = true;
  if (opts.auth) w.PsycheAuth = opts.auth;
  FILES.filter(f => !(opts.auth && f === 'auth.js')).forEach(f => { try { w.eval(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { errs.push(f + ': ' + e.message); } });
  return { w, errs, app: w.__PSYCHE_TEST__, store: () => JSON.parse(w.localStorage.getItem(KEY) || 'null') };
}
const answers = (f) => Array.from({ length: 40 }, (_, i) => f(i));
let n = 0; const ok = (m) => { n++; };
(async () => {
  // 1. complete assessment through the real handlers
  let b = boot();
  assert.strictEqual(typeof b.app, 'object', 'test hook missing');
  assert.strictEqual(b.app.state.result, null); ok();
  b.app.state.screen = 'assessment'; b.app.render();
  const vals = answers(i => 1 + (i * 3 % 5));
  vals.forEach((v, i) => { assert.strictEqual(b.app.state.qIndex, i); b.app.answerCurrent(v, null); });
  assert.strictEqual(b.app.state.screen, 'results'); ok();
  const res = b.app.state.result;
  assert.strictEqual(res.schema, 1); assert.deepStrictEqual(Array.from(res.ans), vals); assert.strictEqual(res.skipped, 0); ok();
  assert.ok(b.store().result.dims, 'persisted'); ok();
  // 2. every result tab renders for a valid result
  ['profile', 'facets', 'deep', 'career', 'relationship', 'plus'].forEach(t => { b.app.state.resultsTab = t; b.app.render(); assert.ok(b.w.document.getElementById('app').innerHTML.length > 500, t); ok(); });
  assert.deepStrictEqual(b.errs, [], 'render errors: ' + b.errs.join('|'));

  // 3. reload with a valid saved result
  const saved = JSON.parse(JSON.stringify(b.store()));
  let r = boot({ storage: saved });
  assert.ok(r.app.state.result && r.app.state.result.dims.P === res.dims.P); assert.deepStrictEqual(r.errs, []); ok();

  // 4. legacy (baseline-shaped, no schema) result still loads
  const legacy = JSON.parse(JSON.stringify(saved)); delete legacy.result.schema; delete legacy.result.versions; delete legacy.result.skipped;
  r = boot({ storage: legacy }); assert.ok(r.app.state.result); assert.strictEqual(r.app.state.result.schema, 1); ok();

  // 5. corrupt / hostile saved data is rejected safely, never rendered, and kept for recovery
  const bad = [
    '{not json', '[]', 'null', '"x"', '{"result":5}', '{"result":{}}', '{"result":{"dims":{},"facets":{}}}',
    JSON.stringify({ result: Object.assign({}, saved.result, { dims: Object.assign({}, saved.result.dims, { P: 400 }) }) }),
    JSON.stringify({ result: Object.assign({}, saved.result, { schema: 42 }) }),
    JSON.stringify({ result: { dims: saved.result.dims, facets: { 'P.curiosity': 'x' } }, theme: { a: 1 } })
  ];
  bad.forEach((s, i) => {
    const x = boot({ storage: s });
    assert.strictEqual(x.app.state.result, null, 'case ' + i);
    assert.strictEqual(x.app.state.screen, 'home', 'case ' + i);
    assert.ok(x.w.document.getElementById('app').innerHTML.length > 200, 'home rendered ' + i);
    assert.deepStrictEqual(x.errs, [], 'case ' + i + ' errors: ' + x.errs.join('|'));
    if (s.indexOf('"result":') > 0 && /"result":(\{|5)/.test(s) && !/theme/.test(s) || /dims/.test(s)) assert.ok(x.w.localStorage.getItem(KEY + '_rejected'), 'rejected copy kept ' + i);
    ok();
  });

  // 6. cloud sync
  const mkAuth = (loadRes, calls) => ({ enabled: true, init: () => {}, urlError: () => null,
    loadResult: () => Promise.resolve(loadRes), saveResult: (uid, result, at) => { calls.push({ uid, result, at }); return Promise.resolve({}); },
    saveProfile: () => Promise.resolve({}), loadProfile: () => Promise.resolve({ name: 'T' }) });
  const cloudGood = JSON.parse(JSON.stringify(saved.result)); delete cloudGood.ans;
  // 6a. invalid cloud copy never replaces a valid local one; local overwrites it
  let calls = [];
  b = boot({ storage: saved, auth: mkAuth({ result: { dims: { P: 'x' } }, at: Date.now() + 1e6 }, calls) });
  b.app.state.user = { id: 'u1', email: 'a@b.c' };
  await b.app.syncAfterLogin();
  assert.strictEqual(b.app.state.result.dims.P, res.dims.P); assert.ok(calls.length >= 1 && calls[0].result.dims.P === res.dims.P);
  assert.ok(!('ans' in calls[0].result), 'answers never uploaded'); ok();
  // 6b. invalid cloud copy and no local result: stays empty, status error
  calls = [];
  b = boot({ auth: mkAuth({ result: { nope: 1 }, at: 5 }, calls) });
  b.app.state.user = { id: 'u1', email: 'a@b.c' };
  await b.app.syncAfterLogin();
  assert.strictEqual(b.app.state.result, null); assert.strictEqual(b.app.state.syncStatus, 'error'); assert.strictEqual(calls.length, 0); ok();
  // 6c. newer valid cloud copy wins and is normalised
  calls = [];
  const other = JSON.parse(JSON.stringify(cloudGood)); other.dims.P = other.dims.P; 
  b = boot({ storage: { result: saved.result, resultAt: 1000 }, auth: mkAuth({ result: other, at: 5000 }, calls) });
  b.app.state.user = { id: 'u1', email: 'a@b.c' };
  await b.app.syncAfterLogin();
  assert.strictEqual(b.app.state.resultAt, 5000); assert.strictEqual(b.app.state.syncStatus, 'saved'); assert.ok(!b.app.state.result.ans); ok();
  // 6d. network error keeps local result
  b = boot({ storage: saved, auth: mkAuth({ error: 'offline' }, []) });
  b.app.state.user = { id: 'u1', email: 'a@b.c' };
  await b.app.syncAfterLogin();
  assert.ok(b.app.state.result); assert.strictEqual(b.app.state.syncStatus, 'error'); ok();

  // 7. skipped questions are surfaced
  b = boot(); b.app.state.screen = 'assessment'; b.app.render();
  for (let i = 0; i < 40; i++) { if (i < 25) b.app.answerCurrent(1 + i % 5, null); else { b.app.state.qIndex = i; b.app.state.answers[i] = undefined; } }
  b.app.state.answers.length = 25; b.app.finishAssessment();
  assert.strictEqual(b.app.state.result.skipped, 15);
  b.app.state.resultsTab = 'profile'; b.app.render();
  assert.ok(/15 of 40 questions were skipped/.test(b.w.document.getElementById('app').innerHTML)); ok();
  assert.deepStrictEqual(b.errs, [], b.errs.join('|'));
  // 8. Profile dynamics (Phase 2): tiers, why-panel, abstention, feedback
  const Q = b.w.eval('QUESTIONS');
  const showResult = (bb, ansArr) => { bb.app.state.screen = 'assessment'; bb.app.render(); ansArr.forEach(v => { if (v == null) { bb.app.state.answers.push(undefined); } else bb.app.answerCurrent(v, null); }); };
  const strong = Array.from(Q, q => q.d > 0 ? 5 : 1);
  b = boot(); b.app.state.screen = 'assessment'; b.app.render(); strong.forEach(v => b.app.answerCurrent(v, null));
  b.app.state.resultsTab = 'profile'; b.app.render();
  let doc = b.w.document, root = doc.getElementById('app');
  assert.ok(/Profile dynamics/.test(root.innerHTML)); assert.ok(/Why am I seeing this\?/.test(root.innerHTML));
  assert.ok(/You will know it worked when/.test(root.innerHTML)); assert.ok(/A small experiment \(/.test(root.innerHTML)); ok();
  assert.strictEqual(root.querySelectorAll('details summary').length >= 3, true);
  assert.ok(/Show \d+ more pattern/.test(root.innerHTML), 'budget: extra patterns behind a button'); ok();
  // answer-level evidence appears in the why panel; question text is escaped, not injected
  assert.ok(/Answers behind those scores/.test(root.innerHTML)); ok();
  // show more
  root.querySelector('[data-act="dynmore"]').click();
  assert.ok(/Show fewer/.test(b.w.document.getElementById('app').innerHTML)); ok();
  // feedback: nothing stored until the user acts
  assert.strictEqual(b.w.localStorage.getItem('psyche_feedback_v1'), null); ok();
  const rate = b.w.document.querySelector('[data-fb="rate"][data-rating="partly"]');
  const fid = rate.getAttribute('data-id'); rate.click();
  let fb = JSON.parse(b.w.localStorage.getItem('psyche_feedback_v1'));
  assert.strictEqual(fb[fid].rating, 'partly'); assert.strictEqual(b.w.document.querySelector('[data-fb="rate"][data-id="' + fid + '"][data-rating="partly"]').getAttribute('aria-pressed'), 'true'); ok();
  // note, then ratings never change the scores or the insight list
  const before = JSON.stringify(b.app.state.result.facets);
  b.w.document.getElementById('fbn-' + fid).value = 'depends on the team'; b.w.document.querySelector('[data-fb="note"][data-id="' + fid + '"]').click();
  assert.strictEqual(JSON.parse(b.w.localStorage.getItem('psyche_feedback_v1'))[fid].note, 'depends on the team');
  assert.strictEqual(JSON.stringify(b.app.state.result.facets), before); ok();
  // remove one, then clear all
  b.w.document.querySelector('[data-fb="remove"][data-id="' + fid + '"]').click();
  assert.deepStrictEqual(JSON.parse(b.w.localStorage.getItem('psyche_feedback_v1')), {}); ok();
  b.w.document.querySelector('[data-fb="rate"][data-rating="accurate"]').click();
  b.app.render(); b.w.document.querySelector('[data-fb="clearall"]').click();
  assert.strictEqual(b.w.localStorage.getItem('psyche_feedback_v1'), null); ok();
  assert.deepStrictEqual(b.errs, [], b.errs.join('|'));
  // a synced result has no answers: the panel says so and confidence is not "moderate"
  const synced = JSON.parse(JSON.stringify(b.app.state.result)); delete synced.ans;
  b = boot({ storage: { result: synced, resultAt: 1 } });
  b.app.state.resultsTab = 'profile'; b.app.state.screen = 'results'; b.app.render();
  root = b.w.document.getElementById('app');
  assert.ok(/Answer-level evidence is not available/.test(root.innerHTML)); assert.ok(!/Moderate confidence/.test(root.innerHTML)); ok();
  // straight-lining abstains, visibly and with a reason
  b = boot(); b.app.state.screen = 'assessment'; b.app.render(); Array(40).fill(3).forEach(v => b.app.answerCurrent(v, null));
  b.app.state.resultsTab = 'profile'; b.app.render(); root = b.w.document.getElementById('app');
  assert.ok(/No cross-trait insights shown/.test(root.innerHTML)); assert.ok(!/Why am I seeing this\?/.test(root.innerHTML)); ok();
  // too many skipped abstains
  b = boot(); b.app.state.screen = 'assessment'; b.app.render();
  strong.slice(0, 30).forEach(v => b.app.answerCurrent(v, null)); b.app.state.answers.length = 30; b.app.finishAssessment();
  b.app.state.resultsTab = 'profile'; b.app.render(); assert.ok(/No cross-trait insights shown/.test(b.w.document.getElementById('app').innerHTML)); ok();
  assert.deepStrictEqual(b.errs, [], b.errs.join('|'));
  console.log('Integration tests passed (' + n + ' groups).');
})().catch(e => { console.error(e); process.exit(1); });
