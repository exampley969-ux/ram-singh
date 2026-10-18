/* ============================================================
   PSYCHE CORE — pure personality-analysis build
   Stripped from Psyche v57.2: kept the assessment, PRISM scoring,
   36-archetype classification, 20-facet breakdown, signature-trait
   synthesis, Career Fit, and Relationship Style — all deterministic,
   all client-side, nothing sent anywhere.
   Auth: optional Supabase accounts (see auth.js / config.js) sync the result.
   Deliberately removed: Journal/Growth history,
   Braindump, CBT Coach, Compatibility/Match, Group Session, Conflict
   Decoder (that one only ever existed as a two-person/compatibility
   feature in the source app — there's no personal-only version of it).
   ============================================================ */
(function () {
'use strict';

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

/* ---------------- RADAR CHART (Compatibility) ---------------- */
function radarSVG(a, b, an, bn, size) {
  size = size || 220;
  var cx = size / 2, cy = size / 2, R = size / 2 - 34, n = DIM_ORDER.length;
  function ptAbs(i, r) { var ang = (-90 + i * (360 / n)) * Math.PI / 180; return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]; }
  function poly(dimsObj) { return DIM_ORDER.map(function (d, i) { var p = ptAbs(i, R * (dimsObj[d] / 100)); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  var rings = [0.25, 0.5, 0.75, 1].map(function (f) {
    var pts = DIM_ORDER.map(function (_, i) { var p = ptAbs(i, R * f); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    return '<polygon points="' + pts + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
  }).join('');
  var axes = DIM_ORDER.map(function (d, i) {
    var p = ptAbs(i, R);
    return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>';
  }).join('');
  var labels = DIM_ORDER.map(function (d, i) {
    var p = ptAbs(i, R + 16);
    return '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" font-size="10" font-weight="700" fill="var(--faint)" text-anchor="middle" dominant-baseline="middle">' + d + '</text>';
  }).join('');
  var polyA = '<polygon points="' + poly(a) + '" fill="var(--ink)" fill-opacity="0.16" stroke="var(--ink)" stroke-width="2"/>';
  var polyB = '<polygon points="' + poly(b) + '" fill="var(--S)" fill-opacity="0.14" stroke="var(--S)" stroke-width="2" stroke-dasharray="4,3"/>';
  var legend = '<div class="row center mt8" style="justify-content:center;gap:16px;font-size:11px;color:var(--faint)">' +
    '<span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--ink);margin-right:5px"></span>' + esc(an) + '</span>' +
    '<span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--S);margin-right:5px;border:1px dashed var(--S)"></span>' + esc(bn) + '</span></div>';
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' + rings + axes + polyA + polyB + labels + '</svg>' + legend;
}

var FACET_DOMAINS = {
  'P.abstraction': 'how you take in information', 'P.curiosity': 'how you relate to novelty',
  'P.attention': 'how wide your attention spreads', 'P.intuition': 'how you extract meaning from a situation',
  'R.tempo': 'how fast you act on new information', 'R.expression': 'how openly you show what you feel',
  'R.adaptability': 'how you handle a changed plan', 'R.risk': 'how you weigh a bet before taking it',
  'I.autonomy': 'whose judgment you steer by', 'I.conviction': 'how firmly you hold a belief',
  'I.distinct': 'whether you aim to stand apart or belong', 'I.stability': 'how stable your self-view is across contexts',
  'S.warmth': 'how you lead with people', 'S.gregarious': 'where you recharge',
  'S.empathy': 'how you read other people\u2019s states', 'S.harmony': 'how you handle group friction',
  'M.drive': 'what keeps you reaching for more', 'M.discipline': 'how you structure your effort',
  'M.ambition': 'how big you aim', 'M.persistence': 'how you sustain effort over time',
};

function buildFacetDefs() {
  var out = {};
  DIM_ORDER.forEach(function (d) {
    Object.keys(DIMS[d].facets).forEach(function (fk) {
      var key = d + '.' + fk, fac = DIMS[d].facets[fk];
      out[key] = { domain: FACET_DOMAINS[key] || ('your ' + fac.name.toLowerCase()), hi: fac.hi, lo: fac.lo };
    });
  });
  return out;
}

var STORE_KEY = 'psyche_core_v1';
function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; } }
function save(state) { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }

function prefersDark() {
  try { return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; }
  catch (e) { return false; }
}

var state = Object.assign({
  screen: 'home',      // home | assessment | results
  qIndex: 0,
  answers: [],
  result: null,         // { dims, facets, match, quality }
  theme: (prefersDark() ? 'dark' : 'light'),
  resultsTab: 'profile', // profile | facets | career | relationship
  // --- accounts-based compare + groups (never persisted; loaded from Supabase after sign-in) ---
  social: { loaded: false, connections: [], groups: [], members: [], profiles: {} },
  socialMsg: null, socialBusy: false, displayName: '', nameReady: false,
  compareWith: null, activeGroup: null, inviteDraft: '', groupNameDraft: '', groupInviteDraft: '',
  scienceTab: 'model',  // model | items | scoring | quality | archetype | compat | limits
  // --- auth (never persisted) ---
  user: null, authMode: 'signin', authEmail: '', authBusy: false, authError: null, authNotice: null,
  syncStatus: null      // null | 'saving' | 'saved' | 'error'
}, load());
var AUTH = window.PsycheAuth || { enabled: false };

function persist() { save({ result: state.result, resultAt: state.resultAt || 0, theme: state.theme }); }

function applyTheme() { document.documentElement.setAttribute('data-theme', state.theme); }

/* ---------------- SCORING PIPELINE ---------------- */
function computeResult(answers) {
  var scored = Engine.score(answers);
  var quality = Engine.quality(answers);
  var match = Engine.match(scored.dims, quality);
  return { dims: scored.dims, facets: scored.facets, match: match, quality: quality };
}

/* ---------------- RENDER ROOT ---------------- */
function render() {
  applyTheme();
  var el = document.getElementById('app');
  if (state.screen === 'home') el.innerHTML = viewHome();
  else if (state.screen === 'assessment') el.innerHTML = viewAssessment();
  else if (state.screen === 'results') el.innerHTML = viewResults();
  else if (state.screen === 'archlib') el.innerHTML = viewArchLibrary();
  else if (state.screen === 'archdetail') el.innerHTML = viewArchDetail();
  else if (state.screen === 'compare') el.innerHTML = viewCompare();
  else if (state.screen === 'group') el.innerHTML = viewGroup();
  else if (state.screen === 'science') el.innerHTML = viewScience();
  else if (state.screen === 'glossary') el.innerHTML = viewGlossary();
  else if (state.screen === 'auth') el.innerHTML = viewAuth();
  else if (state.screen === 'account') el.innerHTML = viewAccount();
  else if (state.screen === 'recovery') el.innerHTML = viewRecovery();
  window.scrollTo(0, 0);
  wireActions();
}

function topbar(title, backAct) {
  return '<div class="topbar">' +
    '<div class="row center" style="gap:10px">' +
      (backAct ? '<button class="iconbtn" data-act="' + backAct + '" aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' : '') +
      '<div class="wordmark">' + (title ? esc(title) : 'Psyche <span class="mono" style="font-weight:400;color:var(--faint);font-size:12px">Core</span>') + '</div>' +
    '</div>' +
    '<div class="row center" style="gap:8px">' +
    (AUTH.enabled
      ? '<button class="iconbtn' + (state.user ? ' signedin' : '') + '" data-act="account" aria-label="' + (state.user ? 'Account' : 'Sign in') + '"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></button>'
      : '') +
    '<button class="iconbtn" data-act="toggletheme" aria-label="Toggle theme">' +
      (state.theme === 'dark'
        ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>') +
    '</button></div></div>';
}

/* ---------------- HOME (doubles as the full app overview \u2014 first thing anyone sees) ---------------- */
function viewHome() {
  var hasResult = !!state.result;

  var feature = function (opts) {
    return '<div class="card mt14" style="border-left:3px solid ' + opts.dot + '">' +
      '<div class="row between center">' +
        '<b style="font-size:15px">' + esc(opts.title) + '</b>' +
      '</div>' +
      '<p class="sub mt6" style="font-size:13px">' + opts.body + '</p>' +
      (opts.extra || '') +
      '<button class="linkbtn mt8" style="padding:0;font-weight:650;color:var(--ink)" data-act="' + opts.act + '"' + (opts.sciTab ? ' data-sci="' + opts.sciTab + '"' : '') + '>' + esc(opts.actLabel) + ' \u2192</button>' +
    '</div>';
  };

  var sampleKeys = ['PRISM', 'PURE_M', 'PI', 'RS', 'IS', 'PURE_S'];
  var archSample = sampleKeys.map(function (key) {
    var arche = archeByKey(key), meta = archeMeta(key);
    var color = meta.lead ? DIMS[meta.lead].color : 'var(--accent)';
    return '<div class="card mt10" data-act="archopen" data-key="' + key + '" style="cursor:pointer;border-left:3px solid ' + color + '">' +
      '<div class="row between center">' +
        '<b style="font-size:13.5px">' + esc(arche.name) + '</b>' +
        '<span class="mono" style="font-size:10px;color:var(--faint)">' + esc(meta.code) + '</span>' +
      '</div>' +
      '<p class="sub mt6" style="font-size:12px">' + esc(arche.tag) + '</p>' +
    '</div>';
  }).join('');

  var sciChips = [['model', 'The model'], ['items', 'Item design'], ['scoring', 'Scoring'], ['quality', 'Response quality'], ['archetype', 'Archetypes'], ['compat', 'Compatibility math'], ['limits', 'Limitations']]
    .map(function (t) { return '<span class="pill" style="cursor:pointer" data-act="science" data-sci="' + t[0] + '">' + esc(t[1]) + '</span>'; }).join('');

  return topbar() +
    '<div class="wrap">' +
      '<div class="hero">' +
        '<h1>A personality instrument,<br>not a personality quiz.</h1>' +
        '<p class="sub">40 questions across five dimensions — Perception, Response, Identity, Social, Motivation — mapped to 36 archetypes and 20 underlying facets. Every result is generated from your actual answers, not picked from a template. This page is a map of everything Psyche Core does, with a direct link into each part.</p>' +
        '<div class="factrow">' +
          '<div class="fact"><b>5</b><span>Dimensions</span></div>' +
          '<div class="fact"><b>20</b><span>Facets</span></div>' +
          '<div class="fact"><b>36</b><span>Archetypes</span></div>' +
          '<div class="fact"><b>~4</b><span>Minutes</span></div>' +
        '</div>' +
        '<button class="btn primary block mt18" data-act="start">Take the PRISM test</button>' +
        (hasResult ? '<button class="btn ghost block mt10" data-act="goresults">See your last result</button>' : '') +
        (AUTH.enabled && !state.user ? '<p class="sub mt12" style="font-size:12.5px;text-align:center"><button class="linkbtn" style="padding:0;font-weight:650;color:var(--ink)" data-act="account">Sign in or create an account</button> to keep your result across devices.</p>' : '') +
      '</div>' +

      '<div class="eb mt24">1 \u00b7 The assessment</div>' +
      feature({
        title: '40-question PRISM assessment', dot: 'var(--P)',
        body: 'A 5-point Likert-scale assessment, 2 questions per facet, fully deterministic \u2014 the same answers always produce the same scores. Mixed positively- and negatively-keyed items reduce the tendency to just agree with everything. Takes about 4 minutes.',
        actLabel: hasResult ? 'Retake the assessment' : 'Begin the assessment', act: 'start'
      }) +

      '<div class="eb mt24">2 \u00b7 Your results</div>' +
      feature({
        title: 'Profile, 20 facets & Deep Analysis', dot: 'var(--R)',
        body: 'Your 5 dimension scores and all 20 underlying facets, plus a Deep Analysis tab covering 9 large NLP-generated sections \u2014 Strength, Weakness, Misunderstood-as, Shadow, Emotional & Logical side, Social side, Dark traits, and At-Best vs. Under-Stress \u2014 built fresh from your actual scores, not picked from a fixed list. Career and Relationship tabs go deep on those two areas specifically, and a one-click PDF export bundles the whole thing into a printable report.',
        actLabel: hasResult ? 'See your result' : 'Take the assessment first', act: hasResult ? 'goresults' : 'start'
      }) +

      '<div class="eb mt24">3 \u00b7 Archetype library</div>' +
      feature({
        title: '36 archetypes, browsable without testing', dot: 'var(--I)',
        body: 'Every one of the 36 possible archetypes \u2014 the balanced Prism type, 5 "Pure" single-dimension types, 10 "Twin" evenly-blended types, and 20 two-dimension blends \u2014 gets the exact same full generative treatment as your own result (Deep Analysis, Career, Relationships), built from a representative exemplar score profile and clearly labeled as illustrative.',
        actLabel: 'Explore all 36 archetypes', act: 'archlib',
        extra: '<div class="mt10">' + archSample + '</div><p class="sub mt10" style="font-size:11.5px;color:var(--faint)">A sample of six \u2014 tap any card to open it, or see the full library below.</p>'
      }) +

      '<div class="eb mt24">4 \u00b7 Compare with someone</div>' +
      feature({
        title: 'Compatibility \u2014 connect through accounts', dot: 'var(--S)',
        body: 'Sign in, then connect with another person by email invite or a one-time share link. Once they accept, you get an overall score, a trait-by-trait breakdown across all 5 dimensions, conflict style and an archetype pairing \u2014 built only from the scores you each chose to share (never your answers).',
        actLabel: AUTH.enabled ? 'Compare with someone' : (hasResult ? 'Compare with someone' : 'Take the assessment first'), act: (AUTH.enabled || hasResult) ? 'compare' : 'start'
      }) +

      '<div class="eb mt24">5 \u00b7 Group & team comparison</div>' +
      feature({
        title: 'The same analysis, extended to a whole group', dot: 'var(--M)',
        body: 'Create a group, invite people by email, and once they join get a team-level read: the group\u2019s averaged profile run through a synthetic "team archetype," which dimension is most aligned vs. most scattered, the full pairwise matrix, and the strongest and widest pairing. Same math as 1:1 Compatibility, applied to every pair at once.',
        actLabel: AUTH.enabled ? 'Compare a group / team' : (hasResult ? 'Compare a group / team' : 'Take the assessment first'), act: (AUTH.enabled || hasResult) ? 'group' : 'start'
      }) +

      '<div class="eb mt24">6 \u00b7 The science behind it</div>' +
      feature({
        title: 'Scientific breakdown \u2014 how every number is computed', dot: 'var(--P)',
        body: 'A tabbed explainer covering the trait model\u2019s academic lineage, item design, the exact scoring formula, how response-quality and confidence are calculated, the archetype classification rules, the compatibility-score formula \u2014 and an honest limitations section on what this tool is and isn\u2019t.',
        actLabel: 'Read the scientific breakdown', act: 'science',
        extra: '<div class="pill-row mt10">' + sciChips + '</div>'
      }) +

      '<div class="eb mt24">7 \u00b7 Reference</div>' +
      feature({
        title: 'Glossary \u2014 every Compatibility & Group term, defined once', dot: 'var(--R)',
        body: 'A consolidated reference for every term used across the comparison tools \u2014 the 5 dimensions, compatibility score tiers, note categories, similarity vs. complementarity, variance, team archetype, natural roles and sub-groupings \u2014 so you\u2019re not re-reading the same explainer cards on every visit.',
        actLabel: 'Open the glossary', act: 'glossary'
      }) +

      '<div class="eb mt24">Made by</div>' +
      '<div class="card mt14"><div class="row center" style="gap:14px">' +
        '<div style="position:relative;width:64px;height:64px;flex:none">' +
          '<div style="position:absolute;inset:0;border-radius:50%;background:var(--ink);color:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px">A</div>' +
          '<img src="profile.jpg" alt="Aryan" width="64" height="64" style="position:absolute;inset:0;width:64px;height:64px;border-radius:50%;object-fit:cover" onerror="this.remove()">' +
        '</div>' +
        '<div><b style="font-size:16px">Aryan</b><div class="mono" style="font-size:12px;color:var(--faint);margin-top:2px">Roll no. 24EBKEC010</div></div>' +
      '</div></div>' +

      '<button class="btn primary block mt24" data-act="start">Take the PRISM test</button>' +
      '<footer class="privacy">' +
        (AUTH.enabled
          ? 'Your answers are scored in this browser. Without an account nothing leaves this device \u2014 your result lives in local storage until you clear it or retake the assessment. If you choose to sign in, only your computed result (scores, facets, archetype) is saved to your private account so it follows you across devices; only you can read it. If you connect with someone or join a group, your display name, 5 scores and archetype become visible to them \u2014 and only them. Sign out any time.'
          : 'Nothing you answer leaves this device. There\u2019s no account, no login, no server this sends data to \u2014 your result lives in this browser\u2019s local storage until you clear it or retake the assessment. Refreshing the page will not lose your result; a private/incognito window will.') +
      '<br><a href="privacy.html" style="color:inherit">Privacy Policy</a> \u00b7 <a href="terms.html" style="color:inherit">Terms of Service</a></footer>' +
    '</div>';
}

/* ---------------- ASSESSMENT ---------------- */
var LIKERT = [
  { v: 1, l: 'Strongly disagree' },
  { v: 2, l: 'Disagree' },
  { v: 3, l: 'Neutral' },
  { v: 4, l: 'Agree' },
  { v: 5, l: 'Strongly agree' }
];

function viewAssessment() {
  var i = state.qIndex, q = QUESTIONS[i], total = QUESTIONS.length;
  var pct = Math.round((i / total) * 100);
  return topbar(null, 'home') +
    '<div class="wrap qwrap">' +
      '<div>' +
        '<div class="row between"><span class="eb">Question ' + (i + 1) + ' of ' + total + '</span><span class="eb">' + pct + '%</span></div>' +
        '<div class="progresstrack mt8"><div class="progressfill" style="width:' + pct + '%"></div></div>' +
        '<div class="qtext mt24">' + esc(q.t) + '</div>' +
        '<div class="likert">' +
          LIKERT.map(function (o) {
            var checked = state.answers[i] === o.v;
            return '<button class="likertbtn" data-act="answer" data-v="' + o.v + '" style="' + (checked ? 'border-color:var(--ink)' : '') + '">' +
              '<span class="num" style="' + (checked ? 'background:var(--ink);color:var(--bg);border-color:var(--ink)' : '') + '">' + o.v + '</span>' + esc(o.l) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="qnav">' +
          (i > 0 ? '<button class="linkbtn" data-act="prevq">\u2190 Back</button>' : '<span></span>') +
          '<button class="linkbtn" data-act="skipq">Skip \u2192</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function answerCurrent(v) {
  state.answers[state.qIndex] = v;
  advanceQuestion();
}
function advanceQuestion() {
  if (state.qIndex + 1 >= QUESTIONS.length) { finishAssessment(); return; }
  state.qIndex++;
  render();
}
function finishAssessment() {
  state.result = computeResult(state.answers);
  state.resultAt = Date.now();
  state.screen = 'results';
  state.resultsTab = 'profile';
  persist();
  render();
  pushResult();
}

/* ---------------- AUTH + CLOUD SYNC ---------------- */
function pushResult() {
  if (!AUTH.enabled || !state.user || !state.result) return Promise.resolve();
  state.syncStatus = 'saving';
  return AUTH.saveResult(state.user.id, state.result, state.resultAt).then(function (r) {
    state.syncStatus = r.error ? 'error' : 'saved';
    if (state.screen === 'account') render();
    return pushProfile();
  });
}

// After sign-in / page load with a session: reconcile the local and cloud copies (newest wins).
function syncAfterLogin() {
  if (!AUTH.enabled || !state.user) return Promise.resolve();
  state.syncStatus = 'saving';
  return AUTH.loadResult().then(function (r) {
    if (r.error) { state.syncStatus = 'error'; return; }
    var localAt = state.resultAt || 0;
    if (r.result && (!state.result || r.at > localAt)) {
      state.result = r.result; state.resultAt = r.at; persist();
      state.syncStatus = 'saved';
    } else if (state.result) {
      if (!state.resultAt) { state.resultAt = Date.now(); persist(); }
      return pushResult();
    } else { state.syncStatus = 'saved'; }
  });
}

function onAuthEvent(event, user) {
  var wasIn = !!state.user;
  state.user = user;
  if (event === 'PASSWORD_RECOVERY') { state.screen = 'recovery'; state.authError = null; state.authNotice = null; render(); return; }
  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
  if (event === 'SIGNED_OUT') {
    resetSocial();
    if (state.screen === 'account' || state.screen === 'compare' || state.screen === 'group') state.screen = 'home';
    if (state.screen !== 'assessment') render();
    return;
  }
  var urlErr = event === 'INITIAL' && !user ? AUTH.urlError() : null;
  if (urlErr) { state.screen = 'auth'; state.authMode = 'signin'; state.authError = urlErr + ' Request a new link below.'; render(); return; }
  if (!user && event === 'INITIAL' && readPendingJoin()) {
    state.screen = 'auth'; state.authMode = 'signin';
    state.authNotice = 'Sign in (or create an account) to accept the invitation to connect.'; render(); return;
  }
  if (user && (!wasIn || event === 'INITIAL')) {
    syncAfterLogin().then(setupSocial).then(function () {
      if (state.screen === 'auth') state.screen = state.result ? 'results' : 'home';
      if (state.screen !== 'assessment') render();
    });
  } else if (state.screen !== 'assessment') render();
}


/* ---------------- ACCOUNT-BASED COMPARE + GROUPS ---------------- */
var PENDING_JOIN_KEY = 'psyche_pending_join_v1';
function siteUrl() { return window.location.origin + window.location.pathname; }
function readPendingJoin() { try { return localStorage.getItem(PENDING_JOIN_KEY); } catch (e) { return null; } }
function writePendingJoin(t) { try { if (t) localStorage.setItem(PENDING_JOIN_KEY, t); else localStorage.removeItem(PENDING_JOIN_KEY); } catch (e) {} }
// A share link looks like  https://site/?join=<token>. Remember the token (it must survive the sign-in redirect) and tidy the URL.
function captureJoinParam() {
  try {
    var p = new URLSearchParams(window.location.search), t = p.get('join');
    if (!t) return;
    if (/^[A-Za-z0-9]{16,128}$/.test(t)) writePendingJoin(t);
    p.delete('join');
    var q = p.toString();
    window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : '') + window.location.hash);
  } catch (e) {}
}
function defaultName(u) {
  var m = (u && u.user_metadata) || {};
  var n = m.full_name || m.name || (u && u.email ? u.email.split('@')[0] : '');
  return String(n).trim().slice(0, 40) || 'Me';
}
function myName() { return state.displayName || (state.user ? defaultName(state.user) : 'You'); }
function userEmail() { return state.user && state.user.email ? String(state.user.email).toLowerCase() : ''; }
function validDims(d) {
  if (!d || typeof d !== 'object') return false;
  return DIM_ORDER.every(function (k) { return typeof d[k] === 'number' && d[k] >= 0 && d[k] <= 100; });
}
function personOf(p, fallbackName) {
  if (!p || !validDims(p.dims)) return null;
  return { name: p.display_name || fallbackName || 'Someone', dims: p.dims, key: p.arch_key };
}
function uniqueName(name, taken) {
  var base = name, n = 2;
  while (taken.indexOf(name) >= 0) { name = base + ' (' + n + ')'; n++; }
  return name;
}
function setSocialMsg(err, ok) { state.socialMsg = err ? { err: err } : ok ? { ok: ok } : null; }
function resetSocial() {
  state.social = { loaded: false, connections: [], groups: [], members: [], profiles: {} };
  state.socialMsg = null; state.socialBusy = false; state.displayName = ''; state.nameReady = false;
  state.compareWith = null; state.activeGroup = null;
}

function refreshSocial() {
  if (!AUTH.enabled || !state.user) return Promise.resolve();
  return AUTH.loadSocial().then(function (r) {
    if (r.error) setSocialMsg(r.error);
    else state.social = { loaded: true, connections: r.connections, groups: r.groups, members: r.members, profiles: r.profiles };
    if (state.screen === 'compare' || state.screen === 'group') render();
  });
}
// Publish my display name + scores so accepted connections / group members can read them (and only them).
function pushProfile() {
  if (!AUTH.enabled || !state.user || !state.nameReady) return Promise.resolve();
  return AUTH.saveProfile(state.user.id, state.user.email, myName(), state.result).then(function (r) {
    if (r.error) setSocialMsg(r.error);
  });
}
function joinPending() {
  var t = readPendingJoin();
  if (!t) return Promise.resolve();
  writePendingJoin(null);
  if (!window.confirm('Connect with the person who sent you this link?\n\nOnce connected you can each see the other’s 5 dimension scores and archetype (never your answers). You can remove the connection any time.')) return Promise.resolve();
  return AUTH.acceptLink(t).then(function (r) {
    if (r.error) setSocialMsg(r.error); else setSocialMsg(null, 'Connected! Tap “Compare” next to their name below.');
    state.screen = 'compare';
  });
}
// After sign-in: load my display name, publish my profile, accept a pending share link, load connections + groups.
function setupSocial() {
  if (!AUTH.enabled || !state.user) return Promise.resolve();
  return AUTH.loadProfile(state.user.id).then(function (r) {
    state.displayName = (r && r.name) || defaultName(state.user);
    state.nameReady = true;
    return pushProfile();
  }).then(joinPending).then(refreshSocial);
}
function doSocial(promise, okMsg, after) {
  state.socialBusy = true; setSocialMsg(null); render();
  promise.then(function (r) {
    if (r.error) setSocialMsg(r.error);
    else { setSocialMsg(null, okMsg); if (after) after(r); }
    return refreshSocial();
  }).then(function () { state.socialBusy = false; render(); });
}

function connectionLists() {
  var uid = state.user.id, em = userEmail();
  var out = { accepted: [], received: [], sent: [] };
  state.social.connections.forEach(function (c) {
    if (c.status === 'accepted') {
      var otherId = c.requester_id === uid ? c.addressee_id : c.requester_id;
      var p = state.social.profiles[otherId];
      out.accepted.push({ id: c.id, name: (p && p.display_name) || (c.requester_id === uid ? (c.invitee_email || 'Connection') : c.requester_name), person: personOf(p) });
    } else if (c.requester_id === uid) out.sent.push(c);
    else if (String(c.invitee_email || '').toLowerCase() === em) out.received.push(c);
  });
  return out;
}
function currentCompareThem() {
  if (!state.user || !state.compareWith) return null;
  var hit = connectionLists().accepted.filter(function (a) { return a.id === state.compareWith; })[0];
  if (!hit || !hit.person) return null;
  return { name: uniqueName(hit.person.name, [myName()]), dims: hit.person.dims, key: hit.person.key };
}
function groupPeople(gid) {
  var out = [], taken = [];
  state.social.members.filter(function (m) { return m.group_id === gid && m.status === 'accepted'; }).forEach(function (m) {
    var isMe = m.user_id === state.user.id;
    var per = isMe && state.result
      ? { name: myName(), dims: state.result.dims, key: state.result.match.key }
      : personOf(state.social.profiles[m.user_id], String(m.email).split('@')[0]);
    if (!per) return;
    per.name = uniqueName(per.name, taken); taken.push(per.name);
    out.push(per);
  });
  return out;
}
function socialGate() {
  if (!AUTH.enabled) return '<div class="card mt14"><div class="eb">Accounts not enabled</div><p class="sub mt8" style="font-size:12.5px">Comparing with other people works through accounts. This copy of Psyche Core has no Supabase project configured (see README), so it runs in offline, single-person mode.</p></div>';
  if (!state.user) return '<div class="card mt14"><div class="eb">Sign in to continue</div><p class="sub mt8" style="font-size:12.5px">Comparing works through accounts: you and the other person each sign in (Google or email), connect by invitation, and nobody sees anyone’s scores until they accept.</p><button class="btn primary block mt12" data-act="account">Sign in / create account</button></div>';
  return '';
}
function socialMsgBox() {
  var m = state.socialMsg;
  return m ? '<div class="msg ' + (m.err ? 'err' : 'ok') + '" role="' + (m.err ? 'alert' : 'status') + '" style="margin-top:14px">' + esc(m.err || m.ok) + '</div>' : '';
}

function authShell(title, body) {
  return topbar(title, 'home') + '<div class="wrap" style="padding-top:8px">' + body + '</div>';
}
function msgBox() {
  return (state.authError ? '<div class="msg err" role="alert">' + esc(state.authError) + '</div>' : '') +
         (state.authNotice ? '<div class="msg ok" role="status">' + esc(state.authNotice) + '</div>' : '');
}
function viewAuth() {
  var m = state.authMode, busy = state.authBusy ? ' disabled' : '';
  var titles = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password' };
  var subs = {
    signin: 'Sign in to load your saved result on this device.',
    signup: 'Free. Save your result and open it from any device. Only your computed scores are stored — never your individual answers.',
    forgot: 'Enter your email and we’ll send a link to choose a new password.'
  };
  var labels = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link' };
  return authShell('Account',
    '<div class="hero" style="padding-top:24px"><h1 style="font-size:28px">' + titles[m] + '</h1><p class="sub">' + subs[m] + '</p></div>' +
    (m !== 'forgot' ? '<button class="btn ghost block mt18" data-act="google"' + busy + '><svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:8px"><path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.1-4.5H2.3v2.8C4.1 20.5 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.9 14.1c-.2-.7-.4-1.400-.4-2.100s.1-1.400.4-2.100V7.100H2.300C1.500 8.600 1 10.200 1 12s.5 3.400 1.300 4.900l3.600-2.800z"/><path fill="#EA4335" d="M12 5.400c1.600 0 3.100.6 4.200 1.600l3.100-3.100C17.400 2.200 15 1 12 1 7.700 1 4.100 3.500 2.300 7.100l3.600 2.800C6.700 7.300 9.100 5.400 12 5.400z"/></svg>Continue with Google</button><div class="eb mt14" style="text-align:center">or use email</div>' : '') +
    '<form id="authForm" class="mt14" novalidate>' +
      '<label class="field"><span>Email</span><input class="input" id="authEmail" type="email" autocomplete="email" inputmode="email" required value="' + esc(state.authEmail) + '"></label>' +
      (m !== 'forgot' ? '<label class="field"><span>Password' + (m === 'signup' ? ' (at least 8 characters)' : '') + '</span><input class="input" id="authPass" type="password" autocomplete="' + (m === 'signup' ? 'new-password' : 'current-password') + '" minlength="8" required></label>' : '') +
      msgBox() +
      '<button class="btn primary block mt18" type="submit"' + busy + '>' + (state.authBusy ? 'Please wait…' : labels[m]) + '</button>' +
    '</form>' +
    '<div class="row mt14" style="justify-content:center;gap:6px;flex-wrap:wrap">' +
      (m === 'signin' ? '<button class="linkbtn" data-act="authmode" data-mode="signup">Create an account</button><button class="linkbtn" data-act="authmode" data-mode="forgot">Forgot password?</button>' : '') +
      (m !== 'signin' ? '<button class="linkbtn" data-act="authmode" data-mode="signin">← Back to sign in</button>' : '') +
    '</div>' +
    '<footer class="privacy">You can keep using Psyche Core without an account — everything works offline in this browser.</footer>');
}
function viewAccount() {
  var u = state.user;
  var status = { saving: 'Syncing…', saved: 'Your result is saved to your account.', error: 'Couldn’t sync just now — your result is still safe on this device. It will retry the next time you finish the test.' }[state.syncStatus] || '';
  return authShell('Account',
    '<div class="hero" style="padding-top:24px"><h1 style="font-size:28px">Your account</h1>' +
      '<p class="sub mono" style="font-size:13px;word-break:break-all">' + esc(u ? u.email : '') + '</p></div>' +
    '<div class="card mt18"><b style="font-size:14px">Saved result</b>' +
      '<p class="sub mt6" style="font-size:13px">' + (state.result ? esc((state.result.match.arche && state.result.match.arche.name) || state.result.match.key || 'Result saved') : 'No result yet — take the test and it will be saved here.') + '</p>' +
      (status ? '<p class="sub mt6" style="font-size:12px;color:var(--faint)">' + esc(status) + '</p>' : '') +
      (state.result ? '<button class="btn ghost block mt12" data-act="goresults">View result</button>' +
        '<button class="linkbtn mt8" style="padding:0" data-act="syncnow">Sync now</button> · <button class="linkbtn mt8" style="padding:0" data-act="deletecloud">Delete my saved copy</button>' : '') +
    '</div>' +
    '<form id="nameForm" class="card mt14" novalidate><b style="font-size:14px">Display name</b>' +
      '<p class="sub mt6" style="font-size:12px;color:var(--faint)">Shown to people you connect with in Compatibility and groups.</p>' +
      '<label class="field"><span>Name</span><input class="input" id="displayNameInput" type="text" maxlength="40" autocomplete="nickname" value="' + esc(myName()) + '"></label>' +
      '<button class="btn ghost block mt12" type="submit"' + (state.authBusy ? ' disabled' : '') + '>Save name</button></form>' +
    '<form id="pwForm" class="card mt14" novalidate><b style="font-size:14px">Change password</b>' +
      '<label class="field"><span>New password (at least 8 characters)</span><input class="input" id="newPass" type="password" autocomplete="new-password" minlength="8" required></label>' +
      msgBox() +
      '<button class="btn ghost block mt12" type="submit"' + (state.authBusy ? ' disabled' : '') + '>Update password</button></form>' +
    '<button class="btn primary block mt24" data-act="signout"' + (state.authBusy ? ' disabled' : '') + '>Sign out</button>');
}
function viewRecovery() {
  return topbar('Reset password') + '<div class="wrap" style="padding-top:8px">' +
    '<div class="hero" style="padding-top:24px"><h1 style="font-size:28px">Choose a new password</h1><p class="sub">You’re signed in via your reset link. Pick a new password to finish.</p></div>' +
    '<form id="recoveryForm" class="mt14" novalidate>' +
      '<label class="field"><span>New password (at least 8 characters)</span><input class="input" id="newPass" type="password" autocomplete="new-password" minlength="8" required></label>' +
      msgBox() +
      '<button class="btn primary block mt18" type="submit"' + (state.authBusy ? ' disabled' : '') + '>Save new password</button>' +
    '</form></div>';
}

function authDone(patch) { state.authBusy = false; Object.assign(state, patch); render(); }
function wireAuthForms() {
  var f = document.getElementById('authForm');
  if (f) f.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('authEmail').value.trim();
    var passEl = document.getElementById('authPass'), pass = passEl ? passEl.value : '';
    state.authEmail = email; state.authError = null; state.authNotice = null;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return authDone({ authError: 'Enter a valid email address.' });
    if (state.authMode !== 'forgot' && pass.length < 8) return authDone({ authError: 'Password must be at least 8 characters.' });
    state.authBusy = true; render();
    var mode = state.authMode;
    var p = mode === 'signup' ? AUTH.signUp(email, pass) : mode === 'forgot' ? AUTH.sendReset(email) : AUTH.signIn(email, pass);
    p.then(function (r) {
      if (r.error) return authDone({ authError: r.error });
      if (mode === 'signup' && r.needsConfirm) return authDone({ authMode: 'signin', authNotice: 'Check ' + email + ' for a confirmation link, then sign in.' });
      if (mode === 'forgot') return authDone({ authMode: 'signin', authNotice: 'If an account exists for ' + email + ', a reset link is on its way.' });
      authDone({}); // signed in — onAuthEvent takes it from here
    });
  });
  var nf = document.getElementById('nameForm');
  if (nf) nf.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = document.getElementById('displayNameInput').value.trim().slice(0, 40);
    state.authError = null; state.authNotice = null;
    if (!v) return authDone({ authError: 'Please enter a name.' });
    state.authBusy = true; render();
    AUTH.saveProfile(state.user.id, state.user.email, v, state.result).then(function (r) {
      if (r.error) return authDone({ authError: r.error });
      state.displayName = v; state.nameReady = true;
      authDone({ authNotice: 'Name updated.' });
    });
  });
  var pw = document.getElementById('pwForm'), rec = document.getElementById('recoveryForm');
  [pw, rec].forEach(function (form) {
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = document.getElementById('newPass').value;
      state.authError = null; state.authNotice = null;
      if (v.length < 8) return authDone({ authError: 'Password must be at least 8 characters.' });
      state.authBusy = true; render();
      AUTH.updatePassword(v).then(function (r) {
        if (r.error) return authDone({ authError: r.error });
        authDone({ authNotice: 'Password updated.', screen: form === rec ? (state.result ? 'results' : 'home') : state.screen });
      });
    });
  });
}

