/* Phase 5 browser security + privacy checks, in real Chromium against a FAKE Supabase backend.
   Run: node tests/e2e/security.js        (add --no-csp-mode to also run the escaping test with CSP removed; default runs both)
   Covers client behaviour only: escaping of other users' data, CSP enforcement, account switching, sign-out,
   account deletion (local data), account-enumeration messages, session revocation after a password change.
   It does NOT test real Row Level Security. That is supabase/tests/rls.test.sql, run against staging. */
const { open, takeAssessment } = require('./lib');

let fails = 0, passes = 0;
function check(name, cond, detail) { if (cond) { passes++; console.log('  ok   ' + name); } else { fails++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function settle(page) { await sleep(150); await page.waitForFunction(() => window.__PSYCHE_TEST__.state.syncStatus !== 'saving', null, { timeout: 4000 }).catch(() => {}); await sleep(150); }
async function login(page, email) { await page.evaluate(e => window.PsycheAuth.signIn(e, 'pw'), email); await page.waitForFunction(e => window.__PSYCHE_TEST__.state.user && window.__PSYCHE_TEST__.state.user.email === e, email, { timeout: 4000 }); await settle(page); }

const P1 = '<img src=x onerror="window.__xss=1">', P2 = '"><svg onload="window.__xss=1">', P3 = "' onmouseover='window.__xss=1' x='";

/* ---------- 1. other people's data is escaped everywhere it is rendered ---------- */
async function xssTest(label, stripCsp) {
  console.log('\n[' + label + '] escaping of other users\' display names, group names and emails');
  const b = await open({ stripCsp });
  if (!b) { console.log('SKIP: no Chromium / playwright-core available'); return; }
  const { page } = b;
  await takeAssessment(page, 0);
  await page.evaluate(({ P1, P2, P3 }) => {
    const F = window.__fake, st = window.__PSYCHE_TEST__.state, mine = st.result;
    const prof = (id, name) => ({ user_id: id, display_name: name, dims: mine.dims, facets: mine.facets, arch_key: mine.match.key });
    F.users['me@x.com'] = { id: 'u1', password: 'pw' };
    const evilMail = '"><img src=x onerror=window.__xss=1>@evil.com';
    F.handler = req => {
      if (req.kind === 'rpc') return { data: null, error: null };
      if (req.op !== 'select') return { data: null, error: null };
      if (req.table === 'assessment_results') return { data: [], error: null };
      if (req.table === 'connections') return { data: [{ id: 'c1', requester_id: 'u2', requester_email: evilMail, requester_name: P2, addressee_id: 'u1', invitee_email: 'me@x.com', status: 'accepted', token: 't' }, { id: 'c2', requester_id: 'u3', requester_email: 'a@b.c', requester_name: P1, addressee_id: null, invitee_email: 'me@x.com', status: 'pending', token: 't2' }, { id: 'c3', requester_id: 'u1', requester_email: 'me@x.com', requester_name: 'Me', addressee_id: null, invitee_email: evilMail, status: 'pending', token: 't3' }], error: null };
      if (req.table === 'groups') return { data: [{ id: 'g1', name: P3 + P1, owner_id: 'u1' }, { id: 'g2', name: P2, owner_id: 'u2' }], error: null };
      if (req.table === 'group_members') return { data: [{ group_id: 'g1', email: 'me@x.com', user_id: 'u1', status: 'accepted' }, { group_id: 'g1', email: evilMail, user_id: 'u2', status: 'accepted' }, { group_id: 'g1', email: 'q@x.com', user_id: 'u3', status: 'accepted' }, { group_id: 'g1', email: P1 + '@x.com', user_id: null, status: 'invited' }, { group_id: 'g2', email: 'me@x.com', user_id: null, status: 'invited' }], error: null };
      if (req.table === 'profiles') return { data: req.cols === 'display_name' ? [{ display_name: P3 }] : [prof('u2', P1), prof('u3', P2)], error: null };
      return { data: [], error: null };
    };
  }, { P1, P2, P3 });
  await login(page, 'me@x.com');
  const scan = () => page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('*').forEach(e => { for (const a of e.attributes) if (/^on/i.test(a.name)) bad.push(e.tagName + '[' + a.name + ']'); if (e.tagName === 'IMG' && e.getAttribute('src') === 'x') bad.push('IMG[src=x]'); });
    if (window.__xss) bad.push('payload-executed');
    return bad;
  });
  const visit = async (name, fn) => { await page.evaluate(fn); await sleep(60); const bad = await scan(); check(name + ' renders without injected markup', bad.length === 0, bad.slice(0, 4).join(', ')); };
  await visit('account page', () => { const a = window.__PSYCHE_TEST__; a.state.screen = 'account'; a.render(); });
  await visit('connections list', () => { const a = window.__PSYCHE_TEST__; a.state.screen = 'compare'; a.state.compareWith = null; a.render(); });
  await visit('compare view', () => { const a = window.__PSYCHE_TEST__; a.state.screen = 'compare'; a.state.compareWith = 'c1'; a.render(); });
  if (!(await page.evaluate(() => !!document.querySelector('#app svg')))) check('compare view actually rendered the comparison (radar present)', false);
  await visit('compare PDF report', () => { window.print = () => {}; const a = window.__PSYCHE_TEST__; a.exportCompatPDF && a.exportCompatPDF(); });
  await visit('group list', () => { const a = window.__PSYCHE_TEST__; a.state.screen = 'group'; a.state.activeGroup = null; a.render(); });
  for (const tab of ['overview', 'members', 'heat', 'insights', 'roles', 'pairs', 'team', 'scen', 'traits', 'story', 'deep']) {
    await page.evaluate(t => { window.__tab = t; }, tab);
    await visit('group tab "' + tab + '"', () => { const a = window.__PSYCHE_TEST__; a.state.screen = 'group'; a.state.activeGroup = 'g1'; a.state.groupTab = window.__tab; a.state.groupPair = null; a.render(); });
  }
  await visit('group PDF report', () => { window.print = () => {}; const a = window.__PSYCHE_TEST__; a.exportGroupPDF && a.exportGroupPDF(); });
  check('no uncaught page errors', b.errors.length === 0, b.errors.slice(0, 2).join(' | '));
  check('no requests left the machine (apart from the supabase-js script the fake replaces)', b.leaks.filter(u => !/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/.test(u)).length === 0, b.leaks.slice(0, 2).join(' '));
  await b.close();
}

