/* ============================================================
   PsycheUX — pure helpers for Phase 4 (onboarding, save/resume, plain-language score meaning).
   No DOM, no storage access: callers pass storage in. Everything here is deterministic and unit-tested.

   - Draft:      an in-progress assessment, saved locally so a refresh or closed tab does not lose it.
                 Holds only the answers given so far and the position. Cleared on finish or discard.
   - bandFor:    Lower / Middle / Higher range for a 0-100 score (text label, never colour alone).
   - scoreMeaning: what a dimension score means, what it does not mean, and a next step. The
                 "does not mean" lines come from docs/CONSTRUCTS.md.
   - closeCall:  when the archetype is a near-tie, name the runner-up (DEFECTS D15).
   ============================================================ */
var PsycheUX = (function () {
  'use strict';

  var DRAFT_KEY = 'psyche_core_v1_draft';
  var TOTAL = 40;
  var HI = 62, LO = 38; // same cut-offs the compatibility code already uses for "both high / both low"

  /* ---------- draft ---------- */
  function sanitizeDraft(raw, total) {
    total = total || TOTAL;
    var o = raw;
    if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (e) { return null; } }
    if (!o || typeof o !== 'object' || Array.isArray(o) || !Array.isArray(o.answers)) return null;
    if (o.answers.length > total) return null;
    var answers = [];
    for (var i = 0; i < total; i++) {
      var v = o.answers[i];
      if (v === undefined || v === null) answers.push(null);
      else if (typeof v === 'number' && v >= 1 && v <= 5 && Math.floor(v) === v) answers.push(v);
      else return null; // anything else means the draft is not ours: discard it whole
    }
    var q = o.qIndex;
    if (typeof q !== 'number' || !isFinite(q) || q < 0 || q >= total || Math.floor(q) !== q) q = firstUnanswered(answers);
    var answered = answers.filter(function (v) { return v != null; }).length;
    if (answered === 0 && q === 0) return null; // nothing worth resuming
    return { answers: answers, qIndex: q, answered: answered, savedAt: typeof o.savedAt === 'number' && isFinite(o.savedAt) ? o.savedAt : 0 };
  }
  function firstUnanswered(answers) {
    for (var i = 0; i < answers.length; i++) if (answers[i] == null) return i;
    return Math.max(0, answers.length - 1);
  }
  function serializeDraft(answers, qIndex, now) {
    var a = [];
    for (var i = 0; i < TOTAL; i++) a.push(answers && answers[i] != null ? answers[i] : null);
    return JSON.stringify({ v: 1, answers: a, qIndex: qIndex, savedAt: now == null ? Date.now() : now });
  }
  function readDraft(storage) { try { return sanitizeDraft(storage.getItem(DRAFT_KEY)); } catch (e) { return null; } }
  function writeDraft(storage, answers, qIndex) {
    try {
      var any = (answers || []).some(function (v) { return v != null; });
      if (!any && !qIndex) { storage.removeItem(DRAFT_KEY); return true; }
      storage.setItem(DRAFT_KEY, serializeDraft(answers, qIndex)); return true;
    } catch (e) { return false; } // storage full or blocked: the assessment still works, it just cannot resume
  }
  function clearDraft(storage) { try { storage.removeItem(DRAFT_KEY); } catch (e) {} }

  /* ---------- score meaning ---------- */
  function bandFor(score) { return score >= HI ? 'higher' : score <= LO ? 'lower' : 'middle'; }
  var BAND_LABEL = { higher: 'Higher range', middle: 'Middle range', lower: 'Lower range' };

  var MEANING = {
    P: { is: 'how you say you tend to take in and organise information: ideas versus facts, new versus familiar, wide versus narrow, implied versus stated.',
         isNot: 'intelligence, mental health, or how well you understand situations.',
         hi: 'You described yourself as leaning towards ideas, novelty, the wide view and reading between the lines.',
         mid: 'Your answers did not lean strongly either way, so this reads as flexible or situation-dependent rather than as a clear style.',
         lo: 'You described yourself as leaning towards concrete facts, the familiar, a narrow focus and taking things as stated.',
         nextHi: 'Pick one idea you like and test it against a concrete fact this week.',
         nextMid: 'Notice which situations pull you towards ideas and which towards facts.',
         nextLo: 'Pick one familiar routine and ask what a different approach could add.' },
    R: { is: 'how you say you tend to react and move: speed, how visible your feelings are, flexibility and appetite for risk.',
         isNot: 'emotional stability, or how well you cope with stress.',
         hi: 'You described yourself as leaning towards quick, visible, flexible and bold responses.',
         mid: 'Your answers did not lean strongly either way, so your response style may change with the situation.',
         lo: 'You described yourself as leaning towards measured, private, steady and cautious responses.',
         nextHi: 'Before one important decision this week, wait a day and see whether your answer changes.',
         nextMid: 'Notice when you speed up and when you slow down, and what triggers each.',
         nextLo: 'Choose one low-stakes decision to make faster than usual and see what happens.' },
    I: { is: 'how you describe your own stance: independence, firmness of belief, wish to stand out and sense of continuity.',
         isNot: 'self-esteem or how developed your identity is. It is not a clinical measure of anything.',
         hi: 'You described yourself as leaning towards independence, firm views, standing apart and a steady sense of self.',
         mid: 'Your answers did not lean strongly either way, which can mean you adapt your stance to the setting.',
         lo: 'You described yourself as leaning towards openness to others’ views, belonging and a self that shifts with circumstances.',
         nextHi: 'Ask one person you trust for the strongest argument against a view you hold.',
         nextMid: 'Write down one view you would not change and one you would, and why.',
         nextLo: 'Name one value you would keep even if others disagreed, and say it out loud once.' },
    S: { is: 'how you say you relate to others: warmth, appetite for company, emotional attunement and conflict style.',
         isNot: 'social skill, relationship quality, or how well you would get on with any particular person.',
         hi: 'You described yourself as leaning towards warmth, company, attunement to others and keeping the peace.',
         mid: 'Your answers did not lean strongly either way, so how you relate to people may depend on who they are.',
         lo: 'You described yourself as leaning towards independence from groups, privacy, objectivity and plain speaking.',
         nextHi: 'Say one honest but kind thing you would usually keep back.',
         nextMid: 'Notice which people bring out more warmth in you and which bring out less.',
         nextLo: 'Reach out to one person with no agenda other than to say hello.' },
    M: { is: 'what you say moves you: striving, structure, scale of ambition and follow-through.',
         isNot: 'achievement, work performance, or suitability for any role.',
         hi: 'You described yourself as leaning towards striving, structure, ambition and sticking with things.',
         mid: 'Your answers did not lean strongly either way, so your drive may vary a lot by topic.',
         lo: 'You described yourself as leaning towards contentment, spontaneity, modest goals and shifting interests.',
         nextHi: 'Schedule one real rest day and notice what happens to your motivation afterwards.',
         nextMid: 'List what you stayed with longest this year and what made it easy.',
         nextLo: 'Pick one small goal with a date and check back on it in a week.' }
  };

  function scoreMeaning(dim, score) {
    var m = MEANING[dim]; if (!m || typeof score !== 'number' || !isFinite(score)) return null;
    var band = bandFor(score), key = band === 'higher' ? 'hi' : band === 'lower' ? 'lo' : 'mid', nk = band === 'higher' ? 'nextHi' : band === 'lower' ? 'nextLo' : 'nextMid';
    return { band: band, label: BAND_LABEL[band], is: m.is, means: m[key], isNot: m.isNot, next: m[nk] };
  }

  // Plain-text description of a score, for screen readers and for any chart that would otherwise rely on colour.
  function scoreText(name, score) {
    return name + ': ' + score + ' out of 100, ' + BAND_LABEL[bandFor(score)].toLowerCase();
  }

  /* ---------- archetype close call (DEFECTS D15) ---------- */
  // One answer moves a facet by 12.5 points, so one dimension (mean of 4 facets) by about 3. Re-run the real
  // archetype rule with each dimension nudged by +/-STEP; any different label that appears is a neighbouring
  // reading the person could plausibly have got. No thresholds are duplicated here: matchFn is Engine.match.
  var STEP = 3.2;
  function closeCall(dims, order, matchFn, currentKey) {
    if (!dims || !order || typeof matchFn !== 'function') return null;
    var counts = {}, total = 0;
    order.forEach(function (d) {
      [-STEP, STEP].forEach(function (delta) {
        var t = {}; order.forEach(function (k) { t[k] = dims[k]; });
        t[d] = Math.max(0, Math.min(100, dims[d] + delta));
        var m; try { m = matchFn(t); } catch (e) { return; }
        total++;
        if (m && m.key && m.key !== currentKey) counts[m.key] = (counts[m.key] || 0) + 1;
      });
    });
    var alts = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : 1); });
    if (!alts.length) return null;
    return { alts: alts.slice(0, 2), changing: alts.length, of: total };
  }

  /* ---------- copy used by the first-run screen (kept here so tests can guard it) ---------- */
  var INTRO = {
    purpose: 'Psyche Core is a structured self-reflection tool. It turns 40 statements about you into five scores, twenty facets and a set of written reflections.',
    time: 'About 5 to 8 minutes. You can skip any question, go back, and leave and come back later.',
    use: 'Your answers are scored in this browser. The result is for you to reflect on; it is not shared with anyone unless you choose to connect with someone or join a group.',
    privacy: 'Without an account nothing leaves this device. Your answers so far are kept on this device so you can resume, and removed when you finish or discard them.',
    boundary: 'This is not a diagnosis, not a clinical or hiring tool, and not a prediction of how you will behave. No validation study has been run yet.'
  };

  return { DRAFT_KEY: DRAFT_KEY, TOTAL: TOTAL, sanitizeDraft: sanitizeDraft, serializeDraft: serializeDraft, readDraft: readDraft, writeDraft: writeDraft,
           clearDraft: clearDraft, firstUnanswered: firstUnanswered, bandFor: bandFor, BAND_LABEL: BAND_LABEL, scoreMeaning: scoreMeaning, scoreText: scoreText,
           closeCall: closeCall, STEP: STEP, INTRO: INTRO, MEANING: MEANING };
})();
