/* Browser audit (Phase 4): automated accessibility + responsive checks in real Chromium.
   Run: node tests/e2e/audit.js            (needs `npm install`; Chromium found via PSYCHE_CHROMIUM or Playwright's cache)
   What it checks, per screen x theme x viewport:
     - axe-core (WCAG 2.0/2.1/2.2 A+AA rules, incl. colour contrast and target size)
     - no horizontal page overflow at 320 / 390 / 768 / 1280 px
   What it does NOT check: real screen readers, real devices, or whether the copy is understandable. See docs/UX_A11Y.md. */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.css': 'text/css', '.json': 'application/json' };

function findChromium() {
  if (process.env.PSYCHE_CHROMIUM) return process.env.PSYCHE_CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const cands = [path.join(base, 'chromium'), ...(fs.existsSync(base) ? [].concat(...fs.readdirSync(base).filter(d => /^chromium-/.test(d)).map(d => ['chrome-linux64', 'chrome-linux'].map(x => path.join(base, d, x, 'chrome')))) : [])];
  return cands.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });
}
function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rsp) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); rsp.end(fs.readFileSync(f));
    }).listen(0, '127.0.0.1', () => res(s));
  });
}
// a fixed, realistic answer pattern so every tab has content
const ANSWERS = Array.from({ length: 40 }, (_, i) => 1 + ((i * 7 + (i % 3)) % 5));

async function main() {
  const exe = findChromium();
  if (!exe) { console.log('SKIP browser audit: no Chromium found (set PSYCHE_CHROMIUM).'); return { skipped: true }; }
  const server = await serve(); const url = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const widths = [[320, 640], [390, 844], [768, 1024], [1280, 800]];
  const screens = [
    ['home', s => { s.screen = 'home'; }],
    ['intro', s => { s.screen = 'intro'; }],
    ['assessment', (s, A) => { s.screen = 'assessment'; s.qIndex = 4; s.answers = A.slice(0, 4); }],
    ['review', (s, A) => { s.screen = 'review'; s.answers = A.map((v, i) => i % 9 === 4 ? null : v); s.qIndex = 39; }],
    ['results-summary', s => { s.screen = 'results'; s.resultsTab = 'profile'; }],
    ['results-facets', s => { s.screen = 'results'; s.resultsTab = 'facets'; }],
    ['results-deep', s => { s.screen = 'results'; s.resultsTab = 'deep'; }],
    ['results-plus', s => { s.screen = 'results'; s.resultsTab = 'plus'; }],
    ['results-career', s => { s.screen = 'results'; s.resultsTab = 'career'; }],
    ['results-relationship', s => { s.screen = 'results'; s.resultsTab = 'relationship'; }],
    ['archlib', s => { s.screen = 'archlib'; }],
    ['science', s => { s.screen = 'science'; s.scienceTab = 'limits'; }],
    ['glossary', s => { s.screen = 'glossary'; }]
  ];
  const out = { violations: {}, overflow: [], checked: 0, errors: [] };
  for (const theme of ['light', 'dark']) {
    for (const [w, h] of widths) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      page.on('pageerror', e => out.errors.push(String(e)));
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort()); // no network: local-only mode
      await page.addInitScript(() => { window.__PSYCHE_TEST__ = true; });
      await page.goto(url); await page.addScriptTag({ content: AXE });
      for (const [name, setup] of screens) {
        const ok = await page.evaluate(([setupSrc, answers]) => {
          const T = window.__PSYCHE_TEST__; if (!T || !T.state) return 'no-hook';
          if (!T.state.result) T.state.result = T.computeResult(answers);
          const fn = eval('(' + setupSrc + ')'); fn(T.state, answers); T.render(); return 'ok';
        }, [setup.toString(), ANSWERS]);
        await page.waitForFunction(() => { const T = window.__PSYCHE_TEST__; return !T.toolsState || T.toolsState() !== 'loading'; }, null, { timeout: 5000 });
        if (ok !== 'ok') { out.errors.push('hook missing'); continue; }
        await page.waitForTimeout(60);
        const r = await page.evaluate(async () => {
          const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
          return { v: res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 2).map(n => n.target.join(' ') + ' :: ' + (n.any[0] ? n.any[0].message : '').slice(0, 110)) })), sw: document.documentElement.scrollWidth, iw: window.innerWidth };
        });
        out.checked++;
        if (r.sw > r.iw + 1) out.overflow.push(`${name} @${w} ${theme}: scrollWidth ${r.sw} > ${r.iw}`);
        r.v.forEach(v => { const k = v.id; const o = out.violations[k] = out.violations[k] || { impact: v.impact, count: 0, where: new Set(), sample: v.sample[0] }; o.count += v.n; o.where.add(name); });
      }
      await ctx.close();
    }
  }
  await browser.close(); server.close();
  const summary = Object.entries(out.violations).map(([id, o]) => ({ id, impact: o.impact, nodes: o.count, screens: [...o.where].join(','), sample: o.sample }));
  console.log(JSON.stringify({ checked: out.checked, violations: summary, overflow: out.overflow, errors: [...new Set(out.errors)] }, null, 1));
  return { summary, overflow: out.overflow, errors: out.errors };
}
if (require.main === module) main().then(r => { if (r && !r.skipped && process.argv.includes('--strict') && (r.summary.length || r.overflow.length || r.errors.length)) process.exit(1); }).catch(e => { console.error(e); process.exit(2); });
module.exports = { main };
