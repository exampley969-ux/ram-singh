/* Phase 3: psychometric helpers, quality v2, legacy-quality handling, item-review/construct doc integrity. Run: node tests/psychometrics.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { loadEngine, DIR } = require('./helpers');
const lib = require('../tools/psychometrics-lib'), gen = require('../tools/gen-item-review');
const E = loadEngine(), { Engine, QUESTIONS, ProfileSchema } = E;
let n = 0; const ok = () => { n++; }; const near = (a, b, t, m) => { assert.ok(Math.abs(a - b) <= (t || 1e-9), (m || '') + ' got ' + a + ' expected ' + b); ok(); };

// ---- helpers against known values ----
near(lib.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1); near(lib.pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1); assert.strictEqual(lib.pearson([1, 1, 1], [1, 2, 3]), null); ok();
near(lib.spearmanBrown(0.5, 2), 2 / 3); near(lib.spearmanBrown(0.6, 2), 0.75);
near(lib.cronbachAlpha([[1, 1, 1], [2, 2, 2], [3, 3, 3], [4, 4, 4]]), 1);
// worked by hand: item variances 1.6667, 2.25, 1.5833 (sum 5.5); totals 6,9,12,15 (variance 15); alpha = 1.5 * (1 - 5.5/15) = 0.95
near(lib.cronbachAlpha([[1, 2, 3], [2, 3, 4], [3, 5, 4], [4, 5, 6]]), 0.95, 1e-9);
near(lib.icc21([[1, 1], [2, 2], [3, 3], [4, 4]]), 1); assert.ok(lib.icc21([[1, 4], [2, 1], [3, 5], [4, 2], [5, 3]]) < 0.3); ok();
const ci = lib.fisherCI(0.75, 100); near(ci[0], 0.65, 0.01); near(ci[1], 0.82, 0.01); assert.strictEqual(lib.fisherCI(0.5, 3), null); ok();

// ---- quality v2: consistency is measured on direction-aligned answers (D14) ----
const A = f => QUESTIONS.map(f);
const coherent = A(q => q.d > 0 ? 5 : 1), contradict = A(() => 5), mild = A(q => q.d > 0 ? 4 : 2), acq = A(() => 4);
near(Engine.quality(coherent).consistency, 1); near(Engine.quality(contradict).consistency, 0); near(Engine.quality(mild).consistency, 1);
assert.strictEqual(Engine.quality(acq).straightLining, true); assert.strictEqual(Engine.quality(coherent).straightLining, false); ok();
const conf = a => Engine.match(Engine.score(a).dims, Engine.quality(a)).confidence;
assert.ok(conf(coherent) > conf(contradict), 'coherent answering must not get lower confidence than contradictory answering'); ok();
// scores are untouched by the quality change
assert.deepStrictEqual(JSON.parse(JSON.stringify(Engine.score(coherent).facets['P.curiosity'])), 100); ok();
// match tolerates unknown consistency
const mu = Engine.match({ P: 70, R: 40, I: 40, S: 40, M: 40 }, { engagement: .6, spread: 1, consistency: null, straightLining: false });
assert.ok(Number.isFinite(mu.confidence)); ok();

// ---- legacy saved results (quality v1) ----
const built = ProfileSchema.build(coherent);
assert.strictEqual(built.versions.quality, '2.0.0'); ok();
const legacy = JSON.parse(JSON.stringify(built)); delete legacy.versions.quality; legacy.quality.consistency = 0; // what v1 wrote for this respondent
let v = ProfileSchema.validate(legacy);
assert.ok(v.ok && v.warnings.includes('quality_rederived')); near(v.value.quality.consistency, 1); assert.strictEqual(v.value.versions.quality, '2.0.0'); assert.strictEqual(v.value.versions.scoring, built.versions.scoring);
const legacyNoAns = JSON.parse(JSON.stringify(legacy)); delete legacyNoAns.ans;
v = ProfileSchema.validate(legacyNoAns);
assert.ok(v.ok && v.warnings.includes('quality_consistency_unknown_legacy') && v.value.quality.consistency === null && Number.isFinite(v.value.match.confidence)); ok();
const cur = ProfileSchema.validate(JSON.parse(JSON.stringify(built))); assert.ok(cur.ok && !cur.warnings.some(w => /^quality_/.test(w))); ok();
assert.ok(ProfileSchema.validate(Object.assign(JSON.parse(JSON.stringify(built)), { quality: { engagement: 0.5, spread: 1, consistency: 'x', straightLining: false } })).warnings.includes('quality_invalid_ignored')); ok();

// ---- analysis on synthetic data with KNOWN structure (code correctness only, not evidence) ----
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, w = 0; while (!u) u = r(); while (!w) w = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); }
const clip = x => Math.max(1, Math.min(5, Math.round(x)));
const r1 = rng(11), signal = [], noise = [];
for (let i = 0; i < 1500; i++) { const th = {}; Engine.facetKeys().forEach(k => th[k] = gauss(r1)); signal.push(QUESTIONS.map(q => clip(3 + q.d * 1.2 * th[q.f] + 0.7 * gauss(r1)))); noise.push(QUESTIONS.map(() => 1 + Math.floor(r1() * 5))); }
const rs = lib.analyse(signal, E), rn = lib.analyse(noise, E);
Engine.facetKeys().forEach(k => { assert.ok(rs.facets[k].interItemR > 0.5, 'signal data: aligned items correlate ' + k); assert.ok(Math.abs(rn.facets[k].interItemR) < 0.12, 'random data: no correlation ' + k); }); ok();
Object.keys(rs.dims).forEach(d => assert.ok(rs.dims[d].alpha > 0.4, 'signal alpha ' + d)); ok();  // independent facets within a dimension cap alpha: documented expectation
assert.ok(rn.flags.some(f => /barely correlate/.test(f)), 'random data must trigger the weak-facet flag'); assert.ok(!rs.flags.some(f => /barely correlate/.test(f))); ok();
assert.strictEqual(rs.items.length, 40); assert.strictEqual(rs.n, 1500); ok();
// retest: identical sittings are perfectly stable; independent random sittings are not
const same = lib.retest(signal.slice(0, 200), signal.slice(0, 200), E);
assert.strictEqual(same.archetypeAgreement, 1); Object.keys(same.facets).forEach(k => near(same.facets[k].r, 1, 1e-9)); near(same.dims.P.icc21, 1, 1e-9); near(same.dims.P.mdc95, 0, 1e-9);
const diff = lib.retest(noise.slice(0, 400), noise.slice(400, 800), E); assert.ok(Math.abs(diff.dims.P.r) < 0.2 && diff.archetypeAgreement < 0.3); ok();

// ---- CLI end to end on a temp CSV ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psy-')); const csv = path.join(tmp, 'r.csv'), csv2 = path.join(tmp, 'r2.csv');
fs.writeFileSync(csv, 'q1,' + Array.from({ length: 39 }, (_, i) => 'q' + (i + 2)).join(',') + '\n' + signal.slice(0, 120).map(r => r.join(',')).join('\n'));
fs.writeFileSync(csv2, signal.slice(120, 240).map(r => r.join(',')).join('\n'));
const out = cp.execFileSync('node', [path.join(DIR, 'tools', 'psychometrics.js'), csv, '--retest', csv2], { encoding: 'utf8' });
assert.ok(/## Dimensions/.test(out) && /## Test-retest \(N = 120\)/.test(out) && /P\.curiosity/.test(out)); ok();
fs.writeFileSync(csv, '1,2,3\n'); assert.throws(() => cp.execFileSync('node', [path.join(DIR, 'tools', 'psychometrics.js'), csv], { stdio: 'pipe' })); ok();
fs.writeFileSync(csv, Array(40).fill('7').join(',')); assert.throws(() => cp.execFileSync('node', [path.join(DIR, 'tools', 'psychometrics.js'), csv], { stdio: 'pipe' })); ok();

// ---- item review and construct docs stay in sync with the instrument ----
const review = require('../tools/item-review.json');
assert.strictEqual(review.items.length, QUESTIONS.length); ok();
QUESTIONS.forEach((q, i) => { assert.strictEqual(review.items[i].textHash, gen.hash(q.t), 'item ' + (i + 1) + ' wording changed since review: re-review it and update tools/item-review.json'); assert.ok(['none', 'low', 'medium'].includes(review.items[i].severity)); review.items[i].flags.forEach(f => assert.ok(review.vocabulary[f], 'unknown flag ' + f)); ok(); });
assert.strictEqual(fs.readFileSync(path.join(DIR, '..', 'docs', 'ITEM_REVIEW.md'), 'utf8'), gen.build(), 'docs/ITEM_REVIEW.md is stale: run node tools/gen-item-review.js'); ok();
const constructs = fs.readFileSync(path.join(DIR, '..', 'docs', 'CONSTRUCTS.md'), 'utf8');
Engine.facetKeys().forEach(k => assert.ok(constructs.includes('| ' + k + ' |'), 'CONSTRUCTS.md missing ' + k)); ['Perception', 'Response', 'Identity', 'Social', 'Motivation'].forEach(d => assert.ok(constructs.includes('· ' + d))); ok();
console.log('Psychometrics tests passed (' + n + ' groups).');
