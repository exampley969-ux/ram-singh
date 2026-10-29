/* ============================================================
   PsycheOps (Phase 6) — redacted error reporting, retry/backoff, coalesced (idempotent) sync, perf marks.
   - Never records messages, stacks with arguments, answers, scores, emails or ids. Only: kind, error type
     (allowlist), same-origin file:line, screen name, versions, online flag, request id, timestamp.
   - Memory only (ring buffer). Writes NOTHING to localStorage. Sends NOTHING unless PSYCHE_CONFIG.TELEMETRY_URL is set
     (then also add that origin to connect-src in index.html and update docs/DATA_INVENTORY.md).
   - Pure functions over injectable env so tests can run in node.
   ============================================================ */
(function (root) {
'use strict';

var APP_VERSION = '1.1.0';
var MAX_EVENTS = 50, MAX_SENT_PER_SESSION = 20;
var SAFE_NAMES = { Error: 1, TypeError: 1, RangeError: 1, ReferenceError: 1, SyntaxError: 1, URIError: 1, EvalError: 1, AbortError: 1, NetworkError: 1 };
var SAFE_KINDS = { error: 1, rejection: 1, render: 1, sync: 1, auth: 1, db: 1, timeout: 1, perf: 1 };

function requestId() {
  var a = '';
  try { var u = new Uint8Array(6); (root.crypto || {}).getRandomValues(u); for (var i = 0; i < u.length; i++) a += ('0' + u[i].toString(16)).slice(-2); } catch (e) {}
  if (!a) a = Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  return 'r-' + a;
}

/* Keep only "file.js:line" for same-origin scripts. Everything else (messages, URLs, query strings, args) is dropped. */
function where(stackOrFile, line) {
  var s = String(stackOrFile || '');
  var m = s.match(/([A-Za-z0-9_.-]+\.js)(?:[?#][^:\s)]*)?:(\d+)(?::\d+)?/);
  if (m) return m[1] + ':' + m[2];
  m = s.match(/^([A-Za-z0-9_.-]+\.js)$/);
  if (m) return m[1] + (line ? ':' + (parseInt(line, 10) || 0) : '');
  return '';
}

/* Build a safe event. `info` may carry untrusted data (error objects, messages, payloads) — none of it is copied except allowlisted fields. */
function redact(kind, info, ctx) {
  info = info || {}; ctx = ctx || {};
  var name = info.name && SAFE_NAMES[info.name] ? info.name : 'Error';
  var code = typeof info.code === 'string' && /^[a-z0-9_.-]{1,40}$/i.test(info.code) ? info.code : '';
  return {
    id: requestId(),
    t: new Date(ctx.now || Date.now()).toISOString(),
    kind: SAFE_KINDS[kind] ? kind : 'error',
    name: name,
    code: code,
    at: where(info.stack || info.file, info.line),
    screen: typeof ctx.screen === 'string' && /^[a-z0-9_-]{1,24}$/i.test(ctx.screen) ? ctx.screen : '',
    online: ctx.online !== false,
    app: APP_VERSION,
    v: ctx.versions || {}
  };
}

function createReporter(env) {
  env = env || {};
  var events = [], sent = 0, seen = {};
  function ctx() {
    var c = { now: env.now ? env.now() : Date.now(), online: env.online ? env.online() : true,
      screen: env.screen ? env.screen() : '', versions: env.versions ? env.versions() : {} };
    return c;
  }
  function report(kind, info) {
    var ev = redact(kind, info, ctx());
    var dk = ev.kind + '|' + ev.name + '|' + ev.code + '|' + ev.at;
    if (seen[dk] >= 3) return null;               // a render loop must not flood the buffer or the endpoint
    seen[dk] = (seen[dk] || 0) + 1;
    events.push(ev); if (events.length > MAX_EVENTS) events.shift();
    if (env.send && sent < MAX_SENT_PER_SESSION) { sent++; try { env.send(ev); } catch (e) {} }
    return ev;
  }
  return { report: report, events: function () { return events.slice(); }, clear: function () { events = []; seen = {}; sent = 0; },
    diagnostics: function () { return JSON.stringify({ app: APP_VERSION, events: events }, null, 2); } };
}

/* Retry only transient failures (network, timeout, 5xx, 429). Never retry auth/validation/RLS errors. */
function isTransient(err) {
  if (!err) return false;
  var m = String((err && (err.message || err.code)) || err), st = err && err.status;
  if (st === 429 || (st >= 500 && st < 600)) return true;
  return /failed to fetch|network|load failed|timeout|timed out|temporar|fetch/i.test(m) && !/jwt|permission|policy|violates|invalid/i.test(m);
}

/* run() must return a Promise resolving {error: null|string, transient?: bool}. Resolves the last result. */
function retry(run, opts) {
  opts = opts || {};
  var tries = opts.tries || 3, base = opts.baseMs || 600, sleep = opts.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var onAttempt = opts.onAttempt || function () {};
  function go(n) {
    return Promise.resolve().then(run).then(function (r) { return r; }, function (e) { return { error: 'Network error', transient: isTransient(e) || true }; }).then(function (r) {
      onAttempt(n, r);
      if (r && !r.error) return r;
      if (!(r && r.transient) || n >= tries || (opts.canRetry && !opts.canRetry())) return r;
      return sleep(Math.min(base * Math.pow(2, n - 1), 8000) + (opts.jitter ? opts.jitter() : 0)).then(function () { return go(n + 1); });
    });
  }
  return go(1);
}

/* Coalesce: while a task with `key` is running, further calls share ONE follow-up run (latest wins). Duplicate clicks / rapid saves
   produce at most one in-flight request and one trailing request. The sync itself is an upsert keyed by user_id, so replays are harmless. */
function createCoalescer() {
  var running = {}, trailing = {};
  function noop() {}
  return function coalesce(key, task) {
    if (running[key]) {
      if (!trailing[key]) {
        trailing[key] = { task: task };
        trailing[key].promise = running[key].catch(noop).then(function () { var t = trailing[key].task; trailing[key] = null; return coalesce(key, t); });
      } else trailing[key].task = task;     // latest wins
      return trailing[key].promise;
    }
    var p = Promise.resolve().then(task).then(function (r) { delete running[key]; return r; }, function (e) { delete running[key]; throw e; });
    running[key] = p;
    return p;
  };
}

/* Run a heavy optional computation; on throw/timeout-like failure return the fallback and report. */
function withFallback(fn, fallback, onError) {
  try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { try { if (onError) onError(e); } catch (_) {} return fallback; }
}

var PsycheOps = { APP_VERSION: APP_VERSION, requestId: requestId, where: where, redact: redact, createReporter: createReporter,
  isTransient: isTransient, retry: retry, createCoalescer: createCoalescer, withFallback: withFallback };

/* ---- browser wiring (skipped under node/vm tests that have no window.addEventListener) ---- */
if (root && typeof root.addEventListener === 'function' && root.document) {
  var cfg = root.PSYCHE_CONFIG || {};
  var url = typeof cfg.TELEMETRY_URL === 'string' && /^https:\/\//.test(cfg.TELEMETRY_URL) ? cfg.TELEMETRY_URL : '';
  var reporter = createReporter({
    online: function () { return root.navigator ? root.navigator.onLine !== false : true; },
    screen: function () { try { return root.PsycheOps.screenName ? root.PsycheOps.screenName() : ''; } catch (e) { return ''; } },
    versions: function () { try { var V = root.ProfileSchema && root.ProfileSchema.VERSIONS; return V ? JSON.parse(JSON.stringify(V)) : {}; } catch (e) { return {}; } },
    send: url ? function (ev) { try { var b = JSON.stringify(ev); if (root.navigator.sendBeacon) root.navigator.sendBeacon(url, b); } catch (e) {} } : null
  });
  root.addEventListener('error', function (e) { reporter.report('error', { name: e && e.error && e.error.name, file: e && e.filename && String(e.filename).split('/').pop().split('?')[0], line: e && e.lineno }); });
  root.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; reporter.report('rejection', { name: r && r.name, stack: r && typeof r.stack === 'string' ? r.stack : '' }); });
  PsycheOps.reporter = reporter;
  PsycheOps.report = reporter.report;
  PsycheOps.sync = createCoalescer();
  PsycheOps.screenName = null;
  /* Lightweight timing: load -> first interactive screen; exposed for the diagnostics copy and the perf e2e. */
  try { root.addEventListener('load', function () { var n = root.performance && root.performance.getEntriesByType && root.performance.getEntriesByType('navigation')[0]; if (n) PsycheOps.loadMs = Math.round(n.loadEventEnd - n.startTime); }); } catch (e) {}
}

if (typeof module !== 'undefined' && module.exports) module.exports = PsycheOps;
root.PsycheOps = PsycheOps;
})(typeof window !== 'undefined' ? window : globalThis);
