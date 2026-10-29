'use strict';
/* node tools/review-score.js docs/beta/reviewer-a.csv docs/beta/reviewer-b.csv [--out docs/beta/review-result.md]
   Exit code 0 only if the rubric gate passes. */
const fs = require('fs'), path = require('path');
const L = require('./review-lib'); const { runEval, DIR } = require('./eval-run');
const args = process.argv.slice(2), oi = args.indexOf('--out'), out = oi >= 0 ? args.splice(oi, 2)[1] : null;
if (!args.length) { console.error('usage: node tools/review-score.js <reviewer csv> <reviewer csv> [...] [--out file.md]'); process.exit(2); }
const sheets = args.map(f => L.loadSheet(fs.readFileSync(f, 'utf8'), path.basename(f, '.csv')));
const expected = []; runEval().cases.forEach(c => (c.out.insights || []).forEach(i => expected.push(c.name + '|' + i.id)));
const a = L.analyze(sheets, expected), md = L.report(a); console.log(md);
if (out) fs.writeFileSync(out, md);
process.exit(a.pass ? 0 : 1);