/* ---------------- RESULTS ---------------- */
/* ---------------- ARCHETYPE LIBRARY ---------------- */
var ARCH_KEYS = (function () {
  var keys = ['PRISM'];
  DIM_ORDER.forEach(function (d) { keys.push('PURE_' + d); });
  var pairs = [['P','R'],['P','I'],['P','S'],['P','M'],['R','I'],['R','S'],['R','M'],['I','S'],['I','M'],['S','M']];
  pairs.forEach(function (p) { keys.push('TWIN_' + p[0] + p[1]); });
  DIM_ORDER.forEach(function (primary) {
    DIM_ORDER.forEach(function (secondary) {
      if (primary !== secondary) keys.push(primary + secondary);
    });
  });
  return keys;
})();

function viewArchLibrary() {
  var cards = ARCH_KEYS.map(function (key) {
    var arche = archeByKey(key), meta = archeMeta(key);
    var color = meta.lead ? DIMS[meta.lead].color : 'var(--accent)';
    return '<div class="card mt10" data-act="archopen" data-key="' + key + '" style="cursor:pointer;border-left:3px solid ' + color + '">' +
      '<div class="row between center">' +
        '<b style="font-size:15px">' + esc(arche.name) + '</b>' +
        '<span class="mono" style="font-size:10.5px;color:var(--faint)">' + esc(meta.code) + '</span>' +
      '</div>' +
      '<p class="sub mt6" style="font-size:12.5px">' + esc(arche.tag) + '</p>' +
    '</div>';
  }).join('');

  return topbar('36 archetypes', 'home') +
    '<div class="wrap">' +
      '<div class="eb">Archetype library</div>' +
      '<p class="sub mt8" style="font-size:13px">Every archetype in the PRISM system, explained using a representative profile \u2014 not your own reading. Take the assessment to see where you actually land.</p>' +
      '<div class="mt18">' + cards + '</div>' +
      '<button class="btn ghost block mt24" data-act="home">Back home</button>' +
    '</div>';
}

