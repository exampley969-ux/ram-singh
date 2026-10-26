/* Profile schema validation. Run: node tests/schema.test.js */
const assert = require('assert');
const { loadEngine } = require('./helpers');
const { Engine, QUESTIONS, ProfileSchema: PS } = loadEngine();
const N = QUESTIONS.length;
const J = x => JSON.parse(JSON.stringify(x));
const good = () => J(PS.build(Array.from({ length: N }, (_, i) => 1 + (i * 3 % 5))));
let n = 0; const ok = () => { n++; };
const code = (r, c) => assert.ok(r.errors.some(e => e === c) || r.warnings.some(w => w.indexOf(c) === 0), c + ' expected in ' + JSON.stringify(r)); 

// valid
let v = PS.validate(good()); assert.ok(v.ok, JSON.stringify(v)); assert.strictEqual(v.value.schema, 1); assert.ok(v.value.ans); ok();
// round trip through JSON (localStorage / jsonb) is stable
const g = good(); assert.deepStrictEqual(J(PS.validate(g).value), J(PS.validate(J(PS.validate(g).value)).value)); ok();
// legacy (no schema/versions, the shape the baseline wrote) migrates with a warning
const legacy = good(); delete legacy.schema; delete legacy.versions; delete legacy.skipped;
v = PS.validate(legacy); assert.ok(v.ok); code(v, 'migrated_from_schema_0'); assert.strictEqual(v.value.schema, 1); ok();
// cloud copy has no answers: valid
const cloud = good(); delete cloud.ans; v = PS.validate(cloud); assert.ok(v.ok && !v.value.ans); ok();

// hard failures
[null, undefined, 5, 'x', [], true].forEach(x => { v = PS.validate(x); assert.ok(!v.ok); assert.strictEqual(v.value, null); }); ok();
v = PS.validate({}); assert.ok(!v.ok); code(v, 'dims_invalid'); ok();
v = PS.validate({ dims: {}, facets: {} }); assert.ok(!v.ok); ok();
let r = good(); r.dims.P = 101; v = PS.validate(r); assert.ok(!v.ok); code(v, 'dims_invalid'); ok();
r = good(); r.dims.P = -1; assert.ok(!PS.validate(r).ok); ok();
r = good(); r.dims.P = NaN; assert.ok(!PS.validate(r).ok); ok();
r = good(); r.dims.P = '50'; assert.ok(!PS.validate(r).ok); ok();
r = good(); r.dims.P = Infinity; assert.ok(!PS.validate(r).ok); ok();
r = good(); delete r.dims.M; assert.ok(!PS.validate(r).ok); ok();
r = good(); delete r.facets['P.curiosity']; v = PS.validate(r); assert.ok(!v.ok); code(v, 'facets_invalid'); ok();
r = good(); r.facets['P.curiosity'] = 140; assert.ok(!PS.validate(r).ok); ok();
r = good(); r.facets['P.curiosity'] = null; assert.ok(!PS.validate(r).ok); ok();
r = good(); r.dims.P = (r.dims.P + 30) % 100; v = PS.validate(r); assert.ok(!v.ok); code(v, 'dims_inconsistent_with_facets'); ok();
r = good(); r.schema = 99; v = PS.validate(r); assert.ok(!v.ok); code(v, 'newer_schema'); ok();
r = good(); r.schema = -1; assert.ok(!PS.validate(r).ok); ok();
r = good(); r.schema = 1.5; assert.ok(!PS.validate(r).ok); ok();
// explain() is human readable
assert.ok(/dimension scores/.test(PS.explain(['dims_invalid']))); ok();

// derived data is re-derived, never trusted
r = good(); const realKey = r.match.key; r.match = { key: 'PURE_S', arche: { name: 'Forged' } };
v = PS.validate(r); assert.ok(v.ok); assert.strictEqual(v.value.match.key, realKey); code(v, 'archetype_rederived'); ok();
r = good(); delete r.match; v = PS.validate(r); assert.ok(v.ok && v.value.match.key); ok();

// quality
r = good(); r.quality = { engagement: 7 }; v = PS.validate(r); assert.ok(v.ok && v.value.quality === null); code(v, 'quality_invalid_ignored'); ok();
r = good(); delete r.quality; v = PS.validate(r); assert.ok(v.ok); code(v, 'quality_missing'); ok();

// answers are never trusted over scores
r = good(); r.ans = r.ans.slice(0, 10); v = PS.validate(r); assert.ok(v.ok && !v.value.ans); code(v, 'answers_dropped_wrong_length'); ok();
r = good(); r.ans[3] = 9; v = PS.validate(r); assert.ok(v.ok && !v.value.ans); code(v, 'answers_dropped_out_of_range'); ok();
r = good(); r.ans = 'abc'; v = PS.validate(r); assert.ok(v.ok && !v.value.ans); ok();
r = good(); r.ans = r.ans.map(a => a === 5 ? 1 : a === 1 ? 5 : a); v = PS.validate(r); assert.ok(v.ok && !v.value.ans); code(v, 'answers_dropped_do_not_match_scores'); ok();
// skipped answers are counted
const sk = Array(N).fill(null); for (let i = 0; i < 30; i++) sk[i] = 1 + i % 5;
r = J(PS.build(sk)); v = PS.validate(r); assert.ok(v.ok); assert.strictEqual(v.value.skipped, 10); code(v, 'answers_missing_10'); ok();

// unknown / hostile extra fields are stripped, prototype pollution does not leak
r = good(); r.__proto__ = { polluted: 1 }; r.evil = '<script>'; r.dims.extra = 1;
v = PS.validate(JSON.parse(JSON.stringify(r))); assert.ok(v.ok); assert.ok(!('evil' in v.value)); assert.ok(!('extra' in v.value.dims)); ok();
v = PS.validate(JSON.parse('{"__proto__":{"x":1},"dims":{},"facets":{}}')); assert.ok(!v.ok); assert.strictEqual({}.x, undefined); ok();

// shared profile rows
assert.ok(PS.validateShared({ dims: good().dims, facets: good().facets, arch_key: good().match.key }).ok); ok();
assert.ok(PS.validateShared({ dims: good().dims, facets: null, arch_key: null }).ok); ok();
assert.ok(!PS.validateShared({ dims: { P: 1 } }).ok); ok();
assert.ok(!PS.validateShared({ dims: good().dims, facets: { 'P.curiosity': 500 } }).ok); ok();
assert.ok(!PS.validateShared({ dims: good().dims, arch_key: 'NOPE' }).ok); ok();
assert.ok(!PS.validateShared(null).ok); ok();
// arch keys
['PRISM', 'PURE_P', 'TWIN_PR', 'PR'].forEach(k => assert.ok(PS.validArchKey(k), k));
['', 'XX', 'PURE_Z', 'TWIN_RP', null, 5, '__proto__', 'constructor'].forEach(k => assert.ok(!PS.validArchKey(k), String(k))); ok();
console.log('Schema tests passed (' + n + ' groups).');
