/* ============================================================
   EnginePlus — facet-level analysis on top of the existing engines.
   Works on the 20 facet scores (not just the 5 dimension averages) and
   adds: behaviour patterns, internal tensions, 8 situational scenarios,
   per-facet pair comparison, relationship lenses, team roles and
   role-gap analysis. All rule-based and deterministic: the same scores
   always give the same text; nothing leaves the browser.
   ============================================================ */
var EnginePlus = (function () {
'use strict';

/* ---------- helpers ---------- */
function facetKeys() { return Engine.facetKeys(); }
function facetInfo(key) {
  var p = key.split('.'), d = p[0], f = DIMS[d].facets[p[1]];
  return { key: key, dim: d, name: f.name, hi: f.hi, lo: f.lo, color: DIMS[d].color };
}
function validFacets(f) {
  if (!f || typeof f !== 'object') return false;
  return facetKeys().every(function (k) { return typeof f[k] === 'number' && f[k] >= 0 && f[k] <= 100; });
}
function H(f, k) { return f[k] >= 62; }
function L(f, k) { return f[k] <= 38; }
function band(score) { return score >= 66 ? 'high' : score <= 34 ? 'low' : 'mid'; }
function lc(x) { return x.charAt(0).toLowerCase() + x.slice(1); }
function seedOf(str) { var h = 0; for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) & 0xFFFFFFFF; } return Math.abs(h); }
// %V(tend|tends)% -> first form for plural subjects ("you", "you two"), second for singular ("the group")
function fillV(tpl, plural, subj) {
  var low = subj.charAt(0).toLowerCase() + subj.slice(1);
  return tpl.replace(/%SUBJ%/g, function (m, off) { return off === 0 ? subj : low; }).replace(/%OBJ%/g, low).replace(/%V\(([a-z]+)\|([a-z]+)\)%/g, function (m, a, b) { return plural ? a : b; });
}