/* ---------- 2. account switching on a shared device ---------- */
async function accountSwitching() {
  console.log('\n[account switching] one device, two accounts');
  const b = await open({});
  if (!b) return console.log('SKIP');
  const { page } = b;
  await takeAssessment(page, 1);
  await page.evaluate(() => {
    const F = window.__fake; F.users['a@x.com'] = { id: 'uA', password: 'pw' }; F.users['b@x.com'] = { id: 'uB', password: 'pw' };
    window.__failSync = true;
    F.handler = req => {
      if (req.kind === 'from' && req.table === 'assessment_results' && req.op === 'upsert' && window.__failSync) return { data: null, error: { message: 'network down' } };
      return null;
    };
  });
  const dimsA = await page.evaluate(() => JSON.stringify(window.__PSYCHE_TEST__.state.result.dims));
  await login(page, 'a@x.com');
  check('sync failure is surfaced to the user', await page.evaluate(() => window.__PSYCHE_TEST__.state.syncStatus === 'error'));
  await page.evaluate(() => { const a = window.__PSYCHE_TEST__; a.state.screen = 'account'; a.render(); });
  await page.click('[data-act="signout"]'); await sleep(300);
  await page.evaluate(() => { window.__failSync = false; window.__fake.calls.length = 0; });
  await login(page, 'b@x.com');
  const calls = await page.evaluate(() => window.__fake.calls.filter(c => c.kind === 'from' && (c.op === 'upsert' || c.op === 'insert')).map(c => ({ t: c.table, uid: c.payload && c.payload.user_id, dims: c.payload && (c.payload.dims || (c.payload.result && c.payload.result.dims)) })));
  const leaked = calls.filter(c => c.dims && JSON.stringify(c.dims) === dimsA);
  check('user A\'s unsynced result is NOT uploaded into user B\'s account', leaked.length === 0, JSON.stringify(leaked));
  check('user B starts without user A\'s result on screen', await page.evaluate(() => !window.__PSYCHE_TEST__.state.result));

  // the intended first-use path must still work: an anonymous result is adopted by the account that signs in
  console.log('[account switching] anonymous result is still adopted by the first account that signs in');
  const b2 = await open({});
  await takeAssessment(b2.page, 2);
  await b2.page.evaluate(() => { window.__fake.users['c@x.com'] = { id: 'uC', password: 'pw' }; });
  await login(b2.page, 'c@x.com');
  const pushed = await b2.page.evaluate(() => window.__fake.calls.some(c => c.kind === 'from' && c.table === 'assessment_results' && c.op === 'upsert' && c.payload.user_id === 'uC'));
  check('anonymous local result is saved to the new account', pushed);
  const payload = await b2.page.evaluate(() => (window.__fake.calls.filter(c => c.table === 'assessment_results' && c.op === 'upsert')[0] || {}).payload);
  check('uploaded result never contains raw answers', payload && payload.result && payload.result.ans === undefined && !/"ans"/.test(JSON.stringify(payload)));
  check('uploaded profile contains only name + scores + archetype', await b2.page.evaluate(() => { const p = window.__fake.calls.filter(c => c.table === 'profiles' && c.op === 'upsert')[0]; return !p || Object.keys(p.payload).sort().join() === 'arch_key,dims,display_name,email,facets,updated_at,user_id'; }));
  await b2.close(); await b.close();
}

