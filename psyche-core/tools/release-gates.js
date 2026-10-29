'use strict';
/* node tools/release-gates.js [--report] [--out docs/RELEASE_STATUS.md]
   Runs the automatic checks, reads docs/release-evidence.json for manual evidence, prints every gate. Exit 1 unless every gate is met (--report always exits 0). */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const G = require('./gates-lib'); const ROOT = path.join(__dirname, '..'), DOCS = path.join(ROOT, '..', 'docs');
const run = (args) => spawnSync('node', args, { cwd: ROOT, stdio: 'pipe' }).status === 0;
const auto = { F0: run(['tests/run-all.js']), Q2: run(['tools/eval-run.js']), O5: run(['tools/perf-budget.js']) };
auto.C0 = auto.F0;   // claims lint is part of run-all
const ev = JSON.parse(fs.readFileSync(path.join(DOCS, 'release-evidence.json'), 'utf8'));
const res = G.evaluate(ev, auto, fs.readFileSync(path.join(DOCS, 'DEFECTS.md'), 'utf8'));
const md = '# Release status\n\nGenerated ' + new Date().toISOString().slice(0, 10) + ' from `tools/release-gates.js`. Manual gates are met only with date, owner and evidence in `docs/release-evidence.json`.\n\n' + G.render(res);
console.log(md);
const oi = process.argv.indexOf('--out'); if (oi > 0) fs.writeFileSync(path.resolve(process.argv[oi + 1]), md);
process.exit(res.ready || process.argv.includes('--report') ? 0 : 1);