function viewArchDetail() {
  var key = state.archKey;
  var arche = archeByKey(key), meta = archeMeta(key);
  var dims = Engine.exemplar(key);
  var color = meta.lead ? DIMS[meta.lead].color : 'var(--accent)';
  var c = careerByKey(key), l = relateByKey(key);
  var seedKey = 'exemplar:' + key;
  var profile = generateFullDeepProfile(dims, arche.strengths, arche.shadow, arche.stress, c.fit, c.domains, c.caution, seedKey);

  var dimBars = DIM_ORDER.map(function (d) {
    return '<div class="dimrow"><div class="dimlabel">' + esc(DIMS[d].name) + '</div>' +
      '<div class="dimtrack"><div class="dimfill" style="width:' + dims[d] + '%;background:' + DIMS[d].color + '"></div></div>' +
      '<div class="dimval">' + dims[d] + '</div></div>';
  }).join('');

  var contrastCard = '<div class="card mt18" style="border-top:3px solid var(--ink)">' +
    '<div class="eb">At its best, vs. under sustained stress</div>' +
    '<div class="mt14"><b style="font-size:13px;color:var(--M)">\u2600 At its best</b>' +
    '<p class="sub mt6" style="font-size:13px">' + esc(profile.at_best) + '</p></div>' +
    '<div class="mt18" style="padding-top:14px;border-top:1px solid var(--line)"><b style="font-size:13px;color:var(--S)">\u26a1 Under sustained stress</b>' +
    '<p class="sub mt6" style="font-size:13px">' + esc(profile.under_stress) + '</p></div></div>';

  var rh = profile.relationship_handling;
  var rhCard = '<div class="card mt18"><div class="eb">Relationship handling</div>' +
    rh.sections.map(function (sec) {
      return '<div class="mt10"><b style="font-size:12.5px">' + esc(sec.label) + '</b>' +
        '<p class="sub mt6" style="font-size:13px">' + esc(sec.text) + '</p></div>';
    }).join('') +
    '<p class="sub mt14" style="font-size:12px;color:var(--faint)">' + esc(rh.synthesis) + '</p></div>';

  var otherCards = ['strength', 'weakness', 'misunderstood', 'shadow', 'emotional', 'logical', 'social', 'dark_traits'].map(function (k) {
    return '<div class="card mt18"><div class="eb">' + esc(DEEP_LABELS[k]) + '</div><p class="sub mt10">' + esc(profile[k]) + '</p></div>';
  }).join('');

  var careerCard = '<div class="card mt18"><div class="eb">Career fit</div>' +
    '<p class="sub mt10">' + esc(c.fit) + '</p>' +
    '<div class="pill-row mt10">' + c.domains.map(function (s) { return '<span class="pill">' + esc(s) + '</span>'; }).join('') + '</div>' +
    '<p class="sub mt12" style="font-size:12.5px">' + esc(profile.career) + '</p></div>';

  var relCard = '<div class="card mt18"><div class="eb">In relationships</div>' +
    '<p class="sub mt10">' + esc(l.style) + '</p>' +
    '<p class="sub mt10" style="font-size:12.5px"><b>Needs:</b> ' + esc(l.needs) + '</p>' +
    '<p class="sub mt8" style="font-size:12.5px;color:var(--faint)"><b>Friction:</b> ' + esc(l.friction) + '</p></div>';

  return topbar('Archetype', 'archlib') +
    '<div class="wrap">' +
      '<div class="archline"><h2 class="archname" style="color:' + color + '">' + esc(arche.name) + '</h2>' +
      '<span class="arccode mono" style="color:' + color + '">' + esc(meta.code) + '</span></div>' +
      '<p class="sub mt8">' + esc(arche.tag) + '</p>' +
      '<p class="sub mt14">' + esc(arche.desc) + '</p>' +
      (arche.growth ? '<p class="sub mt10" style="font-size:12.5px"><b>Where to grow:</b> ' + esc(arche.growth) + '</p>' : '') +
      '<div class="card mt18"><div class="eb">Representative dimensions</div>' + dimBars +
        '<p class="sub mt10" style="font-size:11.5px;color:var(--faint)">A synthetic, illustrative profile for this archetype \u2014 not your own scores.</p></div>' +
      contrastCard + otherCards + rhCard + careerCard + relCard +
      '<div class="mt24"><button class="btn primary block" data-act="start">Take the assessment yourself</button>' +
        '<button class="btn ghost block mt10" data-act="archlib">Back to all archetypes</button>' +
        '<button class="btn ghost block mt10" data-act="home">Home</button></div>' +
    '</div>';
}


function viewResults() {
  var r = state.result;
  var m = r.match, dims = r.dims;
  var color = m.arche ? (DIMS[m.primary] ? DIMS[m.primary].color : 'var(--accent)') : 'var(--accent)';
  var sig = Engine.signatureTraits(r.facets);
  var sigNarrative = Engine.signatureNarrative(sig);

  var tabs = [
    ['profile', 'Profile'],
    ['facets', '20 Facets'],
    ['deep', 'Deep Analysis'],
    ['career', 'Career'],
    ['relationship', 'Relationships']
  ];

  return topbar('Your result', 'home') +
    '<div class="wrap">' +
      '<div class="archline">' +
        '<h2 class="archname" style="color:' + color + '">' + esc(m.arche.name) + '</h2>' +
        '<span class="arccode mono" style="color:' + color + '">' + esc(m.code) + '</span>' +
      '</div>' +
      '<p class="sub mt8">' + esc(m.arche.tag) + '</p>' +
      '<div class="row between center mt10">' +
        '<span class="confbadge">CONFIDENCE ' + m.confidence + '%' + (m.lowSignal ? ' \u00b7 low-signal answers detected' : '') + '</span>' +
      '</div>' +
      '<p class="sub mt14">' + esc(m.arche.desc) + '</p>' +
      '<p class="sub mt10">' + esc(generateDeepSection('strength', r.dims, factsSeedKey(r) + ':intro', 'Named strengths include ' + m.arche.strengths.map(function (s) { return s.toLowerCase(); }).join(', ') + '.')) + '</p>' +
      (m.arche.growth ? '<p class="sub mt10" style="font-size:12.5px"><b>Where to grow:</b> ' + esc(m.arche.growth) + '</p>' : '') +

      '<div class="tabs">' +
        tabs.map(function (t) { return '<div class="tab' + (state.resultsTab === t[0] ? ' active' : '') + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + '</div>'; }).join('') +
      '</div>' +

      (state.resultsTab === 'profile' ? resultsProfile(r, sig, sigNarrative) : '') +
      (state.resultsTab === 'facets' ? resultsFacets(r) : '') +
      (state.resultsTab === 'deep' ? resultsDeep(r, m) : '') +
      (state.resultsTab === 'career' ? resultsCareer(r, m) : '') +
      (state.resultsTab === 'relationship' ? resultsRelationship(r, m) : '') +

      '<div class="mt32">' +
        '<button class="btn primary block" data-act="exportpdf">Export complete analysis (PDF)</button>' +
        '<button class="btn ghost block mt10" data-act="share">Export as image</button>' +
        '<button class="btn ghost block mt10" data-act="compare">Compare with someone</button>' +
        '<button class="btn ghost block mt10" data-act="group">Compare a group / team</button>' +
        '<button class="btn ghost block mt10" data-act="start">Retake the assessment</button>' +
        '<button class="btn ghost block mt10" data-act="home">Back home</button>' +
      '</div>' +
    '</div>';
}

function resultsProfile(r, sig, sigNarrative) {
  var dims = r.dims;
  var bars = DIM_ORDER.map(function (d) {
    return '<div class="dimrow">' +
      '<div class="dimlabel">' + esc(DIMS[d].name) + '</div>' +
      '<div class="dimtrack"><div class="dimfill" style="width:' + dims[d] + '%;background:' + DIMS[d].color + '"></div></div>' +
      '<div class="dimval">' + dims[d] + '</div></div>';
  }).join('');

  var sigPills = sig.map(function (t) {
    return '<span class="pill"><span class="pdot" style="background:' + t.color + '"></span>' + esc(t.name) + '</span>';
  }).join('');

  return '<div class="card mt18">' +
      '<div class="eb">Dimensions</div>' + bars +
    '</div>' +
    '<div class="mt24">' +
      '<div class="eb">Signature traits</div>' +
      '<div class="pill-row mt10">' + (sigPills || '<span class="sub">No single trait stands out sharply.</span>') + '</div>' +
      '<p class="sub mt10">' + esc(sigNarrative) + '</p>' +
    '</div>';
}

