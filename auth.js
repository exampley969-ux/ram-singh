/* ============================================================
   PsycheAuth — thin wrapper over supabase-js.
   If config.js still has placeholders (or the supabase-js CDN script
   failed to load) PsycheAuth.enabled is false and the app runs in its
   original offline, no-account mode.
   ============================================================ */
(function () {
'use strict';

var cfg = window.PSYCHE_CONFIG || {};
var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) &&
  !/YOUR-/i.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY);
var client = null;

if (configured && window.supabase && window.supabase.createClient) {
  try {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
    });
  } catch (e) { client = null; }
}

function redirectUrl() { return window.location.origin + window.location.pathname; }
function msg(error) {
  if (!error) return null;
  var m = error.message || String(error);
  if (/invalid login credentials/i.test(m)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first — check your inbox for the link.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a minute and try again.';
  if (/already registered|already been registered/i.test(m)) return 'An account with that email already exists. Try signing in.';
  return m;
}

// Errors Supabase puts in the URL when an email link is expired/invalid.
function urlError() {
  try {
    var src = window.location.hash.replace(/^#/, '') + '&' + window.location.search.replace(/^\?/, '');
    var p = new URLSearchParams(src);
    var d = p.get('error_description');
    if (d) return d.replace(/\+/g, ' ');
  } catch (e) {}
  return null;
}

var PsycheAuth = {
  enabled: !!client,

  // cb(event, user|null). Events: 'INITIAL', 'SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY', 'USER_UPDATED', 'TOKEN_REFRESHED'
  init: function (cb) {
    if (!client) return;
    client.auth.onAuthStateChange(function (event, session) {
      // Never call supabase APIs synchronously inside this callback (can deadlock) — defer.
      setTimeout(function () { cb(event === 'INITIAL_SESSION' ? 'INITIAL' : event, session ? session.user : null); }, 0);
    });
  },
  urlError: urlError,

  signUp: function (email, password) {
    return client.auth.signUp({ email: email, password: password, options: { emailRedirectTo: redirectUrl() } })
      .then(function (r) {
        if (r.error) return { error: msg(r.error) };
        // Obfuscated duplicate: Supabase returns a user with no identities when the email already exists.
        if (r.data.user && r.data.user.identities && r.data.user.identities.length === 0)
          return { error: 'An account with that email already exists. Try signing in.' };
        return { needsConfirm: !r.data.session };
      }, function (e) { return { error: msg(e) }; });
  },
  signIn: function (email, password) {
    return client.auth.signInWithPassword({ email: email, password: password })
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },
  signInWithGoogle: function () {
    return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } })
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },
  signOut: function () {
    return client.auth.signOut().then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },
  sendReset: function (email) {
    return client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() })
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },
  updatePassword: function (password) {
    return client.auth.updateUser({ password: password })
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },

  // ---- cloud copy of the assessment result (one row per user, protected by RLS) ----
  loadResult: function () {
    return client.from('assessment_results').select('result,result_at').maybeSingle()
      .then(function (r) {
        if (r.error) return { error: msg(r.error) };
        return r.data ? { result: r.data.result, at: Date.parse(r.data.result_at) || 0 } : { result: null };
      }, function (e) { return { error: msg(e) }; });
  },
  saveResult: function (userId, result, at) {
    var iso = new Date(at || Date.now()).toISOString();
    return client.from('assessment_results')
      .upsert({ user_id: userId, result: result, result_at: iso, updated_at: new Date().toISOString() })
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },
  deleteResult: function (userId) {
    return client.from('assessment_results').delete().eq('user_id', userId)
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  }
};

window.PsycheAuth = PsycheAuth;
})();
