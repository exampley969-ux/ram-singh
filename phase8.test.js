'use strict';
/* Phase 8 tests: review scoring gate, engine-output snapshot, release gate logic. Run: node tests/phase8.test.js */
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const L = require('../tools/review-lib'), G = require('../tools/gates-lib'), E = require('../tools/eval-run');
let n = 0; const ok = () => { n++; };

// ---- CSV ----
assert.deepEqual(L.parseCSV('a,b\n"x, y","say ""hi"""\r\n1,2'), [['a', 'b'], ['x, y', 'say "hi"'], ['1', '2']]); ok();
assert.equal(L.csvCell('a,b'), '"a,b"'); assert.equal(L.csvCell('plain'), 'plain'); ok();

// ---- review gate ----
const head = 'profile,insight_id,title,' + L.DIMS.join(',') + ',note\n';
const sheet = (rows) => head + rows.map(r => r.join(',')).join('\n') + '\n';
const row = (p, id, s) => [p, id, 'T'].concat(s, ['']);
const load = (txt, who) => L.loadSheet(txt, who);
const keys = ['p1|a', 'p1|b'];
const good = (v) => sheet([row('p1', 'a', Array(6).fill(v)), row('p1', 'b', Array(6).fill(v))]);
let a = L.analyze([load(good(4), 'r1'), load(good(4), 'r2')], keys);
assert.ok(a.pass, a.fails.join('; ')); assert.equal(a.agreementWithin1, 1); assert.equal(a.dims.tone.mean, 4); ok();
a = L.analyze([load(good(4), 'r1')], keys); assert.ok(!a.pass && a.fails.some(f => /at least 2 independent reviewers/.test(f))); ok();
a = L.analyze([load(good(3), 'r1'), load(good(3), 'r2')], keys); assert.ok(!a.pass && a.fails.some(f => /mean 3\.00 is below 3\.5/.test(f))); ok();
// one reviewer gives calibration 2 on one insight: blocking even when means are high
const lowCal = sheet([row('p1', 'a', [5, 5, 5, 5, 5, 2]), row('p1', 'b', Array(6).fill(5))]);
a = L.analyze([load(lowCal, 'r1'), load(good(5), 'r2')], keys); assert.ok(!a.pass && a.fails.some(f => /calibration <= 2 from a reviewer/.test(f))); ok();
// both reviewers rate an insight <=2 on a dimension: must be fixed/removed then re-reviewed
const bad = sheet([row('p1', 'a', [5, 5, 2, 5, 5, 5]), row('p1', 'b', Array(6).fill(5))]);
a = L.analyze([load(bad, 'r1'), load(bad, 'r2')], keys); assert.ok(!a.pass && a.flagged.length === 1 && /nonrepetition/.test(a.flagged[0])); ok();
// missing rows, invalid values, duplicate rows, unexpected rows, disagreement
a = L.analyze([load(sheet([row('p1', 'a', Array(6).fill(4))]), 'r1'), load(good(4), 'r2')], keys); assert.ok(a.fails.some(f => /r1 has not scored p1\|b/.test(f))); ok();
const invalid = load(sheet([row('p1', 'a', [4, 4, 4, 4, 4, 9]), row('p1', 'b', [4, 4, 4, 4, 4, ''])]), 'r1'); assert.equal(invalid.errors.length, 2); assert.ok(!L.analyze([invalid, load(good(4), 'r2')], keys).pass); ok();
const dup = load(sheet([row('p1', 'a', Array(6).fill(4)), row('p1', 'a', Array(6).fill(4))]), 'r1'); assert.ok(dup.errors.some(e => /duplicate/.test(e))); ok();
assert.ok(load('x,y\n1,2', 'r1').errors.some(e => /missing column/.test(e))); assert.ok(load('', 'r1').errors.length); ok();
a = L.analyze([load(good(4), 'r1'), load(sheet([row('p1', 'a', [4, 4, 4, 4, 4, 4]), row('p1', 'b', [4, 4, 4, 4, 4, 4]), row('p9', 'zzz', Array(6).fill(4))]), 'r2')], keys);
assert.ok(a.warns.some(w => /unexpected item/.test(w))); ok();
const dis = L.analyze([load(sheet([row('p1', 'a', [5, 5, 5, 5, 5, 5]), row('p1', 'b', Array(6).fill(5))]), 'r1'), load(sheet([row('p1', 'a', [2, 5, 5, 5, 5, 5]), row('p1', 'b', Array(6).fill(5))]), 'r2')], keys);
assert.equal(dis.disagreements.length, 1); assert.ok(dis.agreementWithin1 < 1); assert.match(L.report(dis), /Disagreements/); ok();
assert.match(L.report(L.analyze([load(good(4), 'r1'), load(good(4), 'r2')], keys)), /Result: PASS/); ok();
// the committed template covers exactly the engine output, has no confidence column and no scores filled in
const tpl = L.parseCSV(fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'beta', 'review-sheet-template.csv'), 'utf8'));
assert.ok(!tpl[0].some(h => /confidence/i.test(h)), 'reviewers must stay blind to confidence'); assert.ok(tpl.slice(1).every(r => r.slice(3, 9).every(c => c === '')), 'template must be blank'); ok();
const exp = []; E.runEval().cases.forEach(c => (c.out.insights || []).forEach(i => exp.push(c.name + '|' + i.id)));
assert.deepEqual(tpl.slice(1).map(r => r[0] + '|' + r[1]).sort(), exp.slice().sort(), 'review sheet is stale: run npm run review-sheet'); ok();