function resultsFacets(r) {
  var colors = { P: 'var(--P)', R: 'var(--R)', I: 'var(--I)', S: 'var(--S)', M: 'var(--M)' };
  var built = buildFacetDefsAndScores(r.facets);
  var facts = generate20Facts(built.defs, built.scores, factsSeedKey(r));

  var factsByDim = {};
  facts.forEach(function (f) { (factsByDim[f.dim] = factsByDim[f.dim] || []).push(f); });

  var factsHTML = '<div class="mt18">' +
    '<div class="eb">Twenty facts about you</div>' +
    '<p class="sub mt6" style="font-size:12.5px">Generated fresh from your actual scores, grouped by dimension \u2014 not a fixed list, and not just a numbered dump.</p>' +
    DIM_ORDER.map(function (d) {
      var group = factsByDim[d] || [];
      return '<div class="card mt14" style="border-top:3px solid ' + colors[d] + '">' +
        '<div class="row between center"><span class="eb" style="color:' + colors[d] + '">' + esc(DIMS[d].name) + '</span>' +
        '<span class="mono" style="font-size:11px;color:var(--faint)">' + group.length + ' facets</span></div>' +
        group.map(function (f) {
          return '<div class="mt14" style="padding-top:12px;border-top:1px solid var(--line)">' +
            '<div class="row between center">' +
              '<b style="font-size:14px">' + esc(f.label) + '</b>' +
              '<span class="mono" style="font-size:11px;color:var(--faint)">' + f.score + '/100</span>' +
            '</div>' +
            '<p class="sub mt6" style="font-size:13.5px;line-height:1.65">' + esc(f.deep) + '</p>' +
            '<div class="facetbar mt8"><div class="facetbarfill" style="width:' + f.score + '%;background:' + colors[d] + '"></div></div>' +
          '</div>';
        }).join('') +
      '</div>';
    }).join('') +
  '</div>';

  var dims = '<div class="mt24"><div class="eb">Full breakdown</div>' +
    DIM_ORDER.map(function (d) {
      var rows = Object.keys(DIMS[d].facets).map(function (fk) {
        var key = d + '.' + fk, s = r.facets[key], fac = DIMS[d].facets[fk];
        var pole = s >= 50 ? fac.hi : fac.lo;
        var desc = Engine.facetDescription(d, fk, s);
        return '<div class="facetrow"><div class="facethead"><span>' + esc(pole[0]) + '</span><span class="mono">' + s + '</span></div>' +
          '<div class="facetdesc">' + esc(desc) + '</div>' +
          '<div class="facetbar"><div class="facetbarfill" style="width:' + s + '%;background:' + colors[d] + '"></div></div></div>';
      }).join('');
      return '<div class="card mt14"><div class="row between center"><span class="eb" style="color:' + colors[d] + '">' + esc(DIMS[d].name) + '</span><span class="mono" style="font-size:13px">' + r.dims[d] + '</span></div>' +
        '<div class="facetgroup">' + rows + '</div></div>';
    }).join('') +
  '</div>';

  return factsHTML + dims;
}

function factsSeedKey(r) {
  return DIM_ORDER.map(function (d) { return r.dims[d]; }).join('-');
}

/* ---------------- DEEP ANALYSIS ---------------- */
var DEEP_LABELS = {
  strength: 'Strength', weakness: 'Weakness', misunderstood: 'Misunderstood as', shadow: 'Shadow',
  emotional: 'Emotional side', logical: 'Critical & logical side', relationship_handling: 'Relationship handling',
  social: 'Social side', dark_traits: 'Dark traits', career: 'Career, in depth'
};
var DEEP_ORDER = ['strength', 'weakness', 'misunderstood', 'shadow', 'emotional', 'logical', 'relationship_handling', 'social', 'dark_traits', 'career'];

function resultsDeep(r, m) {
  var c = careerByKey(m.key);
  var seedKey = factsSeedKey(r) + ':' + m.key;
  var profile = generateFullDeepProfile(
    r.dims,
    m.arche.strengths,
    m.arche.shadow,   // this ARCH field name is historical — it actually holds the weakness/blind-spot sentence
    m.arche.stress,   // this ARCH field holds the under-pressure / crisis-behavior sentence
    c.fit,
    c.domains,
    c.caution,
    seedKey
  );
  var contrastCard = '<div class="card mt18" style="border-top:3px solid var(--ink)">' +
    '<div class="eb">At your best, vs. under sustained stress</div>' +
    '<div class="mt14"><b style="font-size:13px;color:var(--M)">\u2600 At your best</b>' +
    '<p class="sub mt6" style="font-size:13px">' + esc(profile.at_best) + '</p></div>' +
    '<div class="mt18" style="padding-top:14px;border-top:1px solid var(--line)"><b style="font-size:13px;color:var(--S)">\u26a1 Under sustained stress</b>' +
    '<p class="sub mt6" style="font-size:13px">' + esc(profile.under_stress) + '</p></div>' +
  '</div>';

  return '<p class="sub mt10" style="font-size:12px;color:var(--faint)">Every section below is generated from your actual scores, not picked from a fixed list \u2014 two people with the same archetype but different numbers will read different text here.</p>' +
    contrastCard +
    DEEP_ORDER.map(function (key) {
      if (key === 'relationship_handling') {
        var rh = profile[key];
        var subRows = rh.sections.map(function (sec) {
          return '<div class="mt10"><b style="font-size:12.5px">' + esc(sec.label) + '</b> <span class="mono" style="font-size:11px;color:var(--faint)">' + sec.score + '</span>' +
            '<p class="sub mt6" style="font-size:13px">' + esc(sec.text) + '</p></div>';
        }).join('');
        return '<div class="card mt18"><div class="eb">' + esc(DEEP_LABELS[key]) + '</div>' +
          (rh.intro ? '<p class="sub mt10">' + esc(rh.intro) + '</p>' : '') +
          subRows +
          '<p class="sub mt14" style="font-size:12px;color:var(--faint)">' + esc(rh.synthesis) + '</p></div>';
      }
      return '<div class="card mt18"><div class="eb">' + esc(DEEP_LABELS[key]) + '</div>' +
        '<p class="sub mt10">' + esc(profile[key]) + '</p></div>';
    }).join('');
}



function resultsCareer(r, m) {
  var c = careerByKey(m.key);
  return '<div class="card mt18">' +
    '<div class="eb">Career fit</div>' +
    '<p class="sub mt10">' + esc(c.fit) + '</p>' +
    '<div class="pill-row mt10">' + c.domains.map(function (s) { return '<span class="pill">' + esc(s) + '</span>'; }).join('') + '</div>' +
    '<p class="sub mt14" style="font-size:12.5px"><b>Specifically, for you:</b> ' + esc(Engine.careerElaboration(r.dims)) + '</p>' +
    '<p class="sub mt10" style="font-size:12.5px;color:var(--faint)"><b>Watch for:</b> ' + esc(c.caution) + '</p>' +
  '</div>';
}

function resultsRelationship(r, m) {
  var l = relateByKey(m.key);
  var seedKey = factsSeedKey(r) + ':' + m.key + ':reltab';
  var rh = generateRelationshipHandlingDeep(r.dims, null, seedKey);

  var subCards = rh.sections.map(function (sec) {
    return '<div class="mt14" style="padding-top:12px;border-top:1px solid var(--line)">' +
      '<div class="row between center"><b style="font-size:13.5px">' + esc(sec.label) + '</b>' +
      '<span class="mono" style="font-size:11px;color:var(--faint)">' + sec.score + '/100</span></div>' +
      '<p class="sub mt6" style="font-size:13.5px;line-height:1.65">' + esc(sec.text) + '</p></div>';
  }).join('');

  return '<div class="card mt18">' +
    '<div class="eb">In relationships</div>' +
    '<p class="sub mt10">' + esc(l.style) + '</p>' +
    '<p class="sub mt10" style="font-size:12.5px"><b>Needs:</b> ' + esc(l.needs) + '</p>' +
    '<p class="sub mt8" style="font-size:12.5px;color:var(--faint)"><b>Friction:</b> ' + esc(l.friction) + '</p>' +
  '</div>' +
  '<div class="card mt14">' +
    '<div class="eb">The full breakdown</div>' +
    '<p class="sub mt8" style="font-size:12px;color:var(--faint)">Five sub-themes, each generated from your actual scores \u2014 not just an archetype-level summary.</p>' +
    subCards +
    '<p class="sub mt14" style="font-size:12px;color:var(--faint);padding-top:12px;border-top:1px solid var(--line)">' + esc(rh.synthesis) + '</p>' +
  '</div>';
}

/* ---------------- SHARE CARD (canvas export, no server round-trip) ---------------- */
/* ---------------- PDF EXPORT (complete report, browser print-to-PDF) ---------------- */
function buildFullReportHTML(r, m) {
  var dims = r.dims;
  var colors = { P: '#6D28D9', R: '#1D4ED8', I: '#B45309', S: '#BE123C', M: '#047857' };
  var sig = Engine.signatureTraits(r.facets);
  var sigNarrative = Engine.signatureNarrative(sig);
  var c = careerByKey(m.key);
  var l = relateByKey(m.key);
  var seedKey = factsSeedKey(r) + ':' + m.key;
  var profile = generateFullDeepProfile(dims, m.arche.strengths, m.arche.shadow, m.arche.stress, c.fit, c.domains, c.caution, seedKey);
  var built = buildFacetDefsAndScores(r.facets);
  var facts = generate20Facts(built.defs, built.scores, factsSeedKey(r));
  var factsByDim = {};
  facts.forEach(function (f) { (factsByDim[f.dim] = factsByDim[f.dim] || []).push(f); });

  var now = new Date();
  var dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  var header = '<div class="preport-header">' +
    '<h1>' + esc(m.arche.name) + '</h1>' +
    '<div class="preport-meta">' + esc(m.code) + ' \u00b7 CONFIDENCE ' + m.confidence + '% \u00b7 GENERATED ' + dateStr + ' \u00b7 PSYCHE CORE</div>' +
    '</div>' +
    '<p style="font-size:12.5px;line-height:1.65">' + esc(m.arche.tag) + '</p>' +
    '<p style="font-size:12px;line-height:1.65;color:#333">' + esc(m.arche.desc) + '</p>' +
    DIM_ORDER.map(function (d) {
      return '<div class="preport-dimrow"><div class="preport-dimlabel">' + esc(DIMS[d].name) + '</div>' +
        '<div class="preport-track"><div class="preport-fill" style="width:' + dims[d] + '%;background:' + colors[d] + '"></div></div>' +
        '<div class="preport-val">' + dims[d] + '</div></div>';
    }).join('');

  var signature = '<div class="preport-section"><h2>Signature traits</h2><p>' + esc(sigNarrative) + '</p></div>';

  var factsSection = '<div class="preport-section preport-page-break"><h2>Twenty facts about you</h2>' +
    DIM_ORDER.map(function (d) {
      var group = factsByDim[d] || [];
      return '<p style="font-weight:650;font-size:12.5px;margin-top:12px">' + esc(DIMS[d].name) + '</p>' +
        group.map(function (f) {
          return '<div class="preport-facet"><div class="fh"><span>' + esc(f.label) + '</span><span>' + f.score + '/100</span></div><p>' + esc(f.deep) + '</p></div>';
        }).join('');
    }).join('') + '</div>';

  var contrastSection = '<div class="preport-section"><h2>At your best, vs. under sustained stress</h2>' +
    '<p style="font-weight:650;font-size:12.5px;margin-top:10px">At your best</p>' +
    '<p style="font-size:12px">' + esc(profile.at_best) + '</p>' +
    '<p style="font-weight:650;font-size:12.5px;margin-top:10px">Under sustained stress</p>' +
    '<p style="font-size:12px">' + esc(profile.under_stress) + '</p></div>';

  var deepSection = '<div class="preport-section preport-page-break"><h2>Deep analysis</h2>' +
    DEEP_ORDER.map(function (key) {
      if (key === 'relationship_handling') {
        var rh = profile[key];
        return '<p style="font-weight:650;font-size:12.5px;margin-top:14px">' + esc(DEEP_LABELS[key]) + '</p>' +
          rh.sections.map(function (sec) {
            return '<p style="font-size:12px;margin-top:6px"><b>' + esc(sec.label) + ' (' + sec.score + '):</b> ' + esc(sec.text) + '</p>';
          }).join('') +
          '<p style="font-size:11.5px;color:#555;margin-top:6px"><i>' + esc(rh.synthesis) + '</i></p>';
      }
      return '<p style="font-weight:650;font-size:12.5px;margin-top:14px">' + esc(DEEP_LABELS[key]) + '</p>' +
        '<p style="font-size:12px">' + esc(profile[key]) + '</p>';
    }).join('') + '</div>';

  var careerSection = '<div class="preport-section"><h2>Career fit</h2>' +
    '<p>' + esc(c.fit) + '</p>' +
    '<p><b>Roles:</b> ' + c.domains.map(esc).join(', ') + '</p>' +
    '<p><b>Specifically, for you:</b> ' + esc(Engine.careerElaboration(dims)) + '</p>' +
    '<p><b>Watch for:</b> ' + esc(c.caution) + '</p></div>';

  var relSection = '<div class="preport-section"><h2>In relationships</h2>' +
    '<p>' + esc(l.style) + '</p>' +
    '<p><b>Needs:</b> ' + esc(l.needs) + '</p>' +
    '<p><b>Friction:</b> ' + esc(l.friction) + '</p>' +
    '<p style="font-size:11px;color:#888">See "Relationship handling" under Deep Analysis above for the full five-part breakdown.</p></div>';

  var footer = '<div class="preport-footer">Generated by Psyche Core \u2014 every section above was produced from your actual assessment scores at the time of generation. Nothing about this reading was sent to a server; it was computed and printed entirely in your browser.</div>';

  return header + signature + factsSection + contrastSection + deepSection + careerSection + relSection + footer;
}

function buildCompatReportHTML(mine, them, c, dc, archNarrative) {
  var colors = { P: '#6D28D9', R: '#1D4ED8', I: '#B45309', S: '#BE123C', M: '#047857' };
  var now = new Date();
  var dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  var header = '<div class="preport-header">' +
    '<h1>' + esc(mine.name) + ' \u00d7 ' + esc(them.name) + '</h1>' +
    '<div class="preport-meta">COMPATIBILITY ' + c.score + ' \u00b7 GENERATED ' + dateStr + ' \u00b7 PSYCHE CORE</div>' +
    '</div>' +
    '<p style="font-size:12.5px;line-height:1.65">' + esc(c.synthesis) + '</p>';

  var notes = '<div class="preport-section"><h2>Read</h2>' +
    c.notes.map(function (n) { return '<p style="font-weight:650;font-size:12.5px;margin-top:10px">' + esc(n.t) + '</p><p style="font-size:12px">' + esc(n.p) + '</p>'; }).join('') +
  '</div>';

  var archSection = archNarrative ? '<div class="preport-section"><h2>As archetypes</h2><p style="font-size:12px">' + esc(archNarrative) + '</p></div>' : '';

  var trait = '<div class="preport-section preport-page-break"><h2>Trait-by-trait</h2>' +
    dc.dims.map(function (x) {
      return '<div class="preport-facet"><div class="fh"><span>' + esc(x.name) + '</span><span>' + x.harmony + '% aligned</span></div>' +
        '<div class="preport-dimrow"><div class="preport-dimlabel">' + esc(mine.name) + '</div><div class="preport-track"><div class="preport-fill" style="width:' + x.aScore + '%;background:' + colors[x.dim] + '"></div></div><div class="preport-val">' + x.aScore + '</div></div>' +
        '<div class="preport-dimrow"><div class="preport-dimlabel">' + esc(them.name) + '</div><div class="preport-track"><div class="preport-fill" style="width:' + x.bScore + '%;background:' + colors[x.dim] + '"></div></div><div class="preport-val">' + x.bScore + '</div></div>' +
        '<p>' + esc(x.text) + '</p></div>';
    }).join('') +
  '</div>';

  var conflict = '<div class="preport-section"><h2>Conflict style</h2>' +
    '<p>' + esc(c.conflict.why) + '</p>' +
    (c.conflict.dim ? '<p><b>A way through:</b> ' + esc(c.conflict.bridge) + '</p>' : '<p>' + esc(c.conflict.bridge) + '</p>') +
  '</div>';

  var footer = '<div class="preport-footer">Generated by Psyche Core \u2014 computed in your browser from the scores both people chose to share.</div>';

  return header + notes + archSection + trait + conflict + footer;
}

