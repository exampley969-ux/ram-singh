/* ============================================================
   GroupInsights — deterministic, template-based team analysis built on
   top of Engine.groupAnalysis. Same 5 dimension scores, no new data.
   Everything here is a transparent heuristic over those scores: it
   describes composition, it does not predict performance.
   ============================================================ */
var GroupInsights = (function () {
'use strict';

var HI = 62, LO = 38;          // group-average thresholds for a collective lean
var VOICE_HI = 65, VOICE_LO = 35; // an individual "voice" on a pole
var WIDE = 16;                 // std-dev (points) above which a dimension counts as a real split

var TEXT = {
  P: {
    hi: { strength: 'The group naturally generates ideas, spots patterns early and asks “what if” — strong for strategy, discovery and framing problems.',
          blind: 'Risk of staying in idea-space: plans stay abstract, details and proof get skipped, and novelty can beat finishing.',
          tip: 'Give every idea a concrete next step, an owner and a date before the meeting ends.' },
    lo: { strength: 'Grounded and practical: the group trusts evidence, sees what is actually in front of it and executes on what is proven.',
          blind: 'May miss weak signals and new options; everyone can share the same literal reading and dismiss what “isn’t proven yet.”',
          tip: 'Schedule explicit time to ask “what are we not seeing?” and invite an outside view.' },
    mid: 'No strong collective lean on Perception — whether the group works from ideas or from facts depends on who is leading the conversation.'
  },
  R: {
    hi: { strength: 'Fast, expressive and adaptable: decisions move quickly, people say what they feel, and plan changes don’t stall anyone.',
          blind: 'Speed can outrun checking — risky bets, plan churn, and decisions made before anyone verified them.',
          tip: 'Add a short “what could go wrong?” pause before committing to anything hard to reverse.' },
    lo: { strength: 'Measured and steady: decisions are weighed, plans are held, and the downside is protected.',
          blind: 'Slow to start and slow to change course; opportunities can pass while the group deliberates, and quiet disagreement stays unspoken.',
          tip: 'Set decision deadlines and collect first reactions in writing so reserved members’ views surface.' },
    mid: 'No strong collective lean on Response — the group’s tempo will swing with whoever sets the pace.'
  },
  I: {
    hi: { strength: 'Independent and firm: people form their own view, defend it, and don’t just follow — good at holding a line.',
          blind: 'Many strong centres of gravity in one room: stalemates, “my way” friction and slow consensus.',
          tip: 'Agree up-front who decides what, and how a disagreement ends (data, a vote, or a named owner).' },
    lo: { strength: 'Open and cooperative: people listen, revise their view, and fit into the group easily.',
          blind: 'Deference and groupthink: nobody leads, the loudest opinion wins, and real concerns go unvoiced.',
          tip: 'Collect independent input in writing before discussing, and name a rotating devil’s advocate.' },
    mid: 'No strong collective lean on Identity — how much people hold their ground depends on the topic and the people.'
  },
  S: {
    hi: { strength: 'Warm and connected: trust builds quickly, people feel heard, and feedback tends to land gently.',
          blind: 'Harmony can beat honesty — hard truths get softened or avoided and tough decisions are delayed to keep the peace.',
          tip: 'Make candid feedback a routine (a regular retro) so it isn’t personal when it happens.' },
    lo: { strength: 'Direct and objective: issues get named plainly and people work well independently.',
          blind: 'A cool atmosphere: people may feel unseen, check-ins get skipped, and morale problems go unnoticed.',
          tip: 'Build in short check-ins and explicit recognition — don’t assume silence means everything is fine.' },
    mid: 'No strong collective lean on Social — the group’s warmth and directness vary person to person.'
  },
  M: {
    hi: { strength: 'Driven and structured: goals are set high, plans are made and followed, and work gets finished.',
          blind: 'Burnout and rigidity: the pace and the bar can become unsustainable, with little room for rest or improvisation.',
          tip: 'Build slack into plans and celebrate finished milestones, not only the next target.' },
    lo: { strength: 'Relaxed and flexible: low pressure, comfortable with “enough,” open to the unplanned.',
          blind: 'Follow-through risk: deadlines drift, big goals fade, and nobody naturally pushes the finish.',
          tip: 'Make commitments visible — one owner, one date, one weekly check.' },
    mid: 'No strong collective lean on Motivation — drive and structure depend on who owns the task.'
  }
};
var POLE = { P: ['Concrete', 'Conceptual'], R: ['Measured', 'Quick'], I: ['Yielding', 'Independent'], S: ['Detached', 'Warm'], M: ['Relaxed', 'Driven'] };

function lean(avg) { return avg >= HI ? 'hi' : avg <= LO ? 'lo' : 'mid'; }
function spread(variance) { return Math.round(Math.sqrt(variance)); }
function band(score) { return score >= 75 ? 'tightly aligned' : score >= 60 ? 'solid' : score >= 45 ? 'mixed' : 'widely different'; }

function composition(members, g) {
  return DIM_ORDER.map(function (d) {
    var sorted = members.slice().sort(function (a, b) { return b.dims[d] - a.dims[d]; });
    var hiVoices = members.filter(function (m) { return m.dims[d] >= VOICE_HI; }).length;
    var loVoices = members.filter(function (m) { return m.dims[d] <= VOICE_LO; }).length;
    return { dim: d, avg: g.avg[d], spread: spread(g.variance[d]), lean: lean(g.avg[d]),
      top: sorted[0], bottom: sorted[sorted.length - 1], hiVoices: hiVoices, loVoices: loVoices };
  });
}

function strengths(comp) {
  return comp.filter(function (c) { return c.lean !== 'mid'; })
    .sort(function (a, b) { return Math.abs(b.avg - 50) - Math.abs(a.avg - 50); })
    .map(function (c) { return { dim: c.dim, avg: c.avg, lean: c.lean, text: TEXT[c.dim][c.lean].strength }; });
}

function blindSpots(comp) {
  var out = [];
  comp.forEach(function (c) {
    if (c.lean !== 'mid') out.push({ dim: c.dim, kind: 'lean', text: TEXT[c.dim][c.lean].blind });
    if (c.hiVoices === 0) out.push({ dim: c.dim, kind: 'missing', text: 'Nobody in the group leans strongly “' + POLE[c.dim][1].toLowerCase() + '” on ' + DIMS[c.dim].name + ' — there is no natural champion for that side, so it can go unrepresented in discussions.' });
    if (c.loVoices === 0) out.push({ dim: c.dim, kind: 'missing', text: 'Nobody leans strongly “' + POLE[c.dim][0].toLowerCase() + '” on ' + DIMS[c.dim].name + ' — the opposite viewpoint has no natural champion.' });
  });
  return out;
}

function communication(g, comp) {
  var tips = [];
  comp.forEach(function (c) { if (c.lean !== 'mid') tips.push({ dim: c.dim, text: TEXT[c.dim][c.lean].tip }); });
  if (g.avg.S >= HI) tips.push({ dim: 'S', text: 'Lead with context and appreciation, then the hard point — this group hears tone as much as content.' });
  else if (g.avg.S <= LO) tips.push({ dim: 'S', text: 'Be explicit and brief — this group prefers the point stated plainly over softened framing.' });
  if (g.avg.R >= HI) tips.push({ dim: 'R', text: 'Keep meetings short and action-oriented; long preambles will lose people.' });
  else if (g.avg.R <= LO) tips.push({ dim: 'R', text: 'Share material ahead of time — this group wants to think before it responds.' });
  if (g.avg.P >= HI) tips.push({ dim: 'P', text: 'Use examples, analogies and the big picture first; details second.' });
  else if (g.avg.P <= LO) tips.push({ dim: 'P', text: 'Lead with specifics, data and a concrete example before the abstract point.' });
  if (!tips.length) tips.push({ dim: null, text: 'The group sits near the middle on every dimension, so no single communication style fits everyone — ask what each person prefers.' });
  return tips;
}

function decisionStyle(g) {
  var pace = g.avg.R >= HI ? 'Fast and improvisational — decisions are made on the move.' : g.avg.R <= LO ? 'Slow and deliberate — decisions are weighed before anyone acts.' : 'Moderate — pace depends on who is driving.';
  var authority = g.avg.I >= HI ? 'Contested — several people hold firm views, so expect real debate and agree on who has the final say.' : g.avg.I <= LO ? 'Deferential — the group tends to follow whoever speaks first or loudest, so ask for views independently.' : 'Balanced — views are held with moderate firmness.';
  var evidence = g.avg.P >= HI ? 'Exploratory — many options get raised; the risk is under-testing them.' : g.avg.P <= LO ? 'Evidence-first — the group wants proof; the risk is dismissing new options too early.' : 'Mixed — comfortable with both ideas and facts.';
  var follow = g.avg.M >= HI ? 'Strong — decisions turn into plans and plans get finished.' : g.avg.M <= LO ? 'Weak — decisions can stall at the “who does it, by when” step.' : 'Moderate — follow-through depends on individual owners.';
  var fmt = [];
  if (g.avg.R >= HI) fmt.push('a short stand-up with a hard time limit');
  else if (g.avg.R <= LO) fmt.push('a pre-read and a day to reflect before deciding');
  else fmt.push('a standard meeting with a clear agenda');
  if (g.avg.I <= LO) fmt.push('written input collected before discussion');
  if (g.avg.I >= HI) fmt.push('a named decision owner agreed in advance');
  if (g.avg.S >= HI) fmt.push('an explicit slot for disagreement');
  return { pace: pace, authority: authority, evidence: evidence, followThrough: follow,
    format: 'A format that fits this group: ' + fmt.join(', ') + '.' };
}

function hotspots(members, comp) {
  var out = [];
  comp.filter(function (c) { return c.spread >= WIDE; }).sort(function (a, b) { return b.spread - a.spread; }).forEach(function (c) {
    out.push({ dim: c.dim, spread: c.spread, a: c.top, b: c.bottom, gap: c.top.dims[c.dim] - c.bottom.dims[c.dim], prompt: FACILITATION_PROMPTS[c.dim] });
  });
  return out;
}

function pairHotspots(g) {
  return g.pairs.slice().reverse().filter(function (p) { return p.score < 55; }).slice(0, 3);
}

function health(g, comp) {
  var meanSpread = Math.round(comp.reduce(function (s, c) { return s + c.spread; }, 0) / comp.length);
  var both = comp.filter(function (c) { return c.hiVoices > 0 && c.loVoices > 0; }).length;
  return {
    cohesion: g.avgPairScore, cohesionLabel: band(g.avgPairScore),
    diversity: meanSpread, diversityLabel: meanSpread >= 18 ? 'high' : meanSpread >= 11 ? 'moderate' : 'low',
    coverage: both, coverageLabel: both + ' of 5 dimensions have people on both poles'
  };
}

function memberCards(members, g) {
  return members.map(function (m) {
    var ranked = DIM_ORDER.slice().sort(function (x, y) { return m.dims[y] - m.dims[x]; });
    var diffs = DIM_ORDER.map(function (d) { return { d: d, diff: m.dims[d] - g.avg[d] }; })
      .sort(function (x, y) { return Math.abs(y.diff) - Math.abs(x.diff); });
    var mine = g.pairs.filter(function (p) { return p.a === m.name || p.b === m.name; });
    var other = function (p) { return p.a === m.name ? p.b : p.a; };
    var arche = m.key && typeof archeByKey === 'function' ? archeByKey(m.key) : null;
    var role = suggestGroupRole(m.dims);
    var st = diffs[0];
    return {
      name: m.name, dims: m.dims, role: role.role, archetype: arche ? arche.name : null,
      top: ranked.slice(0, 2),
      standout: { dim: st.d, diff: Math.round(st.diff),
        text: Math.abs(st.diff) < 8
          ? 'Close to the group average on every dimension — a natural bridge between different people.'
          : 'Scores ' + Math.abs(Math.round(st.diff)) + ' points ' + (st.diff > 0 ? 'above' : 'below') + ' the group average on ' + DIMS[st.d].name + ' — ' +
            (st.diff > 0 ? 'the group’s clearest voice for the “' + POLE[st.d][1].toLowerCase() + '” side.' : 'the group’s clearest voice for the “' + POLE[st.d][0].toLowerCase() + '” side.') },
      closest: mine.length ? { name: other(mine[0]), score: mine[0].score } : null,
      furthest: mine.length ? { name: other(mine[mine.length - 1]), score: mine[mine.length - 1].score } : null
    };
  });
}

function ranking(members, dim) {
  return members.slice().sort(function (a, b) { return b.dims[dim] - a.dims[dim]; });
}


/* ============================================================
   NLP narrative layer — the group read as written prose.
   Same approach as Engine.deepCompatibility: (1) classify each dimension
   into a relational STATE from the actual scores, (2) pick one of
   several template-grammar variants for that state, seeded off the
   scores so the same group always gets the same text, (3) fill the
   slots with real names and numbers. No network call, no model.
   ============================================================ */
var LANG = {
  P: { topic: 'information-gathering', hiS: 'reads situations through patterns, ideas and possibilities', hiP: 'read situations through patterns, ideas and possibilities', loS: 'works from what is tangible, literal and proven', loP: 'work from what is tangible, literal and proven' },
  R: { topic: 'pace and decision-making', hiS: 'decides on the move and adapts as it goes', hiP: 'decide on the move and adapt as they go', loS: 'pauses, weighs and protects the downside before acting', loP: 'pause, weigh and protect the downside before acting' },
  I: { topic: 'independence and holding one\u2019s ground', hiS: 'steers by an inner compass and holds the line', hiP: 'steer by an inner compass and hold the line', loS: 'stays open to influence and fits in readily', loP: 'stay open to influence and fit in readily' },
  S: { topic: 'warmth and directness between people', hiS: 'leads with care, openness and attunement', hiP: 'lead with care, openness and attunement', loS: 'stays direct, objective and self-contained', loP: 'stay direct, objective and self-contained' },
  M: { topic: 'drive and follow-through', hiS: 'sets high goals and runs on structure and follow-through', hiP: 'set high goals and run on structure and follow-through', loS: 'stays flexible, spontaneous and comfortable with “enough”', loP: 'stay flexible, spontaneous and comfortable with “enough”' }
};

var DIM_STATE_TEMPLATES = {
  consensusHi: [
    '%TOPICC% is a point of strong agreement: everyone sits on the %HIPOLE% side (average %AVG%, spread only ±%SP%), so the whole group %HIVERB%. %STRENGTH% The flip side of agreeing this much \u2014 %BLIND_LC%',
    'On %DIM% the group speaks with one voice — all %N% members land toward the %HIPOLE% end (average %AVG%). %STRENGTH% With nobody leaning the other way, watch for this: %BLIND_LC%'
  ],
  consensusLo: [
    '%TOPICC% is a point of strong agreement: everyone sits on the %LOPOLE% side (average %AVG%, spread only ±%SP%), so the whole group %LOVERB%. %STRENGTH% The flip side of agreeing this much \u2014 %BLIND_LC%',
    'On %DIM% the group speaks with one voice — all %N% members land toward the %LOPOLE% end (average %AVG%). %STRENGTH% With nobody leaning the other way, watch for this: %BLIND_LC%'
  ],
  consensusMid: [
    'On %DIM% the group clusters near the middle (average %AVG%, spread ±%SP%): nobody pulls hard toward %HIPOLE% or %LOPOLE%, so this dimension is unlikely to shape the group’s character or its conflicts. How the group handles %TOPIC% will depend more on the situation than on who is in the room.',
    '%DIM% is a quiet dimension for this group — everyone is moderate (average %AVG%, spread ±%SP%). There is no shared lean to lean on, and no split to manage; %TOPIC% will flex with circumstances.'
  ],
  camps: [
    '%DIM% divides the group into two camps: %HINAMES% %HILEAN% %HIPOLE% while %LONAMES% %LOLEAN% %LOPOLE% (%GAP% points between %TOPNAME% and %BOTNAME%). The first camp %HIVERB%; the second %LOVERB%. Named openly, that split is range; left unnamed, it feels like people talking past each other.',
    'Two different instincts about %TOPIC% coexist here. %HINAMES% %HIVERB%, while %LONAMES% %LOVERB% — a %GAP%-point gap at the extremes. Neither is wrong; the work is making the difference visible before it turns into friction.'
  ],
  outlierHi: [
    '%OUT% is the one clearly %HIPOLE% voice on %DIM% (%OUTSCORE% against a group average of %AVG%) — the rest of the group is closer together. That makes %OUT% either the group’s most valuable counterweight on %TOPIC% or its most easily overlooked perspective.',
    'On %DIM%, %OUT% stands apart: %OUTSCORE%, well above everyone else (group average %AVG%). The others share a similar baseline, so %OUT% may feel they are the only one who %HIVERB% — worth checking that this view actually gets heard.'
  ],
  outlierLo: [
    '%OUT% is the one clearly %LOPOLE% voice on %DIM% (%OUTSCORE% against a group average of %AVG%) — the rest of the group is closer together. That makes %OUT% either the group’s most valuable counterweight on %TOPIC% or its most easily overlooked perspective.',
    'On %DIM%, %OUT% stands apart: %OUTSCORE%, well below everyone else (group average %AVG%). The others share a similar baseline, so %OUT% may feel they are the only one who %LOVERB% — worth checking that this view actually gets heard.'
  ],
  scattered: [
    '%DIM% is spread across the whole range — from %BOTNAME% at %BOT% to %TOPNAME% at %TOP% (spread ±%SP%) — with no dominant camp. The group has no shared default on %TOPIC%, so it gets negotiated each time; that costs speed but adds perspectives.',
    'There is no group consensus on %DIM%: scores run from %BOT% (%BOTNAME%) to %TOP% (%TOPNAME%). Expect %TOPIC% to be re-decided case by case, and expect different members to feel the group “does it wrong” for opposite reasons.'
  ],
  leanHi: [
    'The group leans %HIPOLE% on %DIM% (average %AVG%), though not unanimously — spread ±%SP%. %STRENGTH% Because the lean is soft, individuals closer to the middle can still pull the group the other way when it matters.',
    '%DIM% tilts %HIPOLE% (average %AVG%) without being a hard consensus. %STRENGTH% Watch for the milder version of a shared blind spot: %BLIND_LC%'
  ],
  leanLo: [
    'The group leans %LOPOLE% on %DIM% (average %AVG%), though not unanimously — spread ±%SP%. %STRENGTH% Because the lean is soft, individuals closer to the middle can still pull the group the other way when it matters.',
    '%DIM% tilts %LOPOLE% (average %AVG%) without being a hard consensus. %STRENGTH% Watch for the milder version of a shared blind spot: %BLIND_LC%'
  ],
  blend: [
    '%DIM% is a moderate blend for this group (average %AVG%, spread ±%SP%) — a mix of %HIPOLE% and %LOPOLE% tendencies with no strong pull either way. This is flexible territory: %TOPIC% adapts to the task rather than following a fixed group habit.',
    'On %DIM% the group is mixed but not divided (average %AVG%, spread ±%SP%). Neither the %HIPOLE% nor the %LOPOLE% style dominates, so %TOPIC% is unlikely to be a source of either special strength or special friction.'
  ]
};

function seedOf(str) { var h = 0; for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) & 0xFFFFFFFF; } return Math.abs(h); }
function pick(list, key) { return list[seedOf(key) % list.length]; }
function joinNames(arr) {
  if (!arr.length) return 'nobody';
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}
function fill(tpl, map) { return tpl.replace(/%([A-Z_]+)%/g, function (m, k) { return map[k] != null ? map[k] : m; }); }
function aOrAn(n) { var t = String(n); return (/^8/.test(t) || /^(11|18)(\D|$)/.test(t)) ? 'an' : 'a'; }
function cap(x) { return x.charAt(0).toUpperCase() + x.slice(1); }
function lc(x) { return x.charAt(0).toLowerCase() + x.slice(1); }