// ---- engine output snapshot (regression gate for every scoring/content/schema change) ----
const snap = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'eval-snapshot.json'), 'utf8')), now = E.snapshot();
assert.equal(now.engineVersion, snap.engineVersion, 'engine version changed: bump deliberately, review the diff, then npm run snapshot:update'); ok();
assert.deepEqual(now.versions, snap.versions); ok();
assert.equal(now.cases.length, snap.cases.length);
now.cases.forEach((c, i) => assert.deepEqual(c, snap.cases[i], 'insight output changed for "' + c.name + '". Review with `npm run snapshot`, re-run human review if wording changed, then `npm run snapshot:update`.')); ok();

// ---- release gates ----
const ev = (gates) => ({ gates });
const allAuto = { F0: true, Q2: true, O5: true, C0: true };
let r = G.evaluate(ev([]), allAuto, '| D1 | S3 | x | **Open** |');
assert.ok(!r.ready); assert.equal(r.rows.filter(x => x.kind === 'manual' && x.met).length, 0, 'manual gates are open without evidence'); ok();
r = G.evaluate(ev([{ id: 'S1', status: 'met' }]), allAuto, ''); assert.ok(!r.rows.find(x => x.id === 'S1').met && /missing date, by, evidence/.test(r.rows.find(x => x.id === 'S1').detail), 'met without evidence does not count'); ok();
r = G.evaluate(ev([{ id: 'S1', status: 'met', date: '26/10/2026', by: 'a', evidence: 'x' }]), allAuto, ''); assert.ok(!r.rows.find(x => x.id === 'S1').met, 'bad date format does not count'); ok();
r = G.evaluate(ev([{ id: 'S1', status: 'met', date: '2026-10-26', by: 'Aryan', evidence: 'output', attached: false }]), allAuto, ''); assert.ok(r.rows.find(x => x.id === 'S1').met && r.rows.find(x => x.id === 'S1').unattached); ok();
const all = G.MANUAL.map(m => ({ id: m[1], status: 'met', date: '2026-10-26', by: 'o', evidence: 'e' }));
assert.ok(G.evaluate(ev(all), allAuto, '| D1 | S3 | x | **Open** |').ready, 'ready only when every gate has evidence and autos pass'); ok();
assert.ok(!G.evaluate(ev(all), { F0: true, Q2: false, O5: true, C0: true }, '').ready, 'a failing automatic gate blocks release'); ok();
const defects = '| D1 | S1 | bad | **Open** - x |\n| D2 | S2 | bad | **Open - owner decision** |\n| D3 | S2 | fine | **Closed** |\n| D4 | S3 | minor | **Open** |\n| D5 | S2 | ok | **Mitigated** |';
assert.deepEqual(G.openSevere(defects), ['D1 (S1)', 'D2 (S2)']); assert.ok(!G.evaluate(ev(all), allAuto, defects).ready, 'open S1/S2 blocks release'); ok();
assert.ok(G.render(G.evaluate(ev([]), allAuto, '')).includes('NOT READY')); ok();
// the committed evidence file must not claim more than evidence supports
const committed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'release-evidence.json'), 'utf8'));
committed.gates.forEach(g => { assert.ok(G.MANUAL.some(m => m[1] === g.id), 'unknown gate id ' + g.id); if (g.status === 'met') assert.ok(g.date && g.by && g.evidence, g.id + ' marked met without date/by/evidence'); }); ok();

console.log('Phase 8 tests passed (' + n + ' groups).');