/* ---------- 8 situational scenarios ---------- */
var SCENARIOS = [
  { id: 'deadline', title: 'Deadline pressure', w: { 'M.discipline': 1, 'M.persistence': 1, 'R.tempo': 0.5, 'I.stability': 0.5, 'R.adaptability': 0.3 },
    high: '%SUBJ% %V(stay|stays)% organised under pressure — plans get followed and work gets finished, even when time is short.',
    mid: '%SUBJ% %V(cope|copes)% with deadlines but %V(do|does)% best with clear checkpoints; pressure can tip either way depending on the day.',
    low: '%SUBJ% %V(find|finds)% deadlines stressful — work tends to bunch up late, so early milestones and outside accountability matter.',
    hiRole: 'keeps the plan moving and the finish line in sight', loRole: 'works better with extra structure and checkpoints',
    grow: 'Break big deadlines into three visible checkpoints and tell someone the first one.', lever: 'Take the finishing role on time-boxed work.',
    teamHigh: 'Lean on it: give the group hard dates — it will meet them.', teamLow: 'Protect it: break work into weekly checkpoints with named owners.' },
  { id: 'conflict', title: 'Disagreement & conflict', w: { 'S.empathy': 0.8, 'R.expression': 0.8, 'I.conviction': -0.6, 'S.harmony': 0.3 },
    high: '%SUBJ% can disagree without it turning personal — feelings get named and positions can move.',
    mid: '%SUBJ% %V(handle|handles)% disagreement acceptably, though it can go unspoken for a while or flare when the stakes rise.',
    low: 'Disagreement is where %SUBJ% %V(struggle|struggles)% most — views harden, feelings stay unspoken, or both, so conflict tends to surface late and sharp.',
    hiRole: 'names the issue calmly and keeps the talk constructive', loRole: 'needs more time and a lower-stakes setting to say what they think',
    grow: 'Name one small disagreement a week, starting with “I see it differently because…”.', lever: 'Be the one who opens the hard conversation.',
    teamHigh: 'Lean on it: the group can argue productively — use it for real decisions.', teamLow: 'Protect it: agree ground rules for disagreement and use written input first.' },
  { id: 'brainstorm', title: 'Brainstorming & new ideas', w: { 'P.abstraction': 1, 'P.curiosity': 1, 'P.intuition': 0.7, 'R.adaptability': 0.5, 'R.expression': 0.5 },
    high: 'Ideas flow — %SUBJ% %V(connect|connects)% unrelated things, %V(welcome|welcomes)% odd suggestions and %V(enjoy|enjoys)% open-ended sessions.',
    mid: '%SUBJ% %V(contribute|contributes)% ideas when the question is concrete enough, but open-ended brainstorms can feel unstructured.',
    low: 'Open-ended ideation is not where %SUBJ% %V(shine|shines)% — a defined problem, real constraints and examples work better.',
    hiRole: 'throws out the wild options', loRole: 'asks “what would that look like in practice?”',
    grow: 'Before judging an idea, write down two ways it could work.', lever: 'Join early-stage discovery rounds.',
    teamHigh: 'Lean on it: run open idea sessions — then add a step that turns ideas into plans.', teamLow: 'Protect it: bring examples and constraints; invite an outside view for fresh options.' },
  { id: 'change', title: 'Change & uncertainty', w: { 'R.adaptability': 1, 'P.curiosity': 0.6, 'R.risk': 0.6, 'I.stability': 0.5 },
    high: 'Change feels like opportunity — %SUBJ% %V(adjust|adjusts)% quickly and %V(stay|stays)% steady while plans move.',
    mid: '%SUBJ% %V(adapt|adapts)% to change after a short adjustment period; sudden swerves cost more than gradual ones.',
    low: 'Sudden change is draining — %SUBJ% %V(work|works)% best with notice, a clear reason and time to rebuild the plan.',
    hiRole: 'adapts first and shows others it is safe', loRole: 'needs notice and a clear reason',
    grow: 'When plans change, list what stays the same before what changes.', lever: 'Take the lead during transitions.',
    teamHigh: 'Lean on it: hand the group the ambiguous projects.', teamLow: 'Protect it: announce changes early, explain why, and keep routines stable around them.' },
  { id: 'decision', title: 'Making decisions', w: { 'R.tempo': 1, 'R.risk': 0.6, 'I.conviction': 0.6, 'I.autonomy': 0.4 },
    high: 'Decisions come quickly and firmly — %SUBJ% %V(weigh|weighs)% enough to commit, then %V(move|moves)% on.',
    mid: '%SUBJ% %V(decide|decides)% at a steady pace — quick on small calls, slower when the stakes are high.',
    low: 'Big decisions take a long time — %SUBJ% %V(gather|gathers)% information, %V(protect|protects)% the downside and %V(commit|commits)% late.',
    hiRole: 'calls it and moves', loRole: 'checks the downside before committing',
    grow: 'Set a decision deadline for reversible choices, then stick to it.', lever: 'Own the quick calls where speed matters.',
    teamHigh: 'Lean on it: let the group decide fast on reversible choices; add a pause only for big bets.', teamLow: 'Protect it: set decision deadlines so deliberation does not become delay.' },
  { id: 'detail', title: 'Detail & quality work', w: { 'P.attention': -1, 'P.abstraction': -0.6, 'M.discipline': 0.8, 'R.risk': -0.5, 'M.persistence': 0.4 },
    high: 'Precision work suits %SUBJ% — focused attention, care and follow-through catch what others miss.',
    mid: '%SUBJ% %V(manage|manages)% detail work well in bursts, but long stretches of precision can wear attention thin.',
    low: 'Fine detail is a stretch — %SUBJ% %V(see|sees)% the big picture first, and small errors can slip through without a checklist.',
    hiRole: 'owns quality checks and the fine print', loRole: 'sees the big picture and relies on checklists for the details',
    grow: 'Use a short checklist for anything where small errors are costly.', lever: 'Be the final reviewer on high-stakes work.',
    teamHigh: 'Lean on it: the group can be trusted with precision-critical work.', teamLow: 'Protect it: add checklists and a second-pair-of-eyes review step.' },
  { id: 'connect', title: 'Connection & social energy', w: { 'S.warmth': 1, 'S.gregarious': 1, 'S.empathy': 0.8, 'I.distinct': -0.4 },
    high: 'People energise %SUBJ% — trust builds fast and others tend to feel included.',
    mid: '%SUBJ% %V(connect|connects)% well one-to-one or in small groups; large or long social settings use up energy.',
    low: '%SUBJ% %V(connect|connects)% through ideas and tasks rather than small talk — warm in a quiet, steady way, but social effort is deliberate.',
    hiRole: 'builds rapport and keeps the mood open', loRole: 'connects through shared work rather than chat',
    grow: 'Add one low-effort check-in a week with someone you rely on.', lever: 'Be the relationship-builder in new groups.',
    teamHigh: 'Lean on it: use the group for onboarding and cross-team relationships.', teamLow: 'Protect it: schedule short check-ins — do not assume quiet means fine.' },
  { id: 'ambition', title: 'Ambition & sustained effort', w: { 'M.drive': 1, 'M.ambition': 1, 'M.persistence': 0.6, 'R.risk': 0.4 },
    high: 'Goals are set high and pursued hard — %SUBJ% %V(push|pushes)% for the next level and %V(keep|keeps)% going.',
    mid: '%SUBJ% %V(pursue|pursues)% goals steadily without needing to maximise; ambition rises with a project that matters.',
    low: '“Enough” is enough — %SUBJ% %V(value|values)% balance over escalation, which protects wellbeing but can look unambitious to goal-driven people.',
    hiRole: 'raises the bar and keeps reaching', loRole: 'protects a sustainable pace and asks “is this enough?”',
    grow: 'Choose one stretch goal that genuinely matters and give it a date.', lever: 'Keep the people around you at a sustainable pace.',
    teamHigh: 'Lean on it: set stretch goals — and watch for burnout.', teamLow: 'Protect it: connect work to a goal that matters, or ambition will stall.' }
];

