/* ============================================================
   Psyche Intelligence Layer v2  (engine 2.0.0, catalogue 2.0.0)

   A structured insight pipeline over the existing PRISM facet scores. It does not change scoring,
   archetype matching or stored results. Interpretations are hypotheses to test, never diagnoses or
   predictions.

   Pipeline (each stage is a function below):
     1 validate      schema/range check of the facet scores and response-quality metadata
     2 extract       typed features with provenance: facet, score, band, margin past the threshold
     3 detect        evaluate every catalogue rule; a rule fires only for a defined (band, band) state
     4 evidence      attach the facet scores and, when available, the answers behind each facet,
                     alternative explanations and limits
     5 confidence    support for THIS inference (data quality, answer agreement, classification
                     robustness) — deliberately separate from how strong the trait is
     6 prioritise    rank by magnitude, confidence and distinctiveness; one insight per theme; a
                     facet is reused at most twice; an insight budget (3 shown, 2 more on request)
     7 synthesise    the interpretation text comes from the catalogue entry for the exact state
     8 act           one small experiment with a time window and an observable success signal
     9 safety        generated text is linted for diagnostic / deterministic language; offenders are
                     removed and reported, never shown

   Abstention: the engine returns no insights (with a stated reason) when the response pattern is
   unreliable (straight-lining) or too many questions were skipped. A rule that has no defined state
   for the scores (e.g. a facet in the mid-range) stays silent instead of emitting filler.

   Confidence never reaches "high": each facet has two items and no validation study exists.
   ============================================================ */