function buildGroupReportHTML(members, g) {
  var colors = { P: '#6D28D9', R: '#1D4ED8', I: '#B45309', S: '#BE123C', M: '#047857' };
  var now = new Date();
  var dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  var header = '<div class="preport-header">' +
    '<h1>Group report \u00b7 ' + g.n + ' people</h1>' +
    '<div class="preport-meta">TEAM ARCHETYPE ' + esc(g.teamMatch.arche.name) + ' \u00b7 GENERATED ' + dateStr + ' \u00b7 PSYCHE CORE</div>' +
    '</div>' +
    DIM_ORDER.map(function (d) {
      return '<div class="preport-dimrow"><div class="preport-dimlabel">' + esc(DIMS[d].name) + '</div>' +
        '<div class="preport-track"><div class="preport-fill" style="width:' + g.avg[d] + '%;background:' + colors[d] + '"></div></div>' +
        '<div class="preport-val">' + g.avg[d] + '</div></div>';
    }).join('');

  var roster = '<div class="preport-section"><h2>Roster & natural roles</h2>' +
    members.map(function (m) {
      var sr = suggestGroupRole(m.dims);
      return '<p style="font-size:12px"><b>' + esc(m.name) + '</b> \u2014 ' + esc(sr.role) + ' (' + sr.lead + '+' + sr.second + ')</p>';
    }).join('') + '</div>';

  var summary = '<div class="preport-section"><h2>Alignment</h2>' +
    '<p><b>Most aligned:</b> ' + esc(DIMS[g.aligned].name) + ' (variance ' + g.variance[g.aligned] + ')</p>' +
    '<p><b>Most scattered:</b> ' + esc(DIMS[g.divergent].name) + ' (variance ' + g.variance[g.divergent] + ')</p>' +
    '<p><b>Strongest pairing:</b> ' + esc(g.best.a) + ' \u00d7 ' + esc(g.best.b) + ' (' + g.best.score + ')</p>' +
    '<p><b>Widest pairing:</b> ' + esc(g.worst.a) + ' \u00d7 ' + esc(g.worst.b) + ' (' + g.worst.score + ')</p>' +
    '<p><b>Average pairwise compatibility:</b> ' + g.avgPairScore + '</p></div>';

  var matrix = '<div class="preport-section preport-page-break"><h2>Pairwise matrix</h2>' +
    g.pairs.map(function (p) { return '<p style="font-size:12px">' + esc(p.a) + ' \u00d7 ' + esc(p.b) + ' \u2014 ' + p.score + '</p>'; }).join('') +
  '</div>';

  var footer = '<div class="preport-footer">Generated by Psyche Core \u2014 computed in your browser from the scores each member chose to share.</div>';

  return header + roster + summary + matrix + footer;
}

function fallbackCopy(text, onDone) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    onDone();
  } catch (e) {
    console.error('Copy failed:', e);
  }
}


/* ---------------- COMPATIBILITY (1:1, through accounts) ---------------- */
function viewCompare() {
  var mine = state.result ? { name: myName(), dims: state.result.dims, key: state.result.match.key } : null;
  var gate = socialGate();
  var them = null, socialHTML = '';
  if (!gate) {
    var L = connectionLists(), busy = state.socialBusy ? ' disabled' : '';
    them = currentCompareThem();
    var inviteMsg = function (email) {
      return myName() + ' invited you on Psyche Core to compare personalities. Sign in at ' + siteUrl() + ' with this email (' + email + ') and accept the invite under Compatibility.';
    };
    var connectCard = state.result
      ? '<div class="card mt14"><div class="eb">Connect with someone</div>' +
          '<p class="sub mt8" style="font-size:12.5px">Nobody sees your scores until they accept. Once you’re connected you each see the other’s 5 dimension scores and archetype — never any answers. You can remove a connection any time.</p>' +
          '<label class="field mt10"><span>Invite by email</span><input class="input" id="inviteEmail" type="email" inputmode="email" autocomplete="off" placeholder="friend@example.com" value="' + esc(state.inviteDraft) + '"></label>' +
          '<button class="btn ghost block mt10" data-act="invitecompare"' + busy + '>Send invite</button>' +
          '<p class="sub mt8" style="font-size:11.5px;color:var(--faint)">No email is sent automatically — they see the invite when they sign in with <b>that exact email</b>. Use “Copy invite message” below to send it yourself.</p>' +
          '<div class="eb mt18">Or share a link</div>' +
          '<p class="sub mt8" style="font-size:12.5px">A one-time link for one person. They open it, sign in (or sign up), confirm, and you’re connected.</p>' +
          '<button class="btn ghost block mt10" data-act="makelink"' + busy + '>Create a share link</button>' +
        '</div>'
      : '<div class="card mt14"><div class="eb">Connect with someone</div><p class="sub mt8" style="font-size:12.5px">Take the assessment first — you need your own scores before you can compare.</p><button class="btn primary block mt12" data-act="start">Take the PRISM test</button></div>';

    var recvCard = L.received.length
      ? '<div class="card mt14"><div class="eb">Invitations for you</div>' +
          '<p class="sub mt8" style="font-size:12px;color:var(--faint)">Accepting shares your scores and archetype with them (and theirs with you).</p>' +
          L.received.map(function (c) {
            return '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><div style="font-size:13.5px;font-weight:600">' + esc(c.requester_name) + '</div>' +
              '<div class="mono" style="font-size:11px;color:var(--faint);word-break:break-all">' + esc(c.requester_email) + '</div>' +
              '<div class="row mt8" style="gap:8px"><button class="btn ghost" data-act="acceptconn" data-id="' + esc(c.id) + '"' + busy + '>Accept</button>' +
              '<button class="linkbtn" data-act="removeconn" data-id="' + esc(c.id) + '" style="color:var(--S)">Decline</button></div></div>';
          }).join('') + '</div>'
      : '';

    var sentCard = L.sent.length
      ? '<div class="card mt14"><div class="eb">Waiting for a reply</div>' +
          L.sent.map(function (c) {
            var isLink = !c.invitee_email;
            return '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><div style="font-size:13px">' + (isLink ? 'Share link (one person)' : 'Invited <b>' + esc(c.invitee_email) + '</b>') + '</div>' +
              '<div class="row mt8" style="gap:10px;flex-wrap:wrap">' +
              '<button class="btn ghost" data-act="copycode" data-code="' + esc(isLink ? siteUrl() + '?join=' + c.token : inviteMsg(c.invitee_email)) + '">' + (state.codeCopied ? 'Copied ✓' : (isLink ? 'Copy link' : 'Copy invite message')) + '</button>' +
              '<button class="linkbtn" data-act="removeconn" data-id="' + esc(c.id) + '" style="color:var(--S)">Cancel</button></div></div>';
          }).join('') + '</div>'
      : '';

    var connCard = L.accepted.length
      ? '<div class="card mt14"><div class="eb">Your connections</div>' +
          L.accepted.map(function (a) {
            var sel = state.compareWith === a.id;
            return '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><div class="row between center"><span style="font-size:13.5px;font-weight:600">' + esc(a.name) + (sel ? ' ✓' : '') + '</span>' +
              '<button class="linkbtn" data-act="removeconn" data-id="' + esc(a.id) + '" data-confirm="1" style="color:var(--S)">Remove</button></div>' +
              (a.person ? '<button class="btn ' + (sel ? 'primary' : 'ghost') + ' block mt8" data-act="comparewith" data-id="' + esc(a.id) + '">Compare with ' + esc(a.name) + '</button>'
                        : '<p class="sub mt6" style="font-size:12px;color:var(--faint)">Hasn’t taken the test yet — you can compare once they have.</p>') + '</div>';
          }).join('') + '</div>'
      : '';
    socialHTML = socialMsgBox() + recvCard + connectCard + sentCard + connCard;
  }

  var dimGuide = '<div class="card mt14"><div class="eb">What\u2019s being compared</div>' +
    '<p class="sub mt8" style="font-size:12.5px">Compatibility here isn\u2019t a vibe check \u2014 it\u2019s a direct comparison of the same 5 dimensions your own result is built from. A quick reminder of what each one actually measures, since the breakdown below refers back to these constantly:</p>' +
    DIM_ORDER.map(function (d) {
      return '<div class="row" style="margin-top:8px;gap:8px;align-items:baseline"><span style="width:8px;height:8px;border-radius:50%;background:' + DIMS[d].color + ';flex:none;transform:translateY(-1px)"></span>' +
        '<span style="font-size:12.5px"><b>' + esc(DIMS[d].name) + '</b> \u2014 ' + esc(DIMS[d].blurb) + '</span></div>';
    }).join('') +
  '</div>' +
  '<div class="card mt14"><div class="eb">Two lenses for reading this</div>' +
    '<p class="sub mt8" style="font-size:12.5px">Personality psychology doesn\u2019t fully agree on whether similarity or difference predicts a better relationship, and this tool deliberately doesn\u2019t pick a side \u2014 it reports the gap and lets you interpret it.</p>' +
    '<div class="mt10"><b style="font-size:13px">Similarity \u2192 ease</b><p class="sub mt4" style="font-size:12.5px">The similarity-attraction idea: shared traits mean shared instincts \u2014 less translation needed, fewer surprises, faster rapport. A high score leans on this.</p></div>' +
    '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><b style="font-size:13px">Difference \u2192 range</b><p class="sub mt4" style="font-size:12.5px">The complementarity idea: two different profiles can cover more ground together than either could alone \u2014 one\u2019s gap is the other\u2019s strength. A lower score isn\u2019t automatically a worse match; it can mean a wider combined range, at the cost of needing more deliberate translation between you.</p></div>' +
    '<p class="sub mt10" style="font-size:12px;color:var(--faint)">In practice most real pairs are a mix \u2014 aligned on some dimensions, split on others, which is exactly what the trait-by-trait section below is built to show rather than collapsing into one number.</p>' +
  '</div>';

  var result = '';
  if (mine && them) {
    var c = Engine.compatibility(mine.dims, them.dims, mine.name, them.name);
    var dc = Engine.deepCompatibility(mine.dims, them.dims, mine.name, them.name);
    var offset = 326 - 326 * (c.score / 100);
    var noteLegend = {
      'Shared ground': 'a dimension you both score high on \u2014 easy, instinctive territory',
      'Natural division': 'a wide gap on one dimension, framed as a possible complement rather than a clash',
      'Watch: two centers': 'both of you score high on Identity \u2014 two firm centers of gravity in the same relationship',
      'Watch: distance': 'both of you score low on Social \u2014 neither instinctively reaches out first',
      'Watch: pace': 'a wide gap on Response \u2014 mismatched tempo, worth naming early',
      'Quiet balance': 'nothing strongly stands out either way \u2014 not a bad sign, just a flatter profile'
    };
    var archNarrative = archPairNarrative(mine.key, them.key, mine.name, them.name);
    result = '<div class="card mt18">' +
      '<div class="eb">' + esc(mine.name) + ' \u00d7 ' + esc(them.name) + '</div>' +
      '<div class="row center" style="justify-content:center;margin-top:14px"><div style="position:relative;width:130px;height:130px">' +
        '<svg width="130" height="130" style="transform:rotate(-90deg)"><circle cx="65" cy="65" r="52" fill="none" stroke="var(--surf2)" stroke-width="10"/>' +
        '<circle cx="65" cy="65" r="52" fill="none" stroke="var(--ink)" stroke-width="10" stroke-dasharray="326" stroke-dashoffset="' + offset + '" stroke-linecap="round"/></svg>' +
        '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
        '<b style="font-size:26px">' + c.score + '</b><span style="font-size:10px;color:var(--faint)">compatibility</span></div></div></div>' +
      '<p class="sub mt10" style="font-size:12px;text-align:center;color:var(--faint)">Built from the average gap between your two profiles across all 5 dimensions, clipped to a 32\u201397 range \u2014 not a verdict on whether you should be together, just a measure of how numerically close the two profiles land. Full formula on the science page.</p>' +
      '<p class="sub mt10" style="font-size:11.5px;color:var(--faint)">Roughly: 80+ is a strong numeric match, 60\u201379 is solid, 45\u201359 is workable but needs attention, below 45 is a genuinely wide gap \u2014 read as a prompt for conversation, not a grade.</p>' +
      '<div class="mt18" style="display:flex;justify-content:center">' + radarSVG(mine.dims, them.dims, mine.name, them.name) + '</div>' +
      c.notes.map(function (n) {
        return '<div class="mt14" style="padding-top:12px;border-top:1px solid var(--line)"><b style="font-size:13px">' + esc(n.t) + '</b>' +
          '<p class="sub mt4" style="font-size:11px;color:var(--faint);font-style:italic">' + esc(noteLegend[n.t] || '') + '</p>' +
          '<p class="sub mt6" style="font-size:13px">' + esc(n.p) + '</p></div>';
      }).join('') +
      '<p class="sub mt14" style="font-size:12px;color:var(--faint)">' + esc(c.synthesis) + '</p>' +
    '</div>' +

    (archNarrative ? '<div class="card mt14"><div class="eb">As archetypes</div>' +
      '<p class="sub mt10" style="font-size:13px">' + esc(archNarrative) + '</p>' +
    '</div>' : '') +

    '<div class="card mt14">' +
      '<div class="eb">Trait-by-trait \u2014 all 5 dimensions</div>' +
      '<p class="sub mt8" style="font-size:12.5px">Where the headline score comes from, dimension by dimension. Each bar shows both of your scores side by side; the paragraph underneath is generated specifically for how the two of you land on that dimension \u2014 not a generic description of either score alone. "% aligned" is roughly 100 minus the gap between your two scores on that one dimension, so it\u2019s a per-trait number, not a slice of the overall compatibility score above.</p>' +
      dc.dims.map(function (x) {
        return '<div class="mt14" style="padding-top:12px;border-top:1px solid var(--line)">' +
          '<div class="row between center"><b style="font-size:13px">' + esc(x.name) + '</b><span class="mono" style="font-size:10.5px;color:var(--faint)">' + x.harmony + '% aligned</span></div>' +
          '<p class="sub" style="font-size:11px;color:var(--faint);margin-top:1px">' + esc(DIMS[x.dim].blurb) + '</p>' +
          '<div class="mt8" style="position:relative;height:8px;background:var(--surf);border-radius:4px;overflow:hidden">' +
            '<div style="position:absolute;left:0;top:0;bottom:0;width:' + x.aScore + '%;background:' + x.color + ';opacity:.55"></div>' +
            '<div style="position:absolute;left:0;top:0;bottom:0;width:' + x.bScore + '%;background:' + x.color + ';opacity:.3;border-right:2px solid ' + x.color + '"></div>' +
          '</div>' +
          '<div class="row between" style="font-size:10.5px;color:var(--faint);margin-top:3px"><span>' + esc(mine.name) + ' ' + x.aScore + '</span><span>' + esc(them.name) + ' ' + x.bScore + '</span></div>' +
          '<p class="sub mt8" style="font-size:12.5px">' + esc(x.text) + '</p>' +
        '</div>';
      }).join('') +
      '<p class="sub mt14" style="font-size:12px;color:var(--faint)">Most naturally aligned: <b style="color:var(--ink)">' + esc(dc.mostAligned.name) + '</b> (' + dc.mostAligned.harmony + '%). Widest gap: <b style="color:var(--ink)">' + esc(dc.mostDivergent.name) + '</b> (' + dc.mostDivergent.harmony + '%).</p>' +
    '</div>' +

    '<div class="card mt14"><div class="eb">Conflict style, between you two</div>' +
      '<p class="sub mt8" style="font-size:12px;color:var(--faint)">This isolates the single dimension with the biggest gap between you \u2014 the one most likely to actually produce friction, as opposed to the five-dimension overview above, which covers all of them evenly. If no dimension has a meaningfully wide gap, that\u2019s stated plainly below rather than manufacturing a fault line that isn\u2019t really there.</p>' +
      (c.conflict.dim
        ? '<p class="sub mt10" style="font-size:13px">' + esc(c.conflict.why) + '</p><p class="sub mt10" style="font-size:12.5px"><b>A way through:</b> ' + esc(c.conflict.bridge) + '</p>'
        : '<p class="sub mt10" style="font-size:13px">' + esc(c.conflict.why) + '</p><p class="sub mt10" style="font-size:12.5px">' + esc(c.conflict.bridge) + '</p>') +
    '</div>' +
    '<button class="btn ghost block mt14" data-act="exportcompatpdf">Export this comparison (PDF)</button>' +
    '<p class="sub mt14" style="font-size:11.5px;color:var(--faint)">Curious how the score and the trait pairing above are actually computed, or what the note categories and lenses above mean? <span data-act="glossary" style="text-decoration:underline;cursor:pointer">See the full glossary \u2192</span> or <span data-act="science" data-sci="compat" style="text-decoration:underline;cursor:pointer">the scientific breakdown \u2192</span></p>';
  }

  return topbar('Compatibility', 'home') +
    '<div class="wrap">' +
      '<div class="eb">Compatibility</div>' +
      '<p class="sub mt8" style="font-size:13px">Connect with someone through their account \u2014 by email invite or a share link \u2014 and once they accept, the comparison runs right here from the scores you both chose to share.</p>' +
      (gate || socialHTML) + result + dimGuide +
      '<button class="btn ghost block mt24" data-act="home">Back home</button>' +
    '</div>';
}

