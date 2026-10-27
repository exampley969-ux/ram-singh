/* ============================================================
   SocialPlus — extra, fully rule-based reads for Compatibility and Group.
   No network, no randomness: same scores in -> same text out.
   Works from the five dimension scores alone (facets not required).
   ============================================================ */
var SocialPlus = (function () {
'use strict';

var ORDER = ['P', 'R', 'I', 'S', 'M'];
var HI = 62, LO = 38;

/* what each pole is good at ("gift") and what it looks like when overused ("edge") */
var POLE = {
  P: { hi: { tag: 'Conceptual', gift: 'spotting patterns and possibilities', edge: 'drifting away from what is practical' },
       lo: { tag: 'Concrete',   gift: 'keeping things practical and grounded', edge: 'missing what is new' } },
  R: { hi: { tag: 'Quick',      gift: 'moving fast when things change', edge: 'rushing past details' },
       lo: { tag: 'Measured',   gift: 'slowing things down until they are right', edge: 'stalling when speed matters' } },
  I: { hi: { tag: 'Independent', gift: 'holding a position under pressure', edge: 'overruling others without noticing' },
       lo: { tag: 'Yielding',    gift: 'keeping the peace and adapting', edge: 'going quiet about what they want' } },
  S: { hi: { tag: 'Warm',       gift: 'making people feel included', edge: 'taking on everyone else’s mood' },
       lo: { tag: 'Detached',   gift: 'staying steady and unbothered by social noise', edge: 'seeming cold without meaning to' } },
  M: { hi: { tag: 'Driven',     gift: 'pushing things to the finish', edge: 'burning out or burning others out' },
       lo: { tag: 'Relaxed',    gift: 'knowing when enough is enough', edge: 'letting things drift' } }
};

/* how the person on one pole can talk to the person on the other pole */
var TALK = {
  P: { hiToLo: 'Anchor each idea in one concrete example before the big picture — %LO% trusts what can be seen and tested.',
       loToHi: 'Let %HI% think out loud about possibilities first, then ask “what is the idea behind this?” before asking for specifics.' },
  R: { hiToLo: 'Send %LO% the question ahead of time rather than asking for an answer on the spot — a pause is thinking, not no.',
       loToHi: 'Say early when you need time (“give me until tonight”) so %HI% does not read silence as disagreement.' },
  I: { hiToLo: 'Ask what %LO% actually wants before stating your own view — they may be agreeing only to keep things smooth.',
       loToHi: 'State your preference plainly and early. %HI% takes hints as having no preference.' },
  S: { hiToLo: 'Do not read short replies as distance. Check in lightly and leave %LO% room for space.',
       loToHi: 'One short line of care costs little and means a lot to %HI%. Say when you need quiet so it is not taken personally.' },
  M: { hiToLo: 'Frame goals as what you want, not what %LO% is failing to do, and ask what “enough” looks like for them.',
       loToHi: 'Agree up front on what is good enough, and flag deadlines early so %HI% is not carrying the urgency alone.' }
};

var FEEDBACK = {
  P: ['gets the point faster through a story or example than through a principle', 'gets the point faster when the reason behind it is explained first'],
  R: ['wants it said straight away', 'wants it said calmly and with time to respond'],
  I: ['wants to hear the reasoning and decide for themselves', 'wants to know you are on their side before the correction'],
  S: ['can take it plainly, without a soft landing', 'hears the warmth first and the content second'],
  M: ['wants to know exactly what to change and by when', 'wants to know it is a small thing, not a verdict']
};

function seedOf(str) { var h = 0; for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) & 0xFFFFFFFF; } return Math.abs(h); }
function pick(list, key) { return list[seedOf(key) % list.length]; }
function fill(tpl, map) { return tpl.replace(/%([A-Z_]+)%/g, function (m, k) { return map[k] != null ? map[k] : m; }); }
function side(v) { return v >= HI ? 'hi' : v <= LO ? 'lo' : 'mid'; }
function pole(d, v) { var s = v >= 50 ? 'hi' : 'lo'; return POLE[d][s]; }
function joinNames(a) { return a.length <= 1 ? (a[0] || '') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
function dimName(d) { return (typeof DIMS !== 'undefined' && DIMS[d]) ? DIMS[d].name : d; }
function dimColor(d) { return (typeof DIMS !== 'undefined' && DIMS[d]) ? DIMS[d].color : 'var(--ink)'; }

/* ---------------- COMPATIBILITY ---------------- */

/* 1. How to talk to each other: per dimension with a real gap, advice in both directions. */
function talk(a, b) {
  var items = [], shared = [];
  ORDER.forEach(function (d) {
    var gap = Math.abs(a.dims[d] - b.dims[d]);
    if (gap >= 18) {
      var aHigh = a.dims[d] > b.dims[d];
      var hi = aHigh ? a : b, lo = aHigh ? b : a;
      var m = { HI: hi.name, LO: lo.name };
      items.push({
        dim: d, name: dimName(d), color: dimColor(d), gap: gap,
        head: hi.name + ' leans ' + POLE[d].hi.tag.toLowerCase() + ' (' + hi.dims[d] + '), ' + lo.name + ' leans ' + POLE[d].lo.tag.toLowerCase() + ' (' + lo.dims[d] + ').',
        forHi: { who: hi.name, text: fill(TALK[d].hiToLo, m) },
        forLo: { who: lo.name, text: fill(TALK[d].loToHi, m) }
      });
    } else if (a.dims[d] >= 55 === b.dims[d] >= 55) {
      shared.push({ dim: d, name: dimName(d), tag: pole(d, (a.dims[d] + b.dims[d]) / 2).tag });
    }
  });
  items.sort(function (x, y) { return y.gap - x.gap; });
  var feedback = [a, b].map(function (p, i) {
    var o = i === 0 ? b : a;
    // the dimension where the giver and receiver differ most decides the advice
    var best = null;
    ORDER.forEach(function (d) { var g = Math.abs(p.dims[d] - o.dims[d]); if (!best || g > best.g) best = { d: d, g: g }; });
    var d = best.d, idx = o.dims[d] >= 50 ? 0 : 1;
    return { from: p.name, to: o.name, dim: dimName(d),
      text: 'When giving feedback to ' + o.name + ', remember they ' + FEEDBACK[d][idx] + '.' };
  });
  return { items: items, shared: shared, feedback: feedback };
}

/* 5. Blind-spot swap: where one person's strength is the other's hardest thing. */
function swap(a, b) {
  var rows = [];
  ORDER.forEach(function (d) {
    var gap = Math.abs(a.dims[d] - b.dims[d]);
    if (gap < 20) return;
    var aHigh = a.dims[d] > b.dims[d];
    var hi = aHigh ? a : b, lo = aHigh ? b : a;
    var H = POLE[d].hi, L = POLE[d].lo;
    rows.push({
      dim: d, name: dimName(d), color: dimColor(d), gap: gap,
      text: hi.name + '’s knack for ' + H.gift + ' covers what ' + lo.name + ' finds hardest, and ' + lo.name + '’s knack for ' + L.gift + ' does the same in return.',
      watch: 'Watch for: ' + hi.name + ' ' + H.edge + '; ' + lo.name + ' ' + L.edge + '.'
    });
  });
  rows.sort(function (x, y) { return y.gap - x.gap; });
  return rows;
}

/* 7. How the pairing tends to change over time. */
function evolve(a, b, score) {
  var gaps = ORDER.map(function (d) { return { d: d, g: Math.abs(a.dims[d] - b.dims[d]) }; }).sort(function (x, y) { return y.g - x.g; });
  var big = gaps[0], small = gaps[gaps.length - 1];
  var bigName = dimName(big.d).toLowerCase(), smallName = dimName(small.d).toLowerCase();
  var wide = big.g >= 25, band = score >= 75 ? 'high' : score >= 58 ? 'mid' : 'low';
  var key = a.name + b.name + band;

  var early = wide
    ? 'The first months run on contrast. Your difference on ' + bigName + ' tends to feel interesting rather than difficult, and your closeness on ' + smallName + ' makes things easy.'
    : 'The first months tend to feel easy. Your profiles sit close on most things, including ' + smallName + ', so there is little to translate.';
  var year = wide
    ? 'Around the one-year mark, ' + bigName + ' is where everyday friction is most likely to show up, because by then the novelty has worn off and the habit is what remains. Name it before it becomes a pattern.'
    : 'Around the one-year mark the risk is sameness rather than friction: with so little between you, small habits can go unquestioned. Deliberately try each other’s way once in a while.';
  var long = {
    high: pick(['Over years, you are likely to build shared routines without much effort. The thing to guard is complacency: keep asking each other what has changed.', 'Long term, the closeness on paper tends to turn into reliable habits. Keep making room for the places where you do differ.'], key),
    mid: pick(['Over years, this pairing improves with explicit agreements. Decide how you handle ' + bigName + ' once, out loud, and you will not have to relitigate it.', 'Long term, the pair does best when the gap on ' + bigName + ' becomes a division of labour instead of a recurring argument.'], key),
    low: pick(['Over years, this pairing takes deliberate effort. The wide gaps will not close by themselves, so agree practical rules early, especially around ' + bigName + '.', 'Long term, this works when both of you treat the differences as a design problem to solve together, with ' + bigName + ' first on the list.'], key)
  }[band];
  return [
    { when: 'First few months', text: early },
    { when: 'Around a year', text: year },
    { when: 'Years in', text: long }
  ];
}

/* ---------------- GROUP ---------------- */

var ROLE_DEF = [
  { id: 'opener',    label: 'Likely to speak first',        score: function (m) { return (m.S + m.R) / 2; },              line: function (n) { return n + ' will probably open the discussion and set the tone.'; } },
  { id: 'pusher',    label: 'Likely to push back',          score: function (m) { return m.I; },                          line: function (n) { return n + ' is likely to push back and test the plan.'; } },
  { id: 'visionary', label: 'Likely to widen the options',  score: function (m) { return m.P; },                          line: function (n) { return n + ' will tend to widen the options and talk about what could be.'; } },
  { id: 'grounder',  label: 'Likely to ask for specifics',  score: function (m) { return 100 - m.P; },                    line: function (n) { return n + ' will tend to ask for specifics: who, what, by when.'; } },
  { id: 'closer',    label: 'Likely to push for a decision', score: function (m) { return m.M; },                         line: function (n) { return n + ' will press to close the discussion and pick an owner.'; } },
  { id: 'slower',    label: 'Likely to ask for more time',  score: function (m) { return 100 - m.R; },                    line: function (n) { return n + ' may ask to sleep on it rather than decide in the room.'; } },
  { id: 'peace',     label: 'Likely to smooth things over', score: function (m) { return ((100 - m.I) + m.S) / 2; },     line: function (n) { return n + ' will tend to smooth over disagreement, and may agree sooner than they really do.'; } },
  { id: 'quiet',     label: 'Likely to stay quiet unless asked', score: function (m) { return ((100 - m.S) + (100 - m.R)) / 2; }, line: function (n) { return n + ' may stay quiet unless asked directly, so their view can be missed.'; } }
];

/* 9. Meeting simulator: assign each tendency to at most one person, strongest fits first. */
function meeting(members) {
  var cand = [];
  members.forEach(function (m) { ROLE_DEF.forEach(function (r) { cand.push({ m: m, r: r, s: r.score(m.dims) }); }); });
  cand.sort(function (x, y) { return y.s - x.s || (x.m.name < y.m.name ? -1 : 1); });
  var usedM = {}, usedR = {}, out = [];
  cand.forEach(function (c) {
    if (c.s < 58 || usedM[c.m.name] || usedR[c.r.id]) return;
    usedM[c.m.name] = 1; usedR[c.r.id] = 1;
    out.push({ id: c.r.id, who: c.m.name, label: c.r.label, score: Math.round(c.s), text: c.r.line(c.m.name) });
  });
  var avg = {};
  ORDER.forEach(function (d) { avg[d] = members.reduce(function (s, m) { return s + m.dims[d]; }, 0) / members.length; });
  var tips = [];
  if (avg.R >= HI) tips.push('Add a rule that big decisions wait ten minutes. This group tends to move faster than the information does.');
  if (avg.R <= LO) tips.push('Set a decision deadline at the start. This group tends to keep deliberating past the point of useful information.');
  if (avg.I >= HI) tips.push('Agree who has the final say before the meeting. Several strong views will otherwise keep trading blows.');
  if (avg.I <= LO) tips.push('Ask for the dissenting view on purpose. This group tends to agree before it has really decided.');
  if (avg.S <= LO) tips.push('Go round the table so every voice is heard. Quiet is not agreement here.');
  if (avg.S >= HI) tips.push('Time-box the check-in chat. This group can spend the meeting on the room instead of the agenda.');
  if (avg.P >= HI) tips.push('End every topic with one concrete next step. Ideas come easily here; follow-through needs a name and a date.');
  if (avg.P <= LO) tips.push('Reserve five minutes for “what else could we try?”. This group sticks to what is known.');
  if (avg.M >= HI) tips.push('Check the workload before committing to more. Drive is plentiful; recovery is not.');
  if (avg.M <= LO) tips.push('Write the deadline down and name the owner. Nobody here will push it otherwise.');
  var quiet = out.filter(function (o) { return o.id === 'quiet'; })[0];
  if (quiet) tips.unshift('Ask ' + quiet.who + ' directly for their view, before the discussion hardens.');
  var closer = out.filter(function (o) { return o.id === 'closer'; })[0];
  var pusher = out.filter(function (o) { return o.id === 'pusher'; })[0];
  var risk = '';
  if (closer && pusher && closer.who !== pusher.who) risk = closer.who + ' pressing for a decision while ' + pusher.who + ' is still testing it is the most likely point of tension. Let the challenge finish before the vote.';
  return { roles: out, tips: tips.slice(0, 4), risk: risk, avg: avg };
}

/* 10. Gap finder: which pole of which dimension nobody in the group naturally holds. */
function gaps(members) {
  var res = [];
  ORDER.forEach(function (d) {
    var hiN = members.filter(function (m) { return m.dims[d] >= 58; }).length;
    var loN = members.filter(function (m) { return m.dims[d] <= 42; }).length;
    var missing = null;
    if (hiN === 0 && loN >= 1) missing = 'hi';
    else if (loN === 0 && hiN >= 1) missing = 'lo';
    if (!missing) return;
    var other = missing === 'hi' ? 'lo' : 'hi';
    res.push({
      dim: d, name: dimName(d), color: dimColor(d), missing: POLE[d][missing].tag, have: POLE[d][other].tag,
      add: 'Someone on the ' + POLE[d][missing].tag.toLowerCase() + ' side of ' + dimName(d).toLowerCase() + ' — good at ' + POLE[d][missing].gift + '.',
      risk: 'Without that, the group leans toward ' + POLE[d][other].edge + '.',
      near: Math.min.apply(null, members.map(function (m) { return Math.abs(m.dims[d] - (missing === 'hi' ? 70 : 30)); }))
    });
  });
  res.sort(function (x, y) { return y.near - x.near; });
  return res;
}

/* 11. Sub-team suggester: best pair for six kinds of work. `want` lists the dimensions and
   direction (+1 = high pole, -1 = low pole) that suit the task; the explanation is built from
   the pair's actual averages, so it never claims a trait the pair does not have. */
var TASKS = [
  { id: 'ideas',  title: 'Generating new ideas',            want: [['P', 1, 0.5], ['S', 1, 0.3]], spread: ['P', 0.2] },
  { id: 'detail', title: 'Careful, detail-heavy review',    want: [['P', -1, 0.4], ['R', -1, 0.3], ['M', 1, 0.3]] },
  { id: 'fast',   title: 'A fast call under pressure',      want: [['R', 1, 0.4], ['I', 1, 0.3], ['M', 1, 0.3]], clash: 'I' },
  { id: 'client', title: 'Facing people outside the team',  want: [['S', 1, 0.7], ['R', 1, 0.3]] },
  { id: 'long',   title: 'A long project that needs stamina', want: [['M', 1, 0.6], ['S', 1, 0.2], ['R', -1, 0.2]] },
  { id: 'hard',   title: 'A difficult conversation',        want: [['S', 1, 0.5], ['I', -1, 0.3], ['R', -1, 0.2]] }
];
function toward(avg, dir) { return dir > 0 ? avg : 100 - avg; }
function pairFit(t, a, b) {
  var s = 0;
  t.want.forEach(function (w) { s += w[2] * toward((a[w[0]] + b[w[0]]) / 2, w[1]); });
  if (t.spread) s += t.spread[1] * Math.abs(a[t.spread[0]] - b[t.spread[0]]);
  if (t.clash && a[t.clash] >= 70 && b[t.clash] >= 70) s -= 10;
  return s;
}
function pairWhy(t, a, b, an, bn) {
  var parts = [];
  t.want.forEach(function (w) {
    var avg = (a[w[0]] + b[w[0]]) / 2, tw = toward(avg, w[1]);
    if (tw >= 55) parts.push(POLE[w[0]][w[1] > 0 ? 'hi' : 'lo'].tag.toLowerCase() + ' on ' + dimName(w[0]).toLowerCase() + ' (' + Math.round(tw) + ')');
  });
  if (t.spread && Math.abs(a[t.spread[0]] - b[t.spread[0]]) >= 25) parts.push('far enough apart on ' + dimName(t.spread[0]).toLowerCase() + ' that one can ground what the other imagines');
  return parts.length ? 'together they average ' + parts.join(' and ') : 'the closest fit in this group, though nobody is strongly suited to it';
}
function teams(members) {
  var out = [], used = {};
  TASKS.forEach(function (t) {
    var best = null;
    for (var i = 0; i < members.length; i++) for (var j = i + 1; j < members.length; j++) {
      var key = members[i].name + '|' + members[j].name;
      var s = pairFit(t, members[i].dims, members[j].dims) - (members.length >= 4 ? 8 * (used[key] || 0) : 0);
      if (!best || s > best.s) best = { a: members[i], b: members[j], s: s, key: key };
    }
    if (best) {
      used[best.key] = (used[best.key] || 0) + 1;
      out.push({ id: t.id, title: t.title, a: best.a.name, b: best.b.name, why: pairWhy(t, best.a.dims, best.b.dims) });
    }
  });
  var risky = [];
  if (typeof Engine !== 'undefined') {
    for (var x = 0; x < members.length; x++) for (var y = x + 1; y < members.length; y++) {
      var sc = Engine.compatibility(members[x].dims, members[y].dims, members[x].name, members[y].name).score;
      risky.push({ a: members[x].name, b: members[y].name, score: sc });
    }
    risky.sort(function (p, q) { return p.score - q.score; });
  }
  return { tasks: out, risky: risky.slice(0, 2).filter(function (r) { return r.score < 62; }) };
}

return { talk: talk, swap: swap, evolve: evolve, meeting: meeting, gaps: gaps, teams: teams, POLE: POLE };
})();