function scenarioScore(sc, f) {
  var num = 0, den = 0;
  Object.keys(sc.w).forEach(function (k) {
    var w = sc.w[k], v = w >= 0 ? f[k] : 100 - f[k];
    num += Math.abs(w) * v; den += Math.abs(w);
  });
  return Math.round(num / den);
}

/* ---------- behaviour patterns ---------- */
var PATTERNS = [
  { id: 'spark', name: 'Spark without scaffolding', when: function (f) { return H(f, 'P.curiosity') && L(f, 'M.discipline'); },
    mg: function (f) { return (f['P.curiosity'] - 62) + (38 - f['M.discipline']); },
    text: 'Curiosity runs ahead of structure: new ideas start easily, but systems and routines are not what keeps you going.',
    watch: 'Many starts, fewer finishes.', tip: 'Pair every new idea with one recurring calendar slot.' },
  { id: 'quiet', name: 'Quiet conviction', when: function (f) { return L(f, 'S.gregarious') && H(f, 'I.conviction') && L(f, 'R.expression'); },
    mg: function (f) { return (38 - f['S.gregarious']) + (f['I.conviction'] - 62) + (38 - f['R.expression']); },
    text: 'You hold firm views without broadcasting them — steady, private and hard to talk out of a position.',
    watch: 'Others may not know where you stand until it matters.', tip: 'State your view early, even briefly.' },
  { id: 'guarded', name: 'Warm but guarded', when: function (f) { return H(f, 'S.warmth') && L(f, 'R.expression'); },
    mg: function (f) { return (f['S.warmth'] - 62) + (38 - f['R.expression']); },
    text: 'You care a lot, and show it in actions more than words — people feel looked after without hearing it said.',
    watch: 'Care that is never voiced can go unnoticed.', tip: 'Say one appreciative thing out loud each week.' },
  { id: 'boldplanner', name: 'Bold planner', when: function (f) { return H(f, 'R.risk') && H(f, 'M.discipline'); },
    mg: function (f) { return (f['R.risk'] - 62) + (f['M.discipline'] - 62); },
    text: 'You take real risks, but with a plan behind them — bold moves that are structured enough to actually land.',
    watch: 'Can underestimate how much others need convincing.', tip: 'Share the plan, not just the leap.' },
  { id: 'peacekeeper', name: 'Peacekeeper at a cost', when: function (f) { return H(f, 'S.harmony') && L(f, 'I.conviction') && L(f, 'I.autonomy'); },
    mg: function (f) { return (f['S.harmony'] - 62) + (38 - f['I.conviction']) + (38 - f['I.autonomy']); },
    text: 'You smooth friction and defer easily — pleasant to work with, and easy to overlook when something bothers you.',
    watch: 'Your own needs can go unsaid for too long.', tip: 'Decide one thing per week you will ask for directly.' },
  { id: 'burnout', name: 'Burnout risk', when: function (f) { return H(f, 'M.drive') && H(f, 'M.persistence') && f['I.stability'] <= 45; },
    mg: function (f) { return (f['M.drive'] - 62) + (f['M.persistence'] - 62) + (45 - f['I.stability']); },
    text: 'High drive and high persistence with a self that shifts under pressure — you keep going well past the point you should stop.',
    watch: 'Pushing through when a break is what is needed.', tip: 'Schedule rest like a meeting, and treat it as non-negotiable.' },
  { id: 'frank', name: 'Frank connector', when: function (f) { return H(f, 'S.gregarious') && L(f, 'S.harmony'); },
    mg: function (f) { return (f['S.gregarious'] - 62) + (38 - f['S.harmony']); },
    text: 'You are sociable and say the hard thing — people enjoy your company and also know where they stand with you.',
    watch: 'Directness can land harder than you intend.', tip: 'Lead with what is working before the critique.' },
  { id: 'carefulexplorer', name: 'Careful explorer', when: function (f) { return H(f, 'P.curiosity') && L(f, 'R.risk'); },
    mg: function (f) { return (f['P.curiosity'] - 62) + (38 - f['R.risk']); },
    text: 'You are drawn to the new but protect the downside — you explore thoroughly before committing.',
    watch: 'Research can become a substitute for action.', tip: 'Set a date to stop exploring and start a small trial.' },
  { id: 'independentdriver', name: 'Independent driver', when: function (f) { return H(f, 'I.autonomy') && H(f, 'M.drive') && H(f, 'R.tempo'); },
    mg: function (f) { return (f['I.autonomy'] - 62) + (f['M.drive'] - 62) + (f['R.tempo'] - 62); },
    text: 'You decide quickly, steer by your own compass and push hard — an engine that does not wait for permission.',
    watch: 'Others may feel left behind or overruled.', tip: 'Check in with stakeholders before, not after, a big move.' },
  { id: 'anchor', name: 'Steady anchor', when: function (f) { return H(f, 'I.stability') && L(f, 'R.tempo') && H(f, 'M.persistence'); },
    mg: function (f) { return (f['I.stability'] - 62) + (38 - f['R.tempo']) + (f['M.persistence'] - 62); },
    text: 'Consistent, unhurried and hard to knock off course — the person others rely on when things get turbulent.',
    watch: 'Can resist changes that are actually needed.', tip: 'Ask “what would make me change my mind?” before a plan is locked.' },
  { id: 'dreamer', name: 'Big-picture dreamer', when: function (f) { return H(f, 'P.abstraction') && H(f, 'P.attention') && L(f, 'M.discipline'); },
    mg: function (f) { return (f['P.abstraction'] - 62) + (f['P.attention'] - 62) + (38 - f['M.discipline']); },
    text: 'You see the whole landscape and the possibilities in it — vision comes easily, routine less so.',
    watch: 'Great plans that never get an owner or a date.', tip: 'Turn each vision into a first step you can do this week.' },
  { id: 'guardian', name: 'Detail guardian', when: function (f) { return L(f, 'P.attention') && L(f, 'P.abstraction') && H(f, 'M.discipline'); },
    mg: function (f) { return (38 - f['P.attention']) + (38 - f['P.abstraction']) + (f['M.discipline'] - 62); },
    text: 'Focused, concrete and disciplined — you notice the small thing that would have caused a big problem.',
    watch: 'Can lose sight of the larger purpose.', tip: 'Start each task by asking what it is for.' },
  { id: 'empathicanalyst', name: 'Empathic analyst', when: function (f) { return H(f, 'S.empathy') && H(f, 'P.intuition') && L(f, 'R.expression'); },
    mg: function (f) { return (f['S.empathy'] - 62) + (f['P.intuition'] - 62) + (38 - f['R.expression']); },
    text: 'You read people and situations deeply and say little — you often understand what is going on before anyone has said it.',
    watch: 'Your read stays private, so others do not benefit from it.', tip: 'Offer one observation per meeting.' },
  { id: 'belonging', name: 'Belonging seeker', when: function (f) { return L(f, 'I.distinct') && H(f, 'S.warmth') && L(f, 'I.autonomy'); },
    mg: function (f) { return (38 - f['I.distinct']) + (f['S.warmth'] - 62) + (38 - f['I.autonomy']); },
    text: 'You want to be part of something and to look after the people in it — a natural team member and glue.',
    watch: 'Fitting in can crowd out what you actually think.', tip: 'Add your own view before asking what everyone else thinks.' }
];

