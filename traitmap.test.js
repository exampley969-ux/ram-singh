/* Trait chart / pattern web data: every pattern's drawn keys must match the keys its rule reads, rows must be complete and deterministic. */
const assert = require('node:assert/strict'), vm = require('vm'), fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
['core-logic.js', 'profile-schema.js', 'engine-plus.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8') + '\n;', ctx, { filename: f }));
vm.runInContext('this.X = { EnginePlus, Engine }', ctx);
const { EnginePlus: EP, Engine } = ctx.X; const J = x => JSON.parse(JSON.stringify(x));
const keys = Engine.facetKeys();
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// 1. PATTERN_KEYS agree with the facets each rule reads
const src = fs.readFileSync(path.join(DIR, 'engine-plus.js'), 'utf8');
const rules = [...src.matchAll(/\{ id: '([a-z]+)', name: '[^']+', when: function \(f\) \{ return ([^}]+);/g)];
assert.equal(rules.length, 14, 'fourteen pattern rules'); n++;
rules.forEach(m => {
  const read = [...m[2].matchAll(/'([A-Z]\.[a-z]+)'/g)].map(x => x[1]).sort();
  assert.deepEqual(J(EP.PATTERN_KEYS[m[1]]).sort(), read, 'keys for ' + m[1]); n++;
  EP.PATTERN_KEYS[m[1]].forEach(k => ok(keys.includes(k), 'known facet ' + k));
});

// 2. notation codes: 20 unique four-letter codes, one per facet
const codes = keys.map(k => EP.SHORT[k]);
ok(codes.every(c => /^[A-Z]{4}$/.test(c)) && new Set(codes).size === 20, 'unique four-letter codes');

// 3. rows
const f = Object.fromEntries(keys.map(k => [k, 50])); Object.assign(f, { 'P.curiosity': 80, 'M.discipline': 20, 'R.risk': 62, 'I.stability': 38, 'S.warmth': 61, 'S.empathy': 39 });
const rows = J(EP.traitRows(f));
assert.equal(rows.length, 20); n++;
const by = k => rows.find(r => r.key === k);
assert.equal(by('P.curiosity').zone, 'high'); assert.equal(by('M.discipline').zone, 'low');
assert.equal(by('R.risk').zone, 'high', '62 is the first high score'); assert.equal(by('I.stability').zone, 'low', '38 is the last low score');
assert.equal(by('S.warmth').zone, 'mid'); assert.equal(by('S.empathy').zone, 'mid'); assert.equal(by('P.abstraction').zone, 'mid'); n += 6;
ok(rows.every(r => r.score >= 0 && r.score <= 100 && r.name && r.color), 'row fields');
assert.deepEqual(J(EP.traitRows(f)), rows, 'deterministic'); n++;

// 4. individual(): patterns and tensions carry the keys that the web draws
const ind = J(EP.individual(Object.assign({}, f, { 'P.curiosity': 90, 'M.discipline': 10, 'R.risk': 10 })));
ok(ind.patterns.length >= 1 && ind.patterns.every(p => Array.isArray(p.keys) && p.keys.length >= 2 && p.keys.every(k => keys.includes(k))), 'pattern keys present');
ind.tensions.forEach(t => ok(t.keys.length === 2 && t.keys.every(k => keys.includes(k)) && t.poles.length === 2, 'tension keys'));
// balanced profile: nothing to draw, and nothing invented
const flat = J(EP.individual(Object.fromEntries(keys.map(k => [k, 50]))));
assert.equal(flat.patterns.length, 0); assert.equal(flat.tensions.length, 0); n += 2;
console.log('Trait chart tests passed (' + n + ' assertions).');

/* ---- adaptive discovery ---- */
{
  const hi = { 'P.curiosity': 95, 'M.persistence': 90, 'M.drive': 88, 'I.conviction': 92, 'R.risk': 85, 'S.warmth': 97, 'S.empathy': 80, 'P.intuition': 76, 'I.autonomy': 78 };
  const lo = { 'M.discipline': 4, 'I.stability': 8, 'R.expression': 3, 'S.gregarious': 6, 'S.harmony': 30, 'P.attention': 28 };
  const ff = Object.fromEntries(keys.map(k => [k, hi[k] ?? lo[k] ?? 50]));
  const pats = J(EP.individual(ff).patterns);
  const d = J(EP.discover(ff, pats));
  ok(d.length >= 1 && d.length <= 3, 'discovered count within the budget');
  assert.deepEqual(J(EP.discover(ff, pats)), d, 'deterministic'); n++;
  ok(new Set(d.map(x => x.id)).size === d.length, 'unique ids');
  d.forEach(x => {
    ok(x.source === 'discovered' && x.keys.length >= 2 && x.keys.length <= 3 && x.keys.every(k => keys.includes(k)), 'shape');
    ok(x.keys.every(k => EP.zone(ff[k]) !== 'mid'), 'only clearly high or low traits are combined');
    ok(!pats.some(p => x.keys.every(k => p.keys.includes(k))), 'never repeats a named pattern');
    ok(!/diagnos|always|never|you are a/i.test(x.name + ' ' + x.text), 'safe wording');
    ok(/hypothesis/.test(x.text) && x.notation.includes('+') && /^(clear|moderate|slight)$/.test(x.strength.label), 'hedged text and notation');
    ok(!(x.keys.length === 2 && x.keys[0][0] === x.keys[1][0] && x.zones[0] === x.zones[1]), 'no same-dimension same-direction pair');
  });
  for (let a = 0; a < d.length; a++) for (let b = a + 1; b < d.length; b++) ok(d[a].keys.filter(k => d[b].keys.includes(k)).length < 2, 'distinct combinations');
  // nothing to find in a balanced profile, and a middling profile never invents a pattern
  assert.equal(EP.discover(Object.fromEntries(keys.map(k => [k, 50])), []).length, 0);
  assert.equal(EP.discover(Object.fromEntries(keys.map(k => [k, 55])), []).length, 0); n += 2;
  // the ranking is pluggable: a custom ranker changes the order, a broken one falls back to the default
  const rev = J(EP.discover(ff, pats, { ranker: c => -c.base }));
  assert.notDeepEqual(rev.map(x => x.id), d.map(x => x.id), 'custom ranker is used'); n++;
  assert.deepEqual(J(EP.discover(ff, pats, { ranker: () => NaN })).map(x => x.id), d.map(x => x.id), 'bad ranker falls back'); n++;
  assert.equal(J(EP.discover(ff, pats, { max: 1 })).length, 1); n++;
  // borderline flag
  const bf = Object.assign({}, ff, { 'P.curiosity': 62, 'S.warmth': 62, 'M.discipline': 5 });
  ok(J(EP.discover(bf, [], { max: 20 })).some(x => x.borderline), 'borderline flagged near the cut-off');
  console.log('Discovery tests passed (running total ' + n + ' assertions).');
}
