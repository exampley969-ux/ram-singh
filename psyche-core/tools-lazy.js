/* ============================================================
   tools-lazy.js — loaded on demand (Patterns, Compare and Group screens), not on first paint.
   Part 1 extends EnginePlus with the what-if, interaction-matrix, drill-down, pair and group tool logic (no DOM).
   Part 2 builds the screens; it only runs inside the app (needs window.PsycheHost from app-core.js).
   Rule-based and in-browser: nothing here stores or sends anything. See docs/TRAIT_LAB.md and docs/COMPAT_GROUP_TOOLS.md.
   ============================================================ */
(function () {
var EP = EnginePlus, I = EP._i, facetKeys = I.facetKeys, facetInfo = I.facetInfo, zone = I.zone, SCENARIOS = I.SCENARIOS, TENSIONS = I.TENSIONS, PATTERNS = I.PATTERNS, PATTERN_KEYS = I.PATTERN_KEYS, tensionOn = I.tensionOn,
  individual = I.individual, discover = I.discover, traitRows = I.traitRows, scenarioScore = I.scenarioScore, poleOf = I.poleOf, SHORT = I.SHORT, pair = I.pair, group = I.group, weighted = I.weighted, ROLES = I.ROLES;

/* ---------- Part 1: engine ---------- */
/* ---------- Trait lab: what-if, interaction matrix, trait drill-down ----------
   All three are derived from rules that already exist in this file (scenario weights, tension list, pattern rules),
   so every number can be traced. Nothing here is a statistical correlation between traits and nothing is stored. */
var ANSWER_WORDS = { 1: 'Strongly disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly agree' };
function clamp100(v) { v = Math.round(Number(v)); return isFinite(v) ? Math.max(0, Math.min(100, v)) : 50; }
function copyFacets(f) { var o = {}; facetKeys().forEach(function (k) { o[k] = f[k]; }); return o; }

/* Which way does a trait push a situation score right now? +1 raises it, -1 lowers it; size 0..1 from distance to 50. */
function pushOf(sc, k, f) { var w = sc.w[k]; return (w >= 0 ? 1 : -1) * (f[k] - 50) / 50; }

/* pairLink: how two traits act together across the situations both feed.
   value > 0  -> they push the same situations the same way (reinforce)
   value < 0  -> they push the same situations opposite ways (pull against each other)
   linked false -> no shared situation and no listed tension, so the rules say nothing about this pair. */
function pairLink(f, a, b) {
  var syn = 0, ten = 0, cap = 0, via = [];
  SCENARIOS.forEach(function (sc) {
    if (sc.w[a] === undefined || sc.w[b] === undefined) return;
    var m = Math.sqrt(Math.abs(sc.w[a]) * Math.abs(sc.w[b])), pa = pushOf(sc, a, f), pb = pushOf(sc, b, f);
    cap += m;
    var amt = m * Math.min(Math.abs(pa), Math.abs(pb));
    if (pa * pb > 0) syn += amt; else if (pa * pb < 0) ten += amt;
    via.push({ id: sc.id, title: sc.title, kind: pa * pb > 0 ? 'reinforce' : pa * pb < 0 ? 'oppose' : 'neutral', amount: Math.round(amt * 100) / 100 });
  });
  var rule = TENSIONS.filter(function (t) { return (t.a[0] === a && t.b[0] === b) || (t.a[0] === b && t.b[0] === a); })[0] || null;
  var ruleOn = !!(rule && tensionOn(f, rule));
  var patIds = PATTERNS.filter(function (p) { return PATTERN_KEYS[p.id].indexOf(a) >= 0 && PATTERN_KEYS[p.id].indexOf(b) >= 0; })
    .map(function (p) { return { id: p.id, name: p.name, active: !!p.when(f) }; });
  var linked = cap > 0 || !!rule || patIds.length > 0;
  var value = cap > 0 ? (syn - ten) / cap : 0;
  if (ruleOn) value = Math.min(value, 0) - 0.5;
  value = Math.max(-1, Math.min(1, value));
  return { a: a, b: b, linked: linked, value: Math.round(value * 100) / 100, via: via, ruleOn: ruleOn, ruleText: rule ? rule.text : null, patterns: patIds };
}

/* The 20 x 20 matrix (symmetric; the diagonal is the trait itself and is left empty). */
function interactions(f) {
  var keys = facetKeys(), cells = [], links = 0;
  keys.forEach(function (a, i) {
    cells[i] = [];
    keys.forEach(function (b, j) {
      if (i === j) { cells[i][j] = null; return; }
      if (j < i) { cells[i][j] = cells[j][i]; return; }
      var c = pairLink(f, a, b); if (c.linked) links++;
      cells[i][j] = c;
    });
  });
  return { keys: keys, cells: cells, linkedPairs: links, totalPairs: keys.length * (keys.length - 1) / 2 };
}
function strongestLinks(f, key, n) {
  var out = [];
  facetKeys().forEach(function (b) { if (b === key) return; var c = pairLink(f, key, b); if (c.linked) out.push({ other: b, link: c }); });
  var syn = out.filter(function (x) { return x.link.value > 0.05; }).sort(function (x, y) { return y.link.value - x.link.value || (x.other < y.other ? -1 : 1); }).slice(0, n || 3);
  var ten = out.filter(function (x) { return x.link.value < -0.05; }).sort(function (x, y) { return x.link.value - y.link.value || (x.other < y.other ? -1 : 1); }).slice(0, n || 3);
  return { reinforce: syn, oppose: ten };
}

/* whatIf: change some trait scores and report what moves. edits = { 'P.curiosity': 80, ... }. Unknown keys are ignored. */
function whatIf(base, edits) {
  var keys = facetKeys(), f2 = copyFacets(base), changed = [];
  keys.forEach(function (k) {
    if (edits && Object.prototype.hasOwnProperty.call(edits, k)) {
      if (typeof edits[k] !== 'number' || !isFinite(edits[k])) return;                       // ignore anything that is not a real number
      var v = clamp100(edits[k]); if (v !== Math.round(base[k])) { f2[k] = v; changed.push(k); }
    }
  });
  var A = individual(base), B = individual(f2), dA = discover(base, A.patterns, { max: 3 }), dB = discover(f2, B.patterns, { max: 3 });
  var scen = B.scenarios.map(function (s, i) { return { id: s.id, title: s.title, before: A.scenarios[i].score, after: s.score, delta: s.score - A.scenarios[i].score, band: s.band, bandBefore: A.scenarios[i].band }; });
  function diff(a, b, id) {
    var ia = a.map(id), ib = b.map(id);
    return { gained: b.filter(function (x) { return ia.indexOf(id(x)) < 0; }), lost: a.filter(function (x) { return ib.indexOf(id(x)) < 0; }), kept: b.filter(function (x) { return ia.indexOf(id(x)) >= 0; }) };
  }
  return { facets: f2, changed: changed, rows: traitRows(f2), scenarios: scen,
    patterns: diff(A.patterns, B.patterns, function (p) { return p.id; }),
    tensions: diff(A.tensions, B.tensions, function (t) { return t.keys.join('|'); }),
    discovered: diff(dA, dB, function (d) { return d.id; }), after: B };
}

/* traitDetail: everything behind one trait. ans = the stored answers (1-5 per question) or null if they are not on this device. */
function traitDetail(f, key, ans) {
  if (facetKeys().indexOf(key) < 0) return null;
  var info = facetInfo(key), score = Math.round(f[key]), z = zone(score);
  var qs = [], raw = 0, haveAns = Array.isArray(ans) && ans.length === QUESTIONS.length;
  QUESTIONS.forEach(function (q, i) {
    if (q.f !== key) return;
    var v = haveAns ? ans[i] : null, step = (v == null ? null : (v - 3) * q.d);
    qs.push({ index: i, text: q.t, direction: q.d, answer: v == null ? null : v, answerWord: v == null ? null : ANSWER_WORDS[v], shift: step == null ? null : step * 12.5 });
    if (step != null) raw += step;
  });
  var scen = SCENARIOS.filter(function (sc) { return sc.w[key] !== undefined; }).map(function (sc) {
    var w = sc.w[key], p = pushOf(sc, key, f);
    return { id: sc.id, title: sc.title, weight: Math.abs(w), effect: w >= 0 ? 'raises' : 'lowers', now: Math.abs(p) < 0.1 ? 'little effect now' : p > 0 ? 'helping now' : 'holding back now', score: scenarioScore(sc, f) };
  }).sort(function (a, b) { return b.weight - a.weight; });
  var pats = PATTERNS.filter(function (p) { return PATTERN_KEYS[p.id].indexOf(key) >= 0; }).map(function (p) { return { id: p.id, name: p.name, active: !!p.when(f), keys: PATTERN_KEYS[p.id].slice() }; });
  var tens = TENSIONS.filter(function (t) { return t.a[0] === key || t.b[0] === key; }).map(function (t) { return { text: t.text, active: tensionOn(f, t), keys: [t.a[0], t.b[0]] }; });
  var disc = discover(f, individual(f).patterns, { max: 12 }).filter(function (d) { return d.keys.indexOf(key) >= 0; });
  var pole = z === 'mid' ? null : poleOf(key, z);
  return { key: key, name: info.name, dim: info.dim, color: info.color, code: SHORT[key], score: score, zone: z, hi: info.hi, lo: info.lo, pole: pole,
    questions: qs, haveAnswers: haveAns && qs.every(function (q) { return q.answer != null; }), formula: 'Starts at 50. Each of the 2 answers can move it up to 25 points either way.',
    scenarios: scen, patterns: pats, tensions: tens, discovered: disc, links: strongestLinks(f, key, 3) };
}

/* ---------- Compatibility + group tools (all rule-based, in-browser, derived from the same scores and rules as the rest) ---------- */
function applyEdits(f, e) { var o = copyFacets(f); Object.keys(e || {}).forEach(function (k) { if (o[k] !== undefined && typeof e[k] === 'number' && isFinite(e[k])) o[k] = clamp100(e[k]); }); return o; }
function sim(fa, fb) { return Math.round(100 - facetKeys().reduce(function (s, k) { return s + Math.abs(fa[k] - fb[k]); }, 0) / 20); }

/* Pair 1: what-if. ea / eb = edits to person A's / B's scores. Compares facet similarity and the joint situation scores. */
function pairWhatIf(fa, fb, an, bn, ea, eb) {
  var fa2 = applyEdits(fa, ea), fb2 = applyEdits(fb, eb), P0 = pair(fa, fb, an, bn, 'partner'), P1 = pair(fa2, fb2, an, bn, 'partner');
  var by0 = {}; P0.scenarios.forEach(function (s) { by0[s.id] = s; });
  var changed = facetKeys().filter(function (k) { return fa2[k] !== fa[k] || fb2[k] !== fb[k]; });
  return { changed: changed, fa: fa2, fb: fb2, simBefore: sim(fa, fb), simAfter: sim(fa2, fb2),
    scenarios: P1.scenarios.map(function (s) { var o = by0[s.id]; return { id: s.id, title: s.title, before: o.joint, after: s.joint, delta: s.joint - o.joint, bandBefore: o.band, band: s.band, splitBefore: o.split, split: s.split }; }),
    friction: P1.friction.map(function (r) { return r.name; }), frictionBefore: P0.friction.map(function (r) { return r.name; }) };
}

/* Pair 2: where you lean the same way, where you lean opposite ways (cover for each other), and where neither leans. */
function pairCovers(fa, fb, an, bn) {
  var same = [], cover = [], open = [];
  facetKeys().forEach(function (k) {
    var i = facetInfo(k), za = zone(fa[k]), zb = zone(fb[k]);
    if (za !== 'mid' && za === zb) same.push({ key: k, name: i.name, pole: (za === 'high' ? i.hi : i.lo)[0], a: Math.round(fa[k]), b: Math.round(fb[k]), gap: Math.abs(fa[k] - fb[k]) });
    else if (za !== 'mid' && zb !== 'mid') cover.push({ key: k, name: i.name, aPole: (za === 'high' ? i.hi : i.lo)[0], bPole: (zb === 'high' ? i.hi : i.lo)[0], a: Math.round(fa[k]), b: Math.round(fb[k]), gap: Math.abs(fa[k] - fb[k]) });
    else if (za === 'mid' && zb === 'mid') open.push({ key: k, name: i.name });
  });
  var depth = function (x) { return Math.abs(x.a - 50) + Math.abs(x.b - 50); };
  same.sort(function (x, y) { return depth(y) - depth(x); }); cover.sort(function (x, y) { return y.gap - x.gap; });
  return { same: same, cover: cover, open: open };
}

/* Pair 3: friction forecast: the situations where you two score furthest apart, who is likely to do what, and what to agree first. */
function pairForecast(fa, fb, an, bn) {
  var rows = SCENARIOS.map(function (sc) {
    var sa = scenarioScore(sc, fa), sb = scenarioScore(sc, fb), aHi = sa >= sb;
    return { id: sc.id, title: sc.title, gap: Math.abs(sa - sb), hiName: aHi ? an : bn, loName: aHi ? bn : an, hiScore: Math.max(sa, sb), loScore: Math.min(sa, sb),
      hiRole: sc.hiRole, loRole: sc.loRole, forHi: sc.lever, forLo: sc.grow };
  }).sort(function (x, y) { return y.gap - x.gap || (x.id < y.id ? -1 : 1); });
  return { top: rows.filter(function (r) { return r.gap >= 15; }).slice(0, 3), calm: rows.filter(function (r) { return r.gap < 8; }).map(function (r) { return r.title; }) };
}

/* Pair 4: after a hard day. Voice (expression) and company (gregarious) set how each person tends to recover; stability sets how long it lingers. */
function recoverStyle(f) {
  var v = f['R.expression'] >= 50, c = f['S.gregarious'] >= 50, s = f['I.stability'];
  return { voice: v, company: c, key: (v ? 'talk' : 'quiet') + '-' + (c ? 'people' : 'alone'),
    text: v && c ? 'tends to talk it through with people around' : v ? 'tends to talk it through, but one-to-one or after some time alone' : c ? 'tends to want company without having to talk about it' : 'tends to need quiet and time alone before talking',
    linger: s <= 38 ? 'feels it more strongly and for longer' : s >= 62 ? 'usually recovers quickly' : 'recovers at an average pace' };
}
function pairRecharge(fa, fb, an, bn) {
  var A = recoverStyle(fa), B = recoverStyle(fb), match = A.key === B.key ? 'same' : (A.voice === B.voice || A.company === B.company) ? 'partly' : 'opposite';
  var tip = match === 'same' ? 'You recover in a similar way, so the easy default works. The risk is both of you needing the same thing and neither offering the other what they lack: check in once.'
    : match === 'partly' ? 'You overlap on one thing and differ on the other. Ask “talk, company, or space?” before guessing; it takes ten seconds.'
    : 'You tend to recover in opposite ways. Agree a sign in advance: one says “I need an hour”, the other says “I need to talk”, and both are treated as normal.';
  return { a: { name: an, style: A }, b: { name: bn, style: B }, match: match, tip: tip, lingerGap: Math.abs(fa['I.stability'] - fb['I.stability']) >= 25 };
}

/* Pair 5: who leads what. Higher score leads; within 8 points either can; counts show whether the load is balanced. */
function pairLeads(fa, fb, an, bn) {
  var cnt = { a: 0, b: 0 }, rows = SCENARIOS.map(function (sc) {
    var sa = scenarioScore(sc, fa), sb = scenarioScore(sc, fb), d = sa - sb, who = Math.abs(d) < 8 ? 'either' : d > 0 ? 'a' : 'b';
    if (who !== 'either') cnt[who]++;
    return { id: sc.id, title: sc.title, a: sa, b: sb, who: who, name: who === 'a' ? an : who === 'b' ? bn : null, role: who === 'a' ? sc.hiRole : who === 'b' ? sc.hiRole : null };
  });
  var tot = cnt.a + cnt.b, lopsided = tot >= 4 && Math.max(cnt.a, cnt.b) / tot >= 0.75;
  return { rows: rows, countA: cnt.a, countB: cnt.b, either: rows.length - tot, lopsided: lopsided, busy: lopsided ? (cnt.a > cnt.b ? an : bn) : null };
}

/* Group 1: cover depth. How many natural fits each working role has, and who would be next best. */
function groupCover(members) {
  var rows = ROLES.map(function (r) {
    var fits = members.map(function (m) { return { name: m.name, fit: weighted(r.w, m.facets) }; }).sort(function (a, b) { return b.fit - a.fit || (a.name < b.name ? -1 : 1); });
    var champs = fits.filter(function (x) { return x.fit >= 62; }), depth = champs.length;
    return { id: r.id, name: r.name, depth: depth, state: depth === 0 ? 'none' : depth === 1 ? 'single' : 'deep', champions: champs.map(function (x) { return x.name; }),
      backup: depth === 0 ? null : fits[depth] || null, best: fits[0] };
  });
  var load = {}; members.forEach(function (m) { load[m.name] = 0; }); rows.forEach(function (r) { if (r.state === 'single') load[r.champions[0]]++; });
  return { rows: rows, single: rows.filter(function (r) { return r.state === 'single'; }), none: rows.filter(function (r) { return r.state === 'none'; }), load: load };
}

/* Group 2: fault lines. The two-way split that separates the group most clearly across all 20 traits (up to 14 members). */
function groupFault(members) {
  var n = members.length, keys = facetKeys();
  if (n < 3) return { ok: false, reason: 'needs at least 3 members' };
  if (n > 14) return { ok: false, reason: 'shown for groups of up to 14 people' };
  var mean = {}, total = 0; keys.forEach(function (k) { var m = members.reduce(function (s, x) { return s + x.facets[k]; }, 0) / n; mean[k] = m; total += members.reduce(function (s, x) { return s + Math.pow(x.facets[k] - m, 2); }, 0); });
  if (total === 0) return { ok: false, reason: 'everyone scored the same' };
  var best = null, minSide = n >= 4 ? 2 : 1;
  for (var mask = 1; mask < (1 << (n - 1)); mask++) {          // member n-1 is always on side B, so each split is counted once
    var cA = 0; for (var i = 0; i < n; i++) if (mask & (1 << i)) cA++;
    var cB = n - cA; if (cA < minSide || cB < minSide) continue;
    var between = 0;
    keys.forEach(function (k) { var sa = 0; for (var j = 0; j < n; j++) if (mask & (1 << j)) sa += members[j].facets[k]; var ma = sa / cA, mb = (mean[k] * n - sa) / cB; between += cA * Math.pow(ma - mean[k], 2) + cB * Math.pow(mb - mean[k], 2); });
    var st = between / total;
    if (!best || st > best.s + 1e-9) best = { s: st, mask: mask, cA: cA };
  }
  var A = [], B = []; members.forEach(function (m, i) { (best.mask & (1 << i) ? A : B).push(m); });
  var avg = function (arr, k) { return arr.reduce(function (s, x) { return s + x.facets[k]; }, 0) / arr.length; };
  var drivers = keys.map(function (k) { var i = facetInfo(k), a = avg(A, k), b = avg(B, k); return { key: k, name: i.name, gap: Math.round(Math.abs(a - b)), aPole: (a >= b ? i.hi : i.lo)[0], bPole: (a >= b ? i.lo : i.hi)[0], aAvg: Math.round(a), bAvg: Math.round(b) }; })
    .sort(function (x, y) { return y.gap - x.gap || (x.key < y.key ? -1 : 1); }).slice(0, 3);
  var s = Math.round(best.s * 100) / 100;
  return { ok: true, strength: s, label: s >= 0.6 ? 'clear split' : s >= 0.4 ? 'moderate split' : 'no clear camps', sideA: A.map(function (m) { return m.name; }), sideB: B.map(function (m) { return m.name; }), drivers: drivers, small: n <= 4 };
}

/* Group 3: rotating meeting roles. Week 1 gives each role to its best fit; later weeks rotate the roles around the group. */
var MEET = [
  { id: 'facilitator', name: 'Facilitator', desc: 'keeps everyone heard and the talk on track', w: { 'S.empathy': 1, 'R.expression': 0.8, 'S.harmony': 0.5, 'I.conviction': -0.4 } },
  { id: 'timekeeper', name: 'Timekeeper', desc: 'watches the clock and the agenda', w: { 'M.discipline': 1, 'R.tempo': 0.6, 'P.attention': -0.4 } },
  { id: 'challenger', name: 'Challenger', desc: 'tests the plan before the group commits', w: { 'I.conviction': 1, 'I.autonomy': 0.6, 'I.distinct': 0.5, 'S.harmony': -0.5 } },
  { id: 'synthesiser', name: 'Synthesiser', desc: 'sums up the discussion and the decisions', w: { 'P.abstraction': 1, 'P.intuition': 0.6, 'S.empathy': 0.4 } }
];
function groupRotation(members, weeks) {
  var n = members.length, roles = MEET.slice(0, Math.min(MEET.length, n)), W = Math.max(2, Math.min(weeks || 4, 6));
  var fit = {}; members.forEach(function (m) { fit[m.name] = {}; MEET.forEach(function (r) { fit[m.name][r.id] = weighted(r.w, m.facets); }); });
  var cand = []; members.forEach(function (m) { roles.forEach(function (r) { cand.push({ m: m.name, r: r.id, s: fit[m.name][r.id] }); }); });
  cand.sort(function (x, y) { return y.s - x.s || (x.m < y.m ? -1 : 1) || (x.r < y.r ? -1 : 1); });
  var usedM = {}, usedR = {}, first = {};
  cand.forEach(function (c) { if (usedM[c.m] || usedR[c.r]) return; usedM[c.m] = 1; usedR[c.r] = 1; first[c.r] = c.m; });
  var order = roles.map(function (r) { return first[r.id]; }); members.forEach(function (m) { if (order.indexOf(m.name) < 0) order.push(m.name); });
  var plan = []; for (var w = 0; w < W; w++) plan.push({ week: w + 1, natural: w === 0, picks: roles.map(function (r, i) { var who = order[(i + w) % n]; return { role: r.name, who: who, fit: fit[who][r.id] }; }) });
  return { roles: roles.map(function (r) { return { id: r.id, name: r.name, desc: r.desc }; }), plan: plan };
}

/* Group 4: learning buddies. Pairs everyone up (best total of useful differences) so each pair has something to swap. */
function groupBuddies(members) {
  var n = members.length, keys = facetKeys();
  if (n < 2) return { ok: false, reason: 'needs at least 2 members' }; if (n > 16) return { ok: false, reason: 'shown for groups of up to 16 people' };
  var sc = function (a, b) { return keys.reduce(function (s, k) { return s + Math.max(0, Math.abs(a.facets[k] - b.facets[k]) - 20); }, 0); };
  var N = n % 2 ? n + 1 : n, S = []; for (var i = 0; i < N; i++) { S[i] = []; for (var j = 0; j < N; j++) S[i][j] = (i >= n || j >= n || i === j) ? 0 : sc(members[i], members[j]); }
  var memo = {}, full = (1 << N) - 1;
  function go(mask) { if (mask === full) return { v: 0, p: [] }; if (memo[mask] !== undefined) return memo[mask];
    var a = 0; while (mask & (1 << a)) a++; var best = null;
    for (var b = a + 1; b < N; b++) { if (mask & (1 << b)) continue; var r = go(mask | (1 << a) | (1 << b)), v = r.v + S[a][b]; if (!best || v > best.v + 1e-9) best = { v: v, p: [[a, b]].concat(r.p) }; }
    return (memo[mask] = best); }
  var res = go(0), pairs = [], solo = null;
  res.p.forEach(function (p) { if (p[0] >= n || p[1] >= n) solo = members[p[0] >= n ? p[1] : p[0]]; else pairs.push([members[p[0]], members[p[1]]]); });
  var out = pairs.map(function (p) {
    var a = p[0], b = p[1], sw = keys.map(function (k) { var d = a.facets[k] - b.facets[k], i = facetInfo(k); return { name: i.name, gap: Math.abs(d), hiWho: d > 0 ? a.name : b.name, loWho: d > 0 ? b.name : a.name, hi: i.hi[0], lo: i.lo[0] }; })
      .filter(function (x) { return x.gap >= 25; }).sort(function (x, y) { return y.gap - x.gap || (x.name < y.name ? -1 : 1); }).slice(0, 2);
    return { a: a.name, b: b.name, swaps: sw };
  });
  var third = null; if (solo && out.length) { var bi = 0, bv = -1; pairs.forEach(function (p, i) { var v = sc(solo, p[0]) + sc(solo, p[1]); if (v > bv) { bv = v; bi = i; } }); third = { name: solo.name, joins: out[bi].a + ' & ' + out[bi].b }; }
  return { ok: true, pairs: out, third: third };
}

/* Group 5: member what-if. Change one member's scores and see what moves for the group. */
function groupWhatIf(members, idx, edits) {
  var m2 = members.map(function (m, i) { return i === idx ? { name: m.name, dims: m.dims, key: m.key, facets: applyEdits(m.facets, edits) } : m; });
  var G0 = group(members), G1 = group(m2), C0 = groupCover(members), C1 = groupCover(m2), F0 = groupFault(members), F1 = groupFault(m2);
  var changed = facetKeys().filter(function (k) { return m2[idx].facets[k] !== members[idx].facets[k]; });
  return { changed: changed, members: m2,
    scenarios: G1.scenarios.map(function (s, i) { return { id: s.id, title: s.title, before: G0.scenarios[i].avg, after: s.avg, delta: s.avg - G0.scenarios[i].avg, band: s.band, bandBefore: G0.scenarios[i].band }; }),
    roles: C1.rows.map(function (r, i) { return { id: r.id, name: r.name, before: C0.rows[i].state, after: r.state, depthBefore: C0.rows[i].depth, depth: r.depth }; }),
    faultBefore: F0.ok ? F0.strength : null, faultAfter: F1.ok ? F1.strength : null };
}

EP.whatIf = whatIf; EP.interactions = interactions; EP.pairLink = pairLink; EP.traitDetail = traitDetail; EP.pairWhatIf = pairWhatIf; EP.pairCovers = pairCovers; EP.pairForecast = pairForecast; EP.pairRecharge = pairRecharge; EP.pairLeads = pairLeads;
EP.groupCover = groupCover; EP.groupFault = groupFault; EP.groupRotation = groupRotation; EP.groupBuddies = groupBuddies; EP.groupWhatIf = groupWhatIf; EP.MEET = MEET;

/* ---------- Part 2: screens ---------- */
function buildUI(H) {
var esc = H.esc, segHTML = H.segHTML, spCard = H.spCard, plusNote = H.plusNote, traitChartSVG = H.traitChartSVG, traitKeyHTML = H.traitKeyHTML, bandLabel = H.bandLabel,
  groupFacetMembers = H.groupFacetMembers, groupFacetNote = H.groupFacetNote, ZSYM = H.ZSYM, S = H.state;
/* ---------- Trait lab (Patterns tab): what-if sliders, 20 x 20 interaction heatmap, trait drill-down ----------
   Everything is computed in this browser from the scores on screen. Lab state is never saved or sent anywhere. */
var HM_SYN = '#3b82f6', HM_OPP = '#e8833a';
function labState(r) {
  var sig = JSON.stringify(r.facets);
  if (!S().lab || S().lab.sig !== sig) S().lab = { sig: sig, edits: {}, dim: 'P', sel: null, pair: null, w: null };
  return S().lab;
}
function labCompute(r) {
  var L = labState(r);
  L.w = EnginePlus.whatIf(r.facets, L.edits);
  return L;
}
function labTraitName(k) { return EnginePlus.facetInfo(k).name; }
function labSlidersHTML(r, L) {
  var keys = EnginePlus.facetKeys().filter(function (k) { return k.charAt(0) === L.dim; });
  var dimBtns = segHTML(['P', 'R', 'I', 'S', 'M'].map(function (d) { return [d, d + ' \u00B7 ' + DIMS[d].name]; }), L.dim, 'labdim', 'data-lab-dim', 'Dimension to adjust');
  return dimBtns.replace(/data-act="labdim"/g, 'data-lab="dim"') + keys.map(function (k) {
    var i = EnginePlus.facetInfo(k), base = Math.round(r.facets[k]), cur = L.w ? Math.round(L.w.facets[k]) : base, ch = cur !== base;
    return '<div class="mt14"><div class="row between center" style="gap:8px"><button type="button" class="tl-name" data-lab="open" data-k="' + k + '" aria-label="' + esc(i.name + ' \u2014 open details') + '">' + esc(i.name) + ' <span aria-hidden="true">\u203A</span></button>' +
      '<span class="mono" style="font-size:12.5px" id="tl-val-' + k.replace('.', '-') + '">' + cur + (ch ? ' <span style="color:var(--faint)">(was ' + base + ')</span>' : '') + '</span></div>' +
      '<input type="range" class="tl-range" min="0" max="100" step="1" value="' + cur + '" data-lab="range" data-k="' + k + '" aria-label="' + esc(i.name + ' score, 0 to 100. Low end: ' + i.lo[0] + '. High end: ' + i.hi[0]) + '">' +
      '<div class="row between" style="font-size:11.5px;color:var(--faint)"><span>' + esc(i.lo[0]) + '</span><span>' + esc(i.hi[0]) + '</span></div></div>';
  }).join('');
}
function labDiffList(title, g, l, nameOf) {
  if (!g.length && !l.length) return '';
  return '<div class="mt12"><b style="font-size:13px">' + esc(title) + '</b>' +
    g.map(function (x) { return '<div class="sub mt4" style="font-size:12.5px"><b>+ New:</b> ' + esc(nameOf(x)) + '</div>'; }).join('') +
    l.map(function (x) { return '<div class="sub mt4" style="font-size:12.5px"><b>\u2212 Gone:</b> ' + esc(nameOf(x)) + '</div>'; }).join('') + '</div>';
}
function labOutHTML(r, L) {
  var W = L.w, n = W.changed.length;
  if (!n) return '<p class="sub mt12" style="font-size:12.5px">Nothing changed yet. Move a slider and the chart, situations and patterns below update straight away. Your real result is never altered.</p>' + traitChartSVG(W.rows) + traitKeyHTML();
  var moved = W.scenarios.filter(function (s) { return s.delta !== 0; });
  var sc = moved.length ? moved.map(function (s) {
    return '<div class="row between" style="gap:8px;margin-top:6px;font-size:12.5px"><span>' + esc(s.title) + '</span><span class="mono" style="white-space:nowrap">' + s.before + ' \u2192 ' + s.after + ' (' + (s.delta > 0 ? '+' : '\u2212') + Math.abs(s.delta) + ')' + (s.band !== s.bandBefore ? ' \u00B7 ' + esc(bandLabel(s.band)) : '') + '</span></div>';
  }).join('') : '<p class="sub mt4" style="font-size:12.5px">No situation score moves with these changes.</p>';
  var any = W.patterns.gained.length + W.patterns.lost.length + W.tensions.gained.length + W.tensions.lost.length + W.discovered.gained.length + W.discovered.lost.length;
  return '<div class="mt12"><b style="font-size:13px">' + n + (n === 1 ? ' trait' : ' traits') + ' changed in the lab</b>' + sc + '</div>' +
    labDiffList('Behaviour patterns', W.patterns.gained, W.patterns.lost, function (p) { return p.name; }) +
    labDiffList('Internal tensions', W.tensions.gained, W.tensions.lost, function (t) { return t.a + ' / ' + t.b; }) +
    labDiffList('Auto-found combinations', W.discovered.gained, W.discovered.lost, function (d) { return d.notation; }) +
    (any ? '' : '<p class="sub mt12" style="font-size:12.5px">No pattern or tension appears or disappears with these changes.</p>') +
    '<div class="mt14">' + traitChartSVG(W.rows) + traitKeyHTML() + '</div>';
}
function labCardHTML(r, L) {
  return '<div class="card mt14"><div class="eb">What-if lab</div>' +
    '<p class="sub mt8" style="font-size:12px;color:var(--faint)">Change trait scores to see how your situations and patterns would shift. This is a thought experiment on fixed rules, not a prediction of how you would change.</p>' +
    '<div id="tl-sliders">' + labSlidersHTML(r, L) + '</div>' +
    '<div class="row mt14" style="gap:8px"><button type="button" class="btn ghost" data-lab="reset" id="tl-reset"' + (L.w.changed.length ? '' : ' disabled') + '>Reset to my scores</button></div>' +
    '<div id="tl-out" aria-live="polite">' + labOutHTML(r, L) + '</div></div>';
}

/* Heatmap: one cell per pair. Blue = the two traits push the same situations the same way; orange = they push opposite ways. */
function heatmapSVG(M, sel, pair) {
  var X0 = 38, Y0 = 40, C = 15, n = M.keys.length, W = X0 + C * n + 2, H = Y0 + C * n + 2, g = '', i, j;
  M.keys.forEach(function (k, a) {
    var code = EnginePlus.SHORT[k], bold = k === sel ? ' font-weight="700"' : '';
    g += '<text x="' + (X0 - 3) + '" y="' + (Y0 + a * C + 11) + '" font-size="10" text-anchor="end" class="mono"' + bold + ' style="fill:var(--ink)">' + code + '</text>' +
      '<text transform="translate(' + (X0 + a * C + 11) + ',' + (Y0 - 3) + ') rotate(-90)" font-size="10" class="mono"' + bold + ' style="fill:var(--ink)">' + code + '</text>';
  });
  for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
    var x = X0 + j * C, y = Y0 + i * C, c = M.cells[i][j], fill, op = 1, mark = '', edge = false;
    if (i === j) { fill = EnginePlus.facetInfo(M.keys[i]).color; op = 0.35; }
    else if (!c.linked) { fill = 'var(--surf2)'; op = 0.6; }
    else if (Math.abs(c.value) < 0.05) { fill = 'var(--surf2)'; op = 1; edge = true; }
    else { fill = c.value > 0 ? HM_SYN : HM_OPP; op = Math.round((0.18 + 0.72 * Math.min(1, Math.abs(c.value))) * 100) / 100; }
    g += '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="' + (C - 1) + '" height="' + (C - 1) + '" rx="2" style="fill:' + fill + ';opacity:' + op + (edge ? ';stroke:var(--faint);stroke-width:1' : '') + '"/>';
    if (c && c.linked && Math.abs(c.value) >= 0.3) {
      var cx = x + C / 2, cy = y + C / 2;
      mark = '<path d="M' + (cx - 3) + ' ' + cy + 'H' + (cx + 3) + (c.value > 0 ? 'M' + cx + ' ' + (cy - 3) + 'V' + (cy + 3) : '') + '" stroke-width="1.6" fill="none" style="stroke:var(--ink)"/>';
      g += mark;
    }
    if (c && c.ruleOn) g += '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="' + (C - 4) + '" height="' + (C - 4) + '" rx="1" fill="none" stroke-width="1" style="stroke:var(--ink)"/>';
  }
  for (i = 1; i < 5; i++) g += '<line x1="' + (X0 + i * 4 * C) + '" y1="' + Y0 + '" x2="' + (X0 + i * 4 * C) + '" y2="' + (Y0 + n * C) + '" stroke-width="1" style="stroke:var(--faint);opacity:.6"/><line x1="' + X0 + '" y1="' + (Y0 + i * 4 * C) + '" x2="' + (X0 + n * C) + '" y2="' + (Y0 + i * 4 * C) + '" stroke-width="1" style="stroke:var(--faint);opacity:.6"/>';
  var si = sel ? M.keys.indexOf(sel) : -1;
  if (si >= 0) g += '<rect x="' + X0 + '" y="' + (Y0 + si * C) + '" width="' + (C * n) + '" height="' + C + '" fill="none" stroke-width="1.5" style="stroke:var(--ink)"/><rect x="' + (X0 + si * C) + '" y="' + Y0 + '" width="' + C + '" height="' + (C * n) + '" fill="none" stroke-width="1.5" style="stroke:var(--ink)"/>';
  if (pair) { var pa = M.keys.indexOf(pair[0]), pb = M.keys.indexOf(pair[1]); if (pa >= 0 && pb >= 0) g += '<rect x="' + (X0 + pb * C - 1) + '" y="' + (Y0 + pa * C - 1) + '" width="' + (C + 2) + '" height="' + (C + 2) + '" fill="none" stroke-width="2.5" style="stroke:var(--ink)"/>'; }
  var top = [];
  M.keys.forEach(function (a, p) { M.keys.forEach(function (b, q) { if (q > p && M.cells[p][q].linked) top.push(M.cells[p][q]); }); });
  var syn = top.filter(function (c) { return c.value >= 0.3; }).length, opp = top.filter(function (c) { return c.value <= -0.3; }).length;
  var label = '20 by 20 grid of how pairs of traits act together. ' + syn + ' pairs clearly reinforce each other and ' + opp + ' clearly pull against each other. ' + (M.totalPairs - M.linkedPairs) + ' of ' + M.totalPairs + ' pairs have no rule linking them. Use the trait buttons below the grid for the details.';
  return '<svg data-hm="1" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '" style="width:100%;height:auto;display:block;touch-action:manipulation">' + g + '</svg>';
}
function heatmapCardHTML(r, L, M) {
  var chips = M.keys.map(function (k) {
    var on = L.sel === k;
    return '<button type="button" class="tl-chip" data-lab="open" data-k="' + k + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(labTraitName(k) + ' \u2014 open details') + '">' + EnginePlus.SHORT[k] + '</button>';
  }).join('');
  var key = '<div class="mono" style="font-size:11px;color:var(--faint);margin-top:10px;line-height:1.8"><span style="display:inline-block;width:10px;height:10px;background:' + HM_SYN + ';margin-right:4px"></span>+ reinforce &nbsp; <span style="display:inline-block;width:10px;height:10px;background:' + HM_OPP + ';margin-right:4px"></span>\u2212 pull against &nbsp; \u25A1 listed tension active<br>Pale grey: no rule links this pair, which does not mean the two are unrelated. Outlined grey: linked by a rule or a named pattern, but with little push either way at these scores.</div>';
  return '<div class="card mt14"><div class="eb">Interaction heatmap \u2014 20 \u00D7 20</div>' +
    '<p class="sub mt8" style="font-size:12px;color:var(--faint)">Where two traits feed the same everyday situation, do they push it the same way or opposite ways given your scores? Built from this app\u2019s own situation weights and tension list, not from outside data. ' + (L.w.changed.length ? 'It uses your what-if scores from the lab.' : '') + '</p>' +
    '<div class="mt10" id="tl-hm">' + heatmapSVG(M, L.sel, L.pair) + '</div>' + key +
    '<p class="sub mt10" style="font-size:12px;color:var(--faint)">' + M.linkedPairs + ' of ' + M.totalPairs + ' pairs are linked by the rules. Tap a cell, or a trait below, to see why.</p>' +
    '<div class="tl-chips mt8" role="group" aria-label="Choose a trait">' + chips + '</div></div>';
}

/* Drill-down for one trait (and, if a heatmap cell was tapped, for that pair). */
function labPairHTML(L, M) {
  if (!L.pair) return '';
  var c = EnginePlus.pairLink(L.w.facets, L.pair[0], L.pair[1]), a = labTraitName(c.a), b = labTraitName(c.b);
  var verdict = !c.linked ? 'No rule in this app links these two traits, so it says nothing about how they act together.'
    : (!c.via.length && !c.ruleText) ? 'They appear together in a named pattern, but share no everyday situation in the rules, so no push or pull is scored for them.'
    : c.ruleOn ? 'A listed tension is active for this pair: ' + c.ruleText
    : Math.abs(c.value) < 0.05 ? 'They share situations, but at your scores neither pushes strongly, so the effect is small.'
    : c.value > 0 ? 'At your scores they push the same situations the same way, so each strengthens the other\u2019s effect.' : 'At your scores they push the same situations opposite ways, so one softens the other\u2019s effect.';
  var via = c.via.filter(function (v) { return v.kind !== 'neutral'; }).map(function (v) { return v.title + (v.kind === 'reinforce' ? ' (+)' : ' (\u2212)'); }).join(', ');
  var pats = c.patterns.map(function (p) { return p.name + (p.active ? ' (active)' : ''); }).join(', ');
  return '<div style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;margin-top:12px"><b style="font-size:13px">' + esc(a) + ' \u00D7 ' + esc(b) + '</b>' +
    '<p class="sub mt4" style="font-size:12.5px">' + esc(verdict) + '</p>' + (via ? '<p class="sub mt4" style="font-size:12px;color:var(--faint)">Shared situations: ' + esc(via) + '</p>' : '') +
    (pats ? '<p class="sub mt4" style="font-size:12px;color:var(--faint)">Named patterns using both: ' + esc(pats) + '</p>' : '') + '</div>';
}
function labLinkRow(f, x, sign) {
  var via = x.link.via.filter(function (v) { return v.kind === (sign > 0 ? 'reinforce' : 'oppose'); }).map(function (v) { return v.title; }).slice(0, 2).join(', ');
  return '<div class="mt6" style="font-size:12.5px"><button type="button" class="tl-name" data-lab="pair" data-a="' + x.link.a + '" data-b="' + x.other + '">' + esc(labTraitName(x.other)) + ' <span aria-hidden="true">\u203A</span></button><span class="sub" style="font-size:12px;color:var(--faint)"> ' + (via ? 'in ' + esc(via) : '') + '</span></div>';
}
function labDetailHTML(r, L, M) {
  if (!L.sel) return '<p class="sub mt8" style="font-size:12.5px">Tap a trait (a slider name above, a cell in the heatmap, or a trait button) to see what sits behind it.</p>';
  var D = EnginePlus.traitDetail(L.w.facets, L.sel, r.ans), real = Math.round(r.facets[L.sel]), edited = D.score !== real;
  var pole = D.pole ? '<p class="sub mt6" style="font-size:12.5px"><b>' + esc(D.pole.name) + ':</b> ' + esc(D.pole.desc) + '</p>' : '<p class="sub mt6" style="font-size:12.5px">In the balanced middle: you can lean either way, \u201C' + esc(D.lo[0]) + '\u201D or \u201C' + esc(D.hi[0]) + '\u201D, depending on the situation.</p>';
  var qs = D.questions.map(function (q) {
    return '<div class="mt8" style="font-size:12.5px">\u201C' + esc(q.text) + '\u201D<br><span class="mono" style="font-size:12px;color:var(--faint)">' + (q.answer == null ? 'answer not stored on this device' : 'You: ' + esc(q.answerWord) + ' \u00B7 ' + (q.shift === 0 ? 'no shift' : (q.shift > 0 ? '+' : '\u2212') + Math.abs(q.shift) + ' points toward ' + (q.shift > 0 ? esc(D.hi[0]) : esc(D.lo[0])))) + '</span></div>';
  }).join('');
  var why = '<div class="mt14"><b style="font-size:13px">Why this score</b><p class="sub mt4" style="font-size:12px;color:var(--faint)">' + esc(D.formula) + '</p>' + qs +
    (D.haveAnswers ? '' : '<p class="sub mt8" style="font-size:12px;color:var(--faint)">Your answers are not stored with this result (older result or cleared on this device). The score itself still stands.</p>') +
    (edited ? '<p class="sub mt8" style="font-size:12px"><b>Lab note:</b> your real score is ' + real + '; the lab is showing ' + D.score + '. The answers above are your real ones.</p>' : '') + '</div>';
  var sc = '<div class="mt14"><b style="font-size:13px">Where it matters</b>' + D.scenarios.map(function (s) {
    return '<div class="row between" style="gap:8px;margin-top:6px;font-size:12.5px"><span>' + esc(s.title) + ' <span style="color:var(--faint)">\u00B7 ' + (s.effect === 'raises' ? 'higher helps' : 'higher lowers it') + '</span></span><span class="mono" style="color:var(--faint);white-space:nowrap">' + esc(s.now) + '</span></div>';
  }).join('') + '</div>';
  var pt = D.patterns.concat(D.tensions.map(function (t) { return { name: 'Tension: ' + t.keys.map(labTraitName).join(' / '), active: t.active }; }));
  var pats = pt.length ? '<div class="mt14"><b style="font-size:13px">Patterns and tensions it belongs to</b>' + pt.map(function (p) { return '<div class="mt6" style="font-size:12.5px">' + esc(p.name) + ' <span class="mono" style="font-size:12px;color:var(--faint)">' + (p.active ? '\u00B7 active for you' : '\u00B7 not active') + '</span></div>'; }).join('') + '</div>' : '';
  var disc = D.discovered.length ? '<div class="mt14"><b style="font-size:13px">Auto-found combinations with it</b>' + D.discovered.map(function (d) { return '<div class="mt6 mono" style="font-size:12px;color:var(--faint)">' + esc(d.notation) + '</div>'; }).join('') + '</div>' : '';
  var lk = D.links.reinforce.length || D.links.oppose.length
    ? '<div class="mt14"><b style="font-size:13px">Works with</b>' + (D.links.reinforce.length ? D.links.reinforce.map(function (x) { return labLinkRow(r.facets, x, 1); }).join('') : '<p class="sub mt4" style="font-size:12px;color:var(--faint)">No clear reinforcing partner at these scores.</p>') +
      '<div class="mt10"><b style="font-size:13px">Pulls against</b></div>' + (D.links.oppose.length ? D.links.oppose.map(function (x) { return labLinkRow(r.facets, x, -1); }).join('') : '<p class="sub mt4" style="font-size:12px;color:var(--faint)">No clear opposing partner at these scores.</p>') + '</div>' : '';
  return '<div class="row between center mt8" style="gap:8px"><b id="tl-title" tabindex="-1" style="font-size:15px;color:' + D.color + '">' + esc(D.name) + ' <span class="mono" style="font-size:13px;color:var(--ink)">' + D.code + ' ' + ZSYM[D.zone] + ' ' + D.score + '</span></b>' +
    '<button type="button" class="btn ghost" data-lab="close" style="min-height:44px">Close</button></div>' + pole + labPairHTML(L, M) + why + sc + pats + disc + lk;
}
function labDetailCardHTML(r, L, M) {
  return '<div class="card mt14" id="tl-td" role="region" aria-label="Trait drill-down"><div class="eb">Trait drill-down</div><div id="tl-detail">' + labDetailHTML(r, L, M) + '</div></div>';
}
function traitLabHTML(r) {
  var L = labCompute(r), M = EnginePlus.interactions(L.w.facets);
  return '<div id="lab-root">' + labCardHTML(r, L) + heatmapCardHTML(r, L, M) + labDetailCardHTML(r, L, M) + '</div>';
}

function wireLab() {
  var root = document.getElementById('lab-root');
  if (!root || !S().result) return;
  var r = S().result, raf = null;
  function refreshOut(full) {
    var L = labCompute(r), M = EnginePlus.interactions(L.w.facets);
    var o = document.getElementById('tl-out'); if (o) o.innerHTML = labOutHTML(r, L);
    var hm = document.getElementById('tl-hm'); if (hm) hm.innerHTML = heatmapSVG(M, L.sel, L.pair);
    var td = document.getElementById('tl-detail'); if (td) td.innerHTML = labDetailHTML(r, L, M);
    var rs = document.getElementById('tl-reset'); if (rs) rs.disabled = !L.w.changed.length;
    root.querySelectorAll('.tl-chip').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-k') === L.sel ? 'true' : 'false'); });
    if (full) { var s = document.getElementById('tl-sliders'); if (s) s.innerHTML = labSlidersHTML(r, L); }
  }
  root.addEventListener('input', function (e) {
    var t = e.target; if (!t || t.getAttribute('data-lab') !== 'range') return;
    var k = t.getAttribute('data-k'), L = labState(r), v = +t.value;
    if (v === Math.round(r.facets[k])) delete L.edits[k]; else L.edits[k] = v;
    var base = Math.round(r.facets[k]), out = document.getElementById('tl-val-' + k.replace('.', '-'));
    if (out) out.innerHTML = v + (v !== base ? ' <span style="color:var(--faint)">(was ' + base + ')</span>' : '');
    if (raf) return;
    raf = (window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); })(function () { raf = null; refreshOut(false); });
  });
  function openTrait(k, pair, scroll) {
    var L = labState(r); L.sel = k; L.pair = pair || null; refreshOut(false);
    if (scroll) { var td = document.getElementById('tl-td'); if (td && td.scrollIntoView) { var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; td.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); } var h = document.getElementById('tl-title'); if (h) h.focus({ preventScroll: true }); }
  }
  root.addEventListener('click', function (e) {
    var svg = e.target.closest && e.target.closest('svg[data-hm]');
    if (svg) {
      var box = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, sx = vb.width / box.width, x = (e.clientX - box.left) * sx, y = (e.clientY - box.top) * sx;
      var j = Math.floor((x - 38) / 15), i = Math.floor((y - 40) / 15), keys = EnginePlus.facetKeys();
      if (i >= 0 && j >= 0 && i < 20 && j < 20) { if (i === j) openTrait(keys[i], null, false); else openTrait(keys[i], [keys[i], keys[j]], false); }
      return;
    }
    var b = e.target.closest && e.target.closest('[data-lab]'); if (!b || b.getAttribute('data-lab') === 'range') return;
    var act = b.getAttribute('data-lab'), L = labState(r);
    if (act === 'open') openTrait(b.getAttribute('data-k'), null, b.classList.contains('tl-name'));
    else if (act === 'pair') openTrait(b.getAttribute('data-a'), [b.getAttribute('data-a'), b.getAttribute('data-b')], false);
    else if (act === 'close') { L.sel = null; L.pair = null; refreshOut(false); }
    else if (act === 'reset') { L.edits = {}; refreshOut(true); }
    else if (act === 'dim') { L.dim = b.getAttribute('data-lab-dim'); var s = document.getElementById('tl-sliders'); if (s) { s.innerHTML = labSlidersHTML(r, labCompute(r)); var nb = s.querySelector('[data-lab-dim="' + L.dim + '"]'); if (nb) nb.focus(); } }
  });
}

