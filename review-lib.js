'use strict';
/* Human-review scoring (Phase 8). Pure functions: parse reviewer CSVs, check them, apply the rubric gate (docs/EVALUATION_RUBRIC.md). */
const DIMS = ['specificity', 'evidence', 'nonrepetition', 'tone', 'actionability', 'calibration'];
const GATE = { meanMin: 3.5, minReviewers: 2, lowScore: 2, disagreement: 2 };

function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x !== '')) rows.push(row);
  return rows;
}
const csvCell = s => /[",\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);

/* Returns { items: Map(key -> {scores, note}), errors: [] }. Blank score cells are reported, not treated as 0. */
function loadSheet(text, reviewer) {
  const rows = parseCSV(text), errors = [], items = new Map();
  if (!rows.length) return { reviewer, items, errors: ['empty sheet'] };
  const head = rows[0].map(h => h.trim().toLowerCase());
  const need = ['profile', 'insight_id'].concat(DIMS);
  need.forEach(h => { if (head.indexOf(h) < 0) errors.push('missing column: ' + h); });
  if (errors.length) return { reviewer, items, errors };
  rows.slice(1).forEach((r, i) => {
    const get = h => (r[head.indexOf(h)] || '').trim(), key = get('profile') + '|' + get('insight_id');
    const scores = {}; let bad = false;
    DIMS.forEach(d => { const v = get(d); const n = Number(v); if (v === '' || !Number.isInteger(n) || n < 1 || n > 5) { errors.push(reviewer + ' row ' + (i + 2) + ' (' + key + '): ' + d + ' must be a whole number 1-5, got "' + v + '"'); bad = true; } else scores[d] = n; });
    if (items.has(key)) errors.push(reviewer + ': duplicate row for ' + key);
    if (!bad) items.set(key, { scores, note: get('note') });
  });
  return { reviewer, items, errors };
}

function analyze(sheets, expectedKeys) {
  const fails = [], warns = [], out = { reviewers: sheets.map(s => s.reviewer), dims: {}, flagged: [], disagreements: [] };
  sheets.forEach(s => s.errors.forEach(e => fails.push(e)));
  if (sheets.length < GATE.minReviewers) fails.push('need at least ' + GATE.minReviewers + ' independent reviewers, got ' + sheets.length);
  const keys = new Set(); sheets.forEach(s => s.items.forEach((_, k) => keys.add(k)));
  if (expectedKeys) {
    expectedKeys.forEach(k => sheets.forEach(s => { if (!s.items.has(k)) fails.push(s.reviewer + ' has not scored ' + k); }));
    keys.forEach(k => { if (expectedKeys.indexOf(k) < 0) warns.push('unexpected item scored: ' + k + ' (engine output changed since the sheet was made?)'); });
  }
  out.items = keys.size;
  DIMS.forEach(d => {
    const vals = []; sheets.forEach(s => s.items.forEach(it => vals.push(it.scores[d])));
    const dist = [0, 0, 0, 0, 0, 0]; vals.forEach(v => dist[v]++);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    out.dims[d] = { mean: +mean.toFixed(2), n: vals.length, dist: dist.slice(1), pass: vals.length > 0 && mean >= GATE.meanMin };
    if (vals.length && mean < GATE.meanMin) fails.push(d + ' mean ' + mean.toFixed(2) + ' is below ' + GATE.meanMin);
  });
  let pairs = 0, close = 0;
  keys.forEach(k => {
    const rs = sheets.filter(s => s.items.has(k)).map(s => ({ who: s.reviewer, it: s.items.get(k) }));
    DIMS.forEach(d => {
      const v = rs.map(r => r.it.scores[d]);
      if (v.length >= 2) { const spread = Math.max.apply(null, v) - Math.min.apply(null, v); pairs++; if (spread <= 1) close++; if (spread >= GATE.disagreement) out.disagreements.push(k + ' / ' + d + ': ' + v.join(' vs ')); }
      if (v.length >= 2 && v.every(x => x <= GATE.lowScore)) { out.flagged.push(k + ' / ' + d + ': all reviewers scored <= ' + GATE.lowScore + ' (fix or remove, then re-review)'); }
      if ((d === 'calibration' || d === 'tone') && v.some(x => x <= GATE.lowScore)) fails.push(k + ' has ' + d + ' <= ' + GATE.lowScore + ' from a reviewer (blocking)');
    });
  });
  out.flagged.forEach(f => fails.push(f));
  out.agreementWithin1 = pairs ? +(close / pairs).toFixed(2) : null;
  if (out.disagreements.length) warns.push(out.disagreements.length + ' disagreement(s) of ' + GATE.disagreement + '+ points: resolve by discussion and record the outcome');
  out.fails = Array.from(new Set(fails)); out.warns = warns; out.pass = out.fails.length === 0;
  return out;
}

function report(a) {
  let md = '# Human review result\n\nReviewers: ' + (a.reviewers.join(', ') || 'none') + ' · items: ' + a.items + ' · agreement within 1 point: ' + (a.agreementWithin1 == null ? 'n/a' : Math.round(a.agreementWithin1 * 100) + '%') + '\n\n| Dimension | Mean | 1 | 2 | 3 | 4 | 5 | Gate (>= ' + GATE.meanMin + ') |\n|---|---|---|---|---|---|---|---|\n';
  DIMS.forEach(d => { const x = a.dims[d]; md += '| ' + d + ' | ' + x.mean + ' | ' + x.dist.join(' | ') + ' | ' + (x.pass ? 'pass' : 'FAIL') + ' |\n'; });
  md += '\n**Result: ' + (a.pass ? 'PASS' : 'NOT PASSED') + '**\n';
  if (a.fails.length) md += '\nBlocking:\n' + a.fails.map(f => '- ' + f).join('\n') + '\n';
  if (a.warns.length) md += '\nTo resolve:\n' + a.warns.map(f => '- ' + f).join('\n') + '\n';
  if (a.disagreements.length) md += '\nDisagreements:\n' + a.disagreements.map(f => '- ' + f).join('\n') + '\n';
  return md;
}
module.exports = { DIMS, GATE, parseCSV, csvCell, loadSheet, analyze, report };
