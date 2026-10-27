/* Pure psychometric helpers for PRISM item/scale QA (no I/O). Used by tools/psychometrics.js and tests.
   Convention: "aligned" answer = (answer - 3) * keyDirection, so that higher = more of the facet's HIGH pole. */
'use strict';
function mean(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }
function variance(a) { var m = mean(a); return a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / (a.length - 1); }
function sd(a) { return Math.sqrt(variance(a)); }
function pearson(x, y) {
  var n = x.length; if (n < 3) return null;
  var mx = mean(x), my = mean(y), sxy = 0, sxx = 0, syy = 0;
  for (var i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my); }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}
/* 95% CI for r via Fisher z; null when n < 4 or r is null */
function fisherCI(r, n) {
  if (r == null || n < 4) return null;
  var rr = Math.max(-0.999999, Math.min(0.999999, r)), z = Math.atanh(rr), se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)];
}
/* Cronbach's alpha. rows: array of respondents, each an array of k item scores (already aligned). */
function cronbachAlpha(rows) {
  var k = rows[0].length, n = rows.length; if (k < 2 || n < 3) return null;
  var itemVar = 0;
  for (var j = 0; j < k; j++) itemVar += variance(rows.map(function (r) { return r[j]; }));
  var totVar = variance(rows.map(function (r) { return r.reduce(function (s, v) { return s + v; }, 0); }));
  if (totVar === 0) return null;
  return (k / (k - 1)) * (1 - itemVar / totVar);
}
/* Spearman-Brown: reliability of a k-times-longer test from inter-item r (two-item scale: k=2 gives the scale reliability) */
function spearmanBrown(r, k) { return r == null ? null : (k * r) / (1 + (k - 1) * r); }
/* corrected item-total correlation: item vs sum of the other items */
function correctedItemTotal(rows, j) {
  return pearson(rows.map(function (r) { return r[j]; }), rows.map(function (r) { return r.reduce(function (s, v, i) { return i === j ? s : s + v; }, 0); }));
}
/* ICC(2,1): two-way random, absolute agreement, single measure. pairs: [[t1,t2],...] */
function icc21(pairs) {
  var n = pairs.length, k = 2; if (n < 3) return null;
  var grand = mean(pairs.map(function (p) { return (p[0] + p[1]) / 2; }));
  var rowMeans = pairs.map(function (p) { return (p[0] + p[1]) / 2; });
  var colMeans = [mean(pairs.map(function (p) { return p[0]; })), mean(pairs.map(function (p) { return p[1]; }))];
  var ssr = 0, ssc = 0, sst = 0;
  rowMeans.forEach(function (m) { ssr += k * (m - grand) * (m - grand); });
  colMeans.forEach(function (m) { ssc += n * (m - grand) * (m - grand); });
  pairs.forEach(function (p) { p.forEach(function (v) { sst += (v - grand) * (v - grand); }); });
  var sse = sst - ssr - ssc;
  var msr = ssr / (n - 1), msc = ssc / (k - 1), mse = sse / ((n - 1) * (k - 1));
  var den = msr + (k - 1) * mse + (k * (msc - mse)) / n;
  return den === 0 ? null : (msr - mse) / den;
}
function round(x, d) { return x == null ? null : Math.round(x * Math.pow(10, d)) / Math.pow(10, d); }