/* ---------- internal tensions (facet pairs pulling against each other) ---------- */
var TENSIONS = [
  { a: ['R.expression', 'hi'], b: ['S.gregarious', 'lo'], text: 'You express yourself openly but recharge alone — people may read you as more available than you feel.', tip: 'Protect solo time before, not after, social stretches.' },
  { a: ['R.risk', 'hi'], b: ['I.stability', 'lo'], text: 'You lean into big bets with a self that shifts under stress — the leap is easy, the aftermath less so.', tip: 'Build a stabilising routine around risky periods.' },
  { a: ['M.ambition', 'hi'], b: ['M.persistence', 'lo'], text: 'You aim big but move on when the spark fades — ambitions outnumber finished projects.', tip: 'Pick one ambition at a time and set a finish line.' },
  { a: ['S.empathy', 'hi'], b: ['S.warmth', 'lo'], text: 'You feel what others feel but keep a cool front — people may not realise how much you notice.', tip: 'Let one observation out as words each day.' },
  { a: ['I.autonomy', 'hi'], b: ['I.distinct', 'lo'], text: 'You steer by your own judgment yet want to belong — independence and belonging pull in opposite directions.', tip: 'Notice which one you are choosing in a given moment.' },
  { a: ['P.abstraction', 'hi'], b: ['M.discipline', 'lo'], text: 'Your thinking is conceptual but your routines are loose — big ideas without a system to carry them.', tip: 'Use a simple template (idea → next step → date).' },
  { a: ['R.tempo', 'hi'], b: ['R.risk', 'lo'], text: 'You act fast but avoid risk — quick on small, safe things and slow-looking on the big ones.', tip: 'Separate reversible decisions (decide fast) from irreversible ones (pause).' },
  { a: ['I.conviction', 'hi'], b: ['S.harmony', 'hi'], text: 'You hold your views firmly and also want peace — you may argue internally more than you argue out loud.', tip: 'Decide in advance which points you will hold and which you will give.' },
  { a: ['M.drive', 'hi'], b: ['M.ambition', 'lo'], text: 'You are driven but modest in what you aim at — lots of effort, aimed carefully.', tip: 'Ask whether your effort is going where you want it to.' },
  { a: ['S.gregarious', 'hi'], b: ['R.expression', 'lo'], text: 'You enjoy people but keep your inner world private — sociable on the surface, reserved underneath.', tip: 'Find one or two people you let in fully.' }
];
function tensionOn(f, t) {
  var ok = function (spec) { return spec[1] === 'hi' ? f[spec[0]] >= 62 : f[spec[0]] <= 38; };
  return ok(t.a) && ok(t.b);
}

