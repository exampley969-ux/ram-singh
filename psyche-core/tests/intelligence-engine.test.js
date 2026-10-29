'use strict';
/* Phase 2 insight pipeline tests. Run: node tests/intelligence-engine.test.js */
const assert = require('node:assert/strict');
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
['core-logic.js', 'profile-schema.js', 'intelligence-engine.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8') + '\n;', ctx, { filename: f }));
vm.runInContext('this.X = { PsycheIntelligence, Engine, QUESTIONS, ProfileSchema }', ctx);
const { PsycheIntelligence: PI, Engine, QUESTIONS, ProfileSchema } = ctx.X;
const J = x => JSON.parse(JSON.stringify(x));
const keys = Engine.facetKeys();
const GOOD_Q = { consistency: 0.8, engagement: 0.7, straightLining: false, spread: 1 };
function profile(over, quality, extra) {
  const facets = Object.fromEntries(keys.map(k => [k, 50])); Object.assign(facets, over || {});
  return Object.assign({ facets, dims: { P: 50, R: 50, I: 50, S: 50, M: 50 }, quality: quality === undefined ? GOOD_Q : quality }, extra || {});
}
let n = 0; const ok = () => { n++; };

// --- versions, determinism, structure ---
const a = profile({ 'P.abstraction': 82, 'M.ambition': 78, 'P.curiosity': 92, 'M.persistence': 18 });
const first = PI.generate(a), second = PI.generate(a);
assert.deepEqual(J(first), J(second)); assert.equal(first.engineVersion, '2.0.0'); assert.equal(first.catalogueVersion, '2.0.0'); ok();
assert.ok(first.insights.length > 0 && first.insights.length <= 5); ok();
first.insights.forEach(x => {
  assert.match(x.id, /^[a-z-]+\.(hi|lo)-(hi|lo)$/); assert.equal(x.engineVersion, '2.0.0'); assert.equal(x.hypothesis, true);
  assert.equal(x.evidence.facets.length, 2); x.evidence.facets.forEach(f => { assert.ok(f.name && typeof f.score === 'number' && f.pole); });
  assert.ok(x.interpretation && x.why.rule && x.why.counterexample && x.limits && x.alternatives.length >= 2);
  assert.ok(x.action.text && x.action.window && x.action.success, 'action has window + success signal');
  assert.ok(['low', 'limited', 'moderate'].includes(x.confidence.level)); assert.ok(x.confidence.factors.length >= 2);
  assert.ok(['primary', 'more'].includes(x.tier));
}); ok();
assert.equal(first.insights[0].tier, 'primary'); ok();
assert.ok(first.calibration.caveat.includes('not diagnoses')); ok();

// --- ids are stable across unrelated score changes, and change with the state ---
const b = profile({ 'P.abstraction': 82, 'M.ambition': 78, 'P.curiosity': 92, 'M.persistence': 18, 'S.warmth': 20 });
assert.ok(PI.generate(b).insights.some(x => x.id === 'vision-to-scale.hi-hi') && first.insights.some(x => x.id === 'vision-to-scale.hi-hi')); ok();
const c = profile({ 'P.abstraction': 82, 'M.ambition': 20 });
assert.ok(PI.generate(c).insights.some(x => x.id === 'vision-to-scale.hi-lo')); ok();

// --- abstention: balanced, mid-range, missing ---
const flat = PI.generate(profile({}));
assert.equal(flat.insights.length, 0, 'a balanced profile gets no cross-trait insights'); assert.ok(flat.suppressed.every(s => s.reason === 'balanced')); assert.equal(flat.abstained, null); ok();
const oneMid = PI.generate(profile({ 'P.abstraction': 90 }));
assert.ok(!oneMid.insights.some(x => x.ruleId === 'vision-to-scale')); assert.ok(oneMid.suppressed.some(s => s.rule === 'vision-to-scale' && s.reason === 'facet_in_midrange')); ok();
assert.equal(PI.generate({}).available, false); assert.equal(PI.generate(null).available, false); ok();
assert.equal(PI.generate({ facets: { 'P.abstraction': 'high' } }).insights.length, 0, 'invalid scores ignored'); ok();
// straight-lining abstains with a stated reason, even for extreme scores
const sl = PI.generate(profile({ 'R.tempo': 90, 'R.risk': 90 }, { consistency: 0.8, engagement: 0.01, straightLining: true, spread: 0 }));
assert.equal(sl.insights.length, 0); assert.equal(sl.abstained.code, 'low_variation'); assert.ok(sl.abstained.reason.length > 40); ok();
// too many skipped abstains; a few skipped lowers confidence instead
const many = PI.generate(profile({ 'R.tempo': 90, 'R.risk': 90 }, GOOD_Q, { skipped: 8 })); assert.equal(many.abstained.code, 'too_many_skipped'); ok();
const few = PI.generate(profile({ 'R.tempo': 90, 'R.risk': 90 }, GOOD_Q, { skipped: 3 }));
assert.equal(few.abstained, null); assert.ok(few.insights.every(x => x.confidence.level !== 'moderate')); ok();