function classifyDim(members, d, avg, sp) {
  var n = members.length;
  var hi = members.filter(function (m) { return m.dims[d] >= HI; });
  var lo = members.filter(function (m) { return m.dims[d] <= LO; });
  var sorted = members.slice().sort(function (a, b) { return b.dims[d] - a.dims[d]; });
  var top = sorted[0], bot = sorted[n - 1];
  var res = { hi: hi, lo: lo, top: top, bot: bot, outlier: null };
  if (sp < 9) { res.state = avg >= HI ? 'consensusHi' : avg <= LO ? 'consensusLo' : 'consensusMid';
    res.rule = 'Spread ±' + sp + ' is under 9, so everyone agrees; average ' + avg + ' → ' + (avg >= HI ? 'high' : avg <= LO ? 'low' : 'middle') + '.'; return res; }
  if (n >= 3) {
    members.forEach(function (m) {
      var others = members.filter(function (x) { return x !== m; });
      var mean = others.reduce(function (s, x) { return s + x.dims[d]; }, 0) / others.length;
      var sdo = Math.sqrt(others.reduce(function (s, x) { return s + Math.pow(x.dims[d] - mean, 2); }, 0) / others.length);
      var dev = m.dims[d] - mean;
      if (!res.outlier && Math.abs(dev) >= 22 && sdo < 10) res.outlier = { m: m, dev: dev, sdo: Math.round(sdo) };
    });
    if (res.outlier) { res.state = res.outlier.dev > 0 ? 'outlierHi' : 'outlierLo';
      res.rule = res.outlier.m.name + ' sits ' + Math.round(Math.abs(res.outlier.dev)) + ' points ' + (res.outlier.dev > 0 ? 'above' : 'below') + ' the others, who stay within ±' + res.outlier.sdo + ' of each other → single outlier.'; return res; }
  }
  if (hi.length >= 1 && lo.length >= 1 && sp >= WIDE) { res.state = 'camps';
    res.rule = hi.length + ' member' + (hi.length > 1 ? 's' : '') + ' at ' + HI + '+ and ' + lo.length + ' at ' + LO + ' or below, spread ±' + sp + ' (≥ ' + WIDE + ') → two camps.'; return res; }
  if (sp >= WIDE) { res.state = 'scattered'; res.rule = 'Spread ±' + sp + ' is ≥ ' + WIDE + ' with no clear high/low camps → scattered.'; return res; }
  res.state = avg >= HI ? 'leanHi' : avg <= LO ? 'leanLo' : 'blend';
  res.rule = 'Spread ±' + sp + ' is moderate; average ' + avg + ' → ' + (res.state === 'blend' ? 'no strong lean (between ' + LO + ' and ' + HI + ')' : 'soft lean ' + (avg >= HI ? 'high' : 'low') + ' (' + (avg >= HI ? HI + '+' : LO + ' or below') + ')') + '.';
  return res;
}