/* ---------------- GROUP / TEAM COMPARISON (same code mechanism, 2+ people) ---------------- */
function viewGroup() {
  var gate = socialGate(), socialHTML = '', members = [], activeG = null;
  if (!gate) {
    var uid = state.user.id, em = userEmail(), busy = state.socialBusy ? ' disabled' : '';
    var S = state.social;
    var iAmIn = function (gid) { return S.members.some(function (m) { return m.group_id === gid && m.user_id === uid && m.status === 'accepted'; }); };
    var myGroups = S.groups.filter(function (g) { return iAmIn(g.id); });
    var invites = S.members.filter(function (m) { return m.status === 'invited' && String(m.email).toLowerCase() === em; })
      .map(function (m) { return { gid: m.group_id, group: S.groups.filter(function (g) { return g.id === m.group_id; })[0] }; })
      .filter(function (x) { return x.group; });
    activeG = myGroups.filter(function (g) { return g.id === state.activeGroup; })[0] || null;
    var invCard = invites.length
      ? '<div class="card mt14"><div class="eb">Group invitations</div>' +
          '<p class="sub mt8" style="font-size:12px;color:var(--faint)">Joining shares your name, 5 scores and archetype with everyone in the group, including people who join later. You can leave any time.</p>' +
          invites.map(function (x) {
            return '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><div style="font-size:13.5px;font-weight:600">' + esc(x.group.name) + '</div>' +
              '<div class="row mt8" style="gap:8px"><button class="btn ghost" data-act="acceptgroup" data-id="' + esc(x.gid) + '"' + busy + '>Join</button>' +
              '<button class="linkbtn" data-act="declinegroup" data-id="' + esc(x.gid) + '" style="color:var(--S)">Decline</button></div></div>';
          }).join('') + '</div>'
      : '';
    if (activeG) {
      members = groupPeople(activeG.id);
      var isOwner = activeG.owner_id === uid;
      var rows = S.members.filter(function (m) { return m.group_id === activeG.id; });
      var rowHTML = rows.map(function (m, i) {
        var prof = m.user_id ? S.profiles[m.user_id] : null;
        var isMe = m.user_id === uid;
        var nm = isMe ? myName() + ' (you)' : (prof && prof.display_name) || m.email;
        var st = m.status === 'invited' ? 'invited \u2014 waiting' : (isMe ? (state.result ? 'joined' : 'joined \u2014 take the test') : (personOf(prof) ? 'joined' : 'joined \u2014 no test yet'));
        return '<div class="row between center mt10" style="padding-top:10px;border-top:' + (i === 0 ? 'none' : '1px solid var(--line)') + '">' +
          '<span style="font-size:13px"><b>' + esc(nm) + '</b><br><span style="font-size:11px;color:var(--faint)">' + esc(st) + '</span></span>' +
          (isOwner && !isMe ? '<button class="linkbtn" data-act="removemember" data-email="' + esc(m.email) + '" style="color:var(--S)">Remove</button>' : '') + '</div>';
      }).join('');
      socialHTML = socialMsgBox() + invCard +
        '<div class="card mt14"><div class="row between center"><div class="eb">' + esc(activeG.name) + '</div><button class="linkbtn" data-act="backgroups">\u2190 All groups</button></div>' +
          '<p class="sub mt8" style="font-size:12px;color:var(--faint)">Everyone in this group sees everyone\u2019s name, 5 scores and archetype \u2014 never answers.</p>' +
          rowHTML +
          (isOwner
            ? '<label class="field mt14"><span>Invite by email</span><input class="input" id="groupInviteEmail" type="email" inputmode="email" autocomplete="off" placeholder="teammate@example.com" value="' + esc(state.groupInviteDraft) + '"></label>' +
              '<button class="btn ghost block mt10" data-act="invitegroup"' + busy + '>Invite to group</button>' +
              '<p class="sub mt8" style="font-size:11.5px;color:var(--faint)">No email is sent automatically \u2014 they see the invite when they sign in with that exact email. Send them the site link: <span class="mono" style="word-break:break-all">' + esc(siteUrl()) + '</span> <button class="linkbtn" data-act="copycode" data-code="' + esc(siteUrl()) + '">' + (state.codeCopied ? 'Copied \u2713' : 'Copy') + '</button></p>' +
              '<button class="linkbtn mt12" data-act="deletegroup" style="color:var(--S);padding:0">Delete this group</button>'
            : '<button class="linkbtn mt12" data-act="leavegroup" style="color:var(--S);padding:0">Leave this group</button>') +
        '</div>';
    } else {
      socialHTML = socialMsgBox() + invCard +
        '<div class="card mt14"><div class="eb">Your groups</div>' +
          (myGroups.length ? myGroups.map(function (g) {
            var n = S.members.filter(function (m) { return m.group_id === g.id && m.status === 'accepted'; }).length;
            return '<div class="row between center mt10" style="padding-top:10px;border-top:1px solid var(--line)"><span style="font-size:13.5px;font-weight:600">' + esc(g.name) + ' <span style="font-weight:400;font-size:11.5px;color:var(--faint)">\u00b7 ' + n + ' joined</span></span>' +
              '<button class="btn ghost" data-act="opengroup" data-id="' + esc(g.id) + '">Open</button></div>';
          }).join('') : '<p class="sub mt8" style="font-size:12.5px">No groups yet \u2014 create one below, or accept an invitation.</p>') +
        '</div>' +
        (state.result
          ? '<div class="card mt14"><div class="eb">Create a group</div>' +
              '<label class="field mt8"><span>Group name</span><input class="input" id="groupNewName" type="text" maxlength="80" placeholder="e.g. Product team" value="' + esc(state.groupNameDraft) + '"></label>' +
              '<button class="btn ghost block mt10" data-act="creategroup"' + busy + '>Create group</button></div>'
          : '<div class="card mt14"><div class="eb">Create a group</div><p class="sub mt8" style="font-size:12.5px">Take the assessment first \u2014 you need your own scores to be in a group.</p><button class="btn primary block mt12" data-act="start">Take the PRISM test</button></div>');
    }
  }

  var dimGuide = '<div class="card mt14"><div class="eb">What\u2019s being compared</div>' +
    '<p class="sub mt8" style="font-size:12.5px">Every metric below \u2014 the group average, the variance, the pairwise scores \u2014 is built from the same 5 dimensions each person\u2019s individual result is scored on:</p>' +
    DIM_ORDER.map(function (d) {
      return '<div class="row" style="margin-top:8px;gap:8px;align-items:baseline"><span style="width:8px;height:8px;border-radius:50%;background:' + DIMS[d].color + ';flex:none;transform:translateY(-1px)"></span>' +
        '<span style="font-size:12.5px"><b>' + esc(DIMS[d].name) + '</b> \u2014 ' + esc(DIMS[d].blurb) + '</span></div>';
    }).join('') +
    '<p class="sub mt10" style="font-size:12px;color:var(--faint)">Personality here isn\u2019t treated as a fixed category (\u201cintrovert,\u201d \u201cleader\u201d) but as five continuous scores \u2014 which is what makes averaging a group, or measuring how scattered it is on one trait, mathematically meaningful in the first place.</p>' +
  '</div>' +
  '<div class="card mt14"><div class="eb">How to read a group, not just a pair</div>' +
    '<p class="sub mt8" style="font-size:12.5px">A pair has one relationship to describe. A group has several things happening at once, so this screen breaks it into four distinct reads instead of one score:</p>' +
    '<div class="mt10"><b style="font-size:13px">Average profile</b><p class="sub mt4" style="font-size:12.5px">The group\u2019s scores on each dimension, averaged across everyone in it. This describes the group\u2019s center of gravity \u2014 it is not, and isn\u2019t meant to be, an accurate description of any one person in it.</p></div>' +
    '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><b style="font-size:13px">Variance / alignment</b><p class="sub mt4" style="font-size:12.5px">How spread out individual scores are around that average, dimension by dimension. Low variance on a trait means the group genuinely lands in similar territory there; high variance means real, measurable disagreement in how the group is composed on that trait \u2014 not necessarily conflict, but a real split worth knowing about.</p></div>' +
    '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><b style="font-size:13px">Team archetype</b><p class="sub mt4" style="font-size:12.5px">The group\u2019s average profile, run through the exact same 36-archetype classifier used for an individual result. It names the group\u2019s collective tendency, not a person\u2019s type.</p></div>' +
    '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><b style="font-size:13px">Pairwise matrix</b><p class="sub mt4" style="font-size:12.5px">Every two-person combination in the group, scored exactly like 1:1 Compatibility. This is where you find the specific relationships driving the group-level picture above \u2014 the average can look smooth even when it\u2019s hiding one very strong pairing and one very strained one.</p></div>' +
  '</div>' +
  '<div class="card mt14"><div class="eb">Is a diverse group better?</div>' +
    '<p class="sub mt8" style="font-size:12.5px">This tool measures composition, not performance \u2014 it has no way of knowing whether your particular group works well together, only how spread out its trait scores are. With that caveat, two things are both broadly true of trait diversity in groups, and they pull in opposite directions:</p>' +
    '<div class="mt10"><b style="font-size:13px">The case for high variance</b><p class="sub mt4" style="font-size:12.5px">A wider spread of Perception, Response, or Motivation styles means more angles on the same problem \u2014 someone grounded when others are abstract, someone cautious when others are bold. Homogeneous groups can move fast but also miss the same blind spot together, the same way two people who both score low on Perception can share a blind spot (see the trait guide above).</p></div>' +
    '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><b style="font-size:13px">The case for low variance</b><p class="sub mt4" style="font-size:12.5px">A tightly aligned group coordinates with less friction and less need to translate between different working styles \u2014 faster consensus, but with the shared-blind-spot risk that comes with everyone seeing a situation the same way.</p></div>' +
    '<p class="sub mt10" style="font-size:12px;color:var(--faint)">Which one matters more depends entirely on what the group is actually for \u2014 the numbers below just tell you which situation you\u2019re in, on which dimension.</p>' +
  '</div>';

  var analysis = '';
  if (members.length >= 2) {
    var g = Engine.groupAnalysis(members);
    var avgBars = DIM_ORDER.map(function (d) {
      return '<div class="mt10"><div class="dimrow">' +
        '<div class="dimlabel">' + esc(DIMS[d].name) + '</div>' +
        '<div class="dimtrack"><div class="dimfill" style="width:' + g.avg[d] + '%;background:' + DIMS[d].color + '"></div></div>' +
        '<div class="dimval">' + g.avg[d] + '</div></div>' +
        '<p class="sub" style="font-size:11px;color:var(--faint);margin:2px 0 0 0">' + esc(DIMS[d].blurb) + ' \u00b7 variance ' + g.variance[d] + '</p></div>';
    }).join('');

    var rolesCard = '<div class="card mt14"><div class="eb">Natural roles in this group</div>' +
      '<p class="sub mt8" style="font-size:12.5px">A heuristic read, not a job assignment \u2014 each person\u2019s top two dimensions mapped to a tendency label. No new data, just the same 5 scores read for what they suggest someone naturally gravitates toward in a group setting.</p>' +
      members.map(function (m, i) {
        var sr = suggestGroupRole(m.dims);
        return '<div class="row between center mt10" style="padding-top:10px;border-top:' + (i === 0 ? 'none' : '1px solid var(--line)') + '">' +
          '<span style="font-size:13px">' + esc(m.name) + '</span>' +
          '<span style="font-size:12px;color:var(--faint)">' + esc(sr.role) + ' <span class="mono" style="font-size:10px">(' + sr.lead + '+' + sr.second + ')</span></span></div>';
      }).join('') +
    '</div>';

    var subgroupCard = '';
    if (members.length >= 5) {
      var sg = subgroupSuggestions(members);
      subgroupCard = '<div class="card mt14"><div class="eb">Natural sub-groupings</div>' +
        '<p class="sub mt8" style="font-size:12.5px">Illustrative, not a verdict \u2014 for groups this size, here\u2019s who the numbers lean toward for two different modes of working:</p>' +
        '<div class="mt10"><b style="font-size:13px">For fast decisions</b><p class="sub mt4" style="font-size:12.5px">' + sg.fast.map(esc).join(', ') + ' \u2014 highest combined Response + Motivation, the pair/trio most likely to move quickly without waiting for consensus.</p></div>' +
        '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><b style="font-size:13px">For careful review</b><p class="sub mt4" style="font-size:12.5px">' + sg.careful.map(esc).join(', ') + ' \u2014 highest combined Perception + measured pace, the pair/trio most likely to catch what speed would miss.</p></div>' +
      '</div>';
    }

    var matrix = '<div class="card mt14"><div class="eb">Pairwise compatibility</div>' +
      '<p class="sub mt8" style="font-size:12.5px">Every pair in the group, computed the same way as 1:1 Compatibility \u2014 connect with a person in Compatibility for the full trait-by-trait breakdown and conflict style behind one of these numbers.</p>' +
      g.pairs.map(function (p) {
        return '<div class="row between center mt10" style="padding-top:10px;border-top:1px solid var(--line)">' +
          '<span style="font-size:13px">' + esc(p.a) + ' \u00d7 ' + esc(p.b) + '</span>' +
          '<b style="font-size:14px">' + p.score + '</b></div>';
      }).join('') +
    '</div>';

    analysis = '<div class="card mt18"><div class="eb">Group profile \u2014 average across ' + g.n + ' people</div>' +
        '<p class="sub mt8" style="font-size:12.5px">Each bar is the group\u2019s mean score on that dimension; the variance figure underneath is how spread out individuals are around it \u2014 the lower it is, the more the group actually agrees on that trait rather than just averaging out to the middle.</p>' +
        '<div class="mt10">' + avgBars + '</div>' +
        '<p class="sub mt14" style="font-size:13px">Run through the same classifier as an individual result, the group\u2019s averaged profile reads closest to <b style="color:var(--ink)">' + esc(g.teamMatch.arche.name) + '</b>. This isn\u2019t any one person\u2019s type \u2014 it\u2019s a synthetic read of the group\u2019s center of gravity, useful for spotting the collective tendency rather than describing any individual accurately.</p>' +
        '<div class="mt14" style="padding-top:12px;border-top:1px solid var(--line)"><b style="font-size:13px">Most aligned dimension</b>' +
          '<p class="sub mt6" style="font-size:13px">' + esc(DIMS[g.aligned].name) + ' (' + esc(DIMS[g.aligned].blurb) + ') \u2014 the group scores unusually close together here (variance ' + g.variance[g.aligned] + '), meaning it\u2019s unlikely to be a source of internal friction.</p></div>' +
        '<div class="mt14" style="padding-top:12px;border-top:1px solid var(--line)"><b style="font-size:13px">Most scattered dimension</b>' +
          '<p class="sub mt6" style="font-size:13px">' + esc(DIMS[g.divergent].name) + ' (' + esc(DIMS[g.divergent].blurb) + ') \u2014 the widest spread in the group (variance ' + g.variance[g.divergent] + '). Worth naming explicitly if this dimension touches how the group works together (pace, risk appetite, how directly people surface disagreement).</p>' +
          '<p class="sub mt6" style="font-size:12px;color:var(--faint);font-style:italic">Facilitation prompt: ' + esc(FACILITATION_PROMPTS[g.divergent]) + '</p></div>' +
        '<div class="mt14" style="padding-top:12px;border-top:1px solid var(--line)"><b style="font-size:13px">Strongest pairing</b>' +
          '<p class="sub mt6" style="font-size:13px">' + esc(g.best.a) + ' \u00d7 ' + esc(g.best.b) + ' at ' + g.best.score + ' \u2014 the group\u2019s easiest, most instinctive working relationship on paper.</p></div>' +
        '<div class="mt14" style="padding-top:12px;border-top:1px solid var(--line)"><b style="font-size:13px">Widest pairing</b>' +
          '<p class="sub mt6" style="font-size:13px">' + esc(g.worst.a) + ' \u00d7 ' + esc(g.worst.b) + ' at ' + g.worst.score + '. ' + esc(g.worst.conflict.why) + '</p></div>' +
        '<p class="sub mt14" style="font-size:12px;color:var(--faint)">Average pairwise compatibility across the whole group: ' + g.avgPairScore + '.</p>' +
      '</div>' + rolesCard + subgroupCard + matrix +
      '<button class="btn ghost block mt14" data-act="exportgrouppdf">Export group report (PDF)</button>' +
      '<p class="sub mt10" style="font-size:11.5px;color:var(--faint)">Not sure what a term above means? <span data-act="glossary" style="text-decoration:underline;cursor:pointer">See the full glossary \u2192</span></p>';
  } else if (members.length === 1) {
    analysis = '<p class="sub mt14" style="font-size:13px">Invite at least one more person who has taken the test to see the group analysis \u2014 pairwise scores, the group\u2019s average profile, and where the team is most aligned or most scattered.</p>';
  }

  return topbar('Group', 'home') +
    '<div class="wrap">' +
      '<div class="eb">Team & group comparison</div>' +
      '<p class="sub mt8" style="font-size:13px">Create a group, invite people by email, and once they join the whole analysis runs here from the scores each member chose to share.</p>' +
      (gate || socialHTML) + (activeG ? analysis : '') + dimGuide +
      '<button class="btn ghost block mt24" data-act="home">Back home</button>' +
    '</div>';
}

