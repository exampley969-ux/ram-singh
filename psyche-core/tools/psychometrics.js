#!/usr/bin/env node
/* PRISM item / scale QA on REAL response data.
   Usage:
     node tools/psychometrics.js responses.csv [--retest retest.csv] [--out report.md]
   CSV: header row optional; one respondent per row, 40 columns of answers 1-5 (blank = skipped), in question order.
        With --retest, the second file must list the same respondents in the same row order.
   Nothing here uploads data. Run it only on data collected with informed consent (see docs/VALIDATION_PLAN.md). */
'use strict';
const fs = require('fs'), path = require('path');
const { loadEngine } = require('../tests/helpers');
const lib = require('./psychometrics-lib');
function readCsv(file) {
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim()).map(l => l.split(',').map(c => c.trim()));
  const start = rows.length && rows[0].some(c => c !== '' && isNaN(Number(c))) ? 1 : 0;
  return rows.slice(start).map((r, i) => {
    if (r.length !== 40) throw new Error('row ' + (i + start + 1) + ': expected 40 columns, got ' + r.length);
    return r.map(c => { if (c === '') return null; const v = Number(c); if (![1, 2, 3, 4, 5].includes(v)) throw new Error('row ' + (i + start + 1) + ': invalid value "' + c + '"'); return v; });
  });
}
function report(res, rt, E) {
  const L = [], f = x => x == null ? 'n/a' : x;
  L.push('# PRISM item and scale analysis', '', 'N = ' + res.n + ' (complete responses: ' + res.nComplete + '). Computed from supplied data only; interpret with docs/VALIDATION_PLAN.md thresholds.', '');
  L.push('## Flags', ''); (res.flags.length ? res.flags : ['none']).forEach(x => L.push('- ' + x)); L.push('');
  L.push('## Dimensions (8 items each, direction-aligned)', '', '| Dim | alpha | mean | sd |', '|---|---|---|---|');
  E.DIM_ORDER.forEach(d => L.push('| ' + d + ' | ' + f(res.dims[d].alpha) + ' | ' + res.dims[d].mean + ' | ' + res.dims[d].sd + ' |'));
  L.push('', '## Facets (2 items each: only inter-item r and Spearman-Brown are defined, not alpha)', '', '| Facet | inter-item r | 95% CI | SB reliability | mean | sd | % at 0 | % at 100 |', '|---|---|---|---|---|---|---|---|');
  Object.keys(res.facets).forEach(k => { const x = res.facets[k]; L.push('| ' + k + ' | ' + f(x.interItemR) + ' | ' + (x.interItemCI.length ? x.interItemCI.join(' to ') : 'n/a') + ' | ' + f(x.spearmanBrown) + ' | ' + x.mean + ' | ' + x.sd + ' | ' + x.pctAt0 + ' | ' + x.pctAt100 + ' |'); });
  L.push('', '## Items', '', '| # | facet | key | missing | mean | sd | % =1 | % =5 | corrected item-dim r |', '|---|---|---|---|---|---|---|---|---|');
  res.items.forEach(i => L.push('| ' + (i.index + 1) + ' | ' + i.facet + ' | ' + (i.key > 0 ? '+' : '-') + ' | ' + i.missing + ' | ' + i.mean + ' | ' + i.sd + ' | ' + i.pctMin + ' | ' + i.pctMax + ' | ' + f(i.correctedItemDimTotal) + ' |'));
  L.push('', '## Facet pairs correlating |r| >= .60', ''); (res.facetCorrelations.length ? res.facetCorrelations.map(c => '- ' + c.a + ' / ' + c.b + ': r = ' + c.r + (c.sameDimension ? ' (same dimension)' : ' (different dimensions)')) : ['none']).forEach(x => L.push(x));
  L.push('', '## Response quality', '', 'Straight-lining flagged: ' + (res.quality.straightLiningRate * 100).toFixed(1) + '%. Mean consistency (v2): ' + res.quality.meanConsistency + '.');
  if (rt) {
    L.push('', '## Test-retest (N = ' + rt.n + ')', '', 'Archetype agreement across sessions: ' + (rt.archetypeAgreement * 100).toFixed(1) + '%. MDC95 = smallest change exceeding measurement noise.', '', '| Scale | r | 95% CI | ICC(2,1) | mean change | SEM | MDC95 |', '|---|---|---|---|---|---|---|');
    const row = (k, x) => L.push('| ' + k + ' | ' + f(x.r) + ' | ' + (x.ci.length ? x.ci.join(' to ') : 'n/a') + ' | ' + f(x.icc21) + ' | ' + f(x.meanChange) + ' | ' + f(x.sem) + ' | ' + f(x.mdc95) + ' |');
    E.DIM_ORDER.forEach(d => row(d, rt.dims[d])); Object.keys(rt.facets).forEach(k => row(k, rt.facets[k]));
  }
  return L.join('\n') + '\n';
}
if (require.main === module) {
  const a = process.argv.slice(2); if (!a.length) { console.error(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(1); }
  const opt = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  const E = loadEngine(), data = readCsv(a[0]);
  const rt = opt('--retest') ? (() => { const t2 = readCsv(opt('--retest')); if (t2.length !== data.length) throw new Error('retest file must have the same number of rows'); return lib.retest(data, t2, E); })() : null;
  const md = report(lib.analyse(data, E), rt, E);
  if (opt('--out')) { fs.writeFileSync(opt('--out'), md); console.log('wrote ' + opt('--out')); } else process.stdout.write(md);
}
module.exports = { readCsv, report };