/* ---------- Compatibility and group tools (what-if sliders, covers, forecasts, rotation, buddies) ---------- */
var toolCtx = { pair: null, group: null };
function wiSeg(items, active, kind, label) { return segHTML(items, active, 'wi', 'data-v', label).replace(/data-act="wi"/g, 'data-wi="' + kind + '"'); }
function wiSliders(root, base, cur, dim) {
  return EnginePlus.facetKeys().filter(function (k) { return k.charAt(0) === dim; }).map(function (k) {
    var i = EnginePlus.facetInfo(k), b = Math.round(base[k]), v = Math.round(cur[k]);
    return '<div class="mt12"><div class="row between center" style="gap:8px"><b style="font-size:13.5px">' + esc(i.name) + '</b><span class="mono" style="font-size:12.5px" id="wi-val-' + root + '-' + k.replace('.', '-') + '">' + v + (v !== b ? ' <span style="color:var(--faint)">(was ' + b + ')</span>' : '') + '</span></div>' +
      '<input type="range" class="tl-range" min="0" max="100" step="1" value="' + v + '" data-wi="range" data-k="' + k + '" aria-label="' + esc(i.name + ' score, 0 to 100. Low end: ' + i.lo[0] + '. High end: ' + i.hi[0]) + '">' +
      '<div class="row between" style="font-size:11.5px;color:var(--faint)"><span>' + esc(i.lo[0]) + '</span><span>' + esc(i.hi[0]) + '</span></div></div>';
  }).join('');
}
function wiDimSeg(dim) { return wiSeg(['P', 'R', 'I', 'S', 'M'].map(function (d) { return [d, d + ' \u00B7 ' + DIMS[d].name]; }), dim, 'dim', 'Dimension to adjust'); }
function wiMoves(list, label) {
  var mv = list.filter(function (s) { return s.delta !== 0; });
  return mv.length ? mv.map(function (s) { return '<div class="row between" style="gap:8px;margin-top:6px;font-size:12.5px"><span>' + esc(s.title) + '</span><span class="mono" style="white-space:nowrap">' + s.before + ' \u2192 ' + s.after + ' (' + (s.delta > 0 ? '+' : '\u2212') + Math.abs(s.delta) + ')</span></div>'; }).join('') : '<p class="sub mt6" style="font-size:12.5px">' + label + '</p>';
}
function pairLabState(mine, them) {
  var sig = JSON.stringify([mine.facets, them.facets]);
  if (!S().pairLab || S().pairLab.sig !== sig) S().pairLab = { sig: sig, who: 'a', dim: 'P', e: { a: {}, b: {} } };
  return S().pairLab;
}
function pairWIOut(mine, them, L) {
  var W = EnginePlus.pairWhatIf(mine.facets, them.facets, mine.name, them.name, L.e.a, L.e.b);
  if (!W.changed.length) return '<p class="sub mt12" style="font-size:12.5px">Nothing changed yet. Move a slider to see how your similarity and shared situations would shift. Neither real profile is altered.</p>';
  var fr = W.friction.join(', ') || 'none', fr0 = W.frictionBefore.join(', ') || 'none';
  return '<div class="mt12"><b style="font-size:13px">Facet similarity: ' + W.simBefore + ' \u2192 ' + W.simAfter + '</b><p class="sub mt4" style="font-size:12px;color:var(--faint)">100 minus the average gap across all 20 traits. Similarity is not compatibility.</p></div>' +
    '<div class="mt12"><b style="font-size:13px">Situations, together</b>' + wiMoves(W.scenarios, 'No joint situation score moves.') + '</div>' +
    '<div class="mt12"><b style="font-size:13px">Biggest differences</b><p class="sub mt4" style="font-size:12.5px">Before: ' + esc(fr0) + '<br>Now: ' + esc(fr) + '</p></div>';
}
function pairWIHTML(mine, them) {
  var L = pairLabState(mine, them), f = L.who === 'a' ? mine.facets : them.facets, e = L.e[L.who], cur = EnginePlus.pairWhatIf(f, f, '', '', e, {}).fa;
  return spCard('What-if: change one of you', 'Pick whose scores to change and see how your joint situations shift. A thought experiment on fixed rules, not advice to change who you are.',
    wiSeg([['a', mine.name], ['b', them.name]], L.who, 'who', 'Whose scores to change') + wiDimSeg(L.dim) + '<div id="pl-sl">' + wiSliders('pl', f, cur, L.dim) + '</div>' +
    '<div class="row mt12"><button type="button" class="btn ghost" data-wi="reset" id="pl-reset"' + (EnginePlus.pairWhatIf(mine.facets, them.facets, '', '', L.e.a, L.e.b).changed.length ? '' : ' disabled') + '>Reset</button></div><div id="pl-out" aria-live="polite">' + pairWIOut(mine, them, L) + '</div>');
}
function compatToolsHTML(mine, them) {
  toolCtx.pair = { mine: mine, them: them };
  var an = mine.name, bn = them.name, f = mine.facets, g = them.facets;
  var C = EnginePlus.pairCovers(f, g, an, bn), line = function (t) { return '<div class="mt6" style="font-size:12.5px">' + t + '</div>'; };
  var covers = spCard('Shared lean and covering for each other', 'Facet by facet: where you lean the same way, and where you lean opposite ways so each can stretch the other\u2019s range.',
    '<b style="font-size:13px">You lean the same way (' + C.same.length + ')</b>' + (C.same.slice(0, 5).map(function (x) { return line('<b>' + esc(x.name) + '</b>: both ' + esc(x.pole.toLowerCase()) + ' <span class="mono" style="color:var(--faint)">' + x.a + ' / ' + x.b + '</span>'); }).join('') || line('No trait where you both clearly lean the same way.')) +
    '<div class="mt14"><b style="font-size:13px">You cover for each other (' + C.cover.length + ')</b></div>' + (C.cover.slice(0, 5).map(function (x) { return line('<b>' + esc(x.name) + '</b>: ' + esc(an) + ' ' + esc(x.aPole.toLowerCase()) + ', ' + esc(bn) + ' ' + esc(x.bPole.toLowerCase()) + ' <span class="mono" style="color:var(--faint)">' + x.a + ' / ' + x.b + '</span>'); }).join('') || line('No trait where you clearly lean opposite ways.')) +
    '<p class="sub mt12" style="font-size:12px;color:var(--faint)">Both in the balanced middle on ' + C.open.length + ' traits, so those are flexible between you.</p>');
  var Fc = EnginePlus.pairForecast(f, g, an, bn);
  var fore = spCard('Friction forecast', 'The situations where your scores sit furthest apart, who is likely to do what, and what to agree before it comes up.',
    (Fc.top.length ? Fc.top.map(function (r) { return '<div class="mt12" style="padding-top:10px;border-top:1px solid var(--line)"><b style="font-size:13.5px">' + esc(r.title) + '</b> <span class="mono" style="font-size:12px;color:var(--faint)">' + r.hiScore + ' vs ' + r.loScore + '</span><p class="sub mt4" style="font-size:12.5px">' + esc(r.hiName) + ' ' + esc(r.hiRole) + '; ' + esc(r.loName) + ' ' + esc(r.loRole) + '.</p><p class="sub mt4" style="font-size:12px"><b>' + esc(r.hiName) + ':</b> ' + esc(r.forHi) + ' <b>' + esc(r.loName) + ':</b> ' + esc(r.forLo) + '</p></div>'; }).join('') : '<p class="sub mt10" style="font-size:12.5px">No situation separates you by 15 points or more, so there is no clear flashpoint in these scores.</p>') +
    (Fc.calm.length ? '<p class="sub mt12" style="font-size:12px;color:var(--faint)">Smooth ground (within 8 points): ' + esc(Fc.calm.join(', ')) + '.</p>' : ''));
  var R = EnginePlus.pairRecharge(f, g, an, bn);
  var rech = spCard('After a hard day', 'How each of you tends to recover, from expression, sociability and stability. A tendency, not a rule: ask each other.',
    line('<b>' + esc(an) + '</b> ' + esc(R.a.style.text) + '; ' + esc(R.a.style.linger) + '.') + line('<b>' + esc(bn) + '</b> ' + esc(R.b.style.text) + '; ' + esc(R.b.style.linger) + '.') +
    '<p class="sub mt12" style="font-size:12.5px"><b>' + (R.match === 'same' ? 'Same style.' : R.match === 'partly' ? 'Partly alike.' : 'Opposite styles.') + '</b> ' + esc(R.tip) + '</p>' +
    (R.lingerGap ? '<p class="sub mt8" style="font-size:12px;color:var(--faint)">One of you tends to bounce back much faster than the other, so the same event can feel different in size.</p>' : ''));
  var Ld = EnginePlus.pairLeads(f, g, an, bn);
  var lead = spCard('Who leads what', 'The higher score takes the lead; within 8 points either of you can. Rotate on purpose so strengths do not turn into permanent jobs.',
    Ld.rows.map(function (r) { return '<div class="row between" style="gap:8px;margin-top:8px;font-size:12.5px"><span>' + esc(r.title) + '</span><b>' + (r.name ? esc(r.name) : 'Either') + '</b></div>'; }).join('') +
    '<p class="sub mt12" style="font-size:12.5px">' + esc(an) + ' leads ' + Ld.countA + ', ' + esc(bn) + ' leads ' + Ld.countB + ', either on ' + Ld.either + '.' + (Ld.lopsided ? ' ' + esc(Ld.busy) + ' would carry most of the leading; swap on purpose now and then.' : '') + '</p>');
  return '<div class="eb mt24">More tools \u2014 explore together</div><div id="pl-root">' + pairWIHTML(mine, them) + covers + fore + rech + lead + '</div>';
}