/* ---------------- SCIENTIFIC BREAKDOWN ---------------- */
function viewScience() {
  var tabs = [
    ['model', 'The model'],
    ['items', 'Item design'],
    ['scoring', 'Scoring'],
    ['quality', 'Response quality'],
    ['archetype', 'Archetypes'],
    ['compat', 'Compatibility math'],
    ['limits', 'Limitations']
  ];
  var t = state.scienceTab;
  var sec = function (title, body) { return '<div class="card mt14"><div class="eb">' + esc(title) + '</div>' + body + '</div>'; };
  var p = function (s) { return '<p class="sub mt10" style="font-size:13.5px">' + s + '</p>'; };

  var body = '';
  if (t === 'model') {
    body =
      p('PRISM scores five broad dimensions \u2014 Perception, Response, Identity, Social, Motivation \u2014 each built from 4 narrower facets, 20 facets total. This is the same basic architecture as the trait-based personality models used in academic psychology (the Five-Factor Model / "Big Five", and its extension HEXACO): a small number of broad dimensions, each decomposable into more specific facets, each facet scored on a continuous scale rather than sorted into a fixed "type".') +
      p('Where PRISM differs from a clinical instrument is scope and validation, not structure: the five-dimension, facet-based design is standard psychometric practice; what hasn\u2019t been done here is the years of large-sample factor analysis, cross-cultural replication, and peer review that back an instrument like the NEO-PI-R. PRISM is built in that tradition, not certified to its evidentiary standard \u2014 see Limitations.') +
      p('Every facet is scored on a continuous 0\u2013100 scale between two named poles (e.g. Conceptual \u2194 Concrete), not a binary. A score of 51 and a score of 98 are both "high" in direction but are described very differently in the generated text \u2014 the wording scales with how far a score sits from the midpoint, not just which side of it falls on.');
  } else if (t === 'items') {
    body =
      p('40 questions total, 2 per facet, answered on a 5-point Likert scale (Strongly disagree \u2192 Strongly agree). Two items per facet is a minimal, not extensive, item pool \u2014 enough to compute a score, not enough to report the kind of internal-consistency statistics (like Cronbach\u2019s alpha) a validated instrument would need per facet.') +
      p('Items are weighted, not just summed: each question carries a direction weight (+1 or \u22121) so that some items are reverse-keyed \u2014 agreeing with a reverse-keyed item pulls the facet score toward the opposite pole. This is standard practice for reducing acquiescence bias (the tendency to agree with statements regardless of content), and it\u2019s also what the Response Quality check (below) partly relies on to catch inconsistent answering.') +
      p('The assessment itself is fully deterministic: the same 40 answers always produce the same facet scores, dimension scores, and archetype. Nothing about the scoring pipeline is randomized \u2014 only the explanatory text layered on top of a computed score varies in phrasing.');
  } else if (t === 'scoring') {
    body =
      p('Each facet score starts as a weighted sum: for every question mapped to that facet, the answer (1\u20135) is shifted to be centered on neutral ((answer \u2212 3)), then multiplied by that question\u2019s direction weight, and the two questions per facet are summed. That raw sum is then normalized against the maximum possible score for that facet and rescaled to a 0\u2013100 range.') +
      p('A dimension score is simply the mean of its 4 facet scores. This is an unweighted, equal-contribution average \u2014 no facet is treated as more diagnostic of the dimension than another.') +
      p('Signature traits (the handful of facets highlighted as most "defining" for a given person) aren\u2019t independently computed \u2014 they\u2019re just the facets whose score sits furthest from the 50 midpoint, ranked by that distance. The generated sentences describing them scale intensity language to that same distance: a facet at 52 is described as barely leaning either way; a facet at 95 is described as one of the more defining traits in the profile.');
  } else if (t === 'quality') {
    body =
      p('Every result carries a confidence score, and it is not just a measure of "how extreme" the scores are \u2014 it factors in how the assessment was actually taken. Three response-quality signals are computed from the raw answers before any facet scoring happens:') +
      '<ul style="font-size:13.5px;color:var(--mut);line-height:1.7;padding-left:20px;margin:10px 0">' +
        '<li><b>Engagement</b> \u2014 average distance of each answer from the neutral midpoint. Someone who marks every question "Neutral" produces a near-zero engagement score.</li>' +
        '<li><b>Spread</b> \u2014 the standard deviation of all 40 answers. Very low spread means most answers clustered on one or two response values.</li>' +
        '<li><b>Consistency</b> \u2014 for each facet\u2019s 2 questions, how much they agree with each other, averaged across all 20 facets. Two items meant to measure the same trait should broadly move together; when they don\u2019t, consistency drops.</li>' +
      '</ul>' +
      p('If engagement and spread both fall below a threshold, the answer set is flagged as <b>straight-lining</b> (the same response repeated with little variation, a known validity risk in any Likert-based instrument) and the confidence score is sharply discounted \u2014 multiplied by roughly a third \u2014 regardless of how the scores would otherwise look. A results screen with a straight-lining flag is telling you the numbers may not reflect real engagement with the questions, not just giving a low score for its own sake.') +
      p('The final confidence percentage combines dimension separation (how far the top dimension leads the second), overall spread across all 5 dimensions, and the consistency signal above \u2014 then scales the whole thing down if engagement was low, on the reasoning that a flat, low-effort answer set shouldn\u2019t produce a confidently-stated result even if the raw numbers happen to look decisive.');
  } else if (t === 'archetype') {
    body =
      p('36 archetypes come from a rule-based classifier applied to the 5 dimension scores \u2014 not a lookup table and not machine-learned clustering. The rules: rank the 5 dimensions by score; if the gap between the highest and lowest dimension is under 10 points, the profile is classified as balanced (the "PRISM" type, no single dimension dominant). If one dimension leads the next-highest by 18+ points, the profile is a "Pure" type for that dimension. If the top two dimensions are within 6 points of each other, it\u2019s a "Twin" type combining both. Otherwise, it\u2019s a two-dimension blend of the top two.') +
      p('This means the archetype label is a direct, transparent function of the same 5 numbers shown on the results screen \u2014 not a separate hidden score. Two people with the same top-2 dimensions and a similar gap between them will land on the same archetype, by design.') +
      p('The archetype library\u2019s 36 entries use a representative "exemplar" score profile for each type, clearly labeled as illustrative \u2014 useful for browsing what a type generally looks like, but not a substitute for an actual reading from real answers.');
  } else if (t === 'compat') {
    body =
      p('Compatibility score starts from the average absolute difference across all 5 dimensions between two people\u2019s scores, then converts that average gap into a 0\u2013100 score, clipped to a 32\u201397 range so no pairing reads as either a perfect 100 or a hopeless 0 \u2014 the underlying claim is "how numerically close are these two profiles," not a verdict on whether two people should be together.') +
      p('The trait-by-trait breakdown (shown on the Compatibility screen) classifies each of the 5 dimensions independently into one of four states \u2014 both people high, both low, a wide split (24+ points apart), or generally aligned \u2014 and generates dimension-specific text for that exact combination. A per-dimension "harmony" percentage (roughly 100 minus the score gap, scaled) drives the comparison bars.') +
      p('The Conflict Style section takes the single largest gap across the 5 dimensions and, only if that gap is meaningful (15+ points), explains the likely mechanism behind friction on that specific dimension and offers one concrete way to address it. Below that threshold, the tool explicitly says no dimension shows a strong fault line, rather than manufacturing a friction narrative where the data doesn\u2019t support one.') +
      p('Group analysis (2+ people) runs the exact same pairwise compatibility calculation for every possible pair in the group, plus per-dimension variance across the whole group to identify where the team is unusually aligned or unusually scattered \u2014 no new formula, just the same pairwise math applied at scale.');
  } else if (t === 'limits') {
    body =
      p('This is a self-report instrument: every score reflects how someone answered 40 statements about themselves, not an outside behavioral observation. Self-report measures are consistently useful for structured self-reflection, and just as consistently vulnerable to how someone sees themselves (or wants to be seen) in the moment they\u2019re answering.') +
      p('PRISM has not been through the peer-reviewed validation process a clinical or research-grade personality instrument requires \u2014 no published factor analysis confirming the 5-dimension structure holds up statistically, no test-retest reliability data showing scores are stable over time, no criterion validity studies checking scores against independent, real-world outcomes.') +
      p('Personality, including in validated instruments, is not perfectly stable \u2014 mood, context, recent events, and even the order questions are asked in can shift how someone answers. A single sitting produces one read, not a fixed, permanent label.') +
      p('None of this is a diagnostic or clinical tool, and it does not screen for, indicate, or rule out any mental health condition. It\u2019s a structured self-reflection instrument \u2014 genuinely useful for noticing patterns and prompting conversation, not a substitute for professional assessment.');
  }

  return topbar('The science', 'home') +
    '<div class="wrap">' +
      '<div class="eb">Scientific breakdown</div>' +
      '<p class="sub mt8" style="font-size:13px">What PRISM is actually built on, how each number on your results screen is computed, and \u2014 just as important \u2014 what this tool is not. Written to be checked, not just taken on faith.</p>' +
      '<div class="tabs">' +
        tabs.map(function (tb) { return '<div class="tab' + (t === tb[0] ? ' active' : '') + '" data-act="scitab" data-tab="' + tb[0] + '">' + tb[1] + '</div>'; }).join('') +
      '</div>' +
      sec(tabs.filter(function (tb) { return tb[0] === t; })[0][1], body) +
      '<button class="btn ghost block mt24" data-act="home">Back home</button>' +
    '</div>';
}


function exportFullPDF() {
  var r = state.result, m = r.match;
  document.getElementById('printReport').innerHTML = buildFullReportHTML(r, m);
  window.print();
}

function exportCompatPDF() {
  if (!state.result || !state.user) return;
  var mine = { name: myName(), dims: state.result.dims, key: state.result.match.key };
  var them = currentCompareThem();
  if (!them) return;
  var c = Engine.compatibility(mine.dims, them.dims, mine.name, them.name);
  var dc = Engine.deepCompatibility(mine.dims, them.dims, mine.name, them.name);
  var archNarrative = archPairNarrative(mine.key, them.key, mine.name, them.name);
  document.getElementById('printReport').innerHTML = buildCompatReportHTML(mine, them, c, dc, archNarrative);
  window.print();
}

function exportGroupPDF() {
  if (!state.user || !state.activeGroup) return;
  var ppl = groupPeople(state.activeGroup);
  if (ppl.length < 2) return;
  var g = Engine.groupAnalysis(ppl);
  document.getElementById('printReport').innerHTML = buildGroupReportHTML(ppl, g);
  window.print();
}

