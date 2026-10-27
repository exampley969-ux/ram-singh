'use strict';
/* Phase 7 tests: comparison wording, consent scope, small-group advisory, selectable report export, no raw answers. Run: node tests/phase7.test.js */
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const P = require('../share-policy.js');
const DIR = path.join(__dirname, '..'); const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
let n = 0; const ok = () => { n++; };

// ---- group size advisory ----
assert.equal(P.groupAdvisory(0).show, false); assert.equal(P.groupAdvisory(1).show, false); ok();
assert.equal(P.groupAdvisory(2).tier, 'pair'); assert.match(P.groupAdvisory(2).text, /pair comparison/); ok();
[3, 4].forEach(k => { const a = P.groupAdvisory(k); assert.equal(a.tier, 'small'); assert.ok(a.text.includes(String(k)) && /conversation starters/.test(a.text)); }); ok();
assert.equal(P.groupAdvisory(5).tier, 'ok'); assert.equal(P.groupAdvisory(40).tier, 'ok'); assert.equal(P.groupAdvisory('x').show, false); ok();
assert.ok(!/best|worst|reliable|unreliable/i.test(P.groupAdvisory(4).text + P.groupAdvisory(30).text)); ok();

// ---- wording: similarity != compatibility, no hiring use, honest consent limits ----
assert.match(P.SIMILARITY_NOTE, /not guarantee/); assert.match(P.SIMILARITY_NOTE, /questions to talk through/); ok();
assert.match(P.USE_LIMITS, /Not for hiring, promotion, selection or exclusion/); ok();
assert.match(P.SCOPE_TEXT, /never shares your individual answers/); assert.match(P.SCOPE_TEXT, /at any time/); assert.match(P.SCOPE_TEXT, /cannot take back anything someone has already seen/); ok();

// ---- sections ----
assert.deepEqual(P.normalizeSections(undefined), P.SECTIONS.map(s => s.key)); ok();
assert.deepEqual(P.normalizeSections(['deep', 'bogus', 'summary']), ['summary', 'deep']); ok();   // canonical order, unknown dropped
assert.deepEqual(P.normalizeSections([]), []); ok();
assert.ok(!P.SECTIONS.some(s => /answer/i.test(s.key + s.label)), 'raw answers must never be an exportable section'); ok();

// ---- meta ----
const meta = P.reportMeta({ versions: { scoring: '1.0.0', narrative: '1.1.0' } }, 'Individual', Date.UTC(2026, 9, 26));
assert.equal(meta.date, '2026-10-26'); assert.match(meta.versions, /scoring 1\.0\.0, narrative 1\.1\.0/); assert.match(meta.snapshot, /does not update/); ok();
const html = P.metaHTML(meta, s => String(s).replace(/</g, '&lt;'));
['Report details', 'engine versions', 'Method.', 'Limits.', 'not a diagnosis', 'answers are not included'].forEach(t => assert.ok(html.includes(t), 'meta missing: ' + t)); ok();
assert.match(P.reportMeta({}, 'x').versions, /unknown/); ok();

// ---- raw answer guard ----
assert.ok(P.containsRawAnswers({ result: { ans: [1] } })); assert.ok(P.containsRawAnswers([{ a: { answers: [] } }])); assert.ok(!P.containsRawAnswers({ dims: { P: 50 }, facets: {} })); assert.ok(!P.containsRawAnswers(null)); ok();