var PsycheIntelligence = (function () {
  'use strict';

  var ENGINE_VERSION = '2.0.0';
  var CATALOGUE_VERSION = '2.0.0';
  var HI = 62, LO = 42;            // v1 thresholds, kept so existing readings do not shift
  var FRAGILE_MARGIN = 3;          // score within 3 points of a threshold: the band itself is unstable
  var SHOW_PRIMARY = 3, SHOW_MAX = 5, MAX_FACET_USE = 2;
  var MAX_SKIPPED = 7;             // 8+ of 40 skipped (20%): abstain
  var LEVELS = ['low', 'limited', 'moderate'];
  var LIK = { 1: 'Strongly disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly agree' };

  /* ------------------------------------------------------------------ catalogue */
  function E(text, window, success) { return { text: text, window: window, success: success }; }
  var RULES = [
    { id: 'vision-to-scale', title: 'Vision translated into scale', theme: 'scope', keys: ['P.abstraction', 'M.ambition'],
      rationale: 'Abstract thinking sets how large a picture someone naturally sees; ambition sets how large a goal they choose. Whether the two rise together shapes whether ideas become projects.',
      alternatives: ['Your current role may reward practical delivery over big-picture thinking regardless of preference.', 'Ambition scores can reflect current circumstances more than a lasting orientation.'],
      limits: 'Two items per facet; a self-report of how you see yourself, not a record of what you have built.',
      counterexample: 'A person with high abstraction and high ambition who works in a role with no room for either will not show this pattern in their behaviour.',
      action: E('Choose one idea and write a one-page path from concept to a measurable first outcome.', '1 week', 'You have the one-pager and have either completed its first step or consciously dropped it.'),
      states: {
        'hi-hi': { claims: ['builds-systems:+'], text: 'Conceptual thinking and large-scale ambition reinforce each other. You may be drawn to building a system or future, not just completing an isolated task.' },
        'hi-lo': { claims: ['builds-systems:-'], text: 'Conceptual range is stronger than appetite for scale. You may generate more ideas than you choose to pursue at scale; notice whether that is a genuine preference for contained goals or goals you have not yet allowed yourself to want.' },
        'lo-hi': { claims: ['builds-systems:+'], text: 'Large goals are paired with a more concrete, practical thinking style. You may pursue scale through steps and proof rather than theory; check whether stepping back to frame the whole picture would surface options earlier.' },
        'lo-lo': { claims: ['builds-systems:-'], text: 'A concrete thinking style and a modest appetite for scale appear together. That can favour well-defined, achievable work; the thing to check is whether “enough” is a choice or a default.' } } },
    { id: 'explore-finish', title: 'Exploration versus completion', theme: 'finishing', keys: ['P.curiosity', 'M.persistence'],
      rationale: 'Curiosity pulls attention toward new questions; persistence keeps attention on a chosen one. The balance between them shapes how projects end.',
      alternatives: ['Deadlines, accountability and how interesting the work is can matter more than either trait.', 'Persistence on work you care about can differ sharply from persistence on obligations.'],
      limits: 'Persistence is rated in general; it can differ a lot by domain.',
      counterexample: 'A curious person with a structured team and clear milestones may finish consistently despite a low persistence score.',
      action: E('Keep a “later ideas” list and finish one defined milestone before switching projects.', '1 week', 'One milestone finished and no more than the planned number of new projects started.'),
      states: {
        'hi-lo': { claims: ['finishes-projects:-'], text: 'Curiosity is more pronounced than persistence in this profile. New questions may feel more rewarding than the final stretch of an existing project; this is a pattern to check against your actual history.' },
        'lo-hi': { claims: ['finishes-projects:+'], text: 'Persistence is more pronounced than curiosity. You may be good at staying with a chosen path, while needing to deliberately make room for fresh information or alternatives.' },
        'hi-hi': { claims: ['finishes-projects:+'], text: 'Curiosity and persistence both score strongly. You may be able to explore widely and still carry chosen work through; the pressure point is deciding what not to explore while a commitment is live.' },
        'lo-lo': { claims: ['finishes-projects:-'], text: 'Neither curiosity nor persistence stands out. Open-ended efforts may lose momentum; short, clearly defined commitments could suit you better than long, loosely framed ones.' } } },
    { id: 'pace-risk', title: 'Speed and risk appetite', theme: 'decisions', keys: ['R.tempo', 'R.risk'],
      rationale: 'Decision pace and tolerance for downside combine into a decision style; the mismatch cases (fast but cautious, slow but bold) are often the most informative.',
      alternatives: ['Stakes and reversibility change both pace and risk-taking for almost everyone.', 'Organisational culture can impose a pace that differs from your preference.'],
      limits: 'Describes a general tendency; real decisions vary by stakes, time pressure and information.',
      counterexample: 'Someone with a fast pace and high risk appetite who has been burned recently may be deliberately slower right now.',
      action: E('Before one consequential decision, record the upside, worst plausible downside, reversibility and deadline.', 'next significant decision', 'You can say, afterwards, whether the written downside matched what happened.'),
      states: {
        'hi-hi': { claims: ['moves-fast:+', 'takes-risk:+'], text: 'Quick decisions and bold risk-taking appear together. This can create momentum; the key safeguard is a brief downside check before decisions that are costly to reverse.' },
        'lo-lo': { claims: ['moves-fast:-', 'takes-risk:-'], text: 'A measured pace and downside protection appear together. This can support careful judgment; time-boxing deliberation may help when a good-enough decision is reversible.' },
        'hi-lo': { claims: ['moves-fast:+', 'takes-risk:-'], text: 'A quick pace is paired with lower risk appetite. You may decide fast on familiar matters but hold back when the downside is large; compare this with specific decisions you have made.' },
        'lo-hi': { claims: ['moves-fast:-', 'takes-risk:+'], text: 'A deliberate pace is paired with higher risk appetite. You may take time to decide but commit firmly to a bold option once you have; watch for deliberation that substitutes for acting.' } } },
    { id: 'conviction-curiosity', title: 'Conviction tested by curiosity', theme: 'beliefs', keys: ['I.conviction', 'P.curiosity'],
      rationale: 'Conviction settles a view; curiosity keeps testing it. Their balance affects how easily a position is revised.',
      alternatives: ['Openness often depends on the topic and on who is in the room.', 'Strong conviction in one area does not imply the same everywhere.'],
      limits: 'Measures stated firmness of views, not whether the views are well-founded.',
      counterexample: 'A person with high conviction who routinely seeks out disconfirming evidence may be more open than the score suggests.',
      action: E('Pick one belief and write both the strongest supporting evidence and the strongest evidence against it.', '1 week', 'You have both lists, and can state what evidence would change your mind.'),
      states: {
        'hi-hi': { claims: ['revises-views:+'], text: 'Strong conviction coexists with strong curiosity. This can support independent thinking when curiosity keeps conviction open to evidence rather than turning it into a fixed position.' },
        'hi-lo': { claims: ['revises-views:-'], text: 'Conviction is stronger than exploratory pull in these scores. When a belief matters to you, deliberately seeking the strongest counter-evidence may protect against premature closure.' },
        'lo-hi': { claims: ['revises-views:+'], text: 'Curiosity is stronger than attachment to a settled position. You may find it natural to keep exploring; writing down a provisional conclusion can help convert exploration into decisions.' },
        'lo-lo': { claims: ['revises-views:+'], text: 'Views are held lightly and there is little pull to dig into them. Questions may stay open by default; decide which ones deserve a conclusion.' } } },
    { id: 'structure-flex', title: 'Structure and adaptability', theme: 'planning', keys: ['M.discipline', 'R.adaptability'],
      rationale: 'Discipline favours plans and routine; adaptability favours changing course. Having both, one, or neither changes how work feels under change.',
      alternatives: ['Task type matters: many people are structured at work and flexible elsewhere.', 'Workload and deadlines change how much structure feels helpful.'],
      limits: 'General preference; not a measure of how well plans are actually executed.',
      counterexample: 'A highly disciplined person who has built a flexible system may adapt easily despite a lower adaptability score.',
      action: E('Use a three-item checklist for a routine task, while leaving one planned slot open for changes.', '1 week', 'The checklist caught at least one detail, and the open slot was used or consciously released.'),
      states: {
        'hi-hi': { claims: ['follows-plans:+', 'changes-course:+'], text: 'Structure and adaptability both score strongly. You may be able to use plans as scaffolding without treating every change as a failure of the plan.' },
        'hi-lo': { claims: ['follows-plans:+', 'changes-course:-'], text: 'Structure is stronger than adaptability in these scores. Plans may help you execute, but an explicit review point can prevent commitment to a plan after its assumptions have changed.' },
        'lo-hi': { claims: ['follows-plans:-', 'changes-course:+'], text: 'Adaptability is stronger than preference for structure. Improvisation may be comfortable; a small external checklist can protect details when work becomes repetitive.' },
        'lo-lo': { claims: ['follows-plans:-', 'changes-course:-'], text: 'Neither firm structure nor quick adaptability stands out. Work may feel hardest when it needs either a fixed plan or a fast change of direction; one light routine you can rely on may help.' } } },
    { id: 'empathy-boundary', title: 'Empathy and interpersonal boundaries', theme: 'disagreement', keys: ['S.empathy', 'S.harmony'],
      rationale: 'Empathy reads other people’s feelings; harmony-seeking decides how much of a disagreement is voiced. Together they shape how conflict is handled.',
      alternatives: ['Close relationships and workplaces often call for different behaviour than your default.', 'Strong empathy can coexist with either avoiding or voicing conflict, depending on the relationship.'],
      limits: 'Self-perceived empathy is not the same as accuracy in reading others.',
      counterexample: 'Someone with high harmony-seeking in general may be very direct with a few trusted people.',
      action: E('In one conversation, state your view clearly and ask the other person to describe theirs in their own words.', 'next conversation where you disagree', 'You said your view in the first few sentences and the other person confirmed you understood theirs.'),
      states: {
        'hi-hi': { claims: ['voices-disagreement:-'], text: 'Emotional attunement and harmony-seeking both score strongly. These can support considerate relationships; the counterweight is stating a real disagreement before resentment builds.' },
        'hi-lo': { claims: ['voices-disagreement:+'], text: 'Empathy is stronger than harmony-seeking. You may notice other people’s feelings while still being willing to name disagreement; check whether your delivery matches your intention.' },
        'lo-hi': { claims: ['voices-disagreement:-'], text: 'Harmony-seeking is stronger than emotional attunement in these scores. You may prioritise smooth interaction without necessarily sensing what another person feels, so asking directly can be more reliable than guessing.' },
        'lo-lo': { claims: ['voices-disagreement:+'], text: 'Direct, matter-of-fact interaction may come easily. Check that your intent is received as intended, since others can read candour as indifference.' } } },
    { id: 'independence-belonging', title: 'Independence and social alignment', theme: 'disagreement', keys: ['I.autonomy', 'S.harmony'],
      rationale: 'Autonomy is wanting to decide for yourself; harmony-seeking is wanting agreement. Their balance shapes how decisions are made with other people.',
      alternatives: ['Power dynamics and who you are deciding with change this a lot.', 'High autonomy at work and high deference at home (or the reverse) is common.'],
      limits: 'General tendency; hierarchy, culture and stakes override it.',
      counterexample: 'A person with low autonomy who has strong expertise may decide independently within that area.',
      action: E('Before agreeing to a request, privately write your preference, then decide what you are willing to compromise on.', '1 week', 'You wrote your preference first at least twice and can say whether the final agreement matched it.'),
      states: {
        'hi-hi': { claims: ['defers-to-group:-'], text: 'Independent judgment coexists with a preference for harmony. You may want to decide for yourself while preserving a workable relationship; clear, respectful disagreement can serve both.' },
        'hi-lo': { claims: ['defers-to-group:-'], text: 'Independent judgment is paired with a lower harmony score. Direct challenge may feel natural; check whether the goal is to improve the decision or simply to defend autonomy.' },
        'lo-hi': { claims: ['defers-to-group:+'], text: 'Harmony-seeking is stronger than independent judgment in these scores. Before agreeing, pause long enough to identify what you actually think and whether the agreement is freely chosen.' },
        'lo-lo': { claims: ['defers-to-group:+'], text: 'Neither independent judgment nor smoothing things over stands out. You may be influenced by whoever is most decisive in the room; naming your own preference first can keep it visible.' } } },
    { id: 'ambition-execution', title: 'Ambition and sustained execution', theme: 'goals', keys: ['M.ambition', 'M.persistence'],
      rationale: 'Ambition sets the size of goals; persistence determines whether effort survives the unglamorous middle. The pair predicts where goals tend to stall, as a hypothesis.',
      alternatives: ['Support, resources and how a goal was chosen affect execution at least as much as either trait.', 'Persistence for chosen goals can differ from persistence for assigned ones.'],
      limits: 'Describes tendencies, not track record. Compare with completed work.',
      counterexample: 'A person with high ambition and low persistence working with strong accountability may execute reliably.',
      action: E('Define one outcome for the next seven days and a visible “done” condition before starting.', '1 week', 'The outcome was either done by the stated condition or you can name what changed.'),
      states: {
        'hi-hi': { claims: ['sustains-effort:+'], text: 'Large goals and persistence reinforce each other in the score pattern. The practical question is whether your calendar and completed work reflect the scale of your intentions.' },
        'hi-lo': { claims: ['sustains-effort:-'], text: 'Ambition is more pronounced than persistence. Smaller milestones, visible completion criteria and short feedback loops may help large goals survive the less exciting middle.' },
        'lo-hi': { claims: ['sustains-effort:+'], text: 'Persistence is more pronounced than ambition. You may sustain effort reliably once a goal is chosen; periodically checking whether the goal is still worth the effort keeps execution purposeful.' },
        'lo-lo': { claims: ['sustains-effort:-'], text: 'Lower ambition and lower persistence appear together. A low-pressure pace may suit you; check that it matches what you want from the next year rather than avoiding effortful goals by default.' } } }
  ];

  /* ------------------------------------------------------------------ helpers */
  function questions(opts) { return (opts && opts.questions) || (typeof QUESTIONS !== 'undefined' ? QUESTIONS : null); }
  function dimsMap(opts) { return (opts && opts.dims) || (typeof DIMS !== 'undefined' ? DIMS : null); }
  function facetMeta(key, opts) {
    var D = dimsMap(opts), p = key.split('.');
    var f = D && D[p[0]] && D[p[0]].facets && D[p[0]].facets[p[1]];
    return f ? { name: f.name, hi: f.hi[0], lo: f.lo[0] } : { name: key, hi: 'high', lo: 'low' };
  }
  function num(n) { return typeof n === 'number' && isFinite(n) ? Math.max(0, Math.min(100, n)) : null; }
  function band(s) { return s >= HI ? 'hi' : s <= LO ? 'lo' : 'mid'; }
  function lvlRank(l) { return LEVELS.indexOf(l); }
  function capLevel(cur, to) { return lvlRank(to) < lvlRank(cur) ? to : cur; }

  /* ---- stage 1: validate ---- */
  function validate(result) {
    if (!result || typeof result !== 'object' || !result.facets || typeof result.facets !== 'object') return { ok: false, reason: 'no_facets' };
    var q = result.quality, quality = null;
    if (q && typeof q === 'object' && typeof q.straightLining === 'boolean') {
      quality = { straightLining: q.straightLining, consistency: typeof q.consistency === 'number' ? q.consistency : null, engagement: typeof q.engagement === 'number' ? q.engagement : null };
    }
    var skipped = typeof result.skipped === 'number' && result.skipped >= 0 ? result.skipped : (Array.isArray(result.ans) ? result.ans.filter(function (v) { return v == null; }).length : 0);
    return { ok: true, quality: quality, skipped: skipped, hasAnswers: Array.isArray(result.ans) };
  }

  /* ---- stage 2: extract ---- */
  function features(result, rule) {
    var out = [];
    for (var i = 0; i < rule.keys.length; i++) {
      var s = num(result.facets[rule.keys[i]]);
      if (s === null) return null;
      out.push({ key: rule.keys[i], score: Math.round(s), band: band(s) });
    }
    return out;
  }
  function marginOf(f) { return f.band === 'hi' ? f.score - HI : f.band === 'lo' ? LO - f.score : 0; }

  /* ---- stage 4a: answer-level evidence for a facet ---- */
  function answerEvidence(key, result, opts) {
    var Q = questions(opts);
    if (!Q || !Array.isArray(result.ans)) return null;
    var meta = facetMeta(key, opts), items = [], contribs = [], skipped = 0;
    Q.forEach(function (q, i) {
      if (q.f !== key) return;
      var v = result.ans[i];
      if (v == null) { skipped++; return; }
      var c = (v - 3) * q.d; contribs.push(c);
      items.push({ question: q.t, answer: LIK[v] || String(v), pointsToward: c === 0 ? 'neither pole' : (c > 0 ? meta.hi : meta.lo) });
    });
    return { items: items, skipped: skipped, contradictory: contribs.length === 2 && contribs[0] * contribs[1] < 0 };
  }

  /* ---- stage 5: confidence = support for this inference, not trait strength ---- */
  function confidenceFor(feats, ev, ctx) {
    var level = 'moderate', factors = [];
    function lower(to, name, detail) { level = capLevel(level, to); factors.push({ name: name, effect: 'lowers', detail: detail }); }
    function ok(name, detail) { factors.push({ name: name, effect: 'supports', detail: detail }); }

    var margin = Math.min.apply(null, feats.map(marginOf));
    if (margin < FRAGILE_MARGIN) lower('limited', 'Band is fragile', 'a score is within ' + FRAGILE_MARGIN + ' points of the cut-off, so a small change in one answer could move this pattern to a different state');
    else ok('Band is stable', 'both scores are clearly inside the band this pattern needs');

    if (!ctx.hasAnswers) lower('limited', 'No answer-level evidence', 'only the saved scores are available, so agreement between the answers behind each facet could not be checked');
    else {
      var contradictory = feats.filter(function (f) { return ev[f.key] && ev[f.key].contradictory; });
      var skippedHere = feats.filter(function (f) { return ev[f.key] && ev[f.key].skipped > 0; });
      if (contradictory.length) lower('limited', 'Answers disagree', 'the two answers behind ' + contradictory.map(function (f) { return f.key; }).join(' and ') + ' point in opposite directions, so the score is an average of conflicting responses');
      else ok('Answers agree', 'the answers behind each facet point the same way');
      if (skippedHere.length) lower('limited', 'Skipped questions', 'a question behind this pattern was skipped and counted as neutral');
    }
    if (ctx.skipped > 0 && !ctx.hasAnswers) lower('limited', 'Some questions skipped', ctx.skipped + ' questions were skipped in this assessment');
    var q = ctx.quality;
    if (q && q.consistency !== null && q.consistency < 0.35) lower('limited', 'Mixed response pattern', 'answers within facets varied more than usual');
    if (!q) factors.push({ name: 'Response-quality data unavailable', effect: 'lowers', detail: 'the original response-pattern checks are not part of this saved result' }), level = capLevel(level, 'limited');
    factors.push({ name: 'Self-report ceiling', effect: 'lowers', detail: 'each facet is measured by two items and PRISM has no validation study yet, so confidence is never shown as high' });
    return { level: level, factors: factors, reasons: factors.filter(function (f) { return f.effect === 'lowers' && f.name !== 'Self-report ceiling'; }).map(function (f) { return f.detail; }) };
  }

  function magnitude(feats) { return feats.reduce(function (a, f) { return a + Math.abs(f.score - 50); }, 0) / feats.length / 50; }
  function magnitudeLabel(m) { return m >= 0.5 ? 'clear' : m >= 0.3 ? 'moderate' : 'slight'; }

  /* ---- stage 9: safety lint ---- */
  var BANNED = /\b(diagnos\w*|disorder|syndrome|clinical|pathology|pathological|true self|real you|always|never|definitely|certainly|proves?|guarantee\w*|destined|doomed|you are a|you are an)\b/i;
  function lint(insight) {
    var parts = [insight.title, insight.interpretation, insight.action.text, insight.action.success].concat(insight.alternatives, [insight.limits]);
    for (var i = 0; i < parts.length; i++) { var m = BANNED.exec(parts[i]); if (m) return m[0]; }
    return null;
  }

  /* ---- claims: detect opposing claims across surfaced insights ---- */
  function claimConflicts(list) {
    var seen = {}, conflicts = [];
    list.forEach(function (ins) {
      ins.claims.forEach(function (c) {
        var parts = c.split(':'), tag = parts[0], sign = parts[1];
        (seen[tag] = seen[tag] || []).push({ id: ins.id, sign: sign });
      });
    });
    Object.keys(seen).forEach(function (tag) {
      var signs = seen[tag].map(function (x) { return x.sign; });
      if (signs.indexOf('+') >= 0 && signs.indexOf('-') >= 0) conflicts.push({ tag: tag, ids: seen[tag].map(function (x) { return x.id; }) });
    });
    return conflicts;
  }

  /* ------------------------------------------------------------------ generate */
  function generate(result, opts) {
    opts = opts || {};
    var base = { version: ENGINE_VERSION, engineVersion: ENGINE_VERSION, catalogueVersion: CATALOGUE_VERSION, available: false, abstained: null, insights: [], suppressed: [], safety: { removed: [] }, conflicts: [], calibration: null,
      method: 'Eight catalogue rules are checked against the 20 facet scores. A rule speaks only when both facets are clearly high or clearly low; one insight per theme is kept, ranked by pattern size, confidence and distinctiveness. No scores are changed.', source: 'PRISM facet scores' };
    var v = validate(result);
    if (!v.ok) { base.note = 'Facet scores are required for cross-trait analysis.'; return base; }
    base.available = true;

    var q = v.quality;
    base.calibration = {
      label: q && q.straightLining ? 'Use extra caution' : q && q.consistency !== null && q.consistency < 0.35 ? 'Mixed response signal' : 'Interpret as tendencies',
      scoreEvidence: q ? 'Answer-quality metadata is available; it informs caution, not scientific validity.' : 'Only saved scores are available. The original answer-level quality metadata is missing.',
      caveat: 'PRISM results describe self-reported tendencies. They are not diagnoses, fixed identities, or proven predictions of future behaviour.'
    };

    // abstention
    if (q && q.straightLining) { base.abstained = { code: 'low_variation', reason: 'Your answers showed very little variation, so scores built from them are unlikely to separate one trait from another. Cross-trait insights would be guesswork, so none are shown. Retaking with more deliberate answers would give a firmer reading.' }; return base; }
    if (v.skipped > MAX_SKIPPED) { base.abstained = { code: 'too_many_skipped', reason: v.skipped + ' of 40 questions were skipped and counted as neutral. That is too much missing information for cross-trait insights, so none are shown. Answering every question gives a firmer reading.' }; return base; }

    // stages 2–5, per rule
    var fired = [];
    RULES.forEach(function (rule) {
      var feats = features(result, rule);
      if (!feats) { base.suppressed.push({ rule: rule.id, reason: 'missing_or_invalid_score' }); return; }
      var state = feats[0].band + '-' + feats[1].band;
      var st = rule.states[state];
      if (!st) {
        base.suppressed.push({ rule: rule.id, reason: feats[0].band === 'mid' && feats[1].band === 'mid' ? 'balanced' : 'facet_in_midrange' });
        return;
      }
      var ev = {}; feats.forEach(function (f) { ev[f.key] = answerEvidence(f.key, result, opts); });
      var conf = confidenceFor(feats, ev, { hasAnswers: v.hasAnswers, skipped: v.skipped, quality: q });
      var mag = magnitude(feats);
      fired.push({
        id: rule.id + '.' + state, ruleId: rule.id, engineVersion: ENGINE_VERSION, catalogueVersion: CATALOGUE_VERSION,
        title: rule.title, theme: rule.theme, state: state, keys: rule.keys.slice(), claims: st.claims.slice(),
        hypothesis: true,
        evidence: {
          facets: feats.map(function (f) { var m = facetMeta(f.key, opts); return { key: f.key, name: m.name, score: f.score, band: f.band, pole: f.band === 'hi' ? m.hi : m.lo, margin: marginOf(f) }; }),
          answerLevel: v.hasAnswers,
          answers: v.hasAnswers ? feats.map(function (f) { return { key: f.key, items: ev[f.key] ? ev[f.key].items : [] }; }) : null
        },
        interpretation: st.text,
        patternStrength: { value: Math.round(mag * 100) / 100, label: magnitudeLabel(mag) },
        confidence: conf,
        alternatives: rule.alternatives.slice(), limits: rule.limits,
        action: { text: rule.action.text, window: rule.action.window, success: rule.action.success },
        why: { rule: rule.rationale, thresholds: 'High means 62 or above; low means 42 or below. This pattern needs ' + feats[0].band.replace('hi', 'a high').replace('lo', 'a low') + ' ' + facetMeta(rule.keys[0], opts).name + ' and ' + feats[1].band.replace('hi', 'a high').replace('lo', 'a low') + ' ' + facetMeta(rule.keys[1], opts).name + '.', counterexample: rule.counterexample },
        _mag: mag
      });
    });

    // stage 9 first (so unsafe text never competes for a slot)
    fired = fired.filter(function (ins) { var bad = lint(ins); if (bad) { base.safety.removed.push({ id: ins.id, term: bad }); return false; } return true; });

    // stage 6: greedy selection — theme dedupe, facet reuse cap, distinctiveness
    var chosen = [], use = {}, themeUsed = {}, pool = fired.slice();
    while (pool.length && chosen.length < SHOW_MAX) {
      var best = null, bestScore = -1;
      pool.forEach(function (ins) {
        if (themeUsed[ins.theme]) return;
        if (ins.keys.some(function (k) { return (use[k] || 0) >= MAX_FACET_USE; })) return;
        var reuse = ins.keys.reduce(function (a, k) { return a + (use[k] || 0); }, 0);
        var s = 0.5 * ins._mag + 0.3 * (lvlRank(ins.confidence.level) / 2) + 0.2 * (1 - Math.min(1, reuse / 2));
        if (s > bestScore + 1e-9 || (Math.abs(s - bestScore) <= 1e-9 && best && ins.id < best.id)) { best = ins; bestScore = s; }
      });
      if (!best) break;
      best.rank = chosen.length + 1; best.rankScore = Math.round(bestScore * 1000) / 1000;
      chosen.push(best); themeUsed[best.theme] = 1; best.keys.forEach(function (k) { use[k] = (use[k] || 0) + 1; });
      pool = pool.filter(function (x) { return x !== best; });
    }
    pool.forEach(function (ins) { base.suppressed.push({ rule: ins.ruleId, reason: themeUsed[ins.theme] ? 'duplicate_theme' : 'budget_or_facet_reuse' }); });
    chosen.forEach(function (ins, i) { ins.tier = i < SHOW_PRIMARY ? 'primary' : 'more'; delete ins._mag; });
    base.conflicts = claimConflicts(chosen);
    base.insights = chosen;
    base.interactions = chosen; // v1 name, kept for older callers
    return base;
  }

  /* ------------------------------------------------------------------ feedback (local, opt-in) */
  var FB_KEY = 'psyche_feedback_v1';
  var RATINGS = ['accurate', 'partly', 'inaccurate'];
  function feedback(storage) {
    function read() { try { var o = JSON.parse(storage.getItem(FB_KEY)); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
    function write(o) { try { storage.setItem(FB_KEY, JSON.stringify(o)); return true; } catch (e) { return false; } }
    return {
      key: FB_KEY,
      get: function (id) { var o = read()[id]; return o && RATINGS.indexOf(o.rating) >= 0 ? o : null; },
      set: function (id, rating, note) {
        if (typeof id !== 'string' || !id || RATINGS.indexOf(rating) < 0) return false;
        var o = read(); o[id] = { rating: rating, note: typeof note === 'string' ? note.slice(0, 280) : '', at: Date.now(), engine: ENGINE_VERSION };
        return write(o);
      },
      remove: function (id) { var o = read(); delete o[id]; return write(o); },
      clearAll: function () { try { storage.removeItem(FB_KEY); return true; } catch (e) { return false; } },
      all: read
    };
  }

  function catalogue() {
    return RULES.map(function (r) {
      return { id: r.id, title: r.title, theme: r.theme, keys: r.keys.slice(), rationale: r.rationale, alternatives: r.alternatives.slice(), limits: r.limits, counterexample: r.counterexample, action: r.action,
        states: Object.keys(r.states).map(function (s) { return { state: s, claims: r.states[s].claims.slice(), text: r.states[s].text }; }) };
    });
  }

  return { version: ENGINE_VERSION, engineVersion: ENGINE_VERSION, catalogueVersion: CATALOGUE_VERSION, thresholds: { high: HI, low: LO }, budget: { primary: SHOW_PRIMARY, max: SHOW_MAX }, generate: generate, feedback: feedback, catalogue: catalogue, lint: lint, _banned: BANNED, _claimConflicts: claimConflicts };
})();
if (typeof module !== 'undefined') module.exports = PsycheIntelligence;