function groupLabState(fm) {
  var sig = JSON.stringify(fm.map(function (m) { return [m.name, m.facets]; }));
  if (!S().grpLab || S().grpLab.sig !== sig) S().grpLab = { sig: sig, idx: 0, dim: 'P', e: {} };
  return S().grpLab;
}
function groupWIOut(fm, L) {
  var W = EnginePlus.groupWhatIf(fm, L.idx, L.e);
  if (!W.changed.length) return '<p class="sub mt12" style="font-size:12.5px">Nothing changed yet. Move a slider to see how the group\u2019s situations, role cover and split would shift. The real scores are not altered.</p>';
  var rc = W.roles.filter(function (r) { return r.before !== r.after || r.depthBefore !== r.depth; });
  var st = { none: 'no natural fit', single: 'one natural fit', deep: 'two or more natural fits' };
  return '<div class="mt12"><b style="font-size:13px">Group average, by situation</b>' + wiMoves(W.scenarios, 'No group situation average moves.') + '</div>' +
    '<div class="mt12"><b style="font-size:13px">Role cover</b>' + (rc.length ? rc.map(function (r) { return '<div class="mt6" style="font-size:12.5px">' + esc(r.name) + ': ' + st[r.before] + ' \u2192 ' + st[r.after] + '</div>'; }).join('') : '<p class="sub mt6" style="font-size:12.5px">No role changes its cover.</p>') + '</div>' +
    (W.faultBefore !== null ? '<div class="mt12"><b style="font-size:13px">Split strength: ' + W.faultBefore + ' \u2192 ' + W.faultAfter + '</b></div>' : '');
}
function groupToolsHTML(members) {
  var fm = groupFacetMembers(members);
  if (fm.length < 2) return plusNote('These tools need at least two members whose 20 facet scores are available.');
  toolCtx.group = { fm: fm };
  var C = EnginePlus.groupCover(fm), chip = function (t) { return '<span class="mono" style="font-size:12px;padding:2px 8px;border-radius:99px;border:1px solid var(--line);color:var(--faint)">' + t + '</span>'; };
  var maxLoad = Object.keys(C.load).sort(function (a, b) { return C.load[b] - C.load[a]; })[0];
  var cover = spCard('Cover depth', 'How many people are a natural fit for each working role (62+), and who is next best. A role with one fit has no backup yet.',
    C.rows.map(function (r) {
      return '<div class="mt10" style="padding-top:10px;border-top:1px solid var(--line)"><div class="row between center"><b style="font-size:13.5px">' + esc(r.name) + '</b>' + chip(r.state === 'none' ? 'none' : r.depth + (r.depth === 1 ? ' fit' : ' fits')) + '</div>' +
        '<p class="sub mt4" style="font-size:12.5px">' + (r.state === 'none' ? 'Nobody is a natural fit. Closest: ' + esc(r.best.name) + ' (' + r.best.fit + ').' : r.state === 'single' ? '<b>' + esc(r.champions[0]) + '</b> only' + (r.backup ? '; next best ' + esc(r.backup.name) + ' (' + r.backup.fit + ')' : '') + '.' : esc(r.champions.join(', ')) + '.') + '</p></div>';
    }).join('') + (C.load[maxLoad] >= 2 ? '<p class="sub mt12" style="font-size:12.5px">' + esc(maxLoad) + ' is the only natural fit for ' + C.load[maxLoad] + ' roles: share those on purpose so the group does not lean on one person.</p>' : ''));
  var F = EnginePlus.groupFault(fm);
  var fault = spCard('Fault lines', 'The two-way split that separates the group most clearly across all 20 traits. It shows where camps could form, not that they will.',
    F.ok ? '<div class="row between center mt10"><b style="font-size:13.5px">' + esc(F.label) + '</b><span class="mono" style="font-size:12.5px">' + F.strength + '</span></div>' +
      '<p class="sub mt8" style="font-size:12.5px"><b>' + esc(F.sideA.join(', ')) + '</b> vs <b>' + esc(F.sideB.join(', ')) + '</b></p>' +
      (F.strength >= 0.4 ? F.drivers.map(function (d) { return '<div class="mt6" style="font-size:12.5px"><b>' + esc(d.name) + '</b>: ' + esc(d.aPole.toLowerCase()) + ' (' + d.aAvg + ') vs ' + esc(d.bPole.toLowerCase()) + ' (' + d.bAvg + ')</div>'; }).join('') : '<p class="sub mt6" style="font-size:12.5px">No split stands out: differences run across the group rather than between two camps.</p>') +
      '<p class="sub mt10" style="font-size:12px;color:var(--faint)">0 to 1: the share of all differences that line up with this one split. ' + (F.small ? 'With 4 people or fewer some split always looks strong; treat it as a prompt only.' : 'Check it against what you know of the group.') + '</p>'
      : '<p class="sub mt10" style="font-size:12.5px">Not shown: ' + esc(F.reason) + '.</p>');
  var Rt = EnginePlus.groupRotation(fm, 4);
  var rot = spCard('Meeting role rotation', 'Week 1 gives each role to its best fit. Later weeks rotate the roles so nobody is fixed in one. Fit is 0 to 100 for that role.',
    '<div class="sub" style="font-size:12px;color:var(--faint)">' + Rt.roles.map(function (r) { return '<b>' + esc(r.name) + '</b> ' + esc(r.desc); }).join(' \u00B7 ') + '</div>' +
    Rt.plan.map(function (p) { return '<div class="mt12" style="padding-top:10px;border-top:1px solid var(--line)"><b style="font-size:13px">Week ' + p.week + (p.natural ? ' \u00B7 natural fit' : ' \u00B7 stretch') + '</b>' + p.picks.map(function (x) { return '<div class="row between" style="gap:8px;margin-top:4px;font-size:12.5px"><span>' + esc(x.role) + '</span><span><b>' + esc(x.who) + '</b> <span class="mono" style="color:var(--faint)">' + x.fit + '</span></span></div>'; }).join('') + '</div>'; }).join(''));
  var B = EnginePlus.groupBuddies(fm);
  var bud = spCard('Learning buddies', 'Everyone paired so each pair has the most to swap: traits where one is clearly higher than the other. For peer learning, not for judging anyone.',
    B.ok ? B.pairs.map(function (p) { return '<div class="mt12" style="padding-top:10px;border-top:1px solid var(--line)"><b style="font-size:13.5px">' + esc(p.a) + ' & ' + esc(p.b) + '</b>' + (p.swaps.length ? p.swaps.map(function (s) { return '<p class="sub mt4" style="font-size:12.5px"><b>' + esc(s.name) + ':</b> ' + esc(s.hiWho) + ' leans ' + esc(s.hi.toLowerCase()) + ', ' + esc(s.loWho) + ' leans ' + esc(s.lo.toLowerCase()) + '. Swap how you each approach it.</p>'; }).join('') : '<p class="sub mt4" style="font-size:12.5px">Quite alike: a comfortable pair, with less to swap.</p>') + '</div>'; }).join('') + (B.third ? '<p class="sub mt12" style="font-size:12.5px">With an odd number, <b>' + esc(B.third.name) + '</b> joins ' + esc(B.third.joins) + ' as a third.</p>' : '')
    : '<p class="sub mt10" style="font-size:12.5px">Not shown: ' + esc(B.reason) + '.</p>');
  var L = groupLabState(fm), base = fm[L.idx].facets, cur = EnginePlus.groupWhatIf(fm, L.idx, L.e).members[L.idx].facets;
  var wi = spCard('What-if: change one member', 'Pick a member and change their scores to see how the group\u2019s situations, role cover and split would shift. Hypothetical only: nobody\u2019s real scores change.',
    wiSeg(fm.map(function (m, i) { return [String(i), m.name]; }), String(L.idx), 'who', 'Member to change') + wiDimSeg(L.dim) + '<div id="gl-sl">' + wiSliders('gl', base, cur, L.dim) + '</div>' +
    '<div class="row mt12"><button type="button" class="btn ghost" data-wi="reset" id="gl-reset"' + (EnginePlus.groupWhatIf(fm, L.idx, L.e).changed.length ? '' : ' disabled') + '>Reset</button></div><div id="gl-out" aria-live="polite">' + groupWIOut(fm, L) + '</div>');
  return '<div class="mt18"></div>' + cover + fault + rot + bud + '<div id="gl-root">' + wi + '</div>' + groupFacetNote(members) +
    '<p class="sub mt14" style="font-size:12px;color:var(--faint)">All rule-based, from self-reported scores shared with this group. These describe tendencies and how profiles combine, not how well anyone works. Not for hiring, firing or ranking people.</p>';
}