// ---- static wiring checks ----
const app = rd('app-core.js'), auth = rd('auth.js'), idx = rd('index.html');
assert.ok(idx.indexOf('share-policy.js') > -1 && idx.indexOf('share-policy.js') < idx.indexOf('app-core.js')); ok();
assert.ok(/withoutAnswers\(state\.result\)/.test(app) && /delete c\.ans/.test(app), 'cloud sync strips answers'); ok();
const saveProfile = auth.slice(auth.indexOf('saveProfile:'), auth.indexOf('deleteProfile:'));
const rowKeys = [...saveProfile.match(/var row = \{[\s\S]*?\};/)[0].matchAll(/(\w+):/g)].map(m => m[1]);
P.NEVER_SHARED.forEach(k => assert.ok(!rowKeys.includes(k), 'shared profile row must not contain ' + k)); ok();
P.SHARED_FIELDS.forEach(k => assert.ok(rowKeys.includes(k), 'shared profile row should contain ' + k)); ok();
assert.ok(/similarity<\/span>/.test(app) && !/>compatibility<\/span>/.test(app), 'headline ring is labelled similarity'); ok();
assert.ok(/Similarity is not compatibility/.test(app) && /PROFILE SIMILARITY/.test(app)); ok();
assert.ok((app.match(/PsychePolicy\.SCOPE_TEXT/g) || []).length >= 3, 'consent scope shown on invitation, group join and share link'); ok();
assert.ok(/PsychePolicy\.groupAdvisory\(members\.length\)/.test(app) && /PsychePolicy\.USE_LIMITS/.test(app), 'group screen and PDF carry advisory + use limits'); ok();
assert.ok(/<fieldset/.test(app) && /data-exp=/.test(app) && /Choose at least one section/.test(app), 'export section chooser + empty selection guard'); ok();

// ---- rendered report respects the selection (jsdom) ----
let JSDOM, VirtualConsole; try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { console.log('SKIP jsdom report checks'); console.log('Phase 7 tests passed (' + n + ' assertions, jsdom part skipped).'); process.exit(0); }
const FILES = ['config.js', 'ops.js', 'privacy-local.js', 'share-policy.js', 'auth.js', 'core-logic.js', 'profile-schema.js', 'text-dedupe.js', 'implications_data.js', 'deep-analysis.js', 'traits-engine.js', 'engine-plus.js', 'group-insights.js', 'social-plus.js', 'trait-duo.js', 'intelligence-engine.js', 'ux.js', 'app-core.js'];
const vc = new VirtualConsole(); const errs = []; vc.on('jsdomError', e => { if (!/scrollTo|Not implemented/.test(e.message)) errs.push(e.message); });
const dom = new JSDOM(rd('index.html').replace(/<script src="[^"]*"><\/script>/g, ''), { url: 'http://localhost:8000/', runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
const w = dom.window; w.__PSYCHE_TEST__ = true; FILES.forEach(f => w.eval(rd(f)));
assert.deepEqual(errs, []); ok();
const T = w.__PSYCHE_TEST__; const result = JSON.parse(JSON.stringify(w.ProfileSchema.build(Array.from({ length: 40 }, (_, i) => 1 + ((i * 7) % 5)))));
const full = T.buildFullReportHTML(result, result.match);
const some = T.buildFullReportHTML(result, result.match, ['deep']);
const none = T.buildFullReportHTML(result, result.match, []);
['Deep analysis', 'Career fit', 'In relationships', 'Twenty traits about you', 'Signature traits'].forEach(h => assert.ok(full.includes(h), 'full report missing ' + h)); ok();
assert.ok(some.includes('Deep analysis') && !some.includes('Career fit') && !some.includes('Twenty traits about you') && !some.includes('Signature traits'), 'unticked sections are left out'); ok();
[full, some, none].forEach(h => { assert.ok(h.includes('Report details') && h.includes('engine versions: scoring 1.0.0') && h.includes('Limits.') && h.includes('does not update'), 'every export carries date/version/method/limits/snapshot notice'); }); ok();
assert.ok(!/preport-section/.test(none), 'empty selection exports no content sections'); ok();
const answersText = JSON.stringify(result.ans || []);   // the saved result keeps answers on-device; they must not appear in any export
assert.ok(!full.includes('"ans"') && !/answers: \[/.test(full)); ok();
w.close();
console.log('Phase 7 tests passed (' + n + ' assertions).');
