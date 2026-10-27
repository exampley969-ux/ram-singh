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
  if (/schema cache|does not exist|could not find the (table|function)/i.test(m)) return 'Compatibility and groups are not set up yet — the site owner needs to run supabase/social.sql once.';
  // Short, user-actionable validation messages are safe to show; anything else could expose internals, so it is replaced.
  if (/^(password should|new password should|password is known to be weak|unable to validate email address|signups? (not allowed|are disabled)|email address .* is invalid)/i.test(m) && m.length < 160) return m;
  return 'Something went wrong. Please try again in a moment.';
}

function isTransientErr(e) { var m = String((e && (e.message || e.code)) || ''); return /failed to fetch|network|load failed|timeout|timed out|temporar/i.test(m) && !/jwt|permission|policy|violates|invalid/i.test(m); }

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
  configuredButUnavailable: configured && !client,

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
        // Never reveal whether an email is already registered: both an explicit and an obfuscated duplicate look like a new sign-up.
        if (r.error && /already registered|already been registered/i.test(r.error.message || '')) return { needsConfirm: true };
        if (r.error) return { error: msg(r.error) };
        if (r.data && r.data.user && r.data.user.identities && r.data.user.identities.length === 0) return { needsConfirm: true };
        return { needsConfirm: !(r.data && r.data.session) };
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
      .then(function (r) {
        if (r.error) return { error: msg(r.error) };
        // A changed password must end every OTHER session (a stolen or forgotten session should not survive it). Best effort.
        return client.auth.signOut({ scope: 'others' }).then(function () { return { error: null }; }, function () { return { error: null }; });
      }, function (e) { return { error: msg(e) }; });
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
      .then(function (r) { return { error: msg(r.error), transient: !!r.error && (isTransientErr(r.error) || r.status >= 500 || r.status === 429) }; },
            function (e) { return { error: msg(e), transient: true }; });   // a rejected promise is a network-level failure
  },
  deleteResult: function (userId) {
    return client.from('assessment_results').delete().eq('user_id', userId)
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },

  // Atomic: removes the saved result AND clears the scores in the shared profile in one database transaction (needs supabase/phase5-hardening.sql).
  deleteMyResult: function () {
    return client.rpc('delete_my_result').then(function (r) {
      if (!r.error) return {};
      if (/could not find the function|schema cache|does not exist/i.test(r.error.message || '')) return { missing: true };
      return { error: msg(r.error) };
    }, function (e) { return { error: msg(e) }; });
  },

  // ---- profile: display name + scores, visible only to accepted connections / group members ----
  loadProfile: function (userId) {
    return client.from('profiles').select('display_name').eq('user_id', userId).maybeSingle()
      .then(function (r) { return r.error ? { error: msg(r.error) } : { name: r.data ? r.data.display_name : null }; },
            function (e) { return { error: msg(e) }; });
  },
  saveProfile: function (userId, email, name, result) {
    var row = {
      user_id: userId, email: String(email || '').toLowerCase(), display_name: name,
      dims: result ? result.dims : null, facets: result ? result.facets : null, arch_key: result ? result.match.key : null,
      updated_at: new Date().toISOString()
    };
    return client.from('profiles').upsert(row).then(function (r) {
      // If social.sql hasn't been re-run yet (no `facets` column), retry without it so the basic profile still saves.
      if (r.error && /facets/i.test(r.error.message || '')) {
        delete row.facets;
        return client.from('profiles').upsert(row);
      }
      return r;
    }).then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },
  deleteProfile: function (userId) {
    return client.from('profiles').delete().eq('user_id', userId)
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },

  // ---- everything the signed-in user can see: connections, groups, members, and visible profiles ----
  loadSocial: function () {
    function q(t) { return client.from(t).select('*'); }
    return Promise.all([q('connections'), q('groups'), q('group_members')]).then(function (rs) {
      for (var i = 0; i < rs.length; i++) if (rs[i].error) return { error: msg(rs[i].error) };
      var conns = rs[0].data || [], groups = rs[1].data || [], members = rs[2].data || [];
      var seen = {}, ids = [];
      conns.forEach(function (c) { [c.requester_id, c.addressee_id].forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; ids.push(x); } }); });
      members.forEach(function (m) { if (m.user_id && !seen[m.user_id]) { seen[m.user_id] = 1; ids.push(m.user_id); } });
      if (!ids.length) return { connections: conns, groups: groups, members: members, profiles: {} };
      var sel = function (cols) { return client.from('profiles').select(cols).in('user_id', ids); };
      return sel('user_id,display_name,dims,facets,arch_key').then(function (pr) {
        return (pr.error && /facets/i.test(pr.error.message || '')) ? sel('user_id,display_name,dims,arch_key') : pr;
      }).then(function (pr) {
        if (pr.error) return { error: msg(pr.error) };
        var profiles = {};
        (pr.data || []).forEach(function (p) { profiles[p.user_id] = p; });
        return { connections: conns, groups: groups, members: members, profiles: profiles };
      });
    }).then(function (x) { return x; }, function (e) { return { error: msg(e) }; });
  },

  // ---- 1:1 connections ----
  inviteByEmail: function (user, name, email) {
    return client.from('connections').insert({
      requester_id: user.id, requester_email: String(user.email).toLowerCase(), requester_name: name,
      invitee_email: String(email).trim().toLowerCase()
    }).then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },
  createLink: function (user, name) {
    return client.from('connections').insert({
      requester_id: user.id, requester_email: String(user.email).toLowerCase(), requester_name: name
    }).select('token').single().then(function (r) {
      return r.error ? { error: msg(r.error) } : { token: r.data.token };
    }, function (e) { return { error: msg(e) }; });
  },
  acceptConnection: function (id) {
    return client.rpc('accept_connection', { p_id: id }).then(function (r) {
      return r.error ? { error: msg(r.error) } : (r.data ? {} : { error: 'That invitation is no longer available.' });
    }, function (e) { return { error: msg(e) }; });
  },
  acceptLink: function (token) {
    return client.rpc('accept_link', { p_token: token }).then(function (r) {
      return r.error ? { error: msg(r.error) } : (r.data ? {} : { error: 'This link is invalid, was already used, or is your own link.' });
    }, function (e) { return { error: msg(e) }; });
  },
  removeConnection: function (id) {
    return client.from('connections').delete().eq('id', id)
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },

  // ---- groups ----
  createGroup: function (name) {
    return client.rpc('create_group', { p_name: name }).then(function (r) {
      return r.error ? { error: msg(r.error) } : { id: r.data };
    }, function (e) { return { error: msg(e) }; });
  },
  inviteToGroup: function (groupId, email) {
    return client.from('group_members').insert({ group_id: groupId, email: String(email).trim().toLowerCase() })
      .then(function (r) {
        if (r.error && /duplicate|unique/i.test(r.error.message || '')) return { error: 'That email is already in this group.' };
        return { error: msg(r.error) };
      }, function (e) { return { error: msg(e) }; });
  },
  acceptGroup: function (groupId) {
    return client.rpc('accept_group_invite', { p_gid: groupId }).then(function (r) {
      return r.error ? { error: msg(r.error) } : (r.data ? {} : { error: 'That invitation is no longer available.' });
    }, function (e) { return { error: msg(e) }; });
  },
  removeGroupMember: function (groupId, email) {
    return client.from('group_members').delete().eq('group_id', groupId).eq('email', String(email).toLowerCase())
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },
  renameGroup: function (groupId, name) {
    return client.from('groups').update({ name: String(name).trim().slice(0, 80) }).eq('id', groupId)
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  },
  // Permanently deletes the signed-in user's account and all their data (needs supabase/social.sql, see delete_my_account()).
  deleteAccount: function () {
    return client.rpc('delete_my_account').then(function (r) {
      if (r.error) return { error: /could not find the function|schema cache|does not exist/i.test(r.error.message || '') ? 'Account deletion is not set up yet — the site owner needs to re-run supabase/social.sql once.' : msg(r.error) };
      // The user no longer exists server-side; clear the local session without calling the server.
      return client.auth.signOut({ scope: 'local' }).then(function () { return {}; }, function () { return {}; });
    }, function (e) { return { error: msg(e) }; });
  },
  deleteGroup: function (groupId) {
    return client.from('groups').delete().eq('id', groupId)
      .then(function (r) { return { error: msg(r.error) }; }, function (e) { return { error: msg(e) }; });
  }
};

window.PsycheAuth = PsycheAuth;
})();