function dimNarrative(members, g, c) {
  var d = c.dim, cl = classifyDim(members, d, c.avg, c.spread);
  var pole = POLE[d], tx = TEXT[d], lg = LANG[d];
  var leanKey = c.avg >= 50 ? 'hi' : 'lo';
  var camp = function (arr) { return joinNames(arr.map(function (m) { return m.name; })); };
  var map = {
    DIM: DIMS[d].name, TOPIC: lg.topic, TOPICC: cap(lg.topic), AVG: c.avg, SP: c.spread, N: members.length,
    HIPOLE: pole[1].toLowerCase(), LOPOLE: pole[0].toLowerCase(), HIVERB: lg.hiS, LOVERB: lg.loS, HIVERBP: lg.hiP, LOVERBP: lg.loP,
    HIVERBC: cl.hi.length > 1 ? lg.hiP : lg.hiS, HILEAN: cl.hi.length > 1 ? 'lean' : 'leans', LOLEAN: cl.lo.length > 1 ? 'lean' : 'leans', LOVERBC: cl.lo.length > 1 ? lg.loP : lg.loS,
    GAPA: aOrAn(cl.top.dims[d] - cl.bot.dims[d]) + ' ' + (cl.top.dims[d] - cl.bot.dims[d]) + '-point',
    HINAMES: camp(cl.hi), LONAMES: camp(cl.lo), TOPNAME: cl.top.name, BOTNAME: cl.bot.name,
    TOP: cl.top.dims[d], BOT: cl.bot.dims[d], GAP: cl.top.dims[d] - cl.bot.dims[d],
    OUT: cl.outlier ? cl.outlier.m.name : '', OUTSCORE: cl.outlier ? cl.outlier.m.dims[d] : '',
    STRENGTH: tx[leanKey].strength, BLIND: tx[leanKey].blind, BLIND_LC: lc(tx[leanKey].blind)
  };
  var tpl = pick(DIM_STATE_TEMPLATES[cl.state], d + ':' + cl.state + ':' + c.avg + ':' + c.spread + ':' + members.length);
  return { dim: d, state: cl.state, rule: cl.rule, text: fill(tpl, map) };
}

