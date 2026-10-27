'use strict';
/* Phase 6: enforce size + compute budgets. Run: node tools/perf-budget.js   (npm run perf)  [--json to print numbers only] */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'perf-budget.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
const local = scripts.filter(s => !/^https?:/.test(s));
const gz = b => zlib.gzipSync(b, { level: 9 }).length;
const rows = local.map(f => { const b = fs.readFileSync(path.join(ROOT, f)); return { f, raw: b.length, gz: gz(b) }; });
const res = {
  scripts: scripts.length,
  js_raw: rows.reduce((s, r) => s + r.raw, 0), js_gz: rows.reduce((s, r) => s + r.gz, 0),
  largest_gz: Math.max.apply(null, rows.map(r => r.gz)), html_gz: gz(Buffer.from(html)),
  font: fs.readdirSync(path.join(ROOT, 'fonts')).reduce((s, f) => s + fs.statSync(path.join(ROOT, 'fonts', f)).size, 0),
  image: (html.match(/(?:src|href)="([^"]+\.(?:jpg|jpeg|png|webp|svg))"/g) || []).map(x => x.match(/"([^"]+)"/)[1]).filter(x => !/^https?:/.test(x)).reduce((s, f) => s + (fs.existsSync(path.join(ROOT, f)) ? fs.statSync(path.join(ROOT, f)).size : 0), 0)
};
// compute timing (pure engine, no DOM)
const ctx = { console, Math, JSON, Object, Array, String, Number, Date, performance }; ctx.window = ctx; vm.createContext(ctx);
['core-logic.js', 'profile-schema.js', 'intelligence-engine.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n;', ctx, { filename: f }));
vm.runInContext('this.X = { PsycheIntelligence, QUESTIONS, ProfileSchema }', ctx);
const { PsycheIntelligence: PI, QUESTIONS, ProfileSchema } = ctx.X;
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const answers = () => QUESTIONS.map(() => 1 + Math.floor(rnd() * 5));
const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const tBuild = [], tGen = []; let last;
for (let i = 0; i < 30; i++) { const a = answers(); let t = performance.now(); last = ProfileSchema.build(a); tBuild.push(performance.now() - t); t = performance.now(); PI.generate(JSON.parse(JSON.stringify(last))); tGen.push(performance.now() - t); }
res.build_ms = +med(tBuild).toFixed(2); res.generate_ms = +med(tGen).toFixed(2);
if (process.argv.includes('--json')) { console.log(JSON.stringify(res, null, 1)); process.exit(0); }
const f = B.first_load, c = B.compute_ms_median;
const checks = [
  ['JS gzip total', res.js_gz, f.js_gzip_total_max], ['JS raw total', res.js_raw, f.js_raw_total_max], ['index.html gzip', res.html_gz, f.html_gzip_max],
  ['largest JS gzip', res.largest_gz, f.largest_js_gzip_max], ['fonts', res.font, f.font_bytes_max], ['images', res.image, f.image_bytes_max],
  ['script tags', res.scripts, f.script_count_max], ['build profile (median ms)', res.build_ms, c.build_profile_max], ['generate insights (median ms)', res.generate_ms, c.generate_insights_max]
];
let bad = 0;
checks.forEach(([n, v, m]) => { const pass = v <= m; if (!pass) bad++; console.log((pass ? 'ok   ' : 'OVER ') + n.padEnd(32) + String(v).padStart(8) + ' / ' + m + (pass ? '' : '  <-- over budget')); });
console.log('\nLargest scripts (gzip): ' + rows.sort((a, b) => b.gz - a.gz).slice(0, 3).map(r => r.f + ' ' + r.gz).join(', '));
if (bad) { console.error(bad + ' budget(s) exceeded. Fix the cause or raise the number in perf-budget.json as a reviewed decision.'); process.exit(1); }
console.log('Performance budgets met.');