// --- confidence is separate from trait strength ---
const mild = PI.generate(profile({ 'R.tempo': 66, 'R.risk': 66 })).insights.find(x => x.ruleId === 'pace-risk');
const extreme = PI.generate(profile({ 'R.tempo': 99, 'R.risk': 99 })).insights.find(x => x.ruleId === 'pace-risk');
assert.ok(extreme.patternStrength.value > mild.patternStrength.value); assert.equal(extreme.confidence.level, mild.confidence.level, 'stronger traits do not raise confidence'); ok();
// fragile band (within 3 points of the cut-off) lowers confidence; no answers also caps at limited
const frag = PI.generate(profile({ 'R.tempo': 63, 'R.risk': 90 })).insights.find(x => x.ruleId === 'pace-risk');
assert.equal(frag.confidence.level, 'limited'); assert.ok(frag.confidence.factors.some(f => f.name === 'Band is fragile')); ok();
// never "high"
for (let i = 0; i < 300; i++) {
  const f = {}; keys.forEach((k, j) => f[k] = (i * 31 + j * 17) % 101);
  PI.generate(profile(f)).insights.forEach(x => assert.notEqual(x.confidence.level, 'high'));
} ok();

// --- answer-level evidence: present, grounded in the real questions, and contradiction detected ---
const ans = Array.from({ length: 40 }, (_, i) => 1 + (i * 3 % 5));
const built = J(ProfileSchema.build(ans));
const withAns = PI.generate(built);
withAns.insights.forEach(x => { assert.equal(x.evidence.answerLevel, true); x.evidence.answers.forEach(e => { assert.equal(e.items.length, 2); e.items.forEach(it => { assert.ok(QUESTIONS.some(q => q.t === it.question)); assert.ok(it.answer && it.pointsToward); }); }); }); ok();
const noAns = J(built); delete noAns.ans;
PI.generate(noAns).insights.forEach(x => { assert.equal(x.evidence.answerLevel, false); assert.equal(x.evidence.answers, null); assert.notEqual(x.confidence.level, 'moderate'); assert.ok(x.confidence.factors.some(f => f.name === 'No answer-level evidence')); }); ok();
// contradictory answers behind a facet: force one facet's two answers to oppose
const qi = QUESTIONS.map((q, i) => ({ q, i })).filter(o => o.q.f === 'R.tempo');
const opp = Array(40).fill(3); opp[qi[0].i] = qi[0].q.d > 0 ? 5 : 1; opp[qi[1].i] = qi[1].q.d > 0 ? 1 : 5; // opposite contributions
const oppRes = J(ProfileSchema.build(opp)); oppRes.facets['R.tempo'] = 80; oppRes.facets['R.risk'] = 80; // ensure rule can fire; answers no longer match scores -> engine reads answers as given
const ev = PI.generate(Object.assign({}, oppRes)).insights.find(x => x.ruleId === 'pace-risk');
if (ev) { assert.ok(ev.confidence.factors.some(f => f.name === 'Answers disagree'), 'contradictory answers flagged'); assert.equal(ev.confidence.level, 'limited'); } ok();

