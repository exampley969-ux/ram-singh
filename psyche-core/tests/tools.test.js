/* Compatibility and group tools (engine-plus.js + page wiring). Run: node tests/tools.test.js (from psyche-core) */
const assert = require('node:assert/strict'), vm = require('vm'), fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
['core-logic.js', 'profile-schema.js', 'engine-plus.js', 'tools-lazy.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8') + '\n;', ctx, { filename: f }));
vm.runInContext('this.X = { EnginePlus, Engine, QUESTIONS }', ctx);
const { EnginePlus: E, Engine, QUESTIONS } = ctx.X; const J = x => JSON.parse(JSON.stringify(x));
const keys = Engine.facetKeys(); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const mk = (name, seed) => { const r = Engine.score(QUESTIONS.map((q, i) => 1 + ((i * seed + (i % 3) * (seed % 4)) % 5))); return { name, dims: r.dims, key: 'x', facets: r.facets }; };
const flat = Object.fromEntries(keys.map(k => [k, 50])), set = (o) => Object.assign({}, flat, o);
const ms = ['Asha', 'Ben', 'Chen', 'Dev', 'Eli', 'Fay'].map((nm, i) => mk(nm, 3 + i * 2)), a = ms[0], b = ms[1];

// pair what-if
const w0 = J(E.pairWhatIf(a.facets, b.facets, 'A', 'B', {}, {})); ok(w0.changed.length === 0 && w0.simBefore === w0.simAfter && w0.scenarios.every(s => s.delta === 0), 'no edit, no change');
const w1 = J(E.pairWhatIf(a.facets, b.facets, 'A', 'B', { 'P.curiosity': 100, 'X.no': 3, 'R.risk': 'abc' }, {})); ok(w1.changed.length <= 1 && !w1.changed.includes('R.risk'), 'unknown keys and non-numbers ignored');
const same = E.pairWhatIf(a.facets, b.facets, 'A', 'B', Object.fromEntries(keys.map(k => [k, b.facets[k]])), {}); ok(same.simAfter === 100, 'making A equal to B gives similarity 100');
ok(JSON.stringify(a.facets) === JSON.stringify(Engine.score(QUESTIONS.map((q, i) => 1 + ((i * 3 + (i % 3) * 3) % 5))).facets), 'inputs not mutated');
// covers
const cv = J(E.pairCovers(set({ 'P.curiosity': 90, 'R.risk': 90, 'M.drive': 10 }), set({ 'P.curiosity': 85, 'R.risk': 10, 'M.drive': 90 }), 'A', 'B'));
ok(cv.same.some(x => x.key === 'P.curiosity') && cv.cover.some(x => x.key === 'R.risk') && cv.cover.some(x => x.key === 'M.drive'), 'same lean vs cover');
ok(cv.open.length === 17 && cv.same.length + cv.cover.length + cv.open.length <= 20, 'balanced traits counted');
// forecast
const fc = J(E.pairForecast(set({ 'M.discipline': 95, 'M.persistence': 95 }), set({ 'M.discipline': 5, 'M.persistence': 5 }), 'A', 'B'));
ok(fc.top.length >= 1 && fc.top.length <= 3 && fc.top[0].hiName === 'A' && fc.top[0].gap >= 15, 'forecast names the higher scorer');
ok(E.pairForecast(flat, flat, 'A', 'B').top.length === 0, 'identical profiles: no flashpoint');
// recharge
ok(E.pairRecharge(set({ 'R.expression': 90, 'S.gregarious': 90 }), set({ 'R.expression': 90, 'S.gregarious': 90 }), 'A', 'B').match === 'same', 'same style');
ok(E.pairRecharge(set({ 'R.expression': 90, 'S.gregarious': 90 }), set({ 'R.expression': 10, 'S.gregarious': 10 }), 'A', 'B').match === 'opposite', 'opposite style');
ok(E.pairRecharge(set({ 'I.stability': 10 }), set({ 'I.stability': 90 }), 'A', 'B').lingerGap === true, 'stability gap flagged');
// leads
const ld = J(E.pairLeads(a.facets, b.facets, 'A', 'B')); ok(ld.rows.length === 8 && ld.countA + ld.countB + ld.either === 8, 'every situation has an owner or either');
ok(E.pairLeads(flat, flat, 'A', 'B').either === 8, 'identical: either leads all');
ok(E.pairLeads(set({ 'M.discipline': 95, 'M.persistence': 95, 'R.tempo': 95, 'P.attention': 5, 'S.warmth': 95, 'S.gregarious': 95, 'S.empathy': 95, 'P.abstraction': 95 }), flat, 'A', 'B').lopsided, 'one person leading nearly everything is flagged');