/* ---------------- GLOSSARY (shared reference, linked from Compatibility & Group) ---------------- */
function viewGlossary() {
  var entry = function (term, body) { return '<div class="mt14" style="padding-top:12px;border-top:1px solid var(--line)"><b style="font-size:13.5px">' + esc(term) + '</b><p class="sub mt6" style="font-size:12.5px">' + body + '</p></div>'; };
  return topbar('Glossary', 'home') +
    '<div class="wrap">' +
      '<div class="eb">Glossary & reference</div>' +
      '<p class="sub mt8" style="font-size:13px">Every term used across Compatibility and Group comparison, defined once, in one place \u2014 so you don\u2019t have to re-read the same explainer cards every visit.</p>' +
      '<div class="card mt14"><div class="eb">The 5 dimensions</div>' +
        DIM_ORDER.map(function (d) {
          return '<div class="row" style="margin-top:8px;gap:8px;align-items:baseline"><span style="width:8px;height:8px;border-radius:50%;background:' + DIMS[d].color + ';flex:none;transform:translateY(-1px)"></span>' +
            '<span style="font-size:12.5px"><b>' + esc(DIMS[d].name) + '</b> \u2014 ' + esc(DIMS[d].blurb) + '</span></div>';
        }).join('') +
      '</div>' +
      '<div class="card mt14"><div class="eb">Compatibility terms</div>' +
        entry('Compatibility score', 'The average gap between two people\u2019s scores across all 5 dimensions, converted to a 0\u2013100 scale and clipped to 32\u201397. Roughly: 80+ strong, 60\u201379 solid, 45\u201359 workable, below 45 a genuinely wide gap.') +
        entry('% aligned (trait-by-trait)', 'A per-dimension figure, roughly 100 minus the gap on that one dimension. Not a slice of the overall compatibility score \u2014 a separate, dimension-specific number.') +
        entry('Shared ground', 'A note flagging a dimension you both score high on \u2014 easy, instinctive territory.') +
        entry('Natural division', 'A note flagging a wide gap on one dimension, framed as a possible complement rather than a clash.') +
        entry('Watch: \u2026 (two centers / distance / pace)', 'A note flagging a specific pattern worth being aware of \u2014 both high on Identity (two firm centers), both low on Social (neither reaches out first), or a wide Response gap (mismatched tempo).') +
        entry('Quiet balance', 'Nothing on the profile strongly stands out either way \u2014 not a bad sign, just a flatter comparison.') +
        entry('Similarity-attraction vs. complementarity', 'Two established but competing ideas in personality psychology: that shared traits ease connection, or that different traits expand what a pair can cover together. This tool reports the gap and doesn\u2019t take a side.') +
        entry('Archetype pairing', 'A narrative built from each person\u2019s own archetype \u2014 name, tag, lead strength, known weak point, and stress pattern \u2014 showing how the two specific archetypes tend to interact, not just the raw dimension numbers.') +
      '</div>' +
      '<div class="card mt14"><div class="eb">Group terms</div>' +
        entry('Average profile', 'The group\u2019s scores on each dimension, averaged across everyone in it \u2014 the group\u2019s center of gravity, not an accurate description of any one person.') +
        entry('Variance', 'How spread out individual scores are around the group average, dimension by dimension. Low variance = the group genuinely agrees there; high variance = a real, measurable split.') +
        entry('Team archetype', 'The group\u2019s average profile, run through the same 36-archetype classifier used for an individual result \u2014 names the group\u2019s collective tendency, not any person\u2019s type.') +
        entry('Pairwise matrix', 'Every two-person combination in the group, scored exactly like 1:1 Compatibility.') +
        entry('Natural role', 'A heuristic label (e.g. Decision-driver, Mediator, Steady executor) derived from each person\u2019s top two dimensions \u2014 a tendency, not a job assignment.') +
        entry('Natural sub-groupings', 'For groups of 5+, which people the numbers lean toward for two different working modes \u2014 fast decisions vs. careful review \u2014 based on combined dimension scores. Illustrative, not a staffing decision.') +
        entry('Facilitation prompt', 'A ready-to-use conversation starter tied to the group\u2019s most scattered dimension, meant for an actual team discussion.') +
      '</div>' +
      '<button class="btn ghost block mt24" data-act="home">Back home</button>' +
    '</div>';
}


function exportShareCard() {
  var r = state.result, m = r.match;
  var canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 560;
  var ctx = canvas.getContext('2d');
  var dark = state.theme === 'dark';
  ctx.fillStyle = dark ? '#0F0E14' : '#FFFDF8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = dark ? '#6D6980' : '#A39B87';
  ctx.font = '600 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PSYCHE CORE \u00b7 PRISM INSTRUMENT', 240, 46);

  ctx.fillStyle = dark ? '#F5F4FA' : '#171410';
  ctx.font = '700 30px Georgia';
  wrapText(ctx, m.arche.name, 240, 100, 400, 34);

  ctx.font = '12px monospace';
  ctx.fillStyle = dark ? '#A5A1B8' : '#6B6455';
  ctx.fillText(m.code + '  \u00b7  ' + m.confidence + '% confidence', 240, 150);

  // radar
  var cx = 240, cy = 320, R = 130;
  var colors = { P: '#8B5CF6', R: '#3D82F6', I: '#FBBF24', S: '#FB5D8A', M: '#2DD4A0' };
  ctx.strokeStyle = dark ? '#2A2836' : '#EAE3D3';
  for (var ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (var i = 0; i <= 5; i++) {
      var angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      var rr = (R * ring) / 4;
      var x = cx + rr * Math.cos(angle), y = cy + rr * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.beginPath();
  DIM_ORDER.forEach(function (d, i) {
    var angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    var rr = (R * r.dims[d]) / 100;
    var x = cx + rr * Math.cos(angle), y = cy + rr * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(139,92,246,0.2)';
  ctx.fill();
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = '600 13px monospace';
  DIM_ORDER.forEach(function (d, i) {
    var angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    var x = cx + (R + 24) * Math.cos(angle), y = cy + (R + 24) * Math.sin(angle);
    ctx.fillStyle = colors[d];
    ctx.fillText(d, x, y);
  });

  ctx.fillStyle = dark ? '#6D6980' : '#A39B87';
  ctx.font = '11px monospace';
  ctx.fillText('psyche-core.app', 240, 530);

  var link = document.createElement('a');
  link.download = 'psyche-' + m.arche.name.replace(/\s+/g, '-').toLowerCase() + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  var words = text.split(' '), line = '', lines = [];
  words.forEach(function (w) {
    var test = line + w + ' ';
    if (ctx.measureText(test).width > maxWidth && line !== '') { lines.push(line); line = w + ' '; }
    else line = test;
  });
  lines.push(line);
  var startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach(function (l, i) { ctx.fillText(l.trim(), x, startY + i * lineHeight); });
}

/* Domain phrase per facet, used by the dynamic 20-facts generator.
   Matches the 20 real facet keys defined in DIMS above. */
var FACET_DOMAINS = {
  'P.abstraction': 'how you take in information',
  'P.curiosity': 'how you relate to novelty',
  'P.attention': 'how wide your attention spreads',
  'P.intuition': 'how you extract meaning from what you observe',
  'R.tempo': 'how quickly you act on a decision',
  'R.expression': 'how openly you show what you feel',
  'R.adaptability': 'how you respond when a plan changes',
  'R.risk': 'how you weigh a bet against its downside',
  'I.autonomy': 'whose judgment you steer by',
  'I.conviction': 'how easily your beliefs move under pressure',
  'I.distinct': 'whether you aim to stand apart or belong',
  'I.stability': 'how consistent your sense of self stays across contexts',
  'S.warmth': 'how you lead in a new interaction',
  'S.gregarious': 'where you recharge',
  'S.empathy': 'how you read what someone else is feeling',
  'S.harmony': 'how you handle friction in a group',
  'M.drive': 'what keeps you reaching for more',
  'M.discipline': 'whether structure or spontaneity fuels your follow-through',
  'M.ambition': 'the scale of what you aim at',
  'M.persistence': 'what happens when the initial spark fades',
};

function buildFacetDefsAndScores(facets) {
  var defs = {}, scores = {};
  DIM_ORDER.forEach(function (d) {
    Object.keys(DIMS[d].facets).forEach(function (fk) {
      var key = d + '.' + fk, fac = DIMS[d].facets[fk];
      defs[key] = { domain: FACET_DOMAINS[key] || ('your ' + fac.name.toLowerCase()), hi: fac.hi, lo: fac.lo };
      scores[key] = facets[key];
    });
  });
  return { defs: defs, scores: scores };
}

function wireActions() {
  document.querySelectorAll('[data-act]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var act = btn.getAttribute('data-act');
      if (act === 'start') { state.screen = 'assessment'; state.qIndex = 0; state.answers = []; render(); }
      else if (act === 'goresults') { state.screen = 'results'; render(); }
      else if (act === 'account') { state.authError = null; state.authNotice = null; state.screen = state.user ? 'account' : 'auth'; render(); }
      else if (act === 'google') {
        state.authError = null; state.authNotice = null; state.authBusy = true; render();
        AUTH.signInWithGoogle().then(function (r) { if (r.error) authDone({ authError: r.error }); /* else: browser is redirecting to Google */ });
      }
      else if (act === 'authmode') { state.authMode = btn.getAttribute('data-mode'); state.authError = null; state.authNotice = null; render(); }
      else if (act === 'signout') {
        state.authBusy = true; render();
        AUTH.signOut().then(function (r) {
          if (r.error) return authDone({ authError: r.error });
          // Don't leave a signed-in user's result behind on a shared device once it is safely in their account.
          if (state.syncStatus === 'saved') { state.result = null; state.resultAt = 0; persist(); }
          state.user = null; state.syncStatus = null; resetSocial();
          authDone({ screen: 'home' });
        });
      }
      else if (act === 'syncnow') { pushResult().then(function () { render(); }); render(); }
      else if (act === 'deletecloud') {
        if (!window.confirm('Delete the copy of your result saved in your account? This also stops sharing your scores with connections and groups. The copy on this device is kept.')) return;
        AUTH.deleteResult(state.user.id).then(function (r) {
          if (!r.error) return AUTH.saveProfile(state.user.id, state.user.email, myName(), null);
          return r;
        }).then(function (r) {
          authDone(r.error ? { authError: r.error } : { authNotice: 'Saved copy deleted from your account.', syncStatus: null });
        });
      }
      else if (act === 'home') { state.screen = 'home'; render(); }
      else if (act === 'answer') { answerCurrent(+btn.getAttribute('data-v')); }
      else if (act === 'skipq') { advanceQuestion(); }
      else if (act === 'prevq') { state.qIndex = Math.max(0, state.qIndex - 1); render(); }
      else if (act === 'tab') { state.resultsTab = btn.getAttribute('data-tab'); render(); }
      else if (act === 'toggletheme') { state.theme = state.theme === 'dark' ? 'light' : 'dark'; persist(); render(); }
      else if (act === 'share') { exportShareCard(); }
      else if (act === 'exportpdf') { exportFullPDF(); }
      else if (act === 'archlib') { state.screen = 'archlib'; render(); }
      else if (act === 'archopen') { state.archKey = btn.getAttribute('data-key'); state.screen = 'archdetail'; render(); }
      else if (act === 'compare') { state.screen = 'compare'; setSocialMsg(null); render(); refreshSocial(); }
      else if (act === 'invitecompare') {
        var ie = document.getElementById('inviteEmail').value.trim().toLowerCase();
        state.inviteDraft = ie;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ie)) { setSocialMsg('Enter a valid email address.'); return render(); }
        if (ie === userEmail()) { setSocialMsg('That\u2019s your own email.'); return render(); }
        doSocial(AUTH.inviteByEmail(state.user, myName(), ie), 'Invite saved for ' + ie + '. Tap \u201cCopy invite message\u201d below and send it to them.', function () { state.inviteDraft = ''; });
      }
      else if (act === 'makelink') { doSocial(AUTH.createLink(state.user, myName()), 'Link created \u2014 copy it below and send it to one person.'); }
      else if (act === 'acceptconn') { doSocial(AUTH.acceptConnection(btn.getAttribute('data-id')), 'Connected! Tap \u201cCompare\u201d next to their name.'); }
      else if (act === 'removeconn') {
        if (btn.getAttribute('data-confirm') && !window.confirm('Remove this connection? You will both stop seeing each other\u2019s scores.')) return;
        var rid = btn.getAttribute('data-id');
        if (state.compareWith === rid) state.compareWith = null;
        doSocial(AUTH.removeConnection(rid), 'Done.');
      }
      else if (act === 'comparewith') { state.compareWith = btn.getAttribute('data-id'); render(); window.scrollTo && window.scrollTo(0, 0); }
      else if (act === 'exportcompatpdf') { exportCompatPDF(); }
      else if (act === 'exportgrouppdf') { exportGroupPDF(); }
      else if (act === 'glossary') { state.screen = 'glossary'; render(); }
      else if (act === 'copycode') {
        var codeToCopy = btn.getAttribute('data-code');
        var markCopied = function () { state.codeCopied = true; render(); setTimeout(function () { state.codeCopied = false; render(); }, 2000); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(codeToCopy).then(markCopied, function () { fallbackCopy(codeToCopy, markCopied); });
        } else {
          fallbackCopy(codeToCopy, markCopied);
        }
      }
      else if (act === 'group') { state.screen = 'group'; setSocialMsg(null); render(); refreshSocial(); }
      else if (act === 'creategroup') {
        var gn = document.getElementById('groupNewName').value.trim();
        state.groupNameDraft = gn;
        if (!gn) { setSocialMsg('Give the group a name.'); return render(); }
        doSocial(AUTH.createGroup(gn), 'Group created. Invite people by email below.', function (r) { state.groupNameDraft = ''; state.activeGroup = r.id; });
      }
      else if (act === 'opengroup') { state.activeGroup = btn.getAttribute('data-id'); setSocialMsg(null); render(); refreshSocial(); }
      else if (act === 'backgroups') { state.activeGroup = null; setSocialMsg(null); render(); }
      else if (act === 'invitegroup') {
        var ge = document.getElementById('groupInviteEmail').value.trim().toLowerCase();
        state.groupInviteDraft = ge;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ge)) { setSocialMsg('Enter a valid email address.'); return render(); }
        doSocial(AUTH.inviteToGroup(state.activeGroup, ge), 'Invited ' + ge + '. They see it when they sign in with that email.', function () { state.groupInviteDraft = ''; });
      }
      else if (act === 'acceptgroup') { var agid = btn.getAttribute('data-id'); doSocial(AUTH.acceptGroup(agid), 'You joined the group.', function () { state.activeGroup = agid; }); }
      else if (act === 'declinegroup') { doSocial(AUTH.removeGroupMember(btn.getAttribute('data-id'), userEmail()), 'Invitation declined.'); }
      else if (act === 'leavegroup') {
        if (!window.confirm('Leave this group? You will stop seeing each other\u2019s scores.')) return;
        var lg = state.activeGroup; doSocial(AUTH.removeGroupMember(lg, userEmail()), 'You left the group.', function () { state.activeGroup = null; });
      }
      else if (act === 'removemember') {
        if (!window.confirm('Remove this person from the group?')) return;
        doSocial(AUTH.removeGroupMember(state.activeGroup, btn.getAttribute('data-email')), 'Removed.');
      }
      else if (act === 'deletegroup') {
        if (!window.confirm('Delete this group for everyone?')) return;
        var dg = state.activeGroup; doSocial(AUTH.deleteGroup(dg), 'Group deleted.', function () { state.activeGroup = null; });
      }
      else if (act === 'overview') { state.screen = 'home'; render(); }
      else if (act === 'science') {
        var sci = btn.getAttribute('data-sci');
        if (sci) state.scienceTab = sci;
        state.screen = 'science'; render();
      }
      else if (act === 'scitab') { state.scienceTab = btn.getAttribute('data-tab'); render(); }
    });
  });
  wireAuthForms();
}

captureJoinParam();
render();
if (AUTH.enabled) AUTH.init(onAuthEvent);
})();
