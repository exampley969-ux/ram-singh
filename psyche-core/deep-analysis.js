/* ============================================================
   deep-analysis.js — JS mirror of deep_analysis_nlp.py
   Same content (ported via JSON export, not retyped, so there's zero
   drift between the Python and JS versions), same deterministic
   seeded-pick logic, same category structure. This is what lets
   Psyche Core generate the 9 deep-analysis sections and 20 dynamic
   facts fully offline, with no server round-trip, while staying
   identical to what the Python engine would produce.
   ============================================================ */

var DEEP_DIMENSIONS = ["P", "R", "I", "S", "M"];

function _deepSeed(key) {
  var str = String(key), h = 0;
  for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) & 0xFFFFFFFF; }
  return Math.abs(h);
}
function _deepPick(options, seed) { return options[seed % options.length]; }
function _deepBand(score) { return score < 34 ? 'low' : (score < 67 ? 'mid' : 'high'); }

function _deepAnchorLine(category, anchorText) {
  if (!anchorText) return '';
  var prefixes = {
    strength: "Your archetype's core strength is already named plainly: ",
    weakness: "The known blind spot for this archetype: ",
  };
  var prefix = prefixes[category] || '';
  return prefix ? prefix + anchorText : anchorText;
}

var DIM_NAMES_DEEP = { P: 'Perception', R: 'Response', I: 'Identity', S: 'Social', M: 'Motivation' };
var CATEGORY_SYNTHESIS_LABEL = {
  strength: 'strengths', weakness: 'blind spots', shadow: 'shadow pattern',
  emotional: 'emotional processing', logical: 'reasoning style', social: 'social functioning',
  dark_traits: 'dark-trait risk', at_best: 'peak conditions', under_stress: 'stress pattern',
  misunderstood: 'perception gap',
};

function generateDeepSection(category, scores, seedKey, anchorText) {
  var table = IMPLICATIONS[category] || {};
  var ranked = DEEP_DIMENSIONS.slice().sort(function (a, b) {
    return Math.abs(scores[b] - 50) - Math.abs(scores[a] - 50);
  });

  var sentences = [];
  var opener = _deepAnchorLine(category, anchorText);
  if (opener) sentences.push(opener);

  var used = 0, usedDims = [];
  for (var i = 0; i < ranked.length; i++) {
    var d = ranked[i], band = _deepBand(scores[d]);
    var pool = table[d] && table[d][band];
    if (!pool || !pool.length) continue;
    // Use every variant in the pool (not just one) — matches the Python
    // v3 expansion, same deterministic ordering via seeded sort.
    var ordered = pool.slice().sort(function (a, b) {
      return _deepSeed(seedKey + ':' + category + ':' + d + ':' + band + ':' + a.slice(0, 12)) -
             _deepSeed(seedKey + ':' + category + ':' + d + ':' + band + ':' + b.slice(0, 12));
    });
    ordered.forEach(function (variant) { sentences.push(variant); });
    usedDims.push(d);
    used++;
  }

  if (used === 0) {
    if (category === 'dark_traits') {
      return "No strong dark-trait signal showed up across your most defining dimensions. That's a real finding, not an omission \u2014 dark traits in this framework are only named where a genuine, well-established pattern exists at the extremes of a specific dimension, and yours don't currently sit at those extremes. Worth noting this can shift if your scores move significantly on a retake.";
    }
    return "Your scores here sit close enough to the middle that no single dimension dominates this category \u2014 it reads as genuinely situational rather than fixed.";
  }

  if (used >= 2 && CATEGORY_SYNTHESIS_LABEL[category]) {
    var label = CATEGORY_SYNTHESIS_LABEL[category];
    var drivers = [DIM_NAMES_DEEP[usedDims[0]], DIM_NAMES_DEEP[usedDims[1]]];
    var seed2 = _deepSeed(seedKey + ':' + category + ':synthesis');
    var synthTemplates = [
      "If you're looking for the short version: this " + label + " read comes mainly from " + drivers[0] + " and " + drivers[1] + " \u2014 the other dimensions play a smaller supporting role.",
      "Practically, " + drivers[0] + " and " + drivers[1] + " are doing most of the work behind this " + label + " read; the rest of your profile shapes it only at the margins.",
    ];
    sentences.push(_deepPick(synthTemplates, seed2));
  }

  return sentences.join(' ');
}

var RELATIONSHIP_SUBTHEMES = {
  R: 'Conflict style', I: 'Commitment & stability', S: 'Closeness & contact',
  P: 'Reading unstated needs', M: 'Shared direction',
};
var RELATIONSHIP_DIM_ORDER = ['R', 'I', 'S', 'P', 'M'];

