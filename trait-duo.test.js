/* Run: node tests/trait-duo.test.js  (from psyche-core) */
const vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
const dir = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
['core-logic.js', 'implications_data.js', 'deep-analysis.js', 'text-dedupe.js', 'traits-engine.js', 'engine-plus.js', 'social-plus.js', 'trait-duo.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8') + '\n;', ctx, { filename: f }));
vm.runInContext('this.X = { TraitDuo, DIMS }', ctx);
const { TraitDuo, DIMS } = ctx.X;

function prof(seed, name, fixed) {
  let s = seed; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const f = {};
  Object.keys(DIMS).forEach(d => Object.keys(DIMS[d].facets).forEach(k => { f[d + '.' + k] = fixed == null ? Math.round(r() * 100) : fixed; }));
  return { name, facets: f };
}
const BAD = /\b(you|your|yourself)\b/i;
function strings(o, out) { if (typeof o === 'string') out.push(o); else if (o && typeof o === 'object') Object.keys(o).forEach(k => strings(o[k], out)); return out; }

// deterministic
const a = prof(7, 'Asha'), b = prof(99, 'Ben');
assert.deepStrictEqual(TraitDuo.pair(a, b), TraitDuo.pair(a, b));
// identical people share everything and oppose nothing
const same = TraitDuo.pair(a, Object.assign({}, a, { name: 'Twin' }));
assert.strictEqual(same.counts.opposite, 0);
assert.ok(same.shared.length >= 1);
// mirrored extremes oppose
const hi = prof(1, 'Hi', 95), lo = prof(1, 'Lo', 5);
const mir = TraitDuo.pair(hi, lo);
assert.ok(mir.opposite.length >= 1, 'opposite profiles must produce opposite traits');
assert.strictEqual(mir.counts.shared, 0);
// no second-person leakage in descriptive fields and every field is a non-empty string
let checked = 0;
for (let i = 1; i <= 40; i++) {
  const p = TraitDuo.pair(prof(i * 13, 'P' + i), prof(i * 29 + 3, 'Q' + i));
  p.shared.concat(p.opposite).forEach(x => {
    ['gift', 'watch', 'text'].forEach(k => { if (x[k] != null) { assert.ok(x[k].length > 3); if (k !== 'text') assert.ok(!BAD.test(x[k]), x[k]); } });
    (x.sides || []).forEach(sd => { assert.ok(!BAD.test(sd.gift) && !BAD.test(sd.watch), sd.gift + ' | ' + sd.watch); checked++; });
  });
  p.signatures.forEach(sg => assert.strictEqual(sg.items.length, 3));
  strings(p, []).forEach(t => assert.ok(!/undefined|NaN|\[object/.test(t), t));
}
assert.ok(checked > 0);
// group
const members = [1, 2, 3, 4, 5].map(i => prof(i * 41, 'M' + i));
const g = TraitDuo.group(members);
assert.strictEqual(g.members, 5);
assert.strictEqual(g.signatures.length, 5);
strings(g, []).forEach(t => assert.ok(!/undefined|NaN|\[object/.test(t), t));
g.common.forEach(c => { assert.ok(c.count >= 2 && c.count <= 5); assert.ok(!BAD.test(c.strength) && !BAD.test(c.challenge)); });
g.unique.forEach(u => assert.ok(members.some(m => m.name === u.name)));
assert.deepStrictEqual(g, TraitDuo.group(members));
// identical group -> all traits common to everyone, nothing unique
const clones = [1, 2, 3].map(i => Object.assign({}, a, { name: 'C' + i }));
const gc = TraitDuo.group(clones);
assert.ok(gc.common.length > 0 && gc.common.every(c => c.all));
assert.strictEqual(gc.unique.length, 0);
// invalid / missing input
assert.strictEqual(TraitDuo.group([a]), null);
assert.strictEqual(TraitDuo.group([a, { name: 'X', facets: { 'P.curiosity': 5 } }]), null);
assert.strictEqual(TraitDuo.validFacets(null), false);
// 200 random pairs and 30 random groups never throw
for (let i = 0; i < 200; i++) TraitDuo.pair(prof(i + 1000, 'A'), prof(i * 7 + 5, 'B'));
for (let i = 0; i < 30; i++) TraitDuo.group([0, 1, 2, 3, 4, 5].slice(0, 2 + i % 5).map(j => prof(i * 10 + j + 1, 'G' + j)));
console.log('Trait duo tests passed.');