/* ---------- 3. sign-out and deletion leave no sensitive local data ---------- */
async function localDataLifecycle() {
  console.log('\n[local data] sign-out and account deletion');
  const b = await open({});
  if (!b) return console.log('SKIP');
  const { page } = b;
  const seed = async () => {
    await takeAssessment(page, 3);
    await page.evaluate(() => {
      const a = window.__PSYCHE_TEST__; a.state.screen = 'assessment'; a.state.answers = []; a.state.qIndex = 0; a.render();
      for (let i = 0; i < 6; i++) a.answerCurrent(2, null);                       // an unfinished second attempt -> draft with raw answers
      document.querySelector('[data-act="home"]') && document.querySelector('[data-act="home"]').click();
      try { window.PsycheIntelligence.feedback(window.localStorage).set('pattern-x', 'accurate', 'private note about my life'); } catch (e) {}
      localStorage.setItem('psyche_pending_join_v1', 'A'.repeat(40));
      localStorage.setItem('psyche_core_v1_rejected', JSON.stringify({ result: { ans: [1, 2, 3] } }));
    });
  };
  const dump = () => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
  const sensitive = o => Object.keys(o).filter(k => /psyche/i.test(k) && (/draft|feedback|reject|pending|join/i.test(k) || /"ans"|"answers"|private note/.test(o[k]) || (k === 'psyche_core_v1' && /"dims"/.test(o[k]))));

  await page.evaluate(() => { const F = window.__fake; F.users['d@x.com'] = { id: 'uD', password: 'pw' }; F.handler = () => null; });
  await seed(); const seeded = sensitive(await dump());
  check('test setup: draft, feedback note, pending join token, rejected copy and result are present locally', seeded.length >= 4, seeded.join(','));
  await login(page, 'd@x.com');
  await page.evaluate(() => { const a = window.__PSYCHE_TEST__; a.state.screen = 'account'; a.render(); });
  await page.click('[data-act="delopen"]'); await sleep(200);
  await page.fill('#delConfirm', 'DELETE');
  if (!(await page.isChecked('#delLocal'))) await page.check('#delLocal');
  await page.click('#delForm button[type="submit"], #delForm [type="submit"]'); await sleep(400);
  check('delete_my_account RPC was called', await page.evaluate(() => window.__fake.calls.some(c => c.kind === 'rpc' && c.name === 'delete_my_account')));
  const left = sensitive(await dump());
  check('after "delete my account + this device": no result, answers, draft, feedback, join token or rejected copy remain', left.length === 0, left.join(','));

  // sign-out on a device whose result is NOT saved to the account must not hand it to the next person silently
  console.log('[local data] explicit "clear data on this device" control');
  await seed();
  const hasControl = await page.evaluate(() => !!(window.PsychePrivacy && typeof window.PsychePrivacy.wipeLocal === 'function'));
  check('a tested wipe routine exists (PsychePrivacy.wipeLocal)', hasControl);
  if (hasControl) { await page.evaluate(() => window.PsychePrivacy.wipeLocal(window.localStorage)); const l2 = sensitive(await dump()); check('wipeLocal removes every sensitive local key', l2.length === 0, l2.join(',')); }
  await b.close();
}

