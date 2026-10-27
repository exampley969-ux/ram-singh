/* Psyche trait engine — generates exactly 20 individualised, evidence-linked trait insights.
   Deterministic and rule-based, runs fully in the browser. Needs the result object
   ({dims, facets, quality, ans}). `ans` (the raw answers) is kept on this device only; when it is
   missing (e.g. a result synced from another device) traits fall back to score-only evidence and
   say so in their confidence reason.
   Output per trait: id, title, category, description, evidence_from_answers, everyday_manifestation,
   potential_strength, potential_challenge, confidence, confidence_reason, practical_insight. */
var TraitsEngine = (function () {
  var LIK = { 1: 'Strongly disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly agree' };
  var RANK = { low: 0, medium: 1, high: 2 };
  var NAMES = ['low', 'medium', 'high'];

  function fname(key) { var p = key.split('.'); return DIMS[p[0]].facets[p[1]].name; }
  function pole(key, s) { var p = key.split('.'), f = DIMS[p[0]].facets[p[1]]; return s >= 50 ? f.hi[0] : f.lo[0]; }
  function avg(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
  function lean(s) { var d = Math.abs(s - 50); return d >= 20 ? 'strong' : d >= 10 ? 'moderate' : 'slight'; }

  /* ---- evidence for one facet: its two questions, the answers given, and an evidence grade ---- */
  var EVC = null;
  function facetEvidence(key, r) {
    if (EVC && EVC[key]) return EVC[key];
    var o = facetEvidenceRaw(key, r); if (EVC) EVC[key] = o; return o;
  }
  function facetEvidenceRaw(key, r) {
    var s = r.facets[key], items = [], out = { key: key, s: s, items: [], haveAns: !!r.ans, skipped: 0, contradictory: false };
    QUESTIONS.forEach(function (q, i) { if (q.f === key) items.push({ q: q, i: i }); });
    if (!out.haveAns) { out.level = Math.abs(s - 50) >= 20 ? 'medium' : 'low'; return out; }
    var contribs = [];
    items.forEach(function (it) {
      var v = r.ans[it.i];
      if (v == null) { out.skipped++; return; }
      var c = (v - 3) * it.q.d;
      contribs.push(c);
      out.items.push('"' + it.q.t + '" → ' + LIK[v] + (c === 0 ? ' (neutral)' : c > 0 ? ' (points ' + 'toward ' + DIMS[key.split('.')[0]].facets[key.split('.')[1]].hi[0] + ')' : ' (points toward ' + DIMS[key.split('.')[0]].facets[key.split('.')[1]].lo[0] + ')'));
    });
    out.contradictory = contribs.length === 2 && contribs[0] * contribs[1] < 0;
    var d = Math.abs(s - 50);
    if (out.skipped > 0 || out.contradictory) out.level = 'low';
    else out.level = d >= 20 ? 'high' : d >= 10 ? 'medium' : 'low';
    return out;
  }

  /* ---- combine facet evidence into one trait's evidence text + confidence ---- */
  function buildEvidence(keys, r, cap, note) {
    var evs = keys.map(function (k) { return facetEvidence(k, r); });
    var level = 'high', weakest = null;
    evs.forEach(function (e) { if (RANK[e.level] < RANK[level]) { level = e.level; weakest = e; } });
    if (!weakest) weakest = evs[0];
    var reasons = [];
    if (cap && RANK[cap] < RANK[level]) { level = cap; reasons.push(note || 'this trait is a combination inferred from several scores, not directly measured'); }
    if (r.quality && r.quality.straightLining) { level = 'low'; reasons.push('your answers showed a straight-lining pattern (little variation), which weakens every score'); }
    if (!weakest.haveAns) reasons.unshift('the individual answers were not available for this saved result, so this rests on the ' + fname(weakest.key) + ' score (' + weakest.s + '/100) alone');
    else if (weakest.skipped) reasons.unshift(fname(weakest.key) + ' had ' + weakest.skipped + ' skipped question(s), so the score is partly a default');
    else if (weakest.contradictory) reasons.unshift('your two ' + fname(weakest.key) + ' answers pulled in opposite directions, so the score reflects mixed rather than neutral evidence');
    else if (weakest.level === 'low') reasons.unshift(fname(weakest.key) + ' (' + weakest.s + '/100) is close to the midpoint, which is weak evidence of a consistent tendency');
    else if (weakest.level === 'medium') reasons.unshift(fname(weakest.key) + ' (' + weakest.s + '/100) is a moderate lean; its two answers agree');
    else reasons.unshift('the ' + (keys.length > 1 ? 'facet scores are' : fname(weakest.key) + ' score is') + ' clearly away from the midpoint and the paired answers agree');
    var text;
    if (keys.length <= 2) {
      text = evs.map(function (e) {
        var head = fname(e.key) + ' ' + e.s + '/100 (' + pole(e.key, e.s) + ', ' + lean(e.s) + ' lean)';
        return e.items.length ? head + ': ' + e.items.join('; ') : head + (e.haveAns ? '' : ': individual answers not available');
      }).join(' | ');
    } else {
      text = 'Combined from ' + evs.map(function (e) { return fname(e.key) + ' ' + e.s + '/100'; }).join(', ') + '.';
    }
    return { text: text, level: level, reason: reasons.join('; ').replace(/^./, function (c) { return c.toUpperCase(); }) + '. Confidence reflects evidence quality, not how strongly you hold the trait.' };
  }

  /* ---- content tables. Each slot: id, category, keys, optional cap, pick(f)->state, v: {state: {...}} ---- */
  function V(title, desc, m, s, c, i) { return { title: title, desc: desc, m: m, s: s, c: c, i: i }; }
  function tri(sel) { return function (f) { var x = sel(f); return x >= 60 ? 'hi' : x <= 40 ? 'lo' : 'mid'; }; }
  function one(key) { return function (f) { return f[key]; }; }

  var SLOTS = [
    { id: 1, cat: 'Learning & perception', keys: ['P.intuition'], pick: tri(one('P.intuition')), v: {
      hi: V('Pattern-first perception', 'You tend to notice underlying structure and implied meaning before explicit detail.', 'You may sense where a conversation or project is heading before it is stated, and find it hard to explain how you knew.', 'Early detection of risks, openings and connections others miss.', 'Others may find your conclusions vague or unsupported if the reasoning stays unspoken.', 'Before sharing a hunch, note the two or three observations behind it so others can check it.'),
      lo: V('Literal, evidence-first perception', 'You tend to take information as stated and trust what is explicit over what is implied.', 'You probably prefer clear statements and ask for specifics rather than guessing at subtext.', 'Reliable reading of facts and a low risk of over-interpreting.', 'Unspoken signals or hints may pass you by.', 'When a situation feels off, ask a direct question rather than waiting for it to be spelled out.'),
      mid: V('Balanced literal and intuitive reading', 'You read both what is stated and what is implied, without a strong default.', 'You may sometimes sense subtext and sometimes take things at face value.', 'Flexible reading that can be checked either way.', 'Without a default you may second-guess whether a hunch is worth trusting.', 'When a hunch matters, test it with one concrete question.') } },
    { id: 2, cat: 'Work style', keys: ['P.attention'], pick: tri(one('P.attention')), v: {
      hi: V('Wide-angle attention', 'Your attention spreads across the whole field rather than locking onto one element.', 'You track several threads at once and may get restless in tasks that need long, narrow concentration.', 'Strong situational awareness and a knack for connecting separate pieces of information.', 'Small errors can slip through during long stretches of precision work.', 'Use short checklists or a second pair of eyes where small errors are costly, and let your breadth handle the rest.'),
      lo: V('Deep, narrow focus', 'You tend to lock onto one thing and tune out the rest.', 'You do your best work in long uninterrupted blocks and may find interruptions costly.', 'Depth, thoroughness and precision.', 'You may miss what is happening around the task.', 'Schedule short scans of the wider picture between focus blocks.'),
      mid: V('Switchable attention', 'You can focus narrowly or scan widely depending on the demand.', 'You can dig in and look around, though neither mode is automatic.', 'A good fit for roles that need both.', 'It may take effort to choose which mode a moment needs.', 'Name which mode a task needs before you start.') } },
    { id: 3, cat: 'Learning', keys: ['P.abstraction', 'P.curiosity'], pick: tri(function (f) { return avg([f['P.abstraction'], f['P.curiosity']]); }), v: {
      hi: V('Theory-driven exploration', 'You are drawn to ideas, models and the unfamiliar, and you learn by exploring.', 'You may follow tangents, prefer "why" to "how", and get bored with rote material.', 'Rapid learning of new domains and a strong conceptual grasp.', 'Ideas may stay abstract or unfinished without practical application.', 'Pair each new idea with a small concrete test.'),
      lo: V('Concrete, familiar-ground learning', 'You trust the tangible and the proven, and learn best from examples and practice.', 'You prefer worked examples and established methods to open-ended theory.', 'Practical, reliable skill-building.', 'New or abstract areas may feel unrewarding and get avoided.', 'Try one unfamiliar topic a quarter to keep your range.'),
      mid: V('Flexible learning style', 'You move between concrete and conceptual thinking depending on the task, and are moderately drawn to the new.', 'You can follow a theory and also ground it in an example.', 'You can translate between big-idea people and detail people.', 'You may take time to decide which level to work at.', 'At the start of a task, decide whether you need the big picture or the detail first.') } },
    { id: 4, cat: 'Emotional response', keys: ['R.expression'], pick: tri(one('R.expression')), v: {
      hi: V('Open emotional expression', 'Your feelings tend to show outwardly, and people can usually tell how you feel.', 'You voice reactions as they happen, and others rarely have to guess your mood.', 'Transparency that builds trust and lets others respond to you.', 'Raw reactions may land harder than intended, especially in tense moments.', 'In high-stakes moments, pause a beat before voicing a strong reaction.'),
      lo: V('Reserved emotional expression', 'You keep your feelings largely internal and show them less than most people would expect.', 'Others may not know how strongly you feel, and you probably process privately first.', 'Composure, and a refusal to react before you have thought something through.', 'Reserve can read as disinterest, and things that needed saying may go unsaid.', 'Choose one or two trusted people and tell them what you are feeling in a sentence; small, regular disclosure beats rare large ones.'),
      mid: V('Selective emotional expression', 'You show some feelings and hold back others depending on the setting.', 'You are open with some people and guarded with others.', 'You can calibrate to the room.', 'Others may find you hard to read consistently.', 'Notice which situations make you hold back and decide whether that is a choice.') } },
    { id: 5, cat: 'Conflict', keys: ['S.harmony', 'R.expression'], pick: function (f) {
        var fr = f['S.harmony'] <= 44, ac = f['S.harmony'] >= 56, re = f['R.expression'] <= 44, ex = f['R.expression'] >= 56;
        return fr && re ? 'fr' : fr && ex ? 'fe' : ac && re ? 'ar' : ac && ex ? 'ae' : 'mid'; }, v: {
      fr: V('Quiet disagreement that surfaces later', 'You are direct in principle, but your reserve means disagreement can go unvoiced until it matters a lot.', 'You may hold an objection for a while and then voice it more forcefully than the moment seems to call for.', 'You do not suppress your honest view to keep the peace.', 'Delay turns small issues into bigger ones, and a late objection can surprise others.', 'Name one small disagreement a week, starting with "I see it differently because…".'),
      fe: V('Direct, visible disagreement', 'You say the hard thing and your reaction shows.', 'People usually know exactly where you stand in a disagreement.', 'Issues are surfaced early and honestly.', 'Bluntness combined with visible emotion may escalate tension.', 'Open with what you agree on, then state the difference.'),
      ar: V('Peace-keeping, inward conflict style', 'You smooth friction and keep your reactions to yourself.', 'You may let disagreements pass and carry them privately.', 'Calm and low-friction company.', 'Resentment can build quietly, and others may not know there is a problem.', 'Pick one issue a week to raise out loud, however small.'),
      ae: V('Warm, smoothing conflict style', 'You seek harmony and show your feelings openly.', 'You talk things through and lean toward compromise.', 'You repair tension quickly.', 'You may give ground on points that mattered.', 'Before conceding, state your position once.'),
      mid: V('Situational conflict style', 'Your conflict style does not lean strongly in one direction.', 'You are sometimes direct and sometimes avoid, depending on the stakes.', 'Flexibility in how you handle friction.', 'Others may find your response hard to predict.', 'Decide in advance how you want to handle the next disagreement.') } },
    { id: 6, cat: 'Adaptability', keys: ['R.adaptability'], pick: tri(one('R.adaptability')), v: {
      hi: V('Fast adjustment to change', 'You change course readily and improvise when plans shift.', 'A change of plan costs you little, and rigid routines may feel confining.', 'Comfort with uncertainty and quick recovery from disruption.', 'Others may find you hard to pin down, and you may drop plans that deserved commitment.', 'Say which parts of a plan you are holding fixed so your flexibility reads as reliable.'),
      lo: V('Steady, plan-holding style', 'You prefer to hold the plan and resist sudden swerves.', 'You do best with clear plans and advance notice of change.', 'Dependability and follow-through.', 'Sudden change costs you more than it costs others.', 'Build a short buffer after any change to reset the plan before acting.'),
      mid: V('Moderate flexibility', 'You adapt to change, but not effortlessly.', 'You adjust after a short period; gradual change is easier than sudden change.', 'A balance of reliability and flexibility.', 'Abrupt change may still unsettle you.', 'Ask for early notice of changes where possible.') } },
    { id: 7, cat: 'Identity', keys: ['I.stability'], pick: tri(one('I.stability')), v: {
      hi: V('Continuous sense of self', 'Your sense of self stays fairly consistent across settings.', 'You act much the same at work, with friends and with family.', 'Predictability and integrity under social pressure.', 'Adjusting to very different settings may feel like compromise.', 'Practise flexing your style without changing your values, for settings that demand it.'),
      lo: V('Context-sensitive sense of self', 'Your sense of self shifts somewhat with the setting and the people around you.', 'You may present differently at work, with friends and with family, without feeling any one version is false.', 'You fit into different groups without defending a fixed image of yourself.', 'You may lose track of what you personally want when a room strongly influences you.', 'Before a high-pressure social setting, write down what you want from it and check back against it.'),
      mid: V('Moderately stable identity', 'Your sense of self is settled but has room to flex.', 'You hold steady in most settings and adapt in some.', 'Enough stability to stay yourself and enough flexibility to adapt.', 'You may feel torn when settings pull in opposite directions.', 'Notice which settings pull you furthest from your own view.') } },
    { id: 8, cat: 'Decision-making', keys: ['I.conviction'], pick: tri(one('I.conviction')), v: {
      hi: V('Firmly held beliefs', 'Once you form a view, you hold it firmly and are hard to move.', 'You stand your ground in debates and rarely change position in the moment.', 'Consistency and the ability to hold an unpopular position.', 'You may under-weight good counter-evidence.', 'Before a disagreement begins, ask yourself what evidence would change your mind.'),
      lo: V('Beliefs that update under evidence', 'Your views move when you meet a good argument rather than hardening under pressure.', 'You can take criticism without losing your footing and change your mind without it feeling like defeat.', 'Learning from correction and avoiding stubborn commitment to a wrong position.', 'Persuasive people may move you more than the evidence warrants.', 'When an argument changes your mind, give it a day before acting on the change.'),
      mid: V('Moderate conviction', 'You hold views with some firmness but update on good evidence.', 'You stand your ground on some things and shift on others.', 'Firm enough to hold a position, open enough to correct it.', 'Others may find it unclear which of your views are fixed.', 'Decide in advance which two or three things are non-negotiable.') } },
    { id: 9, cat: 'Decision-making', keys: ['R.tempo'], pick: tri(one('R.tempo')), v: {
      hi: V('Quick decision pace', 'You tend to decide on the move and adjust as you go.', 'You act on incomplete information and correct course later.', 'Momentum and responsiveness.', 'Quick calls can skip checks, especially when stakes are high.', 'For high-stakes choices, add one deliberate pause or a second opinion.'),
      lo: V('Measured decision pace', 'You tend to pause and weigh before acting.', 'You prefer time to think before committing and may resist pressure for an instant answer.', 'Considered decisions and resistance to panic.', 'Others may read deliberation as indecision or disinterest.', 'Tell people when you need time and when you will come back with an answer.'),
      mid: V('Context-driven decision pace', 'You are neither a habitual quick decider nor a habitual slow one; the stakes set your pace.', 'You decide small things fast and big ones slowly, which may look inconsistent from outside.', 'Pace matched to stakes.', 'Without a default you may drift in ambiguous situations.', 'For ambiguous decisions, set a decision deadline in advance.') } },
    { id: 10, cat: 'Decision-making', keys: ['R.risk'], pick: tri(one('R.risk')), v: {
      hi: V('Bold risk appetite', 'You lean into the bet and the leap.', 'You are more drawn by the upside than put off by the downside.', 'Willingness to try what others will not.', 'Downsides may be under-weighted.', 'Before a bold move, define the worst case you could live with.'),
      lo: V('Cautious risk appetite', 'You protect the downside first.', 'You look for what could go wrong before committing.', 'Resilience and avoided losses.', 'Opportunities may pass while you check.', 'For low-cost bets, set a rule to go ahead with less checking.'),
      mid: V('Balanced risk appetite', 'You weigh a bet against its downside without a pull toward either extreme.', 'You may take risks in some areas and be careful in others.', 'Each risk is judged on its merits.', 'Others may find you hard to predict.', 'Notice which domains make you bold and which make you cautious; it may reveal what you value.') } },
    { id: 11, cat: 'Social behaviour', keys: ['I.autonomy', 'I.distinct'], pick: tri(function (f) { return avg([f['I.autonomy'], f['I.distinct']]); }), v: {
      hi: V('Self-directed, independent stance', 'You steer by your own judgment and want to stand apart.', 'You resist being told what to do and prefer your own way of doing things.', 'Originality and independence.', 'You may resist useful input and isolate yourself.', 'Invite one challenge to your plan before committing.'),
      lo: V('Group-oriented, deferential stance', 'You defer to others’ judgment and want to belong.', 'You look to the group or a lead for direction and avoid standing out.', 'Cooperation and team fit.', 'Your own view may go unvoiced.', 'State your own view before hearing others’.'),
      mid: V('Independent but not contrarian', 'You are neither strongly deferential nor strongly set on standing apart.', 'You go along with a group on some things and make your own call on others.', 'You collaborate easily and can still hold a position when it matters.', 'Outside influence can tip you either way.', 'Decide in advance which two or three things you will not compromise on.') } },
    { id: 12, cat: 'Ambition', keys: ['M.ambition'], pick: tri(one('M.ambition')), v: {
      hi: V('Large-scale ambition', 'You aim at large goals and are drawn to measurable progress.', 'You set stretch goals, track milestones and feel uneasy when things seem to stand still.', 'Sustained effort toward goals that matter.', 'Others may read your drive as dissatisfaction, and rest may feel like stalling.', 'Schedule checkpoints where you stop and acknowledge progress.'),
      lo: V('Modest, enough-is-enough aims', 'You aim for what is true and sufficient rather than the largest possible goal.', 'You are content with realistic goals and uncomfortable with grand targets.', 'Contentment and realism, with less burnout.', 'Others may see more potential in you than you pursue.', 'Once a quarter, ask whether a goal is smaller than you actually want.'),
      mid: V('Measured ambition', 'You pursue goals steadily without needing to maximise; ambition rises with a project that matters.', 'Your ambition depends on the project in front of you.', 'Balanced, steady effort.', 'Without a compelling project, effort may drift.', 'Pick one project a year that deserves your most ambitious effort.') } },
    { id: 13, cat: 'Motivation', keys: ['M.drive'], pick: tri(one('M.drive')), v: {
      hi: V('Persistent striving', 'You keep reaching for the next rung.', 'You are rarely satisfied to stand still and look for the next goal.', 'Energy toward growth and achievement.', 'Difficulty enjoying what you have already achieved.', 'Pair each goal with a note of what would count as enough.'),
      lo: V('Content with enough', 'You are at ease with enough and not pulled to keep reaching.', 'You value balance and may resist pressure to always do more.', 'Contentment and a sustainable pace.', 'You may be seen as unmotivated when a situation calls for a push.', 'Choose one area where you do want more and direct your effort there.'),
      mid: V('Effort that follows meaning and results', 'Your drive depends on whether the work is both meaningful and has something to show for it.', 'You work hard on things that matter and may coast on things that do not.', 'Your energy goes to worthwhile work.', 'Motivation may drop on necessary tasks that feel neither meaningful nor visible.', 'For tasks that feel pointless, attach a visible outcome or batch them into a short window.') } },
    { id: 14, cat: 'Work style', keys: ['M.discipline', 'P.attention'], cap: 'medium', capNote: 'this trait combines Discipline with the inverse of Attention, so it is inferred from two facets', pick: tri(function (f) { return 0.7 * f['M.discipline'] + 0.3 * (100 - f['P.attention']); }), v: {
      hi: V('Systematic, detail-sustaining work style', 'You run on systems, plans and order, and can sustain careful work.', 'You plan ahead, keep lists and finish the details.', 'Reliability and thoroughness.', 'Rigid plans may resist necessary change.', 'Leave deliberate slack in your plans.'),
      lo: V('Improvisational work style, precision in bursts', 'You run on impulse and the open day, with precision in short bursts rather than long stretches.', 'You do careful work in sprints and avoid long repetitive precision tasks.', 'Adaptable work habits and energy.', 'Follow-through can suffer on long routine tasks.', 'Break precision work into short timed blocks with a checklist.'),
      mid: V('Situational structure', 'You use structure when it helps and can work without it.', 'You do careful work in focused sprints and stay relaxed otherwise.', 'Adaptable work habits.', 'Follow-through can vary on long tasks.', 'Use short timed blocks with a checklist for long precision tasks.') } },
    { id: 15, cat: 'Motivation', keys: ['M.ambition', 'M.persistence'], pick: function (f) {
        var a = f['M.ambition'], p = f['M.persistence'];
        return a - p >= 15 ? 'gap' : p - a >= 15 ? 'builder' : (a >= 60 && p >= 60) ? 'both_hi' : (a <= 40 && p <= 40) ? 'both_lo' : 'mid'; }, v: {
      gap: V('Ambition that outruns staying power', 'You set big goals, but your persistence when the initial spark fades is lower. This is a possible tension, not a fixed flaw.', 'You start strongly and may slow when progress becomes invisible.', 'Knowing where your momentum comes from lets you design projects to keep it.', 'Long stretches without visible progress may stall.', 'Break big goals into milestones that show progress at least weekly, and give each stage a clear reason.'),
      builder: V('Quiet persistence beyond ambition', 'You outlast and finish what you start, without needing a grand target.', 'You keep going long after others drop off, even on modest goals.', 'Finishing power.', 'You may stick with things that should be dropped, or aim lower than your capacity.', 'Periodically ask whether a goal is still worth finishing.'),
      both_hi: V('Ambition with staying power', 'You aim high and keep going.', 'You set large goals and see them through.', 'A strong combination of vision and follow-through.', 'Risk of overwork and burnout.', 'Build rest into the plan as a requirement.'),
      both_lo: V('Modest aims, easily redirected', 'You aim for enough and move on when the spark fades.', 'You try many things and commit lightly.', 'Low pressure and wide experience.', 'Little gets finished or deepened.', 'Pick one project to finish this quarter.'),
      mid: V('Effort that depends on purpose', 'Your ambition and persistence sit at similar, moderate levels.', 'You keep going when purpose and visible progress are both present.', 'Balanced effort.', 'Effort may fade without purpose or progress.', 'Make progress visible with a weekly check.') } },
    { id: 16, cat: 'Social behaviour', keys: ['S.gregarious', 'S.warmth'], cap: 'medium', capNote: 'this trait weights Gregariousness with Warmth, so it is partly inferred', pick: tri(function (f) { return 0.7 * f['S.gregarious'] + 0.3 * f['S.warmth']; }), v: {
      hi: V('Energised by people', 'Gatherings and company recharge you, and you lead with openness.', 'You seek out company, and large settings are rewarding.', 'A wide network and social ease.', 'Time alone may feel uncomfortable.', 'Schedule solo recovery time even when you do not feel you need it.'),
      lo: V('Selective social energy', 'You connect better one-to-one or in small groups, and large or long social events use up energy.', 'You prefer a few deeper conversations to wide circles and need recovery time after gatherings.', 'Depth in the relationships you invest in.', 'Relationships can fade through neglect, and you may miss opportunities that come through wide networks.', 'Add one low-effort weekly check-in with someone you rely on.'),
      mid: V('Flexible social energy', 'You enjoy company in moderation.', 'You are sociable in some settings and drained in others.', 'Adaptable in groups.', 'You may overcommit and then need recovery.', 'Track which gatherings energise you and which drain you.') } },
    { id: 17, cat: 'Relationships', keys: ['S.empathy', 'S.warmth'], cap: 'medium', capNote: 'this trait weights Empathy with Warmth, so it is partly inferred', pick: tri(function (f) { return 0.7 * f['S.empathy'] + 0.3 * f['S.warmth']; }), v: {
      hi: V('Attuned, emotionally responsive empathy', 'You feel what others feel quickly and lead with care.', 'You pick up moods and respond to emotional needs first.', 'People feel understood around you.', 'You may absorb other people’s stress.', 'Name which feelings are yours and which belong to someone else.'),
      lo: V('Objective, analytical empathy', 'You lean toward assessing people’s situations objectively rather than absorbing their feelings.', 'In a friend’s crisis you may be inclined to analyse and offer solutions rather than mirror emotion.', 'A steady, clear-headed presence when others are overwhelmed.', 'People who want acknowledgement first may feel unheard.', 'Before offering solutions, ask: "Do you want help solving this, or do you just want me to listen?"'),
      mid: V('Balanced empathy', 'You can both feel with others and assess a situation objectively.', 'You respond emotionally to some people and analytically to others.', 'You can move between support and problem-solving.', 'You may misjudge which one someone wants.', 'Ask which kind of response the person wants.') } },
    { id: 18, cat: 'Creativity', keys: ['P.curiosity', 'P.intuition', 'P.abstraction', 'R.expression'], cap: 'medium', capNote: 'this trait combines four facets, so it is inferred rather than directly measured', pick: function (f) {
        var ideas = avg([f['P.curiosity'], f['P.intuition'], f['P.abstraction']]);
        return ideas >= 58 ? (f['R.expression'] >= 45 ? 'hi_open' : 'hi_quiet') : ideas <= 42 ? 'lo' : 'mid'; }, v: {
      hi_open: V('Idea generator who shares', 'You generate ideas readily and are open about sharing them.', 'You offer ideas early and enjoy open brainstorms.', 'Fresh options and momentum in discovery work.', 'Ideas may outnumber finished ones.', 'Pick one idea per brainstorm to carry to a first test.'),
      hi_quiet: V('Idea generator who holds back', 'You generate ideas, but your reserve means many may not be shared.', 'Open-ended brainstorms may feel unstructured, and ideas stay in your head.', 'Pattern recognition combined with enough grounding to produce workable ideas.', 'Good ideas may go unseen.', 'Ask for a one-line framing of the problem before a brainstorm, and send ideas in writing if speaking up is hard.'),
      lo: V('Practical, proven-ideas contributor', 'You favour tested approaches over novelty.', 'You contribute refinements and feasibility checks.', 'Grounded, workable input.', 'Novel options may go unexplored.', 'Add one deliberately unconventional option to each proposal.'),
      mid: V('Concrete-prompt contributor', 'You contribute ideas when the question is concrete enough.', 'Open-ended brainstorms can feel unstructured.', 'Useful input when the problem is framed.', 'Vague prompts may leave you quiet.', 'Ask for a specific question before a brainstorm.') } },
    { id: 19, cat: 'Leadership', keys: ['M.ambition', 'R.tempo', 'R.adaptability', 'M.drive', 'R.expression', 'S.empathy', 'S.warmth'], cap: 'low', capNote: 'leadership is a combination inferred from seven facets and none of the questions ask directly about leading others', pick: function (f) {
        var lead = avg([f['M.ambition'], f['R.tempo'], f['R.adaptability'], f['M.drive']]);
        var voice = avg([f['R.expression'], f['S.empathy'], f['S.warmth']]);
        return lead >= 58 ? (voice < 45 ? 'driven_reserved' : 'driven_visible') : lead <= 42 ? 'quiet' : 'mid'; }, v: {
      driven_reserved: V('Potential for leading through transitions, quietly', 'Drive, ambition and adaptability suggest you could lead when the path is unclear, but through example and analysis more than visible warmth.', 'You may step up when things change and lead with analysis rather than persuasion.', 'Seeing where things are heading and moving without waiting for certainty.', 'Teams may need more explicit communication and acknowledgement than you naturally give.', 'When leading, over-communicate your reasoning and check in on how people are doing.'),
      driven_visible: V('Visible, driving leadership potential', 'Drive combined with openness suggests you could lead from the front.', 'You set direction and people can read your intent.', 'Energy and clarity of direction.', 'You may move faster than others can follow.', 'Check the pace with your team at each milestone.'),
      quiet: V('Supporting rather than directing role', 'Your scores point toward contributing and supporting more than driving.', 'You prefer others to set the pace.', 'A steady contributor and a good collaborator.', 'You may be overlooked for lead roles you would handle well.', 'Volunteer to lead one small piece of work to test it.'),
      mid: V('Situational leadership', 'Your scores do not point strongly to one leadership style.', 'You lead when needed and follow when not.', 'Flexibility.', 'No clear default style.', 'Notice when others look to you.') } },
    { id: 20, cat: 'Work style', keys: ['M.discipline', 'M.persistence'], cap: 'medium', capNote: 'pressure response is inferred from Discipline and Persistence; no question asks about deadlines directly', pick: tri(function (f) { return avg([f['M.discipline'], f['M.persistence']]); }), v: {
      hi: V('Steady under deadlines', 'You keep going under pressure and lean on structure.', 'Deadlines mostly focus you.', 'Reliable delivery.', 'Last-minute scope changes may frustrate you.', 'Build slack in for the unexpected.'),
      lo: V('Deadline-sensitive, easily derailed', 'Your discipline and persistence are lower, so pressure may scatter effort rather than focus it.', 'You may rush at the end or drift early.', 'Bursts of energy when it counts.', 'Late scrambles.', 'Set intermediate deadlines for yourself.'),
      mid: V('Checkpoint-dependent under deadlines', 'You cope with deadlines and do best with clear intermediate checkpoints.', 'A long runway may feel less motivating than a series of smaller steps, and results can vary from day to day.', 'You respond well to simple structure and visible milestones.', 'Without checkpoints, pressure can help one day and hurt the next.', 'Turn each big deadline into three or four dated checkpoints, with the first one soon after you start.') } }
  ];

  /* ====================== generative layer ======================
     Candidate pool = 20 anchor traits (above) + pairwise interaction traits composed from a
     facet-pole lexicon. Every candidate gets a salience score from the evidence (distance from
     midpoint x agreement), then the 20 most telling are selected with diversity rules, so
     different profiles get different sets of traits, not just different wording. */
  function L(noun, does, gift, risk, tip) { return { noun: noun, does: does, gift: gift, risk: risk, tip: tip }; }
  var LEX = {
    'P.abstraction': { hi: L('abstract thinking', ['live in ideas and models', 'reach for theory before example'], 'conceptual range', 'ideas that never touch the ground', 'test one idea against a concrete case this week'),
                       lo: L('concrete thinking', ['trust what you can see and touch', 'want the tangible version first'], 'practical grounding', 'missing the larger frame', 'ask what bigger idea sits behind a task') },
    'P.curiosity':   { hi: L('curiosity', ['are pulled toward the new and unfamiliar', 'keep exploring past what is needed'], 'range and fast learning', 'scattered attention', 'choose one thread to finish before opening another'),
                       lo: L('preference for the familiar', ['prefer what you already know works', 'settle into proven routines'], 'reliability', 'staleness', 'try one small unfamiliar thing each month') },
    'P.attention':   { hi: L('wide attention', ['scan the whole field at once', 'track several threads together'], 'situational awareness', 'slipped details', 'use a checklist where small errors are costly'),
                       lo: L('narrow focus', ['lock onto one thing and shut out the rest', 'work best in deep, uninterrupted blocks'], 'depth', 'missing what surrounds the task', 'scan the wider picture between focus blocks') },
    'P.intuition':   { hi: L('pattern sense', ['sense the pattern before you can explain it', 'read between the lines'], 'early insight', 'conclusions others cannot follow', 'write down the observations behind a hunch'),
                       lo: L('literal reading', ['take things as stated', 'trust explicit evidence over hints'], 'clear, checkable reading', 'missing subtext', 'ask a direct question when something feels off') },
    'R.tempo':       { hi: L('speed', ['decide quickly and adjust as you go', 'act before every detail is settled'], 'momentum', 'skipped checks', 'add one pause for high-stakes calls'),
                       lo: L('deliberation', ['sit with a decision before making it', 'weigh options before acting'], 'considered choices', 'looking indecisive', 'tell people when you will give an answer') },
    'R.expression':  { hi: L('open expression', ['let your feelings show', 'are easy to read'], 'transparency', 'reactions landing harder than meant', 'pause a beat before voicing strong reactions'),
                       lo: L('reserve', ['keep your reactions to yourself', 'process feelings privately first'], 'composure', 'being misread as indifferent', 'tell one trusted person what you feel, in a sentence') },
    'R.adaptability':{ hi: L('flexibility', ['bend with the moment and improvise', 'adjust quickly when plans change'], 'resilience to change', 'dropped commitments', 'say which parts of a plan are fixed'),
                       lo: L('steadiness', ['hold the plan', 'resist the sudden swerve'], 'dependability', 'friction when plans change', 'ask for early notice of changes') },
    'R.risk':        { hi: L('boldness', ['lean into the bet', 'move toward the upside'], 'willingness to try', 'an under-weighted downside', 'define the worst case before the leap'),
                       lo: L('caution', ['protect the downside first', 'check what could go wrong before committing'], 'avoided losses', 'missed chances', 'set a rule to go ahead with less checking on low-cost bets') },
    'I.autonomy':    { hi: L('independence', ['steer by your own judgment', 'prefer your own way of doing things'], 'self-direction', 'resisting useful input', 'invite one challenge before committing'),
                       lo: L('deference', ['defer to others’ judgment', 'look to a lead for direction'], 'cooperation', 'your own view going unvoiced', 'state your own view first') },
    'I.conviction':  { hi: L('firm conviction', ['hold beliefs firmly', 'rarely change position mid-argument'], 'consistency', 'discounting counter-evidence', 'decide in advance what would change your mind'),
                       lo: L('open-mindedness', ['hold beliefs loosely', 'update on a good argument'], 'learning from correction', 'being swayed too easily', 'wait a day before acting on a changed mind') },
    'I.distinct':    { hi: L('wish to stand apart', ['want to be unmistakably yourself', 'resist blending in'], 'originality', 'isolation', 'check that standing apart serves the goal'),
                       lo: L('wish to belong', ['want to fit in with the group', 'value being part of something'], 'team fit', 'blending in too much', 'name one place where you would rather stand out') },
    'I.stability':   { hi: L('a steady self', ['stay much the same across settings', 'keep a continuous sense of self'], 'integrity', 'rigidity across very different settings', 'practise flexing your style without changing your values'),
                       lo: L('a shifting self', ['shift with the setting', 'present differently to different people'], 'social range', 'losing track of what you want', 'write down what you want before a high-pressure room') },
    'S.warmth':      { hi: L('warmth', ['lead with care and openness', 'make people feel welcome'], 'trust-building', 'over-giving', 'keep one boundary you do not trade away'),
                       lo: L('cool distance', ['keep a measured distance', 'lead with composure rather than care'], 'clear judgment', 'seeming cold', 'add one explicit sign of care to important messages') },
    'S.gregarious':  { hi: L('sociability', ['are energised by people and gatherings', 'seek out company'], 'a wide network', 'discomfort alone', 'schedule solo recovery time') ,
                       lo: L('need for solitude', ['recharge in space and solitude', 'prefer small groups'], 'depth over breadth', 'fading ties', 'add one low-effort weekly check-in') },
    'S.empathy':     { hi: L('attunement', ['feel what others feel quickly', 'pick up moods fast'], 'people feeling understood', 'absorbing others’ stress', 'name which feelings are yours') ,
                       lo: L('objectivity', ['read situations head over heart', 'analyse before you feel'], 'steadiness in a crisis', 'people feeling unheard', 'ask whether someone wants solutions or just listening') },
    'S.harmony':     { hi: L('harmony-seeking', ['smooth friction to keep the peace', 'avoid sharp disagreement'], 'repairing tension fast', 'conceding too soon', 'state your position once before conceding'),
                       lo: L('frankness', ['say the hard thing', 'hold the line in disagreement'], 'honest feedback', 'friction', 'open with what you agree on') },
    'M.drive':       { hi: L('striving', ['keep reaching for the next rung', 'are rarely satisfied standing still'], 'growth energy', 'never feeling it is enough', 'define what enough looks like for each goal'),
                       lo: L('contentment', ['are at ease with enough', 'resist always doing more'], 'a sustainable pace', 'seeming unmotivated', 'pick one area where you do want more') },
    'M.discipline':  { hi: L('structure', ['run on systems and plans', 'keep order in your effort'], 'reliability', 'rigid plans', 'leave slack in the plan'),
                       lo: L('spontaneity', ['run on impulse and the open day', 'improvise your effort'], 'adaptable energy', 'follow-through gaps', 'use short timed blocks with a checklist') },
    'M.ambition':    { hi: L('ambition', ['aim big', 'think in large goals'], 'vision', 'never feeling done', 'schedule checkpoints to acknowledge progress'),
                       lo: L('modest aims', ['aim true and for enough', 'prefer realistic goals'], 'contentment and realism', 'under-reaching', 'once a quarter ask whether a goal is too small') },
    'M.persistence': { hi: L('staying power', ['finish what you start', 'outlast the initial spark'], 'finishing', 'sticking with what should be dropped', 'periodically ask whether a goal is still worth finishing'),
                       lo: L('spark-chasing', ['chase the spark and move on fast', 'lose steam when novelty fades'], 'quick pivots', 'unfinished work', 'make progress visible every week') }
  };

  /* hand-written interplays for pairs that are known to matter (key order is irrelevant) */
  var CURATED = [
    ['P.intuition:hi', 'R.expression:lo', 'Insight kept inside', 'You see patterns early but may not say so, which leaves your best reads unchecked and unseen.', 'Share one observation a day, even half-formed.'],
    ['M.ambition:hi', 'M.persistence:lo', 'Big aims, shifting energy', 'Large goals set the direction, but energy can fade once the novelty goes, so starts may outnumber finishes.', 'Break big goals into milestones that show progress every week.'],
    ['M.ambition:hi', 'R.risk:lo', 'Ambitious but careful', 'You aim high yet protect the downside, which tends to turn bold aims into staged plans.', 'Name which stage of the plan you are most tempted to over-check.'],
    ['R.adaptability:hi', 'I.stability:lo', 'A fluid self in a fluid world', 'Flexibility in action and in identity means you adapt fast, and also that outside pressure can reshape you.', 'Keep a short list of values that do not flex.'],
    ['R.tempo:hi', 'R.risk:hi', 'Fast and bold', 'Speed and appetite for risk compound: you move first on bets that others are still weighing.', 'Add one pause before anything hard to undo.'],
    ['S.harmony:lo', 'S.warmth:lo', 'Frank and cool', 'Direct honesty without much softening can make feedback feel sharp even when it is fair.', 'Add one sentence of care before the hard thing.'],
    ['S.gregarious:lo', 'S.empathy:hi', 'Attuned but easily drained', 'You feel other people strongly and need space to recover, so crowds cost you more than they cost most.', 'Plan recovery time after emotionally heavy gatherings.'],
    ['I.autonomy:hi', 'S.harmony:hi', 'Independent but conflict-averse', 'You want your own way yet avoid friction, so you may quietly go your own way rather than argue.', 'Say your preference out loud once before acting on it.'],
    ['M.discipline:hi', 'R.adaptability:hi', 'Structured and flexible', 'Planning plus flexibility is a useful mix: you can organise and also re-organise when things change.', 'Use your plans as drafts you expect to revise.'],
    ['P.curiosity:hi', 'M.persistence:lo', 'Explorer who moves on', 'Curiosity opens many doors, but lower staying power means fewer get walked through.', 'Choose one thread to take to a finished result.'],
    ['I.conviction:hi', 'P.intuition:hi', 'Certain about hunches', 'Strong beliefs plus pattern sense can make hunches feel like facts.', 'Label hunches as hypotheses until something checks them.'],
    ['S.warmth:hi', 'S.harmony:lo', 'Caring and candid', 'Warmth with frankness lets you deliver hard truths in a way people can hear.', 'Lead with the care, then say the hard thing plainly.'],
    ['M.drive:hi', 'M.discipline:lo', 'Driven but unstructured', 'A strong push with loose structure can produce bursts of output and gaps.', 'Pick one recurring time block to protect for the work that matters.'],
    ['P.attention:hi', 'M.discipline:lo', 'Broad view, loose routine', 'Wide attention without a strong routine makes it easy to start many things and lose track of details.', 'Keep one running list of open threads.'],
    ['R.expression:lo', 'S.empathy:hi', 'Feeling a lot, showing little', 'You pick up other people’s feelings but may not show your own, so care can go unseen.', 'Say one caring thing out loud that you would usually only think.']
  ];
  var DIM_CAT = { P: 'Perception', R: 'Response', I: 'Identity', S: 'Social', M: 'Motivation' };

  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function cap1(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function dimOf(k) { return k.charAt(0); }
  function ev01(f, k) { return Math.abs(f[k] - 50) / 50; }

  function intensity(desc, keys, f) {
    var d = avg(keys.map(function (k) { return Math.abs(f[k] - 50); }));
    return d >= 20 ? ['This is one of your clearer signals. ', 'This stands out in your answers. ', 'This is among the more pronounced patterns in your scores. '][hash(keys.join('|')) % 3] + desc : d >= 10 ? desc : d >= 5 ? 'A slight lean, but: ' + desc : desc;
  }

  function anchorCandidates(r, seed) {
    var f = r.facets;
    return SLOTS.map(function (sl) {
      var st = sl.pick(f), v = sl.v[st], sal = avg(sl.keys.map(function (k) { return ev01(f, k); }));
      if (st !== 'mid') sal += 0.1;
      if (sl.cap === 'low') sal *= 0.85;
      return { kind: 'anchor', keys: sl.keys, uses: sl.keys.slice(0, 2), sal: sal, slot: sl, state: st, v: v };
    });
  }

  function pairCandidates(r, seed) {
    var f = r.facets, keys = Object.keys(f), out = [], cur = {};
    CURATED.forEach(function (c) { cur[c[0] + '|' + c[1]] = c; cur[c[1] + '|' + c[0]] = c; });
    for (var i = 0; i < keys.length; i++) for (var j = i + 1; j < keys.length; j++) {
      var a = keys[i], b = keys[j], da = f[a] - 50, db = f[b] - 50;
      if (Math.abs(da) < 18 || Math.abs(db) < 18) continue;
      var pa = da > 0 ? 'hi' : 'lo', pb = db > 0 ? 'hi' : 'lo';
      var A = LEX[a][pa], B = LEX[b][pb], c = cur[a + ':' + pa + '|' + b + ':' + pb];
      var sal = (ev01(f, a) + ev01(f, b)) / 2 * (dimOf(a) !== dimOf(b) ? 1.08 : 1) * (c ? 1.3 : 0.92);
      out.push({ kind: c ? 'curated pair' : 'pair', keys: [a, b], uses: [a, b], sal: sal, A: A, B: B, c: c, pa: pa, pb: pb });
    }
    return out;
  }

  function materialise(c, r, seed) {
    var f = r.facets, o;
    if (c.kind === 'anchor') {
      var ev = buildEvidence(c.keys, r, c.slot.cap, c.slot.capNote), v = c.v;
      o = { title: v.title, category: c.slot.cat, description: c.state === 'mid' ? v.desc : intensity(v.desc, c.keys, f), evidence_from_answers: ev.text,
        everyday_manifestation: v.m, potential_strength: v.s, potential_challenge: v.c, confidence: ev.level, confidence_reason: ev.reason, practical_insight: v.i };
    } else {
      var ka = c.keys[0], kb = c.keys[1], A = c.A, B = c.B;
      var ea = buildEvidence(c.keys, r, 'medium', 'this trait is an interaction of two facets, inferred from both scores');
      var da = A.does[hash(seed + ka) % 2], db = B.does[hash(seed + kb) % 2];
      var title = c.c ? c.c[2] : cap1(A.noun) + ' with ' + B.noun;
      var between = c.c ? c.c[3] : 'Day to day this can mean ' + A.gift + ' alongside ' + B.gift + ', with ' + A.risk + ' and ' + B.risk + ' as the things to keep an eye on.';
      var cat = dimOf(ka) === dimOf(kb) ? DIM_CAT[dimOf(ka)] : 'Interaction: ' + DIM_CAT[dimOf(ka)] + ' × ' + DIM_CAT[dimOf(kb)];
      o = { title: title, category: cat,
        description: intensity('You ' + da + ', and you ' + db + '.', c.keys, f),
        evidence_from_answers: ea.text, everyday_manifestation: between,
        potential_strength: cap1(A.gift) + ' together with ' + B.gift + '.',
        potential_challenge: cap1(A.risk) + ' can combine with ' + B.risk + '.',
        confidence: ea.level, confidence_reason: ea.reason,
        practical_insight: c.c ? c.c[4] : cap1(A.tip) + '; and ' + B.tip + '.' };
    }
    return o;
  }

  function select(cands) {
    cands.sort(function (x, y) { return y.sal - x.sal; });
    var picks = [], use = {}, sig = {}, generic = 0, titles = {};
    function sigOf(c) { return c.uses.slice().sort().join('|'); }
    function ok(c, capUse) {
      if (c.kind === 'pair' && generic >= 6) return false;
      if (c.uses.some(function (k) { return (use[k] || 0) >= capUse; })) return false;
      if (c.uses.length === 2 && sig[sigOf(c)]) return false;
      return true;
    }
    function take(c) { picks.push(c); c.uses.forEach(function (k) { use[k] = (use[k] || 0) + 1; }); if (c.uses.length === 2) sig[sigOf(c)] = 1; if (c.kind === 'pair') generic++; }
    [2, 3, 99].forEach(function (cu) { cands.forEach(function (c) { if (picks.length < 20 && picks.indexOf(c) < 0 && ok(c, cu)) take(c); }); });
    // dimension coverage: every dimension should appear in at least 2 chosen traits
    var dimCount = function (d) { return picks.filter(function (c) { return c.uses.some(function (k) { return dimOf(k) === d; }); }).length; };
    DIM_ORDER.forEach(function (d) {
      var guard = 0;
      while (dimCount(d) < 2 && guard++ < 6) {
        var add = cands.filter(function (c) { return picks.indexOf(c) < 0 && c.kind !== 'pair' && c.uses.some(function (k) { return dimOf(k) === d; }); })[0] ||
                  cands.filter(function (c) { return picks.indexOf(c) < 0 && c.uses.some(function (k) { return dimOf(k) === d; }); })[0];
        if (!add) break;
        var victim = null;
        for (var i = picks.length - 1; i >= 0; i--) {
          var cand = picks[i], rest = picks.filter(function (x) { return x !== cand; });
          var safe = DIM_ORDER.every(function (dd) { return rest.filter(function (c) { return c.uses.some(function (k) { return dimOf(k) === dd; }); }).length >= Math.min(2, dd === d ? 0 : 2); });
          if (safe) { victim = cand; break; }
        }
        if (!victim) break;
        picks.splice(picks.indexOf(victim), 1); picks.push(add);
      }
    });
    return picks.sort(function (x, y) { return y.sal - x.sal; });
  }

  /* ====================== in-depth explanation ======================
     A longer, multi-paragraph read for each trait. Section 1 explains the score and what it does and
     does not mean; sections 2-5 draw on the same dimension-level content pools as Deep Analysis
     (strengths, stress pattern, how others read you, blind spots, peak conditions), picked
     deterministically for this person's dimension scores; section 6 relates the trait to the rest of the
     profile and poses a reflection question built from the facet's own wording; section 7 gives the
     practical step and says how sure the reading is. */
  function dBand(v) { return v < 34 ? 'low' : (v < 67 ? 'mid' : 'high'); }
  function poolPick(cat, d, v, seed, n) {
    var pool = (typeof IMPLICATIONS !== 'undefined' && IMPLICATIONS[cat] && IMPLICATIONS[cat][d] && IMPLICATIONS[cat][d][dBand(v)]) || [];
    if (!pool.length) return [];
    var i0 = hash(seed + cat + d) % pool.length, out = [];
    for (var i = 0; i < Math.min(n, pool.length); i++) out.push(pool[(i0 + i) % pool.length]);
    return out;
  }
  /* pool sentences for the dimension of each shown facet, banded by that facet's own score, de-duplicated */
  function multi(cat, shown, r, seed) {
    var out = [], seen = {}, usedDims = {};
    shown.forEach(function (k, i) {
      var d = dimOf(k); if (usedDims[d]) return; usedDims[d] = 1;
      poolPick(cat, d, r.facets[k], seed, i === 0 ? 2 : 1).forEach(function (t) { if (!seen[t]) { seen[t] = 1; out.push(t); } });
    });
    return out.join(' ');
  }
  function lowerFirstNoun(x) { return x; }
  function inDepth(c, o, r, seed) {
    var f = r.facets, keys = c.keys, shown = keys.slice(0, 2);
    var ds = []; shown.forEach(function (k) { var d = dimOf(k); if (ds.indexOf(d) < 0) ds.push(d); });
    var dimTxt = ds.map(function (d) { return DIMS[d].name + ' (' + r.dims[d] + ')'; }).join(' and ');
    var paras = [];
    function sec(label, text) { text = (text || '').replace(/\s+/g, ' ').trim(); if (text) paras.push(label + ': ' + text); }

    // 1. what it means
    var m;
    if (keys.length > 2) {
      m = 'This trait is built from ' + keys.length + ' facets rather than one: ' + keys.map(function (k) { return fname(k) + ' ' + f[k] + '/100'; }).join(', ') + '. No single question asks about it directly, so it is a reading of how those scores fit together.';
    } else if (keys.length === 2) {
      m = 'Two of your facet scores feed this: ' + shown.map(function (k) { return fname(k) + ' ' + f[k] + '/100 (' + pole(k, f[k]) + ', a ' + lean(f[k]) + ' lean)'; }).join(' and ') + '. The midpoint is 50, so both lean clearly enough to be worth reading together.';
    } else {
      var k = keys[0], fp = DIMS[dimOf(k)].facets[k.split('.')[1]], side = f[k] >= 50 ? fp.hi : fp.lo;
      if (Math.abs(f[k] - 50) < 5) m = 'Your ' + fname(k) + ' score is ' + f[k] + '/100 \u2014 essentially at the midpoint of 50, so neither ' + fp.lo[0] + ' nor ' + fp.hi[0] + ' describes you reliably. That is itself a finding: it points to a situational pattern rather than a default.';
      else m = 'Your ' + fname(k) + ' score is ' + f[k] + '/100. The midpoint is 50, and scores in this direction lean toward ' + side[0] + ' — ' + side[1].charAt(0).toLowerCase() + side[1].slice(1) + ' That is a ' + lean(f[k]) + ' lean.';
    }
    sec('What this means', m + ' It describes how you answered these questions at this moment, not a fixed trait or a verdict on you. ' + o.description + ' ' + o.everyday_manifestation);

    // 2. everyday and where it helps
    sec('Where it helps', o.potential_strength + ' ' + multi('strength', shown, r, seed));
    // 3. under pressure
    var us = multi('under_stress', shown, r, seed); if (us) sec('Under sustained pressure', us);
    // 4. how others read it + blind spots
    sec('How others may read it', multi('misunderstood', shown, r, seed) + ' ' + o.potential_challenge + ' ' + multi('weakness', shown.slice(0, 1), r, seed));
    // 5. at best
    sec('At your best', multi('at_best', shown, r, seed));

    // 6. rest of profile + reflection question
    var others = Engine.signatureTraits(f).filter(function (t) { return keys.indexOf(t.dim + '.' + t.fk) < 0; });
    var rel;
    if (others.length) {
      var pick = others[hash(seed + keys[0] + 'o') % Math.min(3, others.length)], ok = pick.dim + '.' + pick.fk, OL = LEX[ok][f[ok] >= 50 ? 'hi' : 'lo'], PL = LEX[keys[0]][f[keys[0]] >= 50 ? 'hi' : 'lo'];
      rel = 'Read it alongside your ' + OL.noun + ' (' + fname(ok) + ' ' + f[ok] + '/100), one of your strongest other signals. Together they combine ' + PL.gift + ' with ' + OL.gift + '; the thing to watch is ' + PL.risk + ' meeting ' + OL.risk + '.';
    } else rel = 'No other trait stands out strongly in your profile, so this one is best read mostly on its own.';
    var q;
    if (c.kind === 'anchor' && c.state === 'mid') {
      var Lh = LEX[keys[0]].hi, Ll = LEX[keys[0]].lo;
      q = 'Which situations pull you toward ' + Lh.noun + ', and which toward ' + Ll.noun + '? The answer is probably more informative than the score.';
    } else {
      var Lp = LEX[keys[0]][f[keys[0]] >= 50 ? 'hi' : 'lo'];
      q = 'When did you last ' + Lp.does[hash(seed + keys[0] + 'q') % 2] + ', and was it a choice or a reflex?';
    }
    sec('In context', rel + ' A useful question to ask yourself: ' + q);

    // 7. what to do + confidence
    var why = o.confidence_reason.split(' Confidence reflects')[0];
    sec('Working with it', o.practical_insight.replace(/\.?$/, '.') + ' Try it for two weeks and notice what changes. Confidence in this reading is ' + o.confidence + ': ' + why.charAt(0).toLowerCase() + why.slice(1) + ' That grades the evidence, not how strongly you hold the trait.');
    return paras.join('\n\n');
  }

  var MEMO = {};
  function generate(r) {
    var f = r.facets;
    var mk = (r.ans ? 'a' + r.ans.join('') : 'f' + Object.keys(f).map(function (k) { return f[k]; }).join(',')) + (r.quality && r.quality.straightLining ? 'S' : '');
    if (MEMO[mk]) return JSON.parse(JSON.stringify(MEMO[mk]));
    EVC = {};
    var seed = mk, cands = anchorCandidates(r, seed).concat(pairCandidates(r, seed));
    var picks = select(cands), log = [];
    var traits = picks.map(function (c, i) {
      var t = materialise(c, r, seed); t.id = i + 1; t.in_depth = inDepth(c, t, r, seed);
      log.push({ id: t.id, kind: c.kind, facets: c.keys, salience: Math.round(c.sal * 100) / 100 });
      return t;
    });
    // the long-form paragraphs draw on shared pools, so keep each sentence once across the 20 traits, and never repeat what the card already says in its own fields
    var seenSent = TextDedupe.seenSet(traits.reduce(function (a, t) { return a.concat([t.description, t.everyday_manifestation, t.potential_strength, t.potential_challenge, t.practical_insight]); }, [])); traits.forEach(function (t) { t.in_depth = TextDedupe.dedupeParagraphs(t.in_depth, seenSent); });
    // make sure no two titles collide
    var seen = {}; traits.forEach(function (t) { if (seen[t.title]) t.title += ' (' + t.category.replace('Interaction: ', '') + ')'; seen[t.title] = 1; });
    var order = ['id', 'title', 'category', 'description', 'evidence_from_answers', 'everyday_manifestation', 'potential_strength', 'potential_challenge', 'confidence', 'confidence_reason', 'practical_insight', 'in_depth'];
    traits = traits.map(function (t) { var o = {}; order.forEach(function (k) { o[k] = t[k]; }); return o; });
    EVC = null;
    var out = {
      assessment_context: {
        answers_available: !!r.ans,
        input_limitation: r.ans ? null : 'Individual answers were not available for this saved result, so traits rest on facet scores only.',
        confidence_note: 'Confidence reflects evidence quality, consistency and coverage, not how strongly a trait is held. Neutral scores are weak evidence either way.',
        selection_note: 'The 20 traits were chosen from ' + cands.length + ' candidates (single-facet traits and two-facet interactions) by strength of evidence, then balanced so every dimension is represented. They are listed strongest-evidence first.',
        selection_log: log,
        scores_used: f
      },
      traits: traits
    };
    var keys = Object.keys(MEMO); if (keys.length > 20) delete MEMO[keys[0]];
    MEMO[mk] = out;
    return JSON.parse(JSON.stringify(out));
  }
  /* ====================== signature read ======================
     A written synthesis of the signature traits, built from this person's own scores and answers:
     the strongest signal (with the answer that shows it most), the supporting signals, where the
     profile is concentrated, how the signatures interact, what is genuinely balanced, and a
     quality caveat. Phrasing is chosen deterministically from the answers. */
  function leanWord(d) { return d >= 30 ? 'a very strong' : d >= 20 ? 'a clear' : 'a moderate'; }
  function decisiveAnswer(key, r) {
    if (!r.ans) return null;
    var best = null;
    QUESTIONS.forEach(function (q, i) {
      if (q.f !== key || r.ans[i] == null) return;
      var c = (r.ans[i] - 3) * q.d;
      if (!best || Math.abs(c) > Math.abs(best.c)) best = { q: q, v: r.ans[i], c: c };
    });
    return best && Math.abs(best.c) >= 1 ? best : null;
  }
  function signature(r) {
    var f = r.facets, sig = Engine.signatureTraits(f);
    var seed = r.ans ? 'a' + r.ans.join('') : 'f' + Object.keys(f).map(function (k) { return f[k]; }).join(',');
    function pk(arr, salt) { return arr[hash(seed + salt) % arr.length]; }
    var parts = [];
    var ranked = Object.keys(f).sort(function (a, b) { return Math.abs(f[b] - 50) - Math.abs(f[a] - 50); });
    var tag = function (key) { return fname(key) + ': ' + pole(key, f[key]) + ', ' + f[key] + '/100'; };
    var lex = function (key) { return LEX[key][f[key] >= 50 ? 'hi' : 'lo']; };
    var keyOf = function (t) { return t.dim + '.' + t.fk; };

    if (!sig.length) {
      var k0 = ranked[0], L0 = lex(k0);
      if (Math.abs(f[k0] - 50) < 3) { parts.push('Every facet sits at or very near the midpoint, so no trait stands out. You are likely to flex with the situation rather than follow one strong pattern.'); }
      else {
      parts.push('No single trait stands out sharply in your answers. Your most pronounced lean is toward ' + L0.noun + ' (' + tag(k0) + '), meaning you ' + L0.does[hash(seed + k0) % 2] + ' — but only slightly.');
      parts.push('That is a balanced profile: you are likely to flex with the situation rather than follow one strong pattern.');
      }
    } else {
      var t0 = sig[0], k = keyOf(t0), L1 = lex(k), n = lean(f[k]);
      var open = pk([
        'Your clearest signal is {n}: {w} lean ({T}) — you {d}.',
        'What defines your profile most is {n}. It is {w} lean ({T}), and it means you {d}.',
        'Start with {n}: it is your strongest tendency ({T}), and it shows in how you {d}.'
      ], 'open').replace('{n}', L1.noun).replace('{w}', leanWord(t0.dev)).replace('{T}', tag(k)).replace('{d}', L1.does[hash(seed + k) % 2]);
      parts.push(open);
      var da = decisiveAnswer(k, r);
      if (da) parts.push('The answer that shows it most: “' + da.q.t + '” — ' + LIK[da.v] + '.');
      if (sig.length > 1) {
        var rest = sig.slice(1, 3).map(function (t) { var kk = keyOf(t), L = lex(kk); return { txt: L.noun + ' (' + tag(kk) + ')', does: L.does[hash(seed + kk) % 2] }; });
        parts.push(pk(['Behind it: ', 'Supporting it: ', 'Right behind that: '], 'bridge') +
          rest.map(function (x) { return x.txt; }).join(' and ') + ' — you ' + rest.map(function (x) { return x.does; }).join(', and you ') + '.');
      }
      // concentration by dimension
      var byDim = {};
      sig.forEach(function (t) { byDim[t.dim] = (byDim[t.dim] || 0) + 1; });
      var dimsUsed = Object.keys(byDim).sort(function (a, b) { return byDim[b] - byDim[a]; });
      if (byDim[dimsUsed[0]] >= 2) parts.push(byDim[dimsUsed[0]] + ' of your ' + sig.length + ' signature traits sit in ' + DIMS[dimsUsed[0]].name + ', so that is where your profile is most concentrated.');
      else if (sig.length >= 3) parts.push('Your signatures are spread across ' + dimsUsed.length + ' dimensions, so no single dimension defines you.');
      // interaction between signatures
      var cur = {}; CURATED.forEach(function (c) { cur[c[0] + '|' + c[1]] = c; cur[c[1] + '|' + c[0]] = c; });
      var pairLine = null;
      for (var i = 0; i < sig.length && !pairLine; i++) for (var j = i + 1; j < sig.length && !pairLine; j++) {
        var a = keyOf(sig[i]), b = keyOf(sig[j]), c = cur[a + ':' + (f[a] >= 50 ? 'hi' : 'lo') + '|' + b + ':' + (f[b] >= 50 ? 'hi' : 'lo')];
        if (c) pairLine = '“' + c[2] + '”: ' + c[3];
      }
      if (!pairLine && sig.length > 1) {
        var ka = keyOf(sig[0]), kb = keyOf(sig[1]), A = lex(ka), B = lex(kb);
        pairLine = 'Your top two signals interact: ' + A.noun + ' brings ' + A.gift + ' and ' + B.noun + ' brings ' + B.gift + '; the thing to watch is ' + A.risk + ' meeting ' + B.risk + '.';
      }
      if (pairLine) parts.push(pairLine);
    }
    // balanced facets
    var calm = sig.length ? ranked.slice().reverse().filter(function (k2) { return Math.abs(f[k2] - 50) <= 4; }).slice(0, 2) : [];
    if (calm.length) parts.push('Where you are genuinely balanced: ' + calm.map(function (k2) { return fname(k2) + ' (' + f[k2] + ')'; }).join(' and ') + ' — neither pole describes you.');
    // dimension extremes
    var dk = DIM_ORDER.slice().sort(function (a, b) { return r.dims[b] - r.dims[a]; });
    if (r.dims[dk[0]] - r.dims[dk[4]] >= 8) parts.push('By dimension, ' + DIMS[dk[0]].name + ' (' + r.dims[dk[0]] + ') is your highest and ' + DIMS[dk[4]].name + ' (' + r.dims[dk[4]] + ') your lowest.');
    if (r.quality && r.quality.straightLining) parts.push('Your answers varied very little, so treat this as a rough sketch rather than a firm reading.');
    return { pills: sig, narrative: parts.join(' ') };
  }

  return { generate: generate, signature: signature, SLOTS: SLOTS };
})();
if (typeof module !== 'undefined') module.exports = TraitsEngine;
