/* Phase 4 tests: onboarding, save/resume, skipped-question review, tab semantics, error and empty states, plain-language helpers.
   Run: node tests/ux.test.js (needs `npm install` for the jsdom part) */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
let n = 0; const ok = () => { n++; };

// ---------- pure helpers ----------
const { loadEngine } = require('./helpers.js');
const X = loadEngine();
const ctx = { console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(DIR, 'ux.js'), 'utf8') + ';this.U=PsycheUX', ctx);
const U = ctx.U;
const full = Array.from({ length: 40 }, (_, i) => 1 + i % 5);
assert.strictEqual(U.sanitizeDraft(U.serializeDraft(full.slice(0, 7), 7)).answered, 7); ok();
assert.strictEqual(U.sanitizeDraft(U.serializeDraft(full.slice(0, 7), 7)).qIndex, 7); ok();
[null, 'x', '{bad', '[]', '{"answers":"a"}', JSON.stringify({ answers: [6] }), JSON.stringify({ answers: [1.5] }), JSON.stringify({ answers: Array(41).fill(1) }),
 JSON.stringify({ answers: ['3'] }), JSON.stringify({ answers: [] , qIndex: 0 })].forEach(b => { assert.strictEqual(U.sanitizeDraft(b), null, String(b)); ok(); });
assert.strictEqual(U.sanitizeDraft({ answers: [3], qIndex: 999 }).qIndex, 1); ok(); // bad position -> first unanswered
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; }, m }; };
let st = mem(); assert.ok(U.writeDraft(st, [3, 4], 2)); assert.strictEqual(U.readDraft(st).answered, 2); U.clearDraft(st); assert.strictEqual(U.readDraft(st), null); ok();
assert.strictEqual(U.writeDraft({ setItem() { throw new Error('full'); }, removeItem() {} }, [3], 1), false); ok(); // storage failure never throws
assert.strictEqual(U.readDraft(null), null); ok();
assert.strictEqual(U.bandFor(62), 'higher'); assert.strictEqual(U.bandFor(61), 'middle'); assert.strictEqual(U.bandFor(38), 'lower'); assert.strictEqual(U.bandFor(39), 'middle'); ok();
X.DIM_ORDER.forEach(d => [10, 50, 90].forEach(s => {
  const m = U.scoreMeaning(d, s); assert.ok(m && m.is && m.means && m.isNot && m.next && m.label, d + s);
  assert.ok(/^[a-z]/.test(m.isNot), 'isNot reads after "not a measure of"');
})); ok();
assert.strictEqual(U.scoreMeaning('Z', 50), null); assert.strictEqual(U.scoreMeaning('P', NaN), null); ok();
assert.ok(/out of 100, higher range/.test(U.scoreText('Perception', 70))); ok();
// close call uses the real archetype rule: a flat-ish profile near a boundary reports neighbours, a clear pure profile does not
const match = d => X.Engine.match(d, null);
const pure = { P: 90, R: 20, I: 25, S: 30, M: 35 }; assert.strictEqual(U.closeCall(pure, X.DIM_ORDER, match, match(pure).key), null); ok();
const edge = { P: 70, R: 62, I: 40, S: 35, M: 30 }, cc = U.closeCall(edge, X.DIM_ORDER, match, match(edge).key);
assert.ok(cc && cc.alts.length >= 1 && cc.alts.indexOf(match(edge).key) < 0); ok();
// every user-facing intro line is short, plain and non-clinical
Object.values(U.INTRO).forEach(t => { assert.ok(t.length < 260); ok(); });
assert.ok(/not a diagnosis/i.test(U.INTRO.boundary) && /No validation study/.test(U.INTRO.boundary)); ok();