/* ---------- 4. account enumeration + session revocation ---------- */
async function authBehaviour() {
  console.log('\n[auth] enumeration and session lifecycle');
  const b = await open({});
  if (!b) return console.log('SKIP');
  const { page } = b;
  const run = async (res) => page.evaluate(async r => { window.__fake.signUpResult = r; return JSON.stringify(await window.PsycheAuth.signUp('x@y.z', 'long-enough-pass-1')); }, res);
  const fresh = await run(null);
  const dupObfuscated = await run({ data: { user: { identities: [] }, session: null }, error: null });
  const dupError = await run({ data: {}, error: { message: 'User already registered' } });
  check('sign-up response for an existing email is indistinguishable (obfuscated duplicate)', fresh === dupObfuscated, fresh + ' vs ' + dupObfuscated);
  check('sign-up response for an existing email is indistinguishable (explicit error)', fresh === dupError, fresh + ' vs ' + dupError);
  const sanitized = await page.evaluate(async () => { window.__fake.signUpResult = { data: {}, error: { message: 'relation "auth.users" violates constraint xyz at 10.0.0.5' } }; return JSON.stringify(await window.PsycheAuth.signUp('q@y.z', 'long-enough-pass-1')); });
  check('unknown backend errors are not shown verbatim to the user', !/auth\.users|10\.0\.0\.5|constraint/.test(sanitized), sanitized);
  await page.evaluate(() => { window.__fake.users['p@x.com'] = { id: 'uP', password: 'pw' }; });
  await login(page, 'p@x.com');
  await page.evaluate(() => { window.__fake.calls.length = 0; return window.PsycheAuth.updatePassword('a-new-long-password-1'); });
  check('changing the password signs out other sessions', await page.evaluate(() => window.__fake.calls.some(c => c.kind === 'auth' && c.op === 'signOut' && c.scope === 'others')));
  await b.close();
}

/* ---------- 5. CSP is present, is enforced, and does not break the app ---------- */
async function cspTest() {
  console.log('\n[csp] content security policy');
  const b = await open({});
  if (!b) return console.log('SKIP');
  const { page } = b;
  const meta = await page.evaluate(() => { const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); return m ? m.content : null; });
  check('index.html declares a Content-Security-Policy', !!meta);
  if (meta) {
    check('script-src has no unsafe-inline / unsafe-eval', !/script-src[^;]*'unsafe-(inline|eval)'/.test(meta), meta);
    check('object-src none, base-uri restricted, form-action restricted', /object-src 'none'/.test(meta) && /base-uri (')?(none|self)/.test(meta) && /form-action 'self'/.test(meta));
    check('connect-src is limited to this site and the Supabase project', /connect-src[^;]*supabase\.co/.test(meta) && !/connect-src[^;]*\*[^.]/.test(meta));
  }
  await page.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__inj = 1'; document.head.appendChild(s); });
  check('an injected inline script does not run', await page.evaluate(() => window.__inj === undefined));
  const before = b.csp.length; // exactly one violation is expected so far: the deliberately injected inline script
  check('the only CSP violation so far is the deliberately injected script', before === 1, b.csp.join(' | ').slice(0, 300));
  await takeAssessment(page, 4);
  await page.evaluate(() => { const a = window.__PSYCHE_TEST__; ['profile', 'facets', 'deep', 'career', 'relationship', 'plus'].forEach(t => { a.state.resultsTab = t; a.render(); }); });
  check('normal use (assessment, every result tab) triggers no further CSP violations', b.csp.length === before, b.csp.slice(before).join(' | ').slice(0, 300));
  await page.evaluate(() => { const i = document.createElement('img'); i.id = 'brokenimg'; i.setAttribute('data-hide-on-error', '1'); i.src = '/does-not-exist.png'; document.body.appendChild(i); });
  await sleep(400);
  check('a failing avatar image is hidden without an inline handler (CSP-safe)', await page.evaluate(() => !document.getElementById('brokenimg')));
  check('referrer policy limits URL leakage (join tokens)', await page.evaluate(() => { const m = document.querySelector('meta[name="referrer"]'); return !!m && /^(no-referrer|same-origin|strict-origin|origin)/.test(m.content); }));
  await b.close();
}

(async () => {
  const only = process.argv.slice(2);
  const want = n => !only.length || only.includes(n);
  if (want('xss')) { await xssTest('escaping, CSP removed', true); await xssTest('escaping, CSP active', false); }
  if (want('switch')) await accountSwitching();
  if (want('local')) await localDataLifecycle();
  if (want('auth')) await authBehaviour();
  if (want('csp')) await cspTest();
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