/* ---------- individual ---------- */
function individual(f) {
  var scen = SCENARIOS.map(function (sc) {
    var s = scenarioScore(sc, f), b = band(s);
    return { id: sc.id, title: sc.title, score: s, band: b, text: fillV(sc[b], true, 'You'), grow: sc.grow, lever: sc.lever };
  });
  var byScore = scen.slice().sort(function (a, b) { return a.score - b.score; });
  var pats = PATTERNS.filter(function (p) { return p.when(f); })
    .map(function (p) { return { id: p.id, name: p.name, text: p.text, watch: p.watch, tip: p.tip, strength: p.mg(f) }; })
    .sort(function (a, b) { return b.strength - a.strength; });
  var tens = TENSIONS.filter(function (t) { return tensionOn(f, t); }).map(function (t) {
    var ia = facetInfo(t.a[0]), ib = facetInfo(t.b[0]);
    return { text: t.text, tip: t.tip, a: ia.name + ' ' + f[t.a[0]], b: ib.name + ' ' + f[t.b[0]] };
  });
  return { scenarios: scen, patterns: pats, tensions: tens,
    growth: byScore.slice(0, 3).map(function (s) { return { title: s.title, score: s.score, step: s.grow }; }),
    leverage: byScore.slice(-3).reverse().map(function (s) { return { title: s.title, score: s.score, step: s.lever }; }) };
}

