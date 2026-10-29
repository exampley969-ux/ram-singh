/* Claims guard (Phase 3): user-facing copy must not exceed the evidence in docs/CLAIMS.md. Run: node tests/claims.test.js */
const fs = require('fs'), path = require('path'), assert = require('assert');
const DIR = path.join(__dirname, '..');
const FILES = ['index.html', 'privacy.html', 'terms.html', 'app-core.js', 'traits-engine.js', 'core-logic.js', 'deep-analysis.js', 'engine-plus.js', 'tools-lazy.js',
  'intelligence-engine.js', 'group-insights.js', 'social-plus.js', 'trait-duo.js', 'implications_data.js', 'ux.js'];
const NEG = /\b(not|no|nor|never|without|isn'?t|doesn'?t|don'?t|cannot|can'?t|neither|has not|hasn'?t|rather than)\b|\\u2019t/i;
// always banned in user-facing copy
const BANNED = [
  [/scientifically\s+(validated|proven|backed|verified)/i, 'claims scientific validation'],
  [/clinically\s+(validated|proven|tested|backed)/i, 'claims clinical validation'],
  [/\b(reveals?|uncovers?|discovers?|shows?)\s+(your|the)\s+(true|real|authentic)\s+(self|you|personality)\b/i, 'claims to reveal a true self'],
  [/\byour\s+true\s+self\b/i, 'true-self language'],
  [/\bpredicts?\s+(your\s+)?((career|job|relationship|team)\s+)?success\b/i, 'claims to predict success'],
  [/same\s+(basic\s+)?architecture\s+as/i, 'claims the same architecture as established models'],
  [/standard\s+psychometric\s+practice/i, 'claims standard psychometric practice'],
  [/\b(this|the)\s+(tool|test|assessment|app|instrument|report)\b[^.]{0,60}genuinely\s+useful/i, 'asserts the tool is useful without evidence'],
  [/\b(accurate|precise)ly\s+(measures?|captures?|describes?)\s+(you|your)\b/i, 'claims accuracy'],
  [/\bproven\s+(by\s+science|accurate|reliable)\b/i, 'claims proof']
];
// allowed only when the same sentence negates or disclaims
const NEGATED_ONLY = [
  [/\bdiagnos(e|es|ed|is|tic)\b/i, 'diagnosis language'],
  [/\bvalidated\b/i, 'validation language'],
  [/\bclinical(ly)?\b/i, 'clinical language'],
  [/\bscientific(ally)?\b/i, 'scientific language']
];
const ALLOW_CONTEXT = /Scientific breakdown|The science|Scientific\)|scientific-breakdown|data-act="science|SCIENTIFIC BREAKDOWN|eb">Scientific|'science'|scientific_|sciTab|\bscience\b.*tab/i;
let n = 0, problems = [];
FILES.forEach(f => {
  // comments are developer text, not user-facing copy: blank them out but keep line numbers
  const text = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/^\s*\/\/.*$/gm, '');
  text.split(/\n/).forEach((line, i) => {
    BANNED.forEach(b => { if (b[0].test(line)) problems.push(f + ':' + (i + 1) + ' ' + b[1] + ': ' + line.trim().slice(0, 140)); });
    line.split(/(?<=[.!?])\s+|\\u2014|<\/p>|<p[^>]*>/).forEach(sentence => {
      NEGATED_ONLY.forEach(b => { if (b[0].test(sentence) && !NEG.test(sentence) && !ALLOW_CONTEXT.test(sentence)) problems.push(f + ':' + (i + 1) + ' ' + b[1] + ' without disclaimer: ' + sentence.trim().slice(0, 140)); });
    });
    n++;
  });
});
assert.deepStrictEqual(problems, [], 'Unsupported claims in user-facing copy:\n' + problems.join('\n'));
// required disclaimers exist
const app = fs.readFileSync(path.join(DIR, 'app-core.js'), 'utf8');
assert.ok(/not a (validated|diagnostic)/i.test(app) || /no clinical validation/i.test(fs.readFileSync(path.join(DIR, 'terms.html'), 'utf8')), 'limitations statement present');
assert.ok(/self-reflection/i.test(fs.readFileSync(path.join(DIR, 'terms.html'), 'utf8')), 'terms say self-reflection');
assert.ok(/not\s+(a\s+)?(medical|psychological|diagnostic)/i.test(fs.readFileSync(path.join(DIR, 'privacy.html'), 'utf8')), 'privacy page states non-clinical scope');
assert.ok(/Treat the archetype as a prompt for reflection/.test(app), 'archetype instability caveat present');
console.log('Claims tests passed (' + n + ' lines scanned in ' + FILES.length + ' files).');