var STATE_LABEL = { consensusHi: 'strong agreement (high)', consensusLo: 'strong agreement (low)', consensusMid: 'quiet / moderate',
  camps: 'two camps', outlierHi: 'one high outlier', outlierLo: 'one low outlier', scattered: 'scattered', leanHi: 'soft lean (high)', leanLo: 'soft lean (low)', blend: 'moderate blend' };

function summaryNarrative(members, g, GI) {
  var h = GI.health, n = members.length;
  var team = g.teamMatch && g.teamMatch.arche ? g.teamMatch.arche.name : null;
  var leanest = GI.comp.slice().sort(function (a, b) { return Math.abs(b.avg - 50) - Math.abs(a.avg - 50); })[0];
  var widest = GI.comp.slice().sort(function (a, b) { return b.spread - a.spread; })[0];
  var out = [];
  out.push('This is a group of ' + n + ' people whose averaged profile reads as ' + (team ? '“' + team + '”' : 'a blended type') + ' — a description of the group’s centre of gravity, not of any one member.');
  out.push(pick([
    'On the numbers it is ' + h.cohesionLabel + ' (average pairwise compatibility ' + h.cohesion + '), with ' + h.diversityLabel + ' diversity of styles (average spread ±' + h.diversity + ' points).',
    'Pair by pair the group scores ' + h.cohesion + ' on average, which reads as ' + h.cohesionLabel + '; individual styles differ by ' + h.diversityLabel + ' amounts (average spread ±' + h.diversity + ').'
  ], 'sum:' + h.cohesion + ':' + h.diversity));
  out.push('Its most pronounced collective trait is ' + DIMS[leanest.dim].name + ' (average ' + leanest.avg + ', leaning ' + (leanest.avg >= 50 ? POLE[leanest.dim][1] : POLE[leanest.dim][0]).toLowerCase() + '), and its biggest internal difference is on ' + DIMS[widest.dim].name + ', where ' + widest.bottom.name + ' (' + widest.bottom.dims[widest.dim] + ') and ' + widest.top.name + ' (' + widest.top.dims[widest.dim] + ') sit furthest apart.');
  out.push('The easiest pairing on paper is ' + g.best.a + ' × ' + g.best.b + ' (' + g.best.score + '); the widest is ' + g.worst.a + ' × ' + g.worst.b + ' (' + g.worst.score + ').');
  out.push(pick([
    'The most useful thing to do with this is to name the differences out loud rather than let them surface as friction — the sections below show where to start.',
    'Treat the splits below as a conversation agenda: the numbers say where the group’s styles diverge, not which style is right.'
  ], 'close:' + n + ':' + g.worst.score));
  return out;
}

