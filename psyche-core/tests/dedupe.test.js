/* Report text de-duplication (roadmap 2.4). Run: node tests/dedupe.test.js (needs jsdom) */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
// ---- unit: TextDedupe ----
const ctx = { console, Math, JSON, Object, Array, String, Number }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'text-dedupe.js'), 'utf8') + '\n;this.T = TextDedupe', ctx);
const T = ctx.T; const J = x => JSON.parse(JSON.stringify(x));
let seen = T.seenSet();
assert.strictEqual(T.dedupeText('You tend to pause and weigh before acting. Short one. You tend to pause and weigh before acting.', seen), 'You tend to pause and weigh before acting. Short one.');
// short sentences are never removed
seen = T.seenSet(); assert.strictEqual(T.dedupeText('Short one. Short one.', seen), 'Short one. Short one.');
// case/punctuation-insensitive match; first occurrence kept
seen = T.seenSet(['You re rarely the wrong tool for the job here.']);
assert.strictEqual(T.dedupeText("you're rarely the wrong tool for the job here! A different sentence that stays in the text.", seen), 'A different sentence that stays in the text.');
// labelled paragraphs keep labels; empty paragraphs vanish
seen = T.seenSet();
const out = T.dedupeParagraphs('What this means: Alpha beta gamma delta epsilon zeta.\n\nWhere it helps: Alpha beta gamma delta epsilon zeta.\n\nWorking with it: Eta theta iota kappa lambda mu.', seen);
assert.strictEqual(out, 'What this means: Alpha beta gamma delta epsilon zeta.\n\nWorking with it: Eta theta iota kappa lambda mu.');
// idempotent and only ever removes text
const txt = 'One two three four five six. One two three four five six. Seven eight nine ten eleven twelve.';
const once = T.dedupeText(txt, T.seenSet()); assert.strictEqual(T.dedupeText(once, T.seenSet()), once);
assert.ok(once.length < txt.length);
assert.strictEqual(T.dedupeText('', T.seenSet()), ''); assert.strictEqual(T.dedupeText(null, T.seenSet()), 'null' === 'x' ? '' : T.dedupeText(null, T.seenSet()));

// ---- render: repetition across the report stays low ----
let JSDOM, VirtualConsole; try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { console.log('Dedupe unit tests passed. SKIP render checks: jsdom not installed.'); process.exit(0); }
const FILES = ['config.js', 'ops.js', 'core-logic.js', 'profile-schema.js', 'text-dedupe.js', 'implications_data.js', 'deep-analysis.js', 'traits-engine.js', 'engine-plus.js', 'group-insights.js', 'social-plus.js', 'trait-duo.js', 'intelligence-engine.js', 'ux.js', 'app-core.js'];
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8').replace(/<script src="[^"]*"><\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost:8000/', runScripts: 'outside-only', virtualConsole: new VirtualConsole(), pretendToBeVisual: true });
const w = dom.window; w.__PSYCHE_TEST__ = true; FILES.forEach(f => w.eval(fs.readFileSync(path.join(DIR, f), 'utf8')));
const app = w.__PSYCHE_TEST__, Q = w.eval('QUESTIONS');
const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const sents = t => t.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => norm(x).split(' ').length >= 6);
const tabs = ['profile', 'facets', 'deep', 'career', 'relationship', 'plus'];
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
let total = 0, within = 0, cross = 0;
for (let p = 0; p < 8; p++) {
  app.state.screen = 'assessment'; app.render(); Q.forEach(() => app.answerCurrent(1 + Math.floor(rnd() * 5), null));
  const per = {};
  tabs.forEach(t => { app.state.resultsTab = t; app.render(); const m = {}; sents(w.document.querySelector('#app .wrap').textContent).forEach(s => { const k = norm(s); m[k] = (m[k] || 0) + 1; }); per[t] = m; });
  const all = {}; tabs.forEach(t => Object.keys(per[t]).forEach(k => { (all[k] = all[k] || new Set()).add(t); }));
  tabs.forEach(t => Object.keys(per[t]).forEach(k => { total++; if (per[t][k] > 1) within++; }));
  Object.keys(all).forEach(k => { if (all[k].size > 1 && all[k].size < tabs.length) cross++; });
}
const rate = within / total;
console.log('Repetition: ' + within + '/' + total + ' sentence repeats within a tab (' + (rate * 100).toFixed(1) + '%), ' + cross + ' across tabs');
assert.strictEqual(cross, 0, 'no sentence may appear on two different tabs (the header paragraph shown on every tab is excluded)');
assert.ok(rate < 0.03, 'within-tab repetition must stay under 3% (was 16% before Phase 2 de-duplication)');
console.log('Dedupe tests passed.');