function wireWI(rootId, pre, getState, refresh, rerender) {
  var root = document.getElementById(rootId); if (!root) return;
  var raf = null;
  root.addEventListener('input', function (e) {
    var t = e.target; if (!t || t.getAttribute('data-wi') !== 'range') return;
    var k = t.getAttribute('data-k'), v = +t.value, S = getState(), out = document.getElementById('wi-val-' + pre + '-' + k.replace('.', '-'));
    S.set(k, v); if (out) out.innerHTML = v + (v !== S.base(k) ? ' <span style="color:var(--faint)">(was ' + S.base(k) + ')</span>' : '');
    if (raf) return; raf = (window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); })(function () { raf = null; refresh(); });
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-wi]'); if (!b || b.getAttribute('data-wi') === 'range') return;
    var kind = b.getAttribute('data-wi'), v = b.getAttribute('data-v'), S = getState();
    if (kind === 'who') S.who(v); else if (kind === 'dim') S.dim(v); else if (kind === 'reset') S.reset();
    rerender(kind);
    if (kind !== 'reset') { var nb = root.querySelector('[data-wi="' + kind + '"][data-v="' + v + '"]'); if (nb) nb.focus(); }
  });
}
function wireTools() {
  var P = toolCtx.pair, G = toolCtx.group;
  if (P && document.getElementById('pl-root')) {
    var pst = function () { var L = pairLabState(P.mine, P.them); return {
      set: function (k, v) { var side = L.who === 'a' ? P.mine : P.them; if (v === Math.round(side.facets[k])) delete L.e[L.who][k]; else L.e[L.who][k] = v; },
      base: function (k) { return Math.round((L.who === 'a' ? P.mine : P.them).facets[k]); },
      who: function (v) { L.who = v; }, dim: function (v) { L.dim = v; }, reset: function () { L.e = { a: {}, b: {} }; } }; };
    var pRefresh = function () { var L = pairLabState(P.mine, P.them), o = document.getElementById('pl-out'); if (o) o.innerHTML = pairWIOut(P.mine, P.them, L); var r = document.getElementById('pl-reset'); if (r) r.disabled = !EnginePlus.pairWhatIf(P.mine.facets, P.them.facets, '', '', L.e.a, L.e.b).changed.length; };
    wireWI('pl-root', 'pl', pst, pRefresh, function (kind) {
      var L = pairLabState(P.mine, P.them), f = L.who === 'a' ? P.mine.facets : P.them.facets, cur = EnginePlus.pairWhatIf(f, f, '', '', L.e[L.who], {}).fa, s = document.getElementById('pl-sl');
      if (kind !== 'reset') { var segs = document.querySelectorAll('#pl-root [data-wi="' + kind + '"]'); segs.forEach(function (x) { var on = x.getAttribute('data-v') === (kind === 'who' ? L.who : L.dim); x.classList.toggle('active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
      if (s) s.innerHTML = wiSliders('pl', f, cur, L.dim); pRefresh(); });
  }
  if (G && document.getElementById('gl-root')) {
    var gst = function () { var L = groupLabState(G.fm); return {
      set: function (k, v) { if (v === Math.round(G.fm[L.idx].facets[k])) delete L.e[k]; else L.e[k] = v; },
      base: function (k) { return Math.round(G.fm[L.idx].facets[k]); },
      who: function (v) { L.idx = +v; L.e = {}; }, dim: function (v) { L.dim = v; }, reset: function () { L.e = {}; } }; };
    var gRefresh = function () { var L = groupLabState(G.fm), o = document.getElementById('gl-out'); if (o) o.innerHTML = groupWIOut(G.fm, L); var r = document.getElementById('gl-reset'); if (r) r.disabled = !EnginePlus.groupWhatIf(G.fm, L.idx, L.e).changed.length; };
    wireWI('gl-root', 'gl', gst, gRefresh, function (kind) {
      var L = groupLabState(G.fm), cur = EnginePlus.groupWhatIf(G.fm, L.idx, L.e).members[L.idx].facets, s = document.getElementById('gl-sl');
      if (kind !== 'reset') { var segs = document.querySelectorAll('#gl-root [data-wi="' + kind + '"]'); segs.forEach(function (x) { var on = x.getAttribute('data-v') === (kind === 'who' ? String(L.idx) : L.dim); x.classList.toggle('active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
      if (s) s.innerHTML = wiSliders('gl', G.fm[L.idx].facets, cur, L.dim); gRefresh(); });
  }
}


return { labHTML: traitLabHTML, compatHTML: compatToolsHTML, groupHTML: groupToolsHTML, wire: function () { wireLab(); wireTools(); } };
}
if (typeof window !== 'undefined' && window.PsycheHost) window.PsycheTools = buildUI(window.PsycheHost);
})();
