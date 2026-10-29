/* Scoring + archetype boundaries and golden regression. Run: node tests/scoring.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path');
const { loadEngine } = require('./helpers');
const { Engine, QUESTIONS, DIM_ORDER, ProfileSchema } = loadEngine();
const N = QUESTIONS.length;
const J = x => JSON.parse(JSON.stringify(x)); const deq = (a, b, m) => assert.deepStrictEqual(J(a), J(b), m);
let n = 0; const ok = () => { n++; };

// ---- structure ----
assert.strictEqual(N, 40); assert.strictEqual(Engine.facetKeys().length, 20); assert.strictEqual(DIM_ORDER.length, 5); ok();
// every facet has exactly two questions, one per direction mix is allowed but d must be +1/-1
Engine.facetKeys().forEach(k => { const qs = QUESTIONS.filter(q => q.f === k); assert.strictEqual(qs.length, 2, k); qs.forEach(q => assert.ok(q.d === 1 || q.d === -1, k)); ok(); });

// ---- golden: scores identical to the baseline engine (v0-baseline) ----
const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'golden-scores.json'), 'utf8'));
gold.cases.forEach(c => {
  const sc = Engine.score(c.answers), q = Engine.quality(c.answers), m = Engine.match(sc.dims, q);
  deq(sc.dims, c.dims, c.name); deq(sc.facets, c.facets, c.name);
  deq(q, c.quality, c.name); assert.strictEqual(m.key, c.archetype, c.name);
  assert.strictEqual(m.confidence, c.confidence, c.name); assert.strictEqual(m.lowSignal, c.lowSignal, c.name);
  // the new pipeline must agree with the raw engine
  const b = ProfileSchema.build(c.answers);
  deq(b.dims, c.dims, c.name); deq(b.facets, c.facets, c.name); assert.strictEqual(b.match.key, c.archetype, c.name);
  ok();
});

// ---- boundaries ----
const all = v => Array(N).fill(v);
const allNeutral = Engine.score(all(3));
Object.values(allNeutral.facets).forEach(v => assert.strictEqual(v, 50)); ok();
DIM_ORDER.forEach(d => assert.strictEqual(allNeutral.dims[d], 50));
// all-min and all-max stay inside 0..100 and mirror each other (reverse-keyed items make facets differ, so check ranges + symmetry)
[all(1), all(5)].forEach(a => { const s = Engine.score(a); Object.values(s.facets).concat(Object.values(s.dims)).forEach(v => assert.ok(v >= 0 && v <= 100 && Number.isInteger(v))); ok(); });
const lo = Engine.score(all(1)), hi = Engine.score(all(5));
Engine.facetKeys().forEach(k => assert.strictEqual(lo.facets[k] + hi.facets[k], 100, k)); ok();
// extremes reachable: a facet with both questions pushed the same way reaches 0 and 100
const push = (dir) => QUESTIONS.map(q => dir * q.d > 0 ? 5 : 1);
const top = Engine.score(push(1)), bot = Engine.score(push(-1));
Engine.facetKeys().forEach(k => { assert.strictEqual(top.facets[k], 100, k); assert.strictEqual(bot.facets[k], 0, k); }); ok();
// missing answers count as neutral (documented behaviour, flagged by build())
deq(Engine.score(Array(N).fill(null)), allNeutral); ok();
const part = all(null); part[0] = 5;
const b = ProfileSchema.build(part); assert.strictEqual(b.skipped, N - 1); ok();
// build rejects malformed input rather than scoring it
assert.throws(() => ProfileSchema.build(all(6))); assert.throws(() => ProfileSchema.build(all(0))); assert.throws(() => ProfileSchema.build(all('x'))); ok();
assert.throws(() => ProfileSchema.build(all(2.5))); ok();
// determinism
const rnd = []; for (let i = 0; i < N; i++) rnd.push(1 + (i * 7 % 5));
deq(ProfileSchema.build(rnd), ProfileSchema.build(rnd)); ok();
// schema stamp
assert.strictEqual(b.schema, 1); assert.ok(b.versions.scoring); ok();

// ---- archetype decision boundaries (match() takes dims directly) ----
const D = (p, r, i, s, m) => ({ P: p, R: r, I: i, S: s, M: m });
assert.strictEqual(Engine.match(D(50, 50, 50, 50, 50)).key, 'PRISM'); ok();
assert.strictEqual(Engine.match(D(55, 50, 50, 50, 46)).key, 'PRISM', 'spread 9 -> balanced'); ok();
assert.notStrictEqual(Engine.match(D(56, 50, 50, 50, 46)).key, 'PRISM', 'spread 10 -> not balanced'); ok();
assert.strictEqual(Engine.match(D(80, 62, 50, 50, 50)).key, 'PURE_P', 'gap 18 -> pure'); ok();
assert.ok(!/^PURE_/.test(Engine.match(D(79, 62, 50, 50, 50)).key), 'gap 17 -> not pure'); ok();
assert.strictEqual(Engine.match(D(70, 64, 40, 40, 40)).key, 'TWIN_PR', 'gap 6 -> twin'); ok();
assert.ok(!/^TWIN_/.test(Engine.match(D(70, 63, 40, 40, 40)).key), 'gap 7 -> not twin'); ok();
// ties resolve deterministically in dimension order, and low-signal quality lowers confidence
assert.strictEqual(Engine.match(D(70, 70, 40, 40, 40)).key, Engine.match(D(70, 70, 40, 40, 40)).key); ok();
const m1 = Engine.match(D(80, 40, 40, 40, 40), { engagement: .6, consistency: .8, spread: 1, straightLining: false });
const m2 = Engine.match(D(80, 40, 40, 40, 40), { engagement: .6, consistency: .8, spread: 1, straightLining: true });
assert.ok(m2.confidence < m1.confidence && m2.lowSignal && !m1.lowSignal); ok();
// confidence always bounded
gold.cases.forEach(c => assert.ok(c.confidence >= 5 && c.confidence <= 99)); ok();
// every archetype key the engine can produce resolves
const keys = new Set();
for (let a = 0; a <= 100; a += 10) for (let r2 = 0; r2 <= 100; r2 += 10) for (let i = 0; i <= 100; i += 20) for (let s = 0; s <= 100; s += 25) {
  const k = Engine.match(D(a, r2, i, s, 50)).key; keys.add(k); assert.ok(ProfileSchema.validArchKey(k), k);
}
assert.ok(keys.size >= 15); ok();
console.log('Scoring tests passed (' + n + ' groups, ' + gold.cases.length + ' golden cases).');
