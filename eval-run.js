'use strict';
/* Shared by the review-sheet, snapshot and tests: runs the fixed evaluation set through the insight engine. */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const DIR = path.join(__dirname, '..');
function runEval() {
  const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
  ['core-logic.js', 'profile-schema.js', 'intelligence-engine.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8') + '\n;', ctx, { filename: f }));
  vm.runInContext('this.X = { PsycheIntelligence, Engine, ProfileSchema }', ctx);
  const { PsycheIntelligence: PI, Engine, ProfileSchema } = ctx.X;
  const fx = JSON.parse(fs.readFileSync(path.join(DIR, 'tests', 'fixtures', 'eval-profiles.json'), 'utf8'));
  const keys = Engine.facetKeys();
  const cases = fx.profiles.map(p => {
    const facets = Object.fromEntries(keys.map(k => [k, p.fill != null ? p.fill : 50])); Object.assign(facets, p.overrides);
    const quality = 'quality' in p ? p.quality : fx.default_quality;
    const out = JSON.parse(JSON.stringify(PI.generate(Object.assign({ facets, dims: {}, quality }, p.extra || {}))));
    return { name: p.name, out };
  });
  return { engineVersion: PI.engineVersion, catalogueVersion: PI.catalogueVersion, versions: JSON.parse(JSON.stringify(ProfileSchema.VERSIONS)), cases };
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
function snapshot() {
  const r = runEval();
  return { note: 'Regression snapshot of the fixed evaluation set. A change here means user-visible insight output changed. Update with `npm run snapshot:update` ONLY after reviewing the diff (and re-running human review if wording changed).',
    engineVersion: r.engineVersion, catalogueVersion: r.catalogueVersion, versions: r.versions,
    cases: r.cases.map(c => ({ name: c.name, abstained: !!c.out.abstained, ids: (c.out.insights || []).map(i => i.id), hash: sha(JSON.stringify(c.out)) })) };
}
module.exports = { runEval, snapshot, DIR };
if (require.main === module) {
  const file = path.join(DIR, 'tests', 'fixtures', 'eval-snapshot.json'), next = snapshot();
  if (process.argv.includes('--update')) { fs.writeFileSync(file, JSON.stringify(next, null, 1) + '\n'); console.log('wrote ' + path.relative(DIR, file)); }
  else {
    const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; if (!old) { console.error('no snapshot yet; run with --update'); process.exit(1); }
    let diff = 0;
    next.cases.forEach(c => { const o = old.cases.find(x => x.name === c.name); if (!o) { diff++; console.log('NEW      ' + c.name); } else if (o.hash !== c.hash) { diff++; const add = c.ids.filter(i => !o.ids.includes(i)), rem = o.ids.filter(i => !c.ids.includes(i)); console.log('CHANGED  ' + c.name + (add.length ? '  +' + add.join(',') : '') + (rem.length ? '  -' + rem.join(',') : '') + (!add.length && !rem.length ? '  (same insights, different wording/evidence)' : '')); } });
    old.cases.forEach(o => { if (!next.cases.find(c => c.name === o.name)) { diff++; console.log('REMOVED  ' + o.name); } });
    console.log(diff ? diff + ' case(s) differ from the snapshot.' : 'No differences.'); process.exit(diff ? 1 : 0);
  }
}
