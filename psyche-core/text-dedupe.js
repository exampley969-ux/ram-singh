/* ============================================================
   TextDedupe — sentence-level de-duplication for generated report text (Phase 2.4).

   The generators build paragraphs from shared pools, so the same sentence can surface under several
   traits or on several tabs. This removes repeats while keeping the first occurrence, and never
   touches short sentences (under MIN_WORDS), numbers or labels. Deterministic; text is only ever
   removed, never rewritten.
   ============================================================ */
var TextDedupe = (function () {
  'use strict';
  var MIN_WORDS = 6;
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function split(text) { return String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean); }
  function eligible(sentence) { return norm(sentence).split(' ').length >= MIN_WORDS; }
  function seenSet(initialTexts) {
    var set = {};
    (initialTexts || []).forEach(function (t) { split(t).forEach(function (s) { if (eligible(s)) set[norm(s)] = 1; }); });
    return set;
  }
  // keep each eligible sentence once; `seen` is updated so later calls continue the same pass
  function dedupeText(text, seen) {
    return split(text).filter(function (s) {
      if (!eligible(s)) return true;
      var k = norm(s); if (seen[k]) return false; seen[k] = 1; return true;
    }).join(' ');
  }
  // paragraphs shaped "Label: sentences"; a paragraph left with no sentences is dropped
  function dedupeParagraphs(text, seen) {
    return String(text).split(/\n\n+/).map(function (p) {
      var m = /^([A-Z][A-Za-z ]{2,30}):\s+([\s\S]*)$/.exec(p);
      var label = m ? m[1] : null, body = m ? m[2] : p;
      var kept = dedupeText(body, seen);
      return kept ? (label ? label + ': ' + kept : kept) : null;
    }).filter(Boolean).join('\n\n');
  }
  return { norm: norm, split: split, seenSet: seenSet, dedupeText: dedupeText, dedupeParagraphs: dedupeParagraphs, MIN_WORDS: MIN_WORDS };
})();
