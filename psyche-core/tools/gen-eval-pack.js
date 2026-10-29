/* Builds docs/eval-pack.md: the rendered insights for each evaluation profile, for human review.
   Run: node tools/gen-eval-pack.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
['core-logic.js', 'profile-schema.js', 'intelligence-engine.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8') + '\n;', ctx, { filename: f }));
vm.runInContext('this.X = { PsycheIntelligence, Engine }', ctx);
const { PsycheIntelligence: PI, Engine } = ctx.X;
const fx = JSON.parse(fs.readFileSync(path.join(DIR, 'tests', 'fixtures', 'eval-profiles.json'), 'utf8'));
const keys = Engine.facetKeys();
let md = '# Evaluation pack (for human review)\n\nEngine ' + PI.engineVersion + ', catalogue ' + PI.catalogueVersion + '. Score each insight with `EVALUATION_RUBRIC.md`.\n\n';
fx.profiles.forEach((p, i) => {
  const facets = Object.fromEntries(keys.map(k => [k, p.fill != null ? p.fill : 50])); Object.assign(facets, p.overrides);
  const quality = 'quality' in p ? p.quality : fx.default_quality;
  const r = JSON.parse(JSON.stringify(PI.generate(Object.assign({ facets, dims: {}, quality }, p.extra || {}))));
  md += '## Case ' + (i + 1) + ' — ' + p.name + '\n\n';
  if (r.abstained) { md += '**No insights shown.** ' + r.abstained.reason + '\n\n'; return; }
  if (!r.insights.length) { md += '_No insights shown (no pattern clear enough)._\n\n'; return; }
  r.insights.forEach(x => {
    md += '### ' + x.title + ' (`' + x.id + '`)\n\n' + x.evidence.facets.map(f => f.name + ' ' + f.score).join(', ') + '\n\n' + x.interpretation + '\n\n**Experiment (' + x.action.window + '):** ' + x.action.text + '  \n**Success signal:** ' + x.action.success + '\n\n| Specificity | Evidence | Non-repetition | Tone | Actionability | Calibration | Notes |\n|---|---|---|---|---|---|---|\n| | | | | | | |\n\n';
  });
});
fs.writeFileSync(path.join(DIR, '..', 'docs', 'eval-pack.md'), md);
console.log('wrote docs/eval-pack.md');