// ---------- jsdom flows ----------
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { console.log('Phase 4 pure tests passed (' + n + '); SKIP jsdom flows: jsdom not installed.'); process.exit(0); }
const FILES = ['config.js', 'ops.js', 'privacy-local.js', 'share-policy.js', 'auth.js', 'core-logic.js', 'profile-schema.js', 'text-dedupe.js', 'implications_data.js', 'deep-analysis.js', 'traits-engine.js', 'engine-plus.js', 'group-insights.js', 'social-plus.js', 'trait-duo.js', 'intelligence-engine.js', 'ux.js', 'app-core.js'];
function boot(store) {
  const errs = [], vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/scrollTo|Not implemented/.test(e.message)) errs.push(e.message); });
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8').replace(/<script src="[^"]*"><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost:8000/', runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
  const w = dom.window; Object.keys(store || {}).forEach(k => w.localStorage.setItem(k, store[k]));
  w.__PSYCHE_TEST__ = true;
  w.console.error = () => {}; // the error-boundary test logs on purpose
  FILES.forEach(f => { try { w.eval(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { errs.push(f + ': ' + e.message); } });
  const d = w.document, q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s));
  const click = s => { const el = typeof s === 'string' ? q(s) : s; assert.ok(el, 'missing ' + s); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  return { w, d, q, qa, click, errs, app: w.__PSYCHE_TEST__ };
}
const text = b => b.d.getElementById('app').textContent;
(async () => {
  // first run: Start goes to the onboarding screen, not straight into question 1
  let b = boot(); b.click('[data-act="start"]');
  assert.strictEqual(b.app.state.screen, 'intro'); assert.ok(/Before you start/.test(text(b)) && /5 to 8 minutes/.test(text(b)) && /not a diagnosis/i.test(text(b))); ok();
  assert.ok(b.q('h1'), 'one h1 on the intro'); assert.strictEqual(b.qa('h1').length, 1); ok();
  b.click('[data-act="begin"]'); assert.strictEqual(b.app.state.screen, 'assessment'); assert.strictEqual(b.app.state.introSeen, true); ok();
  assert.ok(JSON.parse(b.w.localStorage.getItem('psyche_core_v1')).introSeen === true); ok();
  // question screen semantics
  assert.strictEqual(b.qa('.likertbtn[aria-pressed]').length, 5); assert.ok(b.q('[role="group"][aria-labelledby="qtext"]')); assert.ok(b.q('[role="progressbar"][aria-label]')); ok();
  assert.ok(/Question 1 of 40/.test(b.q('[role="progressbar"]').getAttribute('aria-valuetext'))); ok();

  // progress saves after every answer and survives a reload
  full.slice(0, 6).forEach(v => b.app.answerCurrent(v, null));
  const key = 'psyche_core_v1_draft', saved = b.w.localStorage.getItem(key); assert.ok(saved); assert.strictEqual(JSON.parse(saved).qIndex, 6); ok();
  let r = boot({ [key]: saved, psyche_core_v1: JSON.stringify({ introSeen: true }) });
  assert.ok(/Resume your assessment \(6 of 40 answered\)/.test(text(r))); ok();
  r.click('[data-act="resume"]'); assert.strictEqual(r.app.state.qIndex, 6); assert.deepStrictEqual(Array.from(r.app.state.answers).slice(0, 6), full.slice(0, 6)); ok();
  // going back home keeps the draft and says so
  r.click('.topbar [data-act="home"]'); assert.ok(r.w.localStorage.getItem(key)); assert.ok(/Progress saved/.test(r.d.getElementById('toast').textContent)); ok();
  // corrupt draft is ignored, never crashes
  r = boot({ [key]: '{"answers":[9]}' }); assert.ok(!/Resume your assessment/.test(text(r))); assert.deepStrictEqual(r.errs, []); ok();

  // skipped questions lead to a review step, not straight to a thin result
  b = boot({ psyche_core_v1: JSON.stringify({ introSeen: true }) }); b.click('[data-act="start"]');
  for (let i = 0; i < 39; i++) { if (i === 10) b.click('[data-act="skipq"]'); else b.app.answerCurrent(full[i], null); }
  b.app.answerCurrent(3, null);
  assert.strictEqual(b.app.state.screen, 'review'); assert.ok(/One question was skipped/.test(text(b))); assert.strictEqual(b.qa('[data-act="gotoq"]').length, 1); ok();
  b.click('[data-act="gotoq"]'); assert.strictEqual(b.app.state.qIndex, 10); assert.ok(/Answering a skipped question/.test(text(b))); ok();
  b.app.answerCurrent(4, null); assert.strictEqual(b.app.state.screen, 'results'); assert.strictEqual(b.app.state.result.skipped, 0); ok();
  assert.strictEqual(b.w.localStorage.getItem(key), null, 'draft cleared on finish'); ok();
  // "see my result anyway" keeps the skip count
  b = boot({ psyche_core_v1: JSON.stringify({ introSeen: true }) }); b.click('[data-act="start"]');
  for (let i = 0; i < 40; i++) { if (i === 3 || i === 20) b.click('[data-act="skipq"]'); else b.app.answerCurrent(full[i], null); }
  assert.strictEqual(b.app.state.screen, 'review'); assert.ok(/2 questions were skipped/.test(text(b))); b.click('[data-act="finishforce"]');
  assert.strictEqual(b.app.state.screen, 'results'); assert.strictEqual(b.app.state.result.skipped, 2); assert.ok(/Incomplete assessment/.test(text(b))); ok();

  // results: summary-first order, tab semantics, text alternatives
  const heads = b.qa('.sumh').map(h => h.textContent.replace(/^\d/, '').trim());
  assert.deepStrictEqual(heads, ['Your overall profile', 'Your strongest findings', 'Profile dynamics', 'What you could try', 'Method and limits']); ok();
  assert.strictEqual(b.qa('[role="tab"]').length, 6); assert.strictEqual(b.qa('[role="tab"][aria-selected="true"]').length, 1); ok();
  const panel = b.q('[role="tabpanel"]'); assert.ok(panel && b.d.getElementById(panel.getAttribute('aria-labelledby')), 'tabpanel labelled by an existing tab'); ok();
  assert.strictEqual(b.qa('.tab[role="tab"][tabindex="0"]').length, 1); ok();
  assert.ok(/out of 100/.test(b.q('svg.radar').getAttribute('aria-label'))); ok();
  assert.strictEqual(b.qa('.dimdetail').length, 5); assert.ok(b.qa('.dimband').every(e => /range$/.test(e.textContent))); ok();
  assert.ok(/does not mean/.test(b.q('.dimbody').textContent)); ok();
  assert.strictEqual(b.qa('h1').length, 1); ok();
  // arrow keys move focus between tabs
  const tabs = b.qa('[role="tab"]'); tabs[0].focus();
  tabs[0].dispatchEvent(new b.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); assert.strictEqual(b.d.activeElement, tabs[1]); ok();
  tabs[1].dispatchEvent(new b.w.KeyboardEvent('keydown', { key: 'End', bubbles: true })); assert.strictEqual(b.d.activeElement, tabs[5]); ok();
  // choosing a tab keeps focus on that tab
  b.d.activeElement.click(); assert.strictEqual(b.app.state.resultsTab, 'relationship'); assert.ok(b.d.activeElement.getAttribute('data-tab') === 'relationship'); ok();
  // role=button elements respond to the keyboard
  b.app.state.screen = 'home'; b.app.render(); const card = b.q('.archcard[data-act="archopen"]'); card.dispatchEvent(new b.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.strictEqual(b.app.state.screen, 'archdetail'); ok();
  // number keys answer
  b.click('[data-act="start"]'); b.d.dispatchEvent(new b.w.KeyboardEvent('keydown', { key: '4', bubbles: true })); assert.strictEqual(b.app.state.answers[0], 4); ok();

  // empty + error states
  b = boot({ psyche_core_v1: JSON.stringify({ introSeen: true }) }); b.app.state.screen = 'results'; b.app.render();
  assert.ok(/No result on this device yet/.test(text(b))); ok();
  b.app.state.screen = 'archdetail'; b.app.state.archKey = 'NOPE'; b.app.render();
  assert.ok(/Something went wrong/.test(text(b)) && /have not been changed/.test(text(b))); b.click('[data-act="home"]'); assert.ok(/Take the PRISM test|Resume/.test(text(b))); ok();
  // unreadable saved result: a persistent banner, not a vanishing toast
  b = boot({ psyche_core_v1: '{"result":{"dims":{}}}' }); assert.ok(b.q('.banner.warn') && /could not be read/.test(b.q('.banner.warn').textContent)); b.click('[data-act="dismissnotice"]'); assert.ok(!b.q('.banner.warn')); ok();
  // offline banner
  b = boot(); b.w.dispatchEvent(new b.w.Event('offline')); assert.ok(/You are offline/.test(text(b))); b.w.dispatchEvent(new b.w.Event('online')); assert.ok(!/You are offline/.test(text(b))); ok();
  // landmarks, skip link, title
  assert.ok(b.q('#main[role="main"]')); assert.ok(b.q('.topbar[role="banner"]')); assert.ok(b.d.querySelector('a.skiplink[href="#main"]')); ok();
  b.app.state.screen = 'science'; b.app.render(); assert.ok(/The science/.test(b.d.title)); ok();
  // no inline text below 12px outside the print report
  const src = fs.readFileSync(path.join(DIR, 'app-core.js'), 'utf8'); const a = src.indexOf('function rsec('), z = src.indexOf('function fallbackCopy(');
  assert.ok(!/font-size:(9|10|10\.5|11|11\.5)px/.test(src.slice(0, a) + src.slice(z))); ok();
  assert.deepStrictEqual(b.errs, [], b.errs.join('|'));
  console.log('Phase 4 UX tests passed (' + n + ' checks).');
})().catch(e => { console.error(e); process.exit(1); });