/* ---------- pair ---------- */
var LENSES = {
  partner: { label: 'Partners', lead: 'As partners, the everyday rhythm matters most: how you each handle stress, disagreement and change at home.',
    focus: ['conflict', 'change', 'connect', 'decision'], tip: 'Treat differences as things to schedule around, not to fix — agree on how you will raise a problem before one comes up.' },
  friend: { label: 'Friends', lead: 'As friends, what matters is energy and ease: how you each recharge, plan and show up for one another.',
    focus: ['connect', 'change', 'brainstorm', 'conflict'], tip: 'Match your plans to the lower-energy friend now and then — it keeps the friendship easy.' },
  colleague: { label: 'Colleagues', lead: 'As colleagues, working rhythm decides how well you collaborate: pace, detail, deadlines and how you disagree.',
    focus: ['deadline', 'decision', 'detail', 'conflict'], tip: 'Agree who leads on which kind of task, and how you will hand work over.' },
  manager: { label: 'Manager & report', lead: 'In a manager–report relationship, clarity matters most: how decisions get made, how feedback lands and how pressure is handled.',
    focus: ['decision', 'deadline', 'conflict', 'ambition'], tip: 'Ask each other how you prefer to receive feedback and be explicit about expectations.' },
  family: { label: 'Family', lead: 'In family, long history means patterns are well-worn: what changes things is naming them kindly.',
    focus: ['conflict', 'connect', 'change', 'ambition'], tip: 'Pick one repeating friction and agree on a different way to handle it next time.' }
};
var STARTERS = {
  P: ['When we are deciding something, do we tend to talk about the big picture or the specifics first — and is that working?', 'Where do we each want more ideas, and where do we want more facts?', 'What is something I see differently from you that we have never really talked about?'],
  R: ['How fast do we each like to decide — and where does the gap between us show up?', 'When plans change, what do you need from me?', 'What would make you feel safe taking a risk with me?'],
  I: ['When we disagree, how do we each know when to hold on and when to let go?', 'Where do you feel you give way to me more than you would like — or the reverse?', 'What do we each need so that neither of us feels overruled?'],
  S: ['What does a good check-in look like for you — and how often?', 'When something bothers you, how would you like me to find out?', 'How much time together versus time apart feels right to you?'],
  M: ['What are we each actually working toward — and is it the same thing?', 'What does “enough” look like for you, and for me?', 'When one of us is exhausted, what do we want the other to do?']
};

function facetPair(fa, fb, an, bn) {
  return facetKeys().map(function (k) {
    var info = facetInfo(k), av = fa[k], bv = fb[k], gap = Math.abs(av - bv);
    var hiName = av >= bv ? an : bn, loName = av >= bv ? bn : an, hv = Math.max(av, bv), lv = Math.min(av, bv);
    var state, text;
    if (gap >= 30) {
      state = 'split';
      text = hiName + ' leans ' + info.hi[0].toLowerCase() + ' (' + hv + ') — ' + lc(info.hi[1]).replace(/\.$/, '') + '. ' + loName + ' leans ' + info.lo[0].toLowerCase() + ' (' + lv + ') — ' + lc(info.lo[1]).replace(/\.$/, '') + '.';
    } else if (av >= 62 && bv >= 62) {
      state = 'bothHigh'; text = 'You both lean ' + info.hi[0].toLowerCase() + ' — ' + lc(info.hi[1]).replace(/\.$/, '') + '.';
    } else if (av <= 38 && bv <= 38) {
      state = 'bothLow'; text = 'You both lean ' + info.lo[0].toLowerCase() + ' — ' + lc(info.lo[1]).replace(/\.$/, '') + '.';
    } else {
      state = 'near'; text = 'Close enough (' + av + ' and ' + bv + ') that ' + info.name.toLowerCase() + ' is unlikely to matter much between you.';
    }
    return { key: k, dim: info.dim, name: info.name, color: info.color, hi: info.hi[0], lo: info.lo[0], a: av, b: bv, gap: gap, state: state, text: text };
  });
}

function pair(fa, fb, an, bn, type) {
  var rows = facetPair(fa, fb, an, bn);
  var byGap = rows.slice().sort(function (x, y) { return x.gap - y.gap; });
  var sync = rows.filter(function (r) { return r.state === 'bothHigh' || r.state === 'bothLow'; })
    .sort(function (x, y) { return Math.abs(y.a + y.b - 100) - Math.abs(x.a + x.b - 100); }).slice(0, 3);
  var friction = byGap.slice(-3).reverse().filter(function (r) { return r.gap >= 20; });
  var scen = SCENARIOS.map(function (sc) {
    var sa = scenarioScore(sc, fa), sb = scenarioScore(sc, fb), joint = Math.round((sa + sb) / 2);
    var b = band(joint), diff = Math.abs(sa - sb);
    var hiN = sa >= sb ? an : bn, loN = sa >= sb ? bn : an;
    var line = diff >= 25 ? hiN + ' ' + sc.hiRole + '; ' + loN + ' ' + sc.loRole + '.' :
      (sa >= 66 && sb >= 66) ? 'You are both strong here, so it is a shared asset.' :
      (sa <= 34 && sb <= 34) ? 'You both find this harder than most, so plan for it rather than hope.' : 'You are in a similar place on this.';
    return { id: sc.id, title: sc.title, a: sa, b: sb, joint: joint, band: b, split: diff >= 25,
      text: fillV(sc[b], true, 'You two') + ' ' + line };
  });
  var lens = LENSES[type] || LENSES.partner;
  var order = {};
  lens.focus.forEach(function (id, i) { order[id] = i; });
  var focus = scen.filter(function (s) { return order[s.id] != null; }).sort(function (x, y) { return order[x.id] - order[y.id]; });
  var rest = scen.filter(function (s) { return order[s.id] == null; });
  // starters: one from each of the two widest-gap dimensions
  var dimGap = DIM_ORDER.map(function (d) {
    var rs = rows.filter(function (r) { return r.dim === d; });
    return { d: d, gap: rs.reduce(function (s, r) { return s + r.gap; }, 0) / rs.length };
  }).sort(function (x, y) { return y.gap - x.gap; });
  var starters = [];
  dimGap.slice(0, 3).forEach(function (x, i) { starters.push({ dim: x.d, text: STARTERS[x.d][seedOf(an + bn + x.d) % STARTERS[x.d].length] }); });
  return { rows: rows, sync: sync, friction: friction, scenarios: focus.concat(rest), focusIds: lens.focus, lens: lens, lensKey: LENSES[type] ? type : 'partner', starters: starters };
}

