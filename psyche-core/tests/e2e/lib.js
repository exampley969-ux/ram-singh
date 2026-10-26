/* Shared helpers for the browser security tests (Phase 5).
   - serves the static site from a random local port
   - launches the installed Chromium (skips cleanly if none is found)
   - injects a FAKE supabase-js client so account flows can be exercised with no network and no real backend.
   The fake backend proves what the *client* sends and how the client reacts. It does NOT prove anything about
   real Row Level Security; that needs supabase/tests/rls.test.sql run against a staging project. */
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..', '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.txt': 'text/plain' };

function chromiumPath() {
  if (process.env.PSYCHE_CHROMIUM) return process.env.PSYCHE_CHROMIUM;
  const b = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const c = [path.join(b, 'chromium')].concat(fs.existsSync(b) ? [].concat(...fs.readdirSync(b).filter(d => /^chromium-/.test(d)).map(d => ['chrome-linux64', 'chrome-linux'].map(x => path.join(b, d, x, 'chrome')))) : []);
  return c.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });
}
function playwright() {
  try { return require('playwright-core'); } catch (e) {}
  try { return require('/home/claude/.npm-global/lib/node_modules/playwright/node_modules/playwright-core'); } catch (e) {}
  return null;
}

/* opts.stripCsp: serve index.html without its CSP <meta>, so escaping is tested on its own (CSP is defence in depth). */
function serve(opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const srv = http.createServer((q, r) => {
      const rel = q.url.split('?')[0].replace(/^\/$/, '/index.html');
      const f = path.join(ROOT, rel);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      let body = fs.readFileSync(f);
      if (opts.stripCsp && /index\.html$/.test(f)) body = Buffer.from(body.toString('utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, ''));
      r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(body);
    }).listen(0, '127.0.0.1', () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' }));
  });
}

/* Runs inside the page before any app script. */
function fakeSupabaseInit() {
  window.__PSYCHE_TEST__ = true;
  const F = window.__fake = { session: null, listeners: [], calls: [], handler: null, users: {}, signUpResult: null, nextId: 1 };
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const emit = ev => F.listeners.forEach(cb => { try { cb(ev, F.session); } catch (e) { /* ignore */ } });
  F.emit = emit;
  function Q(t) { this.t = t; this.op = 'select'; this.filters = []; this.payload = null; this.cols = null; this.one = null; }
  Q.prototype.select = function (c) { this.cols = c; return this; };
  Q.prototype.insert = function (p) { this.op = 'insert'; this.payload = p; return this; };
  Q.prototype.upsert = function (p) { this.op = 'upsert'; this.payload = p; return this; };
  Q.prototype.update = function (p) { this.op = 'update'; this.payload = p; return this; };
  Q.prototype.delete = function () { this.op = 'delete'; return this; };
  Q.prototype.eq = function (k, v) { this.filters.push([k, 'eq', v]); return this; };
  Q.prototype.in = function (k, v) { this.filters.push([k, 'in', v]); return this; };
  Q.prototype.maybeSingle = function () { this.one = 'maybe'; return this; };
  Q.prototype.single = function () { this.one = 'single'; return this; };
  Q.prototype.then = function (res, rej) {
    const req = { kind: 'from', table: this.t, op: this.op, payload: clone(this.payload), filters: clone(this.filters), cols: this.cols, user: F.session ? F.session.user.id : null };
    F.calls.push(req);
    let out = F.handler ? F.handler(req) : null;
    out = out || { data: this.op === 'select' ? [] : null, error: null };
    if (this.one && Array.isArray(out.data)) out = { data: out.data[0] || null, error: out.error };
    return Promise.resolve(out).then(res, rej);
  };
  const auth = {
    onAuthStateChange(cb) { F.listeners.push(cb); setTimeout(() => cb('INITIAL_SESSION', F.session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithPassword(c) {
      F.calls.push({ kind: 'auth', op: 'signIn', email: c.email });
      const u = F.users[c.email];
      if (!u || u.password !== c.password) return { data: {}, error: { message: 'Invalid login credentials' } };
      F.session = { user: { id: u.id, email: c.email, user_metadata: {} } }; emit('SIGNED_IN'); return { data: { session: F.session }, error: null };
    },
    async signUp(c) { F.calls.push({ kind: 'auth', op: 'signUp', email: c.email }); return F.signUpResult ? clone(F.signUpResult) : { data: { user: { identities: [{}] }, session: null }, error: null }; },
    async signInWithOAuth() { return { data: {}, error: null }; },
    async signOut(o) { F.calls.push({ kind: 'auth', op: 'signOut', scope: o && o.scope }); F.session = null; emit('SIGNED_OUT'); return { error: null }; },
    async resetPasswordForEmail(e) { F.calls.push({ kind: 'auth', op: 'reset', email: e }); return { data: {}, error: null }; },
    async updateUser(p) { F.calls.push({ kind: 'auth', op: 'updateUser' }); return { data: {}, error: null }; }
  };
  const client = {
    auth, from: t => new Q(t),
    async rpc(name, args) {
      const req = { kind: 'rpc', name, args: clone(args), user: F.session ? F.session.user.id : null };
      F.calls.push(req);
      return (F.handler && F.handler(req)) || { data: null, error: null };
    }
  };
  window.supabase = { createClient: () => client };
}

async function open(opts) {
  opts = opts || {};
  const pw = playwright(), ex = chromiumPath();
  if (!pw || !ex) return null;
  const s = await serve(opts);
  const browser = await pw.chromium.launch({ executablePath: ex, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [], csp = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) csp.push(t); });
  page.on('dialog', d => d.accept());
  // nothing may leave the machine in tests (the supabase CDN script is replaced by the fake)
  const leaks = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => { leaks.push(r.request().url()); r.abort(); });
  await page.addInitScript(fakeSupabaseInit);
  await page.goto(s.url + 'index.html');
  await page.waitForFunction(() => window.__PSYCHE_TEST__ && window.__PSYCHE_TEST__.state);
  return { page, browser, srv: s.srv, url: s.url, errors, csp, leaks, close: async () => { await browser.close(); s.srv.close(); } };
}

/* take the assessment through the real handlers */
async function takeAssessment(page, f) {
  await page.evaluate(f0 => {
    const a = window.__PSYCHE_TEST__; a.state.screen = 'assessment'; a.render();
    for (let i = 0; i < 40; i++) a.answerCurrent(1 + ((i * 3 + f0) % 5), null);
  }, f || 0);
}

module.exports = { open, takeAssessment, ROOT, chromiumPath, playwright };
