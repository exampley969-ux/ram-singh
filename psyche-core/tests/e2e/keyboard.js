/* Keyboard-only journey in real Chromium (Phase 4). Run: node tests/e2e/keyboard.js
   Home -> onboarding -> 40 questions by number keys -> result -> every tab by arrow keys, all without a pointer.
   Also checks that every focus stop shows a visible focus indicator. Not a screen-reader test. */
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..', '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
function exe() { if (process.env.PSYCHE_CHROMIUM) return process.env.PSYCHE_CHROMIUM; const b = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'; return [path.join(b, 'chromium')].concat(fs.existsSync(b) ? [].concat(...fs.readdirSync(b).filter(d => /^chromium-/.test(d)).map(d => ['chrome-linux64', 'chrome-linux'].map(x => path.join(b, d, x, 'chrome')))) : []).find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }); }
(async () => {
  const ex = exe(); if (!ex) { console.log('SKIP keyboard journey: no Chromium found.'); return; }
  const srv = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/^\/$/, '/index.html')); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const b = await chromium.launch({ executablePath: ex, args: ['--no-sandbox'] });
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto('http://127.0.0.1:' + srv.address().port + '/index.html');
  const active = () => page.evaluate(() => { const e = document.activeElement; return e ? { tag: e.tagName, text: (e.textContent || '').trim().slice(0, 40), act: e.getAttribute('data-act'), cls: e.className && e.className.baseVal === undefined ? e.className : '' } : null; });
  // 1. first Tab stop is the skip link
  await page.keyboard.press('Tab'); assert.ok(/Skip to main/.test((await active()).text), 'skip link first');
  // 2. reach "Take the PRISM test" by Tab only (bounded), activate with Enter
  let found = false; for (let i = 0; i < 40 && !found; i++) { await page.keyboard.press('Tab'); const a = await active(); if (a.act === 'start') found = true; }
  assert.ok(found, 'start button reachable by keyboard'); await page.keyboard.press('Enter');
  assert.ok(/Before you start/.test(await page.textContent('h1')), 'onboarding shown'); assert.strictEqual((await active()).tag, 'H1', 'focus moved to the new screen heading');
  // 3. begin, then answer all 40 by number keys
  let begin = false; for (let i = 0; i < 20 && !begin; i++) { await page.keyboard.press('Tab'); if ((await active()).act === 'begin') begin = true; }
  assert.ok(begin); await page.keyboard.press('Enter');
  for (let i = 0; i < 40; i++) {
    assert.ok(new RegExp('Question ' + (i + 1) + ' of 40').test(await page.textContent('h1')), 'question ' + (i + 1));
    assert.strictEqual((await active()).tag, 'H1', 'focus on the question heading');
    await page.keyboard.press(String(1 + (i * 7 + (i % 3)) % 5));
  }
  assert.ok(await page.waitForSelector('.sumh', { timeout: 3000 }), 'reached the result');
  // 4. every tab reachable with arrows + Enter
  let tabs = await page.$$eval('[role="tab"]', t => t.length); assert.strictEqual(tabs, 6);
  await page.focus('[role="tab"][aria-selected="true"]');
  for (let i = 1; i < tabs; i++) {
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    assert.strictEqual(await page.$$eval('[role="tab"][aria-selected="true"]', t => t.length), 1);
    assert.ok((await active()).act === 'tab', 'focus stays on the tab bar after selecting a tab');
    const panelOk = await page.evaluate(() => { const p = document.querySelector('[role="tabpanel"]'); return !!document.getElementById(p.getAttribute('aria-labelledby')) && document.querySelector('[role="tab"][aria-selected="true"]').id === p.getAttribute('aria-labelledby'); });
    assert.ok(panelOk, 'panel labelled by selected tab');
  }
  // 5. visible focus on every stop of the summary page
  await page.click('[role="tab"][data-tab="profile"]'); await page.focus('body');
  let stops = 0, bad = [];
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { n: (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30), vis: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, w: r.width, h: r.height }; });
    if (!r) break; stops++; if (!r.vis) bad.push(r.n);
  }
  assert.ok(stops > 10, 'enough focus stops: ' + stops); assert.deepStrictEqual(bad, [], 'focus not visible on: ' + bad.join(', '));
  assert.deepStrictEqual(errors, []);
  console.log('Keyboard journey passed (40 questions by keys, 6 tabs, ' + stops + ' focus stops with visible focus).');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