// group cover
const C = J(E.groupCover(ms)); ok(C.rows.length === 8 && C.rows.every(r => ['none', 'single', 'deep'].includes(r.state) && r.depth === r.champions.length), 'cover rows');
C.rows.filter(r => r.state === 'single').forEach(r => ok(!r.backup || (r.backup.name !== r.champions[0]), 'backup is someone else'));
ok(Object.values(C.load).reduce((x, y) => x + y, 0) === C.single.length, 'load adds up');
// fault
ok(E.groupFault(ms.slice(0, 2)).ok === false && E.groupFault(Array.from({ length: 15 }, (_, i) => mk('M' + i, 3 + i))).ok === false, 'size limits');
const camps = [0, 1, 2, 3].map(i => ({ name: 'H' + i, dims: a.dims, key: 'x', facets: set({ 'P.curiosity': 90 + i, 'M.discipline': 10 + i, 'S.warmth': 85 }) })).concat([0, 1, 2, 3].map(i => ({ name: 'L' + i, dims: a.dims, key: 'x', facets: set({ 'P.curiosity': 10 + i, 'M.discipline': 90 - i, 'S.warmth': 15 }) })));
const ft = J(E.groupFault(camps)); ok(ft.ok && ft.strength >= 0.9 && ft.label === 'clear split', 'two clear camps are found');
ok(ft.sideA.concat(ft.sideB).sort().join() === camps.map(m => m.name).sort().join() && (ft.sideA.every(x => x[0] === 'H') || ft.sideA.every(x => x[0] === 'L')), 'camps separated correctly');
ok(ft.drivers.length === 3 && ft.drivers[0].gap >= ft.drivers[2].gap, 'drivers ranked');
ok(E.groupFault(camps.map(m => ({ name: m.name, dims: m.dims, key: 'x', facets: flat }))).ok === false, 'identical members: nothing to split');
assert.deepEqual(J(E.groupFault(ms)), J(E.groupFault(ms))); n++;
// rotation
const rt = J(E.groupRotation(ms, 4)); ok(rt.plan.length === 4 && rt.roles.length === 4 && rt.plan.every(p => new Set(p.picks.map(x => x.who)).size === 4), 'distinct person per role each week');
ok(rt.plan[0].natural && !rt.plan[1].natural, 'week 1 is the natural fit');
const people = {}; rt.plan.forEach(p => p.picks.forEach(x => { (people[x.role] = people[x.role] || new Set()).add(x.who); })); ok(Object.values(people).every(s => s.size >= 3), 'roles actually rotate');
ok(J(E.groupRotation(ms.slice(0, 2), 4)).roles.length === 2, 'small groups get fewer roles');
// buddies
const bd = J(E.groupBuddies(ms)); ok(bd.ok && bd.pairs.length === 3 && !bd.third, 'even group: all paired');
const names = bd.pairs.flatMap(p => [p.a, p.b]); ok(new Set(names).size === 6, 'nobody twice');
const bo = J(E.groupBuddies(ms.slice(0, 5))); ok(bo.pairs.length === 2 && bo.third && !bo.pairs.some(p => [p.a, p.b].includes(bo.third.name)), 'odd group: a third joins a pair');
const sc = (x, y) => keys.reduce((t, k) => t + Math.max(0, Math.abs(x.facets[k] - y.facets[k]) - 20), 0), by = Object.fromEntries(ms.map(m => [m.name, m]));
const brute = (list) => { if (!list.length) return 0; let best = -1; for (let i = 1; i < list.length; i++) best = Math.max(best, sc(list[0], list[i]) + brute(list.filter((_, j) => j && j !== i))); return best; };
const dpVal = bd.pairs.reduce((t, p) => t + sc(by[p.a], by[p.b]), 0); ok(Math.abs(dpVal - brute(ms)) < 1e-6, 'buddy pairing equals the brute-force optimum');
ok(E.groupBuddies(ms.slice(0, 1)).ok === false, 'one person: not shown');
// group what-if
const g0 = J(E.groupWhatIf(ms, 0, {})); ok(g0.changed.length === 0 && g0.scenarios.every(s => s.delta === 0) && g0.faultBefore === g0.faultAfter, 'no edit, no change');
const g1 = J(E.groupWhatIf(ms, 0, { 'P.curiosity': 0, 'P.abstraction': 0, 'P.intuition': 0, 'ZZ': 1 })); ok(g1.changed.length <= 3 && g1.members.length === 6 && g1.roles.length === 8, 'what-if shape');
ok(g1.scenarios.some(s => s.delta !== 0) || g1.changed.length === 0, 'situation averages respond');