function memberNarrative(card, idx) {
  var arch = card.archetype ? ' (' + card.archetype + ')' : '';
  var rel = card.closest ? { c: card.closest, f: card.furthest } : null;
  var tpl = pick([
    '%NAME% brings %ROLE% energy%ARCH%. %STANDOUT%%REL%',
    'Read as a role, %NAME% is the group’s %ROLE%%ARCH%. %STANDOUT%%REL%'
  ], card.name + ':' + card.role + ':' + idx);
  return fill(tpl, {
    NAME: card.name, ROLE: card.role.toLowerCase(), ARCH: arch, STANDOUT: card.standout.text,
    REL: !rel ? '' : rel.c.name === rel.f.name
      ? ' Their pairing with ' + rel.c.name + ' scores ' + rel.c.score + '.'
      : ' Within the group they connect most easily with ' + rel.c.name + ' (' + rel.c.score + ') and need the most translation with ' + rel.f.name + ' (' + rel.f.score + ').'
  });
}

function pairNarrative(members, p, kind) {
  var A = members.filter(function (m) { return m.name === p.a; })[0], B = members.filter(function (m) { return m.name === p.b; })[0];
  var head = kind === 'best'
    ? p.a + ' × ' + p.b + ' is the group’s easiest working relationship (' + p.score + ') — their profiles land closest together, so less translation is needed between them.'
    : p.a + ' × ' + p.b + ' is the widest pairing (' + p.score + '). ' + (p.conflict && p.conflict.why ? p.conflict.why : '') + (p.conflict && p.conflict.dim ? ' A way through: ' + p.conflict.bridge : '');
  var arch = (A && B && typeof archPairNarrative === 'function') ? archPairNarrative(A.key, B.key, A.name, B.name) : null;
  return { head: head, arch: arch };
}

