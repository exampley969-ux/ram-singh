/* ============================================================
   TraitDuo — the generative trait engine applied to two people and to groups.

   TraitsEngine.generate() already builds each person's own 20 traits (single-facet traits plus
   generated two-facet interactions, chosen by evidence strength). TraitDuo runs it once per
   person on their shared 20 facet scores (answers never leave the device, so evidence is
   score-based) and then compares the generated traits themselves:

   pair(a, b)    -> shared traits, opposite traits (same facets, opposite poles) with what each
                    gives the other, and each person's signature traits as seen from outside.
   group(members)-> traits several members share, collective watch-outs, what only one member
                    brings, opposite-trait tensions between members, and where the group's
                    trait weight sits.

   Deterministic and rule-based: same scores in, same text out. Nothing leaves the browser.
   A person is { name, facets } where facets holds the 20 scores 0-100.
   ============================================================ */
var TraitDuo = (function () {
  'use strict';

  function facetKeys() { return Engine.facetKeys(); }
  function validFacets(f) {
    if (!f || typeof f !== 'object') return false;
    return facetKeys().every(function (k) { return typeof f[k] === 'number' && f[k] >= 0 && f[k] <= 100; });
  }
  function info(key) { var p = key.split('.'), f = DIMS[p[0]].facets[p[1]]; return { name: f.name, hi: f.hi[0], lo: f.lo[0], dim: p[0] }; }
  function poleLabel(key, s) { var i = info(key); return s >= 50 ? i.hi : i.lo; }
  function lc(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : ''; }
  function stripDot(t) { return String(t || '').replace(/\s+$/, '').replace(/\.$/, ''); }
  // trait copy is written to the person ("you"); pair and group text talks about them
  var SUBJ_PREV = /^(when|if|that|before|until|and|but|because|than|as|where|while|so|once|after|though|although|whether|what|which|how|who|since|unless|or|then|why)$/i;
  var SUBJ_NEXT = /^(may|can|will|would|might|could|should|must|do|did|have|has|had|are|were|am|keep|tend|fit|collaborate|respond|repair|feel|read|go|get|see|find|take|need|want|prefer|hold|react|think|act|move|lose|miss|stay|pursue|give|know|invest|handle|work|enjoy|rely|come|make)$/i;
  function third(t) {
    t = String(t);
    return t.replace(/\b(yourself|your|you)\b/gi, function (m, w, off) {
      var cap = m.charAt(0) === 'Y';
      var lw = w.toLowerCase();
      if (lw === 'yourself') return cap ? 'Themselves' : 'themselves';
      if (lw === 'your') return cap ? 'Their' : 'their';
      var before = (t.slice(0, off).match(/([A-Za-z']+)[\s,]*$/) || [])[1];
      var after = (t.slice(off + m.length).match(/^\s+([A-Za-z']+)/) || [])[1];
      var subj = off === 0 || (before && SUBJ_PREV.test(before)) || (after && SUBJ_NEXT.test(after));
      if (subj) return cap ? 'They' : 'they';
      return cap ? 'Them' : 'them';
    });
  }
  function cat(c) { return String(c || '').replace(/^Interaction:\s*/, ''); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pickBy(seed, arr) { return arr[hash(seed) % arr.length]; }
  function joinNames(a) { return a.length <= 1 ? (a[0] || '') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  /* ---------- one person's generated traits, tagged for comparison ---------- */
  function traitsOf(person) {
    var f = person.facets;
    var out = TraitsEngine.generate({ dims: person.dims || {}, facets: f, quality: person.quality || null });
    var logById = {};
    out.assessment_context.selection_log.forEach(function (l) { logById[l.id] = l; });
    return out.traits.map(function (t, i) {
      var l = logById[t.id] || { facets: [], salience: 0, kind: 'anchor' };
      var keys = (l.facets || []).filter(function (k) { return typeof f[k] === 'number'; });
      var poles = {};
      keys.forEach(function (k) { poles[k] = f[k] >= 50 ? '+' : '-'; });
      var sig = keys.slice().sort().map(function (k) { return k + poles[k]; }).join('|');
      return {
        id: t.id, rank: i + 1, title: t.title, category: cat(t.category), kind: l.kind, sal: l.salience || 0,
        keys: keys, poles: poles, sig: sig,
        strength: third(stripDot(t.potential_strength)), challenge: third(stripDot(t.potential_challenge)), insight: stripDot(t.practical_insight),
        confidence: t.confidence
      };
    });
  }
  function describeFacets(t, person) {
    return t.keys.map(function (k) { return info(k).name + ' ' + Math.round(person.facets[k]) + ' (' + poleLabel(k, person.facets[k]).toLowerCase() + ')'; }).join(' + ');
  }
  function top(traits, n) { return traits.slice(0, n); }

  /* ---------- relations between two people's traits ---------- */
  // same facets, same poles -> a shared trait
  function sharedBetween(A, B) {
    var bySig = {}; B.forEach(function (t) { if (t.sig) bySig[t.sig] = t; });
    var out = [];
    A.forEach(function (ta) {
      var tb = bySig[ta.sig]; if (!tb) return;
      out.push({ a: ta, b: tb, weight: Math.min(ta.sal, tb.sal) * (1 + 0.15 * ta.keys.length) });
    });
    return out.sort(function (x, y) { return y.weight - x.weight; });
  }
  // traits that use at least one common facet, and on every common facet sit at opposite poles
  function oppositeBetween(A, B) {
    var out = [];
    A.forEach(function (ta) {
      B.forEach(function (tb) {
        var common = ta.keys.filter(function (k) { return tb.keys.indexOf(k) >= 0; });
        if (!common.length) return;
        var allOpp = common.every(function (k) { return ta.poles[k] !== tb.poles[k]; });
        if (!allOpp) return;
        out.push({ a: ta, b: tb, facets: common, weight: ta.sal * tb.sal * (1 + 0.5 * (common.length - 1)) });
      });
    });
    out.sort(function (x, y) { return y.weight - x.weight; });
    // keep each trait (on either side) once, so the list reads as distinct points
    var usedA = {}, usedB = {}, picked = [];
    out.forEach(function (o) {
      if (usedA[o.a.id] || usedB[o.b.id]) return;
      usedA[o.a.id] = 1; usedB[o.b.id] = 1; picked.push(o);
    });
    return picked;
  }

  /* ---------- pair ---------- */
  function pair(me, them) {
    var A = traitsOf(me), B = traitsOf(them), an = me.name, bn = them.name;
    var shared = sharedBetween(A, B).slice(0, 4);
    var opp = oppositeBetween(A, B).slice(0, 4);
    var seed = an + '|' + bn;

    var sharedItems = shared.map(function (s) {
      return {
        title: s.a.title, category: s.a.category,
        text: 'You both show this pattern, so neither of you is likely to notice its downside in the other.',
        gift: s.a.strength, watch: s.a.challenge,
        ranks: an + ' #' + s.a.rank + ' · ' + bn + ' #' + s.b.rank,
        tip: s.a.insight,
        basis: describeFacets(s.a, me) + ' / ' + describeFacets(s.b, them)
      };
    });

    var oppItems = opp.map(function (o) {
      var fk = o.facets.map(function (k) { return info(k).name; }).join(' and ');
      var k0 = o.facets[0];
      return {
        title: o.a.title + ' ↔ ' + o.b.title, category: o.a.category === o.b.category ? o.a.category : o.a.category + ' / ' + o.b.category,
        facets: fk,
        text: an + ' leans ' + poleLabel(k0, me.facets[k0]).toLowerCase() + ' where ' + bn + ' leans ' + poleLabel(k0, them.facets[k0]).toLowerCase() + ' on ' + info(k0).name + ' (' + Math.round(me.facets[k0]) + ' vs ' + Math.round(them.facets[k0]) + '). Each side has something the other lacks, and each has a risk the other can catch.',
        sides: [
          { who: an, trait: o.a.title, gift: o.a.strength, watch: o.a.challenge, tip: o.a.insight },
          { who: bn, trait: o.b.title, gift: o.b.strength, watch: o.b.challenge, tip: o.b.insight }
        ]
      };
    });

    function signature(p, t, other) {
      return top(t, 3).map(function (x) {
        return {
          title: x.title, category: x.category,
          text: 'Close to ' + p.name + ', this tends to show up as a gift and a cost. ' + other.name + ' is the one most likely to feel the cost first.',
          gift: x.strength, watch: x.challenge, help: x.insight,
          basis: describeFacets(x, p)
        };
      });
    }

    var sigA = signature(me, A, them), sigB = signature(them, B, me);

    var n1 = shared.length, n2 = opp.length;
    var headline, summary;
    if (n1 >= n2 + 2) {
      headline = 'Alike in how you operate';
      summary = 'You share ' + n1 + ' generated traits and have ' + (n2 || 'no') + ' sharply opposed ones. That makes understanding quick and also means you share blind spots, so check big decisions with someone different.';
    } else if (n2 >= n1 + 2) {
      headline = 'Different in how you operate';
      summary = 'You have ' + n2 + ' sharply opposed traits and share only ' + (n1 || 'no') + '. You will often see the same situation differently, which is where most of the value and most of the friction will come from.';
    } else {
      headline = 'A mix of common ground and contrast';
      summary = 'You share ' + n1 + ' trait' + (n1 === 1 ? '' : 's') + ' and are opposed on ' + n2 + '. Expect to agree easily on some things and need to translate for each other on others.';
    }
    summary += ' ' + pickBy(seed + 'close', [
      'These come from your self-reported facet scores, so read them as starting points for a conversation.',
      'Treat each line as a hypothesis to try out together, not a verdict on either of you.',
      'They describe tendencies from answers given at one moment, not fixed facts about either of you.'
    ]);

    return { headline: headline, summary: summary, shared: sharedItems, opposite: oppItems, signatures: [{ name: an, items: sigA }, { name: bn, items: sigB }],
             counts: { shared: n1, opposite: n2, traitsA: A.length, traitsB: B.length } };
  }

  /* ---------- group ---------- */
  function group(members) {
    var ms = members.filter(function (m) { return validFacets(m.facets); });
    var n = ms.length;
    if (n < 2) return null;
    var T = ms.map(traitsOf);

    // traits several members share (same facets, same poles)
    var bySig = {};
    T.forEach(function (list, mi) {
      list.forEach(function (t) {
        if (!t.sig) return;
        var g = bySig[t.sig] || (bySig[t.sig] = { sig: t.sig, members: [], sal: 0, t: t });
        g.members.push(mi); g.sal += t.sal;
      });
    });
    var groups = Object.keys(bySig).map(function (k) { return bySig[k]; });
    var minShare = n <= 3 ? 2 : Math.ceil(n / 2);
    var common = groups.filter(function (g) { return g.members.length >= minShare; })
      .sort(function (x, y) { return (y.members.length - x.members.length) || (y.sal / y.members.length - x.sal / x.members.length); })
      .slice(0, 5)
      .map(function (g) {
        var names = g.members.map(function (i) { return ms[i].name; });
        return { title: g.t.title, category: g.t.category, names: names, count: g.members.length, all: g.members.length === n,
                 strength: g.t.strength, challenge: g.t.challenge, insight: g.t.insight };
      });

    // collective watch-outs: a challenge held by several members is amplified
    var wo = {};
    common.forEach(function (c) { var k = c.challenge; (wo[k] = wo[k] || { text: c.challenge, titles: [], max: 0 }); wo[k].titles.push(c.title); wo[k].max = Math.max(wo[k].max, c.count); });
    var watchouts = Object.keys(wo).map(function (k) { return wo[k]; }).sort(function (a, b) { return b.max - a.max; }).slice(0, 3).map(function (w) {
      return { text: w.text, titles: w.titles, share: w.max };
    });

    // what only one member brings
    var unique = [];
    ms.forEach(function (m, mi) {
      var picks = T[mi].filter(function (t) { return t.sig && bySig[t.sig].members.length === 1; }).slice(0, 2);
      picks.forEach(function (t) { unique.push({ name: m.name, title: t.title, category: t.category, strength: t.strength, challenge: t.challenge, insight: t.insight, rank: t.rank, basis: describeFacets(t, m) }); });
    });
    unique.sort(function (a, b) { return a.rank - b.rank; });
    unique = unique.slice(0, Math.min(8, Math.max(4, n)));

    // sharpest opposite-trait tensions between any two members
    var tens = [];
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
      oppositeBetween(T[i], T[j]).slice(0, 2).forEach(function (o) { tens.push({ i: i, j: j, o: o }); });
    }
    tens.sort(function (x, y) { return y.o.weight - x.o.weight; });
    var seenPair = {}, tensions = [];
    tens.forEach(function (x) {
      var key = x.i + '-' + x.j; var f0 = x.o.facets[0];
      if (seenPair[key] || tensions.length >= 4) return;
      seenPair[key] = 1;
      tensions.push({
        a: ms[x.i].name, b: ms[x.j].name, aTitle: x.o.a.title, bTitle: x.o.b.title, facet: info(f0).name,
        text: ms[x.i].name + ' (' + poleLabel(f0, ms[x.i].facets[f0]).toLowerCase() + ', ' + Math.round(ms[x.i].facets[f0]) + ') and ' + ms[x.j].name + ' (' + poleLabel(f0, ms[x.j].facets[f0]).toLowerCase() + ', ' + Math.round(ms[x.j].facets[f0]) + ') sit at opposite ends here. ' +
          ms[x.i].name + ' brings ' + lc(x.o.a.title) + '; ' + ms[x.j].name + ' brings ' + lc(x.o.b.title) + '.'
      });
    });

    // where the group's trait weight sits
    var weight = {};
    T.forEach(function (list) { top(list, 5).forEach(function (t) { weight[t.category] = (weight[t.category] || 0) + 1; }); });
    var themes = Object.keys(weight).map(function (k) { return { category: k, count: weight[k] }; })
      .sort(function (a, b) { return (b.count - a.count) || (a.category < b.category ? -1 : 1); }).slice(0, 4);

    // each member's signature
    var signatures = ms.map(function (m, mi) { return { name: m.name, items: top(T[mi], 3).map(function (t) { return { title: t.title, category: t.category }; }) }; });

    var sharedCount = common.filter(function (c) { return c.all; }).length;
    var seed = ms.map(function (m) { return m.name; }).join('|');
    var headline = sharedCount >= 2 ? 'A group with a common core' : common.length ? 'Some overlap, plenty of variety' : 'A group of distinct profiles';
    var summary = common.length
      ? n + ' members share ' + common.length + ' recurring trait' + (common.length === 1 ? '' : 's') + (sharedCount ? ' (' + sharedCount + ' held by everyone)' : '') + ', and ' + unique.length + ' standout trait' + (unique.length === 1 ? ' is' : 's are') + ' held by only one person. '
      : 'No generated trait is shared by more than a couple of members, so the group is made of distinct profiles. ';
    summary += pickBy(seed + 'close', [
      'Read this as a map of tendencies drawn from self-reported scores, not a measure of how well anyone performs.',
      'These are hypotheses about how the group tends to work, to be tested in conversation.',
      'They describe composition from answers given at one moment, not fixed facts about anyone.'
    ]);

    return { headline: headline, summary: summary, members: n, common: common, watchouts: watchouts, unique: unique, tensions: tensions, themes: themes, signatures: signatures };
  }

  return { pair: pair, group: group, traitsOf: traitsOf, validFacets: validFacets };
})();