// page wiring
const app = fs.readFileSync(path.join(DIR, 'app-core.js'), 'utf8'), lazy = fs.readFileSync(path.join(DIR, 'tools-lazy.js'), 'utf8'), blk = lazy.slice(lazy.indexOf('/* ---------- Part 2'));
ok(blk.length > 1000, 'screens block found');
ok(!/localStorage|sessionStorage|persist\(|save\(|fetch\(|XMLHttpRequest|sendBeacon|PsycheOps/.test(lazy), 'tools never store or send anything');
ok(/compatToolsHTML\(mine, them\)/.test(app) && /groupToolsHTML\(members\)/.test(app) && /\['tools', 'Tools'\]/.test(app) && /TL\.wire\(\)/.test(app), 'wired into compare and group');
ok(/esc\(an\)/.test(blk) && /esc\(r\.name\)/.test(blk) && /esc\(p\.a\)/.test(blk), 'member names escaped');
ok(/Not for hiring/.test(blk), 'use limit stated');
// lazy loading contract
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8'), core = fs.readFileSync(path.join(DIR, 'engine-plus.js'), 'utf8');
ok(!/tools-lazy\.js/.test(html), 'tools are not loaded on first paint');
ok(/sc\.src = 'tools-lazy\.js'/.test(app) && /retrytools/.test(app) && /state: 'idle'/.test(app), 'loader, retry and idle state exist');
ok(!/whatIf|groupFault|pairForecast/.test(core), 'engine-plus.js no longer carries the lab/tools logic');
ok(fs.readFileSync(path.join(DIR, 'tools/build-static.sh'), 'utf8').includes('tools-lazy.js'), 'static build ships the lazy file');
ok(typeof ctx.X.EnginePlus.whatIf === 'function' && typeof ctx.X.EnginePlus.groupFault === 'function', 'tools attach to EnginePlus when loaded');
const host = { esc: x => String(x), segHTML: () => '', spCard: () => '', plusNote: () => '', traitChartSVG: () => '', traitKeyHTML: () => '', bandLabel: x => x, groupFacetMembers: m => m, groupFacetNote: () => '', ZSYM: {}, state: () => ({}) };
const c2 = { console, Math, JSON, Object, Array, String, Number, Date, document: { getElementById: () => null }, window: null }; c2.window = c2; c2.PsycheHost = host; vm.createContext(c2);
['core-logic.js', 'profile-schema.js', 'engine-plus.js', 'tools-lazy.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8') + '\n;', c2, { filename: f }));
ok(c2.PsycheTools && ['labHTML', 'compatHTML', 'groupHTML', 'wire'].every(k => typeof c2.PsycheTools[k] === 'function'), 'screens object built when the host exists');
console.log('Compatibility and group tools tests passed (' + n + ' assertions).');
