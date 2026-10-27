/* Trait lab: what-if, 20x20 interaction matrix, trait drill-down (engine-plus.js) and its wiring in the page. Run: node tests/traitlab.test.js (from psyche-core) */
const assert = require('node:assert/strict'), vm = require('vm'), fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
['core-logic.js', 'profile-schema.js', 'engine-plus.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8') + '\n;', ctx, { filename: f }));
vm.runInContext('this.X = { EnginePlus, Engine, QUESTIONS }', ctx);
const { EnginePlus: EP, Engine, QUESTIONS } = ctx.X; const J = x => JSON.parse(JSON.stringify(x));
const keys = Engine.facetKeys(); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const flat = Object.fromEntries(keys.map(k => [k, 50]));
const ANS = QUESTIONS.map((q, i) => [5, 1, 4, 2, 3, 5, 2][i % 7]); const real = Engine.score(ANS).facets;

// 1. interactions: 20x20, symmetric, bounded, deterministic, silent on a flat profile
const M = J(EP.interactions(real));
assert.equal(M.cells.length, 20); n++;
M.cells.forEach((row, i) => { assert.equal(row.length, 20); n++; row.forEach((c, j) => {
  if (i === j) { ok(c === null, 'diagonal empty'); return; }
  ok(c.value >= -1 && c.value <= 1, 'bounded'); ok(M.cells[j][i].value === c.value, 'symmetric ' + keys[i] + ' ' + keys[j]);
  if (!c.linked) ok(c.value === 0, 'unlinked pairs score 0');
}); });
ok(M.linkedPairs > 0 && M.linkedPairs < M.totalPairs && M.totalPairs === 190, 'some, not all, pairs are linked');
assert.deepEqual(J(EP.interactions(real)), M, 'deterministic'); n++;
const F = J(EP.interactions(flat)); F.cells.forEach(row => row.forEach(c => { if (c) ok(Math.abs(c.value) === 0 || c.value === 0, 'flat profile: no push either way'); }));

// 2. direction logic on a hand-made case: Curiosity and Abstraction both feed Brainstorming with the same sign
const hi = Object.assign({}, flat, { 'P.curiosity': 90, 'P.abstraction': 90 }), mix = Object.assign({}, flat, { 'P.curiosity': 90, 'P.abstraction': 10 });
ok(EP.pairLink(hi, 'P.curiosity', 'P.abstraction').value > 0.3, 'both high -> reinforce');
ok(EP.pairLink(mix, 'P.curiosity', 'P.abstraction').value < -0.3, 'one high, one low, same situation -> pull against');
const disc = EP.pairLink(Object.assign({}, flat, { 'R.risk': 10, 'R.tempo': 90 }), 'R.tempo', 'R.risk');
ok(disc.ruleOn === true && disc.value < 0, 'an active listed tension forces a negative value');
const patOnly = EP.pairLink(flat, 'P.curiosity', 'M.discipline'); ok(patOnly.linked && patOnly.via.length === 0 && patOnly.patterns.length >= 1, 'pattern-only pair is linked but unscored');
ok(!EP.pairLink(flat, 'S.warmth', 'M.persistence').linked, 'no shared situation, tension or pattern -> unlinked');

// 3. whatIf
const w0 = J(EP.whatIf(real, {})); ok(w0.changed.length === 0 && w0.scenarios.every(s => s.delta === 0), 'no edits, no change');
const w1 = J(EP.whatIf(real, { 'P.curiosity': 100, 'M.discipline': 0, 'X.bogus': 5, 'R.risk': 'abc', 'S.warmth': 250 }));
ok(!w1.changed.includes('X.bogus') && !w1.changed.includes('R.risk'), 'unknown keys and non-numbers ignored');
ok(w1.facets['S.warmth'] === 100, 'clamped to 100'); ok(w1.facets['P.curiosity'] === 100 && w1.facets['M.discipline'] === 0, 'edits applied');
ok(Object.keys(real).every(k => real[k] === Engine.score(ANS).facets[k]), 'input scores are not mutated');
ok(w1.rows.length === 20 && w1.scenarios.length === 8, 'rows and scenarios present');
const spark = J(EP.whatIf(flat, { 'P.curiosity': 90, 'M.discipline': 10 }));
ok(spark.patterns.gained.some(p => p.id === 'spark') && spark.patterns.lost.length === 0, 'spark pattern appears');
const back = J(EP.whatIf(Object.assign({}, flat, { 'P.curiosity': 90, 'M.discipline': 10 }), { 'P.curiosity': 50 }));
ok(back.patterns.lost.some(p => p.id === 'spark'), 'spark pattern disappears again');
ok(spark.scenarios.some(s => s.delta !== 0), 'situation scores move');
assert.deepEqual(J(EP.whatIf(real, { 'P.curiosity': 20 })), J(EP.whatIf(real, { 'P.curiosity': 20 })), 'deterministic'); n++;

// 4. traitDetail
keys.forEach(k => { const d = J(EP.traitDetail(real, k, ANS));
  ok(d.questions.length === 2 && d.questions.every(q => q.answer >= 1 && q.answer <= 5), 'two answered questions for ' + k);
  const sum = d.questions.reduce((a, q) => a + q.shift, 0); ok(Math.round(50 + sum) === real[k], 'shifts add up to the score for ' + k + ' (' + (50 + sum) + ' vs ' + real[k] + ')');
  ok(d.haveAnswers && d.scenarios.every(s => s.weight > 0) && d.name && d.code, 'fields for ' + k); });
const noAns = J(EP.traitDetail(real, 'P.curiosity', null)); ok(!noAns.haveAnswers && noAns.questions.every(q => q.answer === null && q.shift === null), 'no stored answers -> says so, invents nothing');
ok(EP.traitDetail(real, 'nope', ANS) === null, 'unknown trait -> null');
const dd = J(EP.traitDetail(spark.facets, 'P.curiosity', null)); ok(dd.patterns.some(p => p.id === 'spark' && p.active), 'detail shows active pattern');
ok(dd.zone === 'high' && dd.pole && dd.pole.name, 'high trait has a pole description'); ok(J(EP.traitDetail(flat, 'P.curiosity', null)).pole === null, 'balanced trait has no pole');

// 5. wiring in the page: calls exist, nothing is stored or sent, text is escaped
const app = fs.readFileSync(path.join(DIR, 'app-core.js'), 'utf8'), start = app.indexOf('/* ---------- Trait lab'), end = app.indexOf('/* Individual: patterns, tensions');
ok(start > 0 && end > start, 'lab block found'); const lab = app.slice(start, end);
ok(/EnginePlus\.whatIf/.test(lab) && /EnginePlus\.interactions/.test(lab) && /EnginePlus\.traitDetail/.test(lab), 'uses the engine');
ok(!/localStorage|sessionStorage|persist\(|save\(|fetch\(|XMLHttpRequest|sendBeacon|PsycheOps/.test(lab), 'lab never stores or sends anything');
ok(/traitLabHTML\(r\)/.test(app) && /wireLab\(\);/.test(app), 'rendered in the Patterns tab and wired after render');
ok(/esc\(D\.name\)/.test(lab) && /esc\(q\.text\)/.test(lab) && /esc\(q\.answerWord\)/.test(lab), 'trait text is escaped');
const css = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8'); ok(/\.tl-chip\{[^}]*min-height:44px/.test(css) && /\.tl-range\{[^}]*height:44px/.test(css), '44px touch targets');
console.log('Trait lab tests passed (' + n + ' assertions).');
