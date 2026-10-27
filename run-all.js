const { spawnSync } = require('child_process'), path = require('path');
const files = ['intelligence-engine.test.js', 'eval.test.js', 'scoring.test.js', 'schema.test.js', 'dedupe.test.js', 'trait-duo.test.js', 'integration.test.js', 'psychometrics.test.js', 'claims.test.js', 'ux.test.js', 'security.test.js', 'ops.test.js', 'phase7.test.js', 'phase8.test.js', 'traitmap.test.js', 'traitlab.test.js'];
let failed = 0;
files.forEach(f => { const r = spawnSync('node', [path.join(__dirname, f)], { stdio: 'inherit' }); if (r.status !== 0) { failed++; console.error('FAILED: ' + f); } });
if (failed) { console.error(failed + ' test file(s) failed'); process.exit(1); }
console.log('All test files passed.');