function _capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function generateRelationshipHandlingDeep(scores, anchorText, seedKey) {
  var sections = [];
  RELATIONSHIP_DIM_ORDER.forEach(function (d) {
    var band = _deepBand(scores[d]);
    var pool = IMPLICATIONS.relationship_handling[d] && IMPLICATIONS.relationship_handling[d][band];
    if (!pool || !pool.length) return;
    var ordered = pool.slice().sort(function (a, b) {
      return _deepSeed(seedKey + ':relationship_deep:' + d + ':' + band + ':' + a.slice(0, 12)) -
             _deepSeed(seedKey + ':relationship_deep:' + d + ':' + band + ':' + b.slice(0, 12));
    });
    var text = ordered.map(function (v, i) { return i === 0 ? _capFirst(v) : v; }).join(' ');
    sections.push({ label: RELATIONSHIP_SUBTHEMES[d], dim: d, score: scores[d], text: text });
  });

  var ranked = DEEP_DIMENSIONS.slice().sort(function (a, b) { return Math.abs(scores[b] - 50) - Math.abs(scores[a] - 50); });
  var top2 = ranked.slice(0, 2);
  var top2Labels = top2.map(function (d) { return RELATIONSHIP_SUBTHEMES[d]; }).filter(Boolean);
  var synthesis;
  if (top2Labels.length === 2) {
    synthesis = 'Across all five, ' + top2Labels[0] + ' and ' + top2Labels[1] + ' are the two areas that will actually define how a relationship with you tends to feel from the other side \u2014 the other three matter, but these two are where a partner will notice the pattern first, for better or worse.';
  } else {
    synthesis = 'No single relational dimension dominates here \u2014 how you handle closeness reads as genuinely balanced across conflict, commitment, contact, attunement, and direction.';
  }
  return { intro: anchorText || '', sections: sections, synthesis: synthesis };
}

function generateDeepCareer(scores, careerFitText, careerDomains, careerCaution, seedKey) {
  var strengthPara = generateDeepSection('strength', scores, seedKey + ':career');
  var logicalPara = generateDeepSection('logical', scores, seedKey + ':career');
  return [
    careerFitText,
    'Roles worth specifically looking at: ' + careerDomains.join(', ') + '.',
    'The reasoning underneath that fit: ' + strengthPara,
    "How you'll actually reason through the work day to day: " + logicalPara,
    'Where this can go wrong if unmanaged: ' + careerCaution,
  ].join(' ');
}

function generateFullDeepProfile(scores, archStrengths, archWeakness, archShadow, careerFitText, careerDomains, careerCaution, seedKey) {
  var strengthAnchor = 'Named strengths include ' + archStrengths.map(function (s) { return s.toLowerCase(); }).join(', ') + '.';
  var shadowAnchor = archShadow ? ('Under real pressure, this archetype tends toward behavior that ' + archShadow) : null;
  return {
    strength: generateDeepSection('strength', scores, seedKey, strengthAnchor),
    weakness: generateDeepSection('weakness', scores, seedKey, archWeakness),
    shadow: generateDeepSection('shadow', scores, seedKey, shadowAnchor),
    emotional: generateDeepSection('emotional', scores, seedKey),
    logical: generateDeepSection('logical', scores, seedKey),
    relationship_handling: generateRelationshipHandlingDeep(scores, null, seedKey),
    social: generateDeepSection('social', scores, seedKey),
    dark_traits: generateDeepSection('dark_traits', scores, seedKey),
    at_best: generateDeepSection('at_best', scores, seedKey),
    under_stress: generateDeepSection('under_stress', scores, seedKey),
    misunderstood: generateDeepSection('misunderstood', scores, seedKey),
    career: generateDeepCareer(scores, careerFitText, careerDomains, careerCaution, seedKey),
  };
}

var FACET_DEEP_SOURCES = ['strength', 'misunderstood', 'at_best'];

function generateDeepFacetDescription(dim, score, factText, seedKey) {
  var band = _deepBand(score);
  var parts = [factText];
  FACET_DEEP_SOURCES.forEach(function (category) {
    var pool = IMPLICATIONS[category] && IMPLICATIONS[category][dim] && IMPLICATIONS[category][dim][band];
    if (!pool || !pool.length) return;
    var seed = _deepSeed(seedKey + ':facetdeep:' + category + ':' + dim + ':' + band);
    parts.push(_deepPick(pool, seed));
  });
  return parts.join(' ');
}

function generate20Facts(facetDefs, facetScores, seedKey) {
  var facts = [];
  Object.keys(facetDefs).forEach(function (key) {
    var fac = facetDefs[key];
    var dim = key.split('.')[0];
    var s = facetScores[key] != null ? facetScores[key] : 50;
    var band = _deepBand(s);
    var seed = _deepSeed(seedKey + ':' + key + ':' + band);
    var frame = _deepPick(FACT_FRAMES[band], seed);
    var factText = frame
      .split('{domain_cap}').join(fac.domain.charAt(0).toUpperCase() + fac.domain.slice(1))
      .split('{domain}').join(fac.domain)
      .split('{lo_cap}').join(fac.lo[0])
      .split('{hi_cap}').join(fac.hi[0])
      .split('{lo}').join(fac.lo[0].toLowerCase())
      .split('{hi}').join(fac.hi[0].toLowerCase());
    var poleLabel = s >= 50 ? fac.hi[0] : fac.lo[0];
    var deepText = generateDeepFacetDescription(dim, s, factText, seedKey + ':' + key);
    facts.push({ dim: dim, facetKey: key, label: poleLabel, score: s, band: band, domain: fac.domain, fact: factText, deep: deepText });
  });
  return facts;
}