/* Full item/scale analysis. data: array of 40-length answer arrays (1..5 or null). E: { Engine, QUESTIONS, DIM_ORDER, DIMS } */
function analyse(data, E) {
  var Q = E.QUESTIONS, n = data.length, out = { n: n, items: [], facets: {}, dims: {}, facetCorrelations: [], flags: [] };
  var complete = data.filter(function (r) { return r.every(function (v) { return v != null; }); });
  out.nComplete = complete.length;
  var aligned = function (r) { return r.map(function (v, i) { return v == null ? null : (v - 3) * Q[i].d; }); };
  var al = complete.map(aligned);
  Q.forEach(function (q, i) {
    var col = data.map(function (r) { return r[i]; }).filter(function (v) { return v != null; });
    var floor = col.filter(function (v) { return v === 1; }).length / col.length, ceil = col.filter(function (v) { return v === 5; }).length / col.length;
    var dimKeys = Q.map(function (qq, j) { return qq.f.charAt(0) === q.f.charAt(0) ? j : -1; }).filter(function (j) { return j >= 0; });
    var cit = al.length > 3 ? correctedItemTotal(al.map(function (r) { return dimKeys.map(function (j) { return r[j]; }); }), dimKeys.indexOf(i)) : null;
    var it = { index: i, facet: q.f, key: q.d, missing: round(1 - col.length / n, 4), mean: round(mean(col), 3), sd: round(col.length > 1 ? sd(col) : 0, 3),
      pctMin: round(floor, 3), pctMax: round(ceil, 3), alignedMean: round(mean(col.map(function (v) { return (v - 3) * q.d; })), 3), correctedItemDimTotal: round(cit, 3) };
    out.items.push(it);
    if (floor > 0.15 || ceil > 0.15) out.flags.push('item ' + (i + 1) + ' floor/ceiling >15% (min ' + round(floor, 2) + ', max ' + round(ceil, 2) + ')');
    if (it.sd < 0.8 && col.length > 1) out.flags.push('item ' + (i + 1) + ' low variance (sd ' + it.sd + ')');
    if (cit != null && cit < 0.2) out.flags.push('item ' + (i + 1) + ' corrected item-dimension r < .20 (' + round(cit, 2) + ')');
  });
  var scored = data.map(function (r) { return E.Engine.score(r); });
  E.Engine.facetKeys().forEach(function (k) {
    var idx = Q.map(function (q, i) { return q.f === k ? i : -1; }).filter(function (i) { return i >= 0; });
    var r = al.length > 3 ? pearson(al.map(function (a) { return a[idx[0]]; }), al.map(function (a) { return a[idx[1]]; })) : null;
    var vals = scored.map(function (s) { return s.facets[k]; });
    var distinct = {}; vals.forEach(function (v) { distinct[v] = (distinct[v] || 0) + 1; });
    out.facets[k] = { interItemR: round(r, 3), interItemCI: (fisherCI(r, al.length) || []).map(function (v) { return round(v, 2); }), spearmanBrown: round(spearmanBrown(r, 2), 3),
      mean: round(mean(vals), 1), sd: round(vals.length > 1 ? sd(vals) : 0, 1), pctAt0: round(vals.filter(function (v) { return v === 0; }).length / n, 3), pctAt100: round(vals.filter(function (v) { return v === 100; }).length / n, 3) };
    if (r != null && r < 0.2) out.flags.push('facet ' + k + ' two items barely correlate when direction-aligned (r=' + round(r, 2) + ')');
  });
  E.DIM_ORDER.forEach(function (d) {
    var idx = Q.map(function (q, i) { return q.f.charAt(0) === d ? i : -1; }).filter(function (i) { return i >= 0; });
    var a = al.length > 3 ? cronbachAlpha(al.map(function (r) { return idx.map(function (i) { return r[i]; }); })) : null;
    out.dims[d] = { items: idx.length, alpha: round(a, 3), mean: round(mean(scored.map(function (s) { return s.dims[d]; })), 1), sd: round(scored.length > 1 ? sd(scored.map(function (s) { return s.dims[d]; })) : 0, 1) };
  });
  var keys = E.Engine.facetKeys();
  for (var a = 0; a < keys.length; a++) for (var b = a + 1; b < keys.length; b++) {
    var r2 = pearson(scored.map(function (s) { return s.facets[keys[a]]; }), scored.map(function (s) { return s.facets[keys[b]]; }));
    if (r2 != null && Math.abs(r2) >= 0.6) { out.facetCorrelations.push({ a: keys[a], b: keys[b], r: round(r2, 3), sameDimension: keys[a].charAt(0) === keys[b].charAt(0) });
      if (Math.abs(r2) >= 0.7) out.flags.push('facets ' + keys[a] + ' and ' + keys[b] + ' correlate ' + round(r2, 2) + ' (discriminant validity concern)'); }
  }
  var qual = data.map(function (r) { return E.Engine.quality(r); });
  out.quality = { straightLiningRate: round(qual.filter(function (q) { return q.straightLining; }).length / n, 3), meanConsistency: round(mean(qual.map(function (q) { return q.consistency; })), 3) };
  return out;
}
/* Test-retest on paired data: time1[i], time2[i] are answer arrays of the same person. */
function retest(t1, t2, E) {
  var s1 = t1.map(function (r) { return E.Engine.score(r); }), s2 = t2.map(function (r) { return E.Engine.score(r); });
  var res = { n: t1.length, facets: {}, dims: {} };
  function one(get) {
    var x = s1.map(get), y = s2.map(get), r = pearson(x, y), diffs = x.map(function (v, i) { return y[i] - v; });
    var sdd = diffs.length > 1 ? sd(diffs) : null;
    return { r: round(r, 3), ci: (fisherCI(r, x.length) || []).map(function (v) { return round(v, 2); }), icc21: round(icc21(x.map(function (v, i) { return [v, y[i]]; })), 3),
      meanChange: round(mean(diffs), 2), sdChange: round(sdd, 2), sem: round(sdd == null ? null : sdd / Math.SQRT2, 2), mdc95: round(sdd == null ? null : 1.96 * sdd, 1) };
  }
  E.Engine.facetKeys().forEach(function (k) { res.facets[k] = one(function (s) { return s.facets[k]; }); });
  E.DIM_ORDER.forEach(function (d) { res.dims[d] = one(function (s) { return s.dims[d]; }); });
  var same = 0; t1.forEach(function (r, i) { if (E.Engine.match(s1[i].dims, E.Engine.quality(r)).key === E.Engine.match(s2[i].dims, E.Engine.quality(t2[i])).key) same++; });
  res.archetypeAgreement = round(same / t1.length, 3);
  return res;
}
module.exports = { mean: mean, sd: sd, pearson: pearson, fisherCI: fisherCI, cronbachAlpha: cronbachAlpha, spearmanBrown: spearmanBrown, correctedItemTotal: correctedItemTotal, icc21: icc21, analyse: analyse, retest: retest, round: round };