function narrate(members, g, GI) {
  return {
    summary: summaryNarrative(members, g, GI),
    dims: GI.comp.map(function (c) { var x = dimNarrative(members, g, c); x.stateLabel = STATE_LABEL[x.state]; return x; }),
    members: GI.cards.map(function (c, i) { return { name: c.name, text: memberNarrative(c, i) }; }),
    best: pairNarrative(members, g.best, 'best'),
    worst: pairNarrative(members, g.worst, 'worst'),
    method: [
      'Step 1 — Classify. For each of the 5 dimensions the group’s actual scores are sorted into a state: strong agreement, a soft lean, a moderate blend, two camps, a single outlier, or scattered. The thresholds are fixed (a collective lean starts at an average of ' + HI + ' / ' + LO + '; a real split starts at a spread of ±' + WIDE + ' points; an outlier is 22+ points from otherwise-similar others).',
      'Step 2 — Select. Each state has several sentence templates. One is picked using a seed computed from the scores themselves, so the same group always gets the same wording, but different groups get different phrasing.',
      'Step 3 — Fill. The template’s slots are filled with the real names, scores, averages and gaps, plus the strength / blind-spot wording for the side the group leans toward.',
      'This is rule-based natural-language generation, the same technique as the individual Deep Analysis and the 1:1 trait-by-trait text. Nothing is sent to a server or a language model, and it describes composition from five self-reported scores — not performance or anyone’s actual behaviour.'
    ]
  };
}

function build(members, g) {
  var comp = composition(members, g);
  return { comp: comp, health: health(g, comp), strengths: strengths(comp), blindSpots: blindSpots(comp),
    communication: communication(g, comp), decision: decisionStyle(g), hotspots: hotspots(members, comp),
    pairHotspots: pairHotspots(g), cards: memberCards(members, g) };
}
function buildAll(members, g) {
  var GI = build(members, g);
  GI.story = narrate(members, g, GI);
  return GI;
}

return { build: buildAll, ranking: ranking, lean: lean, POLE: POLE, TEXT: TEXT };
})();
