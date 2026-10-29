/* Insight quality evaluation set. Run: node tests/eval.test.js
   Checks reviewed properties of Profile dynamics output for fixed profiles; never exact prose. */
const assert = require('node:assert/strict'), vm = require('vm'), fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
['core-logic.js', 'profile-schema.js', 'intelligence-engine.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8') + '\n;', ctx, { filename: f }));
vm.runInContext('this.X = { PsycheIntelligence, Engine }', ctx);
const { PsycheIntelligence: PI, Engine } = ctx.X; const J = x => JSON.parse(JSON.stringify(x));
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'eval-profiles.json'), 'utf8'));
const RANK = { low: 0, limited: 1, moderate: 2 };
const keys = Engine.facetKeys();
let n = 0;
fx.profiles.forEach(p => {
  const facets = Object.fromEntries(keys.map(k => [k, p.fill != null ? p.fill : 50])); Object.assign(facets, p.overrides);
  const quality = 'quality' in p ? p.quality : fx.default_quality;
  const r = J(PI.generate(Object.assign({ facets, dims: { P: 50, R: 50, I: 50, S: 50, M: 50 }, quality }, p.extra || {})));
  const e = p.expect, ids = r.insights.map(x => x.id), tag = '[' + p.name + '] ';
  if ('abstained' in e) assert.equal(r.abstained ? r.abstained.code : null, e.abstained, tag + 'abstention');
  if (e.min != null) assert.ok(r.insights.length >= e.min, tag + 'min insights, got ' + r.insights.length);
  if (e.max != null) assert.ok(r.insights.length <= e.max, tag + 'max insights, got ' + r.insights.length);
  (e.mustInclude || []).forEach(id => assert.ok(ids.includes(id), tag + 'should include ' + id + ', got ' + ids.join(',')));
  (e.mustNotInclude || []).forEach(id => assert.ok(!ids.includes(id), tag + 'must not include ' + id));
  Object.entries(e.confidenceOf || {}).forEach(([id, lvl]) => assert.equal(r.insights.find(x => x.id === id).confidence.level, lvl, tag + 'confidence of ' + id));
  if (e.noMoreThan) r.insights.forEach(x => assert.ok(RANK[x.confidence.level] <= RANK[e.noMoreThan.confidence], tag + x.id + ' confidence ' + x.confidence.level));
  // properties every output must have
  r.insights.forEach(x => {
    assert.ok(x.hypothesis === true && x.evidence.facets.length === 2 && x.action.window && x.action.success, tag + x.id);
    assert.notEqual(x.confidence.level, 'high', tag);
    assert.ok(!PI._banned.test(x.interpretation), tag + 'unsafe language');
  });
  assert.equal(new Set(r.insights.map(x => x.theme)).size, r.insights.length, tag + 'duplicate theme');
  assert.deepEqual(J(PI.generate(Object.assign({ facets, dims: {}, quality }, p.extra || {}))), J(PI.generate(Object.assign({ facets, dims: {}, quality }, p.extra || {}))), tag + 'deterministic');
  n++;
});
console.log('Evaluation set passed (' + n + ' profiles).');
