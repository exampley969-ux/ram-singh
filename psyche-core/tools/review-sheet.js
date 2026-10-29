'use strict';
/* Writes docs/beta/review-sheet-template.csv (one row per insight in the fixed evaluation set; confidence labels are NOT included so reviewers stay blind).
   Reviewers copy it to reviewer-<name>.csv and fill in 1-5 scores. Score with: node tools/review-score.js docs/beta/reviewer-*.csv */
const fs = require('fs'), path = require('path');
const { runEval, DIR } = require('./eval-run'); const { DIMS, csvCell } = require('./review-lib');
const r = runEval(); const lines = [['profile', 'insight_id', 'title'].concat(DIMS, ['note']).join(',')]; let n = 0;
r.cases.forEach(c => (c.out.insights || []).forEach(i => { n++; lines.push([csvCell(c.name), csvCell(i.id), csvCell(i.title)].concat(DIMS.map(() => ''), ['']).join(',')); }));
const f = path.join(DIR, '..', 'docs', 'beta', 'review-sheet-template.csv'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, lines.join('\n') + '\n');
console.log('wrote ' + path.relative(path.join(DIR, '..'), f) + ' (' + n + ' insights, engine ' + r.engineVersion + ', catalogue ' + r.catalogueVersion + ')');
