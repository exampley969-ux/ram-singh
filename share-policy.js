/* ============================================================
   PsychePolicy (Phase 7) — one place for the rules that govern comparison, group output, sharing and export.
   Pure functions (no DOM, no storage) so the rules can be tested and reviewed on their own.
   Rules encoded here:
   - what is shared with a connection / group, and what is never shared (answers)
   - small-group advisory tiers (the roadmap's "suppress or warn on very small groups")
   - similarity is not compatibility
   - report export: user-selectable sections, always with date, versions, methodology, limits, snapshot notice; never raw answers
   ============================================================ */
(function (root) {
'use strict';

var SHARED_FIELDS = ['display_name', 'dims', 'facets', 'arch_key'];          // what saveProfile() writes to the shared profile row
var NEVER_SHARED = ['ans', 'answers', 'draft', 'skipped'];                   // raw answers never leave the device

var SCOPE_TEXT = 'This shares your name, your 5 dimension scores, your 20 facet scores and your archetype. It never shares your individual answers. ' +
  'You can remove the connection or leave the group at any time, which stops further access from then on. ' +
  'It cannot take back anything someone has already seen, saved or exported.';

var SIMILARITY_NOTE = 'This number is profile similarity: how close the two sets of scores are. Similar scores do not guarantee that a relationship or team will work well, ' +
  'and different scores do not mean it will not. Use the differences as questions to talk through.';

var USE_LIMITS = 'For self-reflection and conversation only. Not for hiring, promotion, selection or exclusion decisions, and not a measure of anyone\u2019s ability or performance.';

var MIN_RECOMMENDED = 5;
function groupAdvisory(n) {
  n = parseInt(n, 10) || 0;
  if (n < 2) return { tier: 'none', show: false, text: '' };
  if (n === 2) return { tier: 'pair', show: true, text: 'With two people this is a pair comparison, not a group pattern. Every figure is just the two of you.' };
  if (n < MIN_RECOMMENDED) return { tier: 'small', show: true,
    text: 'This group has ' + n + ' people. With so few, one person changes every average, \u201cX of ' + n + '\u201d counts and \u201cwho is missing\u201d findings, so treat them as conversation starters rather than patterns. Everyone here has chosen to share their scores with the group.' };
  return { tier: 'ok', show: true, text: 'Findings describe how these ' + n + ' self-reported profiles combine. They do not measure performance.' };
}

/* Report sections the user can choose. `default` = included unless unticked. Raw answers are not a section: they are never exportable. */
var SECTIONS = [
  { key: 'summary',  label: 'Summary and signature traits', default: true },
  { key: 'traits',   label: 'Twenty traits',                default: true },
  { key: 'contrast', label: 'At your best vs. under stress', default: true },
  { key: 'deep',     label: 'Deep analysis',                default: true },
  { key: 'career',   label: 'Career reflections',           default: true },
  { key: 'relations',label: 'In relationships',             default: true },
  { key: 'patterns', label: 'Patterns, situations and growth plan', default: true }
];
function normalizeSections(sel) {
  var keys = SECTIONS.map(function (s) { return s.key; });
  if (!Array.isArray(sel)) return SECTIONS.filter(function (s) { return s.default; }).map(function (s) { return s.key; });
  var out = keys.filter(function (k) { return sel.indexOf(k) !== -1; });      // unknown keys dropped, canonical order kept
  return out;
}

function reportMeta(result, kind, now) {
  var v = (result && result.versions) || {};
  var d = new Date(now || Date.now());
  var vs = ['scoring', 'questions', 'archetypes', 'narrative', 'quality'].filter(function (k) { return v[k]; }).map(function (k) { return k + ' ' + v[k]; }).join(', ');
  return {
    kind: kind || 'individual',
    date: d.toISOString().slice(0, 10),
    versions: vs || 'unknown',
    snapshot: 'This is a saved snapshot from ' + d.toISOString().slice(0, 10) + '. It does not update if your answers or scores change later.',
    method: 'Scores come from a fixed formula applied to 40 self-report answers across 5 dimensions and 20 facets. The wording is generated from those scores by deterministic rules, not by a language model.',
    limits: 'PRISM is a structured self-reflection framework. No validation study has been run, it is not a diagnosis or clinical tool, and it does not predict behaviour or career success. ' + USE_LIMITS
  };
}
function metaHTML(meta, esc) {
  esc = esc || function (x) { return String(x); };
  return '<div class="preport-footer"><p><b>Report details.</b> ' + esc(meta.kind) + ' report \u00b7 ' + esc(meta.date) + ' \u00b7 engine versions: ' + esc(meta.versions) + '.</p>' +
    '<p>' + esc(meta.snapshot) + '</p><p><b>Method.</b> ' + esc(meta.method) + '</p><p><b>Limits.</b> ' + esc(meta.limits) + '</p>' +
    '<p>Computed in your browser. Your individual answers are not included in this report.</p></div>';
}

/* True if any key anywhere in `obj` is one that must never be shared/exported. */
function containsRawAnswers(obj, depth) {
  depth = depth || 0;
  if (depth > 6 || obj === null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(function (x) { return containsRawAnswers(x, depth + 1); });
  return Object.keys(obj).some(function (k) { return NEVER_SHARED.indexOf(k) !== -1 || containsRawAnswers(obj[k], depth + 1); });
}

var PsychePolicy = { SHARED_FIELDS: SHARED_FIELDS, NEVER_SHARED: NEVER_SHARED, SCOPE_TEXT: SCOPE_TEXT, SIMILARITY_NOTE: SIMILARITY_NOTE, USE_LIMITS: USE_LIMITS,
  MIN_RECOMMENDED: MIN_RECOMMENDED, SECTIONS: SECTIONS, groupAdvisory: groupAdvisory, normalizeSections: normalizeSections, reportMeta: reportMeta, metaHTML: metaHTML, containsRawAnswers: containsRawAnswers };
if (typeof module !== 'undefined' && module.exports) module.exports = PsychePolicy;
root.PsychePolicy = PsychePolicy;
})(typeof window !== 'undefined' ? window : globalThis);
