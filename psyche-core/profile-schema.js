/* ============================================================
   ProfileSchema — the canonical, versioned profile contract.

   Phase 1 of the roadmap. This module does three things and nothing else:
     build(answers)   pure scoring pipeline: answers -> stamped result. No DOM, storage or state.
                      The formula itself still lives in Engine (core-logic.js) and is unchanged.
     validate(r)      boundary check for any result that did not come straight from build():
                      saved local copy, cloud copy, synced profile. Never trusts derived fields:
                      archetype and dimension scores are re-derived and compared.
     validateShared() same for the profile row shared with connections and groups.

   Result shape (schema 1):
     { schema, versions:{scoring,questions,archetypes,narrative,quality},
       dims:{P,R,I,S,M}, facets:{20 keys}, match:{...}, quality:{...}, ans?:[40 x 1..5|null] }
   `ans` is optional and local-only; it is dropped whenever it is invalid or contradicts the scores.

   Bump a version here whenever the thing it names changes, so an old report can be explained.
   ============================================================ */
var ProfileSchema = (function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var VERSIONS = { scoring: '1.0.0', questions: '1.0.0', archetypes: '1.0.0', narrative: '1.1.0', quality: '2.0.0' };

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function inRange(x, lo, hi) { return isNum(x) && x >= lo && x <= hi; }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function versions() { return { scoring: VERSIONS.scoring, questions: VERSIONS.questions, archetypes: VERSIONS.archetypes, narrative: VERSIONS.narrative, quality: VERSIONS.quality }; }

  function validArchKey(key) {
    if (typeof key !== 'string' || !key) return false;
    try { return !!archeByKey(key); } catch (e) { return false; }
  }

  /* ---------- answers ---------- */
  function checkAnswers(ans) {
    if (!Array.isArray(ans)) return { ok: false, reason: 'not_array' };
    if (ans.length !== QUESTIONS.length) return { ok: false, reason: 'wrong_length' };
    var missing = 0;
    for (var i = 0; i < ans.length; i++) {
      var v = ans[i];
      if (v == null) { missing++; continue; }
      if (v !== 1 && v !== 2 && v !== 3 && v !== 4 && v !== 5) return { ok: false, reason: 'out_of_range' };
    }
    return { ok: true, missing: missing };
  }
  function normalizeAnswers(answers) {
    var out = [];
    for (var i = 0; i < QUESTIONS.length; i++) out.push(answers && answers[i] != null ? answers[i] : null);
    return out;
  }

  /* ---------- build: the pure scoring pipeline ---------- */
  function build(answers) {
    var ans = normalizeAnswers(answers);
    var chk = checkAnswers(ans);
    if (!chk.ok) throw new Error('Invalid answers: ' + chk.reason);
    var scored = Engine.score(ans);
    var quality = Engine.quality(ans);
    var match = Engine.match(scored.dims, quality);
    return {
      schema: SCHEMA_VERSION, versions: versions(),
      dims: scored.dims, facets: scored.facets, match: match, quality: quality, ans: ans,
      skipped: chk.missing
    };
  }

  /* ---------- validate ---------- */
  function validate(r) {
    var errors = [], warnings = [];
    function fail(code) { errors.push(code); }
    if (!isObj(r)) return { ok: false, errors: ['not_an_object'], warnings: warnings, value: null };

    var schema = r.schema == null ? 0 : r.schema;
    if (!isNum(schema) || schema < 0 || Math.floor(schema) !== schema) fail('bad_schema_version');
    else if (schema > SCHEMA_VERSION) fail('newer_schema');
    else if (schema < SCHEMA_VERSION) warnings.push('migrated_from_schema_' + schema);

    var facetKeys = Engine.facetKeys();
    var dimsOk = isObj(r.dims) && DIM_ORDER.every(function (d) { return inRange(r.dims[d], 0, 100); });
    var facetsOk = isObj(r.facets) && facetKeys.every(function (k) { return inRange(r.facets[k], 0, 100); });
    if (!dimsOk) fail('dims_invalid');
    if (!facetsOk) fail('facets_invalid');

    if (dimsOk && facetsOk) {
      DIM_ORDER.forEach(function (d) {
        var ks = facetKeys.filter(function (k) { return k.charAt(0) === d; });
        var mean = ks.reduce(function (a, k) { return a + r.facets[k]; }, 0) / ks.length;
        if (Math.abs(Math.round(mean) - r.dims[d]) > 1) fail('dims_inconsistent_with_facets');
      });
    }
    if (errors.length) return { ok: false, errors: errors.filter(function (e, i) { return errors.indexOf(e) === i; }), warnings: warnings, value: null };

    // quality: optional, but if present it must be sane; otherwise treated as unknown.
    // consistency may be null: results saved before quality v2 used a flawed consistency formula (D14).
    var q = r.quality, quality = null;
    var consOk = isObj(q) && (q.consistency === null || inRange(q.consistency, 0, 1));
    if (isObj(q) && inRange(q.engagement, 0, 1) && consOk && isNum(q.spread) && q.spread >= 0 && typeof q.straightLining === 'boolean') {
      quality = { engagement: q.engagement, spread: q.spread, consistency: q.consistency, straightLining: q.straightLining };
    } else warnings.push(q == null ? 'quality_missing' : 'quality_invalid_ignored');
    var qLegacy = quality && !(isObj(r.versions) && r.versions.quality === VERSIONS.quality);

    // answers: optional and local-only. Never trusted over the scores.
    var ans;
    if (r.ans != null) {
      var chk = checkAnswers(r.ans);
      if (!chk.ok) warnings.push('answers_dropped_' + chk.reason);
      else {
        var re = Engine.score(r.ans);
        var same = facetKeys.every(function (k) { return re.facets[k] === r.facets[k]; });
        if (!same) warnings.push('answers_dropped_do_not_match_scores');
        else { ans = r.ans.slice(); if (chk.missing) warnings.push('answers_missing_' + chk.missing); }
      }
    }
    var qFixed = false;
    if (qLegacy) {
      if (ans) { quality = Engine.quality(ans); qFixed = true; warnings.push('quality_rederived'); }
      else { quality.consistency = null; warnings.push('quality_consistency_unknown_legacy'); }
    }

    // derived fields are re-derived from the scores, never taken from the stored copy
    var dims = {}; DIM_ORDER.forEach(function (d) { dims[d] = r.dims[d]; });
    var facets = {}; facetKeys.forEach(function (k) { facets[k] = r.facets[k]; });
    var match = Engine.match(dims, quality);
    if (isObj(r.match) && r.match.key !== match.key) warnings.push('archetype_rederived');

    var verOut = isObj(r.versions) ? JSON.parse(JSON.stringify(r.versions)) : versions();
    if (qFixed) verOut.quality = VERSIONS.quality;
    var value = { schema: SCHEMA_VERSION, versions: verOut, dims: dims, facets: facets, match: match, quality: quality };
    if (ans) value.ans = ans;
    var sk = isNum(r.skipped) && r.skipped >= 0 && r.skipped <= QUESTIONS.length ? Math.floor(r.skipped) : (ans ? ans.filter(function (v) { return v == null; }).length : 0);
    value.skipped = sk;
    return { ok: true, errors: [], warnings: warnings, value: value };
  }

  /* ---------- the profile row shared with connections / groups ---------- */
  function validateShared(p) {
    if (!isObj(p)) return { ok: false, errors: ['not_an_object'] };
    var errors = [];
    if (!isObj(p.dims) || !DIM_ORDER.every(function (d) { return inRange(p.dims[d], 0, 100); })) errors.push('dims_invalid');
    var facetsOk = p.facets == null || (isObj(p.facets) && Engine.facetKeys().every(function (k) { return inRange(p.facets[k], 0, 100); }));
    if (!facetsOk) errors.push('facets_invalid');
    if (p.arch_key != null && !validArchKey(p.arch_key)) errors.push('arch_key_invalid');
    return { ok: !errors.length, errors: errors };
  }

  function explain(codes) {
    var map = {
      not_an_object: 'the saved data is not a result', bad_schema_version: 'the saved data has an unreadable version',
      newer_schema: 'the saved result was made by a newer version of the app', dims_invalid: 'dimension scores are missing or out of range',
      facets_invalid: 'facet scores are missing or out of range', dims_inconsistent_with_facets: 'dimension scores do not match the facet scores'
    };
    return codes.map(function (c) { return map[c] || c; }).join('; ');
  }

  return { SCHEMA_VERSION: SCHEMA_VERSION, VERSIONS: VERSIONS, build: build, validate: validate, validateShared: validateShared,
           checkAnswers: checkAnswers, validArchKey: validArchKey, explain: explain };
})();