/* ---------- group ---------- */
var ROLES = [
  { id: 'ideator', name: 'Ideator', desc: 'Generates options and new directions.', w: { 'P.abstraction': 1, 'P.curiosity': 1, 'P.intuition': 0.6 }, gap: 'No natural source of new ideas — schedule exploration time or bring in an outside view.' },
  { id: 'driver', name: 'Driver', desc: 'Pushes pace and keeps momentum.', w: { 'R.tempo': 0.8, 'M.drive': 1, 'M.ambition': 0.6, 'R.risk': 0.4 }, gap: 'Nobody naturally pushes the pace — name an owner for momentum or decisions will drift.' },
  { id: 'finisher', name: 'Finisher', desc: 'Follows through and closes things out.', w: { 'M.discipline': 1, 'M.persistence': 1, 'P.attention': -0.4 }, gap: 'Nobody naturally closes things out — assign follow-through explicitly, with dates.' },
  { id: 'coordinator', name: 'Coordinator', desc: 'Brings people together and smooths friction.', w: { 'S.warmth': 0.6, 'S.harmony': 0.6, 'S.empathy': 0.6, 'I.conviction': -0.4 }, gap: 'No natural facilitator — rotate the role so someone deliberately keeps people aligned.' },
  { id: 'challenger', name: 'Challenger', desc: 'Pushes back and tests assumptions.', w: { 'I.conviction': 0.8, 'I.autonomy': 0.6, 'S.harmony': -0.8, 'R.expression': 0.4 }, gap: 'Nobody naturally pushes back — appoint a rotating devil’s advocate so assumptions get tested.' },
  { id: 'evaluator', name: 'Evaluator', desc: 'Weighs options and spots risks.', w: { 'R.tempo': -0.8, 'R.risk': -0.8, 'P.abstraction': -0.4 }, gap: 'Nobody naturally weighs risk — add a short pre-mortem before big decisions.' },
  { id: 'connector', name: 'Connector', desc: 'Builds relationships inside and outside the group.', w: { 'S.gregarious': 1, 'S.warmth': 0.8, 'R.expression': 0.5 }, gap: 'Nobody naturally builds relationships outward — schedule informal contact on purpose.' },
  { id: 'specialist', name: 'Detail specialist', desc: 'Guards quality and precision.', w: { 'P.attention': -1, 'M.discipline': 0.6, 'P.abstraction': -0.5 }, gap: 'Nobody naturally guards detail — add checklists and a review step.' }
];
function weighted(w, f) {
  var num = 0, den = 0;
  Object.keys(w).forEach(function (k) { var x = w[k]; num += Math.abs(x) * (x >= 0 ? f[k] : 100 - f[k]); den += Math.abs(x); });
  return Math.round(num / den);
}
function joinNames(arr) {
  if (!arr.length) return 'nobody';
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}

