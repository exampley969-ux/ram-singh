/* ============================================================
   PsychePrivacy (Phase 5) — the single place that knows what Psyche Core keeps in the browser.
   - KEYS lists every localStorage key the app writes (mirrored in docs/DATA_INVENTORY.md; tests/security.test.js
     fails if app code writes a key that is not listed here).
   - wipeLocal() removes everything personal. Theme and "intro seen" are kept by default because they are not personal data.
   - Pure functions over a Storage-like object so they can be tested without a browser.
   ============================================================ */
(function (root) {
'use strict';

var KEYS = {
  state:    { key: 'psyche_core_v1',          personal: true,  what: 'latest result (scores, archetype, raw answers), result time, owner id, theme, intro flag' },
  draft:    { key: 'psyche_core_v1_draft',    personal: true,  what: 'answers of an unfinished assessment' },
  rejected: { key: 'psyche_core_v1_rejected', personal: true,  what: 'copy of a saved result that failed validation (kept for recovery)' },
  feedback: { key: 'psyche_feedback_v1',      personal: true,  what: 'accurate / partly / inaccurate ratings and optional notes on insights' },
  join:     { key: 'psyche_pending_join_v1',  personal: true,  what: 'share-link token waiting for sign-in' }
};
var STATE_KEY = KEYS.state.key;
var SESSION_RE = /^sb-.+-auth-token(-code-verifier)?$/;   // supabase-js session keys

function personalKeys() { return Object.keys(KEYS).filter(function (k) { return KEYS[k].personal; }).map(function (k) { return KEYS[k].key; }); }

function readState(storage) {
  try { var o = JSON.parse(storage.getItem(STATE_KEY)); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; }
}

/* Remove all personal data. opts.keepPrefs (default true): keep only {theme, introSeen} in the state key.
   opts.session (default false): also remove supabase session keys (normally supabase-js signOut does this). */
function wipeLocal(storage, opts) {
  opts = opts || {};
  var keepPrefs = opts.keepPrefs !== false, prefs = null, removed = [];
  if (!storage) return removed;
  if (keepPrefs) {
    var s = readState(storage);
    if (s) { prefs = {}; if (s.theme === 'light' || s.theme === 'dark') prefs.theme = s.theme; if (s.introSeen === true) prefs.introSeen = true; }
  }
  personalKeys().forEach(function (k) { try { if (storage.getItem(k) !== null) { storage.removeItem(k); removed.push(k); } } catch (e) {} });
  if (opts.session) {
    var names = [];
    try { for (var i = 0; i < storage.length; i++) names.push(storage.key(i)); } catch (e) {}
    names.forEach(function (n) { if (SESSION_RE.test(n)) { try { storage.removeItem(n); removed.push(n); } catch (e) {} } });
  }
  if (prefs && Object.keys(prefs).length) { try { storage.setItem(STATE_KEY, JSON.stringify(prefs)); } catch (e) {} }
  return removed;
}

/* A saved result is "owned" by the account it was last synced for. Anonymous results have no owner and are adopted by the first
   account that signs in on this device; a result owned by someone else must never be uploaded into a different account. */
function ownedByOther(owner, userId) { return !!owner && !!userId && String(owner) !== String(userId); }

var api = { KEYS: KEYS, personalKeys: personalKeys, wipeLocal: wipeLocal, ownedByOther: ownedByOther };
root.PsychePrivacy = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