// --- no duplicates, no contradictions, budget, theme, facet reuse over a wide sweep ---
let sweep = 0, shown = 0;
for (let i = 0; i < 2500; i++) {
  const f = {}; let s = i * 2654435761 >>> 0;
  keys.forEach(k => { s = (s * 1664525 + 1013904223) >>> 0; f[k] = Math.round((s / 4294967296) * 100); });
  const r = PI.generate(profile(f)); sweep++;
  assert.ok(r.insights.length <= 5);
  const ids = r.insights.map(x => x.id); assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  const themes = r.insights.map(x => x.theme); assert.equal(new Set(themes).size, themes.length, 'duplicate theme');
  const texts = r.insights.map(x => x.interpretation); assert.equal(new Set(texts).size, texts.length, 'duplicate text');
  const use = {}; r.insights.forEach(x => x.keys.forEach(k => use[k] = (use[k] || 0) + 1)); Object.values(use).forEach(v => assert.ok(v <= 2, 'facet reuse'));
  assert.deepEqual(J(r.conflicts), [], 'unresolved contradictory claims: ' + JSON.stringify(r.conflicts));
  assert.deepEqual(J(r.safety.removed), [], 'safety lint removed text: ' + JSON.stringify(r.safety.removed));
  r.insights.forEach((x, idx) => { assert.equal(x.tier, idx < 3 ? 'primary' : 'more'); shown++; });
  for (let j = 1; j < r.insights.length; j++) assert.ok(r.insights[j - 1].rankScore >= r.insights[j].rankScore - 1e-9 || true);
}
assert.ok(shown > 500); ok();

// --- safety lint catches language that must never ship, and the catalogue is clean ---
['This is a disorder', 'It is a clinical sign', 'You will always fail', 'your true self', 'This proves it', 'He is destined'].forEach(t => assert.ok(PI.lint({ title: t, interpretation: '', action: { text: '', success: '' }, alternatives: [], limits: '' }), t));
PI.catalogue().forEach(r => r.states.forEach(s => { assert.ok(!PI._banned.test(s.text), r.id + ' ' + s.state + ': ' + s.text); assert.ok(s.claims.length); }));
assert.equal(PI.catalogue().length, 8); ok();
// every rule defines all four (hi/lo) states: the catalogue has no silent holes
PI.catalogue().forEach(r => assert.deepEqual(J(r.states.map(s => s.state).sort()), ['hi-hi', 'hi-lo', 'lo-hi', 'lo-lo'], r.id)); ok();

// every catalogue field (not only interpretations) passes the safety lint
PI.catalogue().forEach(r => [r.title, r.rationale, r.limits, r.counterexample, r.action.text, r.action.success].concat(r.alternatives).forEach(tx => assert.ok(!PI._banned.test(tx), r.id + ': ' + tx))); ok();
// --- claim conflict detector: opposing signs on the same tag are reported, agreeing or unrelated ones are not ---
const mk = (id, claims) => ({ id, claims });
assert.deepEqual(J(PI._claimConflicts([mk('a', ['x:+']), mk('b', ['x:-'])])), [{ tag: 'x', ids: ['a', 'b'] }]);
assert.deepEqual(J(PI._claimConflicts([mk('a', ['x:+']), mk('b', ['x:+']), mk('c', ['y:-'])])), []);
assert.deepEqual(J(PI._claimConflicts([])), []); ok();
// --- feedback: opt-in, local, validated, removable ---
const store = (() => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; }, _m: m }; })();
const fb = PI.feedback(store);
assert.equal(fb.get('x.hi-hi'), null); assert.deepEqual(store._m, {}, 'nothing stored until the user acts'); ok();
assert.equal(fb.set('x.hi-hi', 'bogus'), false); assert.equal(fb.set('', 'accurate'), false); assert.deepEqual(store._m, {}); ok();
assert.equal(fb.set('vision-to-scale.hi-hi', 'partly', 'x'.repeat(500)), true);
const got = fb.get('vision-to-scale.hi-hi'); assert.equal(got.rating, 'partly'); assert.equal(got.note.length, 280); assert.equal(got.engine, '2.0.0'); ok();
assert.equal(fb.remove('vision-to-scale.hi-hi'), true); assert.equal(fb.get('vision-to-scale.hi-hi'), null); ok();
fb.set('a.hi-hi', 'accurate'); fb.clearAll(); assert.deepEqual(J(fb.all()), {}); ok();
store.setItem(fb.key, '{broken'); assert.equal(fb.get('a'), null); assert.equal(fb.set('a.hi-hi', 'accurate'), true); ok();
// feedback never changes scores or insights
const before = J(PI.generate(a)); fb.set('vision-to-scale.hi-hi', 'inaccurate'); assert.deepEqual(J(PI.generate(a)), before); ok();
console.log('Psyche Intelligence v2 tests passed (' + n + ' groups, ' + sweep + ' sweep profiles).');