function group(members) {
  var n = members.length, keys = facetKeys();
  var facets = keys.map(function (k) {
    var info = facetInfo(k), vals = members.map(function (m) { return m.facets[k]; });
    var mean = vals.reduce(function (s, v) { return s + v; }, 0) / n;
    var sd = Math.sqrt(vals.reduce(function (s, v) { return s + Math.pow(v - mean, 2); }, 0) / n);
    var sorted = members.slice().sort(function (a, b) { return b.facets[k] - a.facets[k]; });
    return { key: k, dim: info.dim, name: info.name, color: info.color, hi: info.hi[0], lo: info.lo[0], avg: Math.round(mean), spread: Math.round(sd), top: sorted[0], bottom: sorted[n - 1] };
  });
  var shared = facets.filter(function (x) { return x.spread < 9 && Math.abs(x.avg - 50) >= 12; })
    .sort(function (a, b) { return Math.abs(b.avg - 50) - Math.abs(a.avg - 50); }).slice(0, 4);
  var split = facets.slice().sort(function (a, b) { return b.spread - a.spread; }).filter(function (x) { return x.spread >= 14; }).slice(0, 4);
  var scen = SCENARIOS.map(function (sc) {
    var scores = members.map(function (m) { return { m: m, s: scenarioScore(sc, m.facets) }; }).sort(function (a, b) { return b.s - a.s; });
    var avg = Math.round(scores.reduce(function (s, x) { return s + x.s; }, 0) / n);
    var sd = Math.sqrt(scores.reduce(function (s, x) { return s + Math.pow(x.s - avg, 2); }, 0) / n);
    var b = band(avg), uneven = sd >= 14 && scores[0].s - scores[n - 1].s >= 25;
    var line = uneven ? scores[0].m.name + ' ' + sc.hiRole + ', while ' + scores[n - 1].m.name + ' ' + sc.loRole + ' (' + scores[0].s + ' vs ' + scores[n - 1].s + ').' : 'Members are fairly close on this (spread ±' + Math.round(sd) + ').';
    return { id: sc.id, title: sc.title, avg: avg, spread: Math.round(sd), band: b, uneven: uneven,
      scores: scores.map(function (x) { return { name: x.m.name, score: x.s }; }),
      text: fillV(sc[b], false, 'The group') + ' ' + line, play: b === 'low' ? sc.teamLow : b === 'high' ? sc.teamHigh : null };
  });
  var roles = ROLES.map(function (r) {
    var fits = members.map(function (m) { return { name: m.name, fit: weighted(r.w, m.facets) }; }).sort(function (a, b) { return b.fit - a.fit; });
    var champs = fits.filter(function (x) { return x.fit >= 62; });
    var best = fits[0].fit;
    var state = champs.length ? 'covered' : best >= 52 ? 'partial' : 'gap';
    return { id: r.id, name: r.name, desc: r.desc, state: state, best: best, champions: champs.map(function (x) { return x.name; }), top: fits[0].name, gap: r.gap };
  });
  var gaps = roles.filter(function (r) { return r.state === 'gap'; });
  var partial = roles.filter(function (r) { return r.state === 'partial'; });
  var actions = [];
  gaps.forEach(function (r) { actions.push(r.gap); });
  scen.filter(function (s) { return s.band === 'low' && s.play; }).sort(function (a, b) { return a.avg - b.avg; }).slice(0, 2).forEach(function (s) { actions.push(s.title + ' — ' + s.play); });
  scen.filter(function (s) { return s.uneven; }).sort(function (a, b) { return b.spread - a.spread; }).slice(0, 1).forEach(function (s) { actions.push('The group is uneven on ' + s.title.toLowerCase() + ' — decide explicitly who leads when it comes up.'); });
  if (!actions.length) actions.push('No obvious gaps: keep rotating who leads, so strengths do not become fixed labels.');
  var playbook = ['deadline', 'conflict', 'change', 'decision'].map(function (id) {
    var s = scen.filter(function (x) { return x.id === id; })[0];
    return { title: s.title, text: s.play || (s.band === 'mid' ? 'No strong lean — the group is flexible here, so match the approach to the people in the room.' : '') };
  });
  var highlights = [];
  shared.forEach(function (x) { highlights.push('Shared: the group leans ' + (x.avg >= 50 ? x.hi : x.lo).toLowerCase() + ' on ' + x.name.toLowerCase() + ' (avg ' + x.avg + ', spread ±' + x.spread + ') — nearly everyone agrees.'); });
  split.forEach(function (x) { highlights.push('Split: ' + x.name.toLowerCase() + ' ranges from ' + x.bottom.facets[x.key] + ' (' + x.bottom.name + ') to ' + x.top.facets[x.key] + ' (' + x.top.name + ') — ' + x.lo.toLowerCase() + ' vs ' + x.hi.toLowerCase() + '.'); });
  return { facets: facets, shared: shared, split: split, scenarios: scen, roles: roles, gaps: gaps, partial: partial, actions: actions.slice(0, 6), playbook: playbook, highlights: highlights };
}

return { validFacets: validFacets, facetInfo: facetInfo, facetKeys: facetKeys, scenarioScore: scenarioScore, SCENARIOS: SCENARIOS, LENSES: LENSES,
  individual: individual, pair: pair, group: group, band: band };
})();
