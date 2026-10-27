'use strict';
/* Release gate evaluation (Phase 8). Pure: takes evidence + automatic results, returns per-gate status. A manual gate is met only with date, owner and evidence. */
const MANUAL = [
  ['Functional', 'F1', 'End-to-end browser tests (keyboard, axe audit, security) pass in CI on the release commit', 'CI run URL'],
  ['Functional', 'F2', 'Full production-like flow passed on staging: new account, assessment, report, reload, sync, sign-out, account switch, deletion (docs/MANUAL_E2E.md)', 'completed checklist'],
  ['Functional', 'F3', 'Supported browsers/devices tested (at least one iPhone Safari, one Android Chrome, one desktop Chrome, one desktop Firefox or Safari)', 'device list + results'],
  ['Analysis quality', 'Q1', 'Human review of the fixed evaluation set passed the rubric (docs/beta/review-result.md says PASS for the current engine/catalogue version)', 'review-result.md'],
  ['Security/privacy', 'S1', 'phase5-hardening.sql and rls.test.sql run successfully on a staging project configured like production', 'SQL editor output'],
  ['Security/privacy', 'S2', 'phase5-hardening.sql applied to PRODUCTION; "Confirm email" is ON in production Auth settings', 'screenshot of settings + run output'],
  ['Security/privacy', 'S3', 'Privacy notice, retention periods (incl. backups), deletion process and a named incident owner exist and the owner has reviewed them (D3, D46)', 'privacy.html + owner sign-off'],
  ['Accessibility', 'A1', 'Critical journeys checked with at least one real screen reader (VoiceOver or NVDA/TalkBack) and keyboard only', 'tester notes'],
  ['Operations', 'O1', 'Frontend rollback drill completed on staging', 'drill log row'],
  ['Operations', 'O2', 'Backup plan confirmed and restore drill into an empty project completed (incl. RLS test on the restored project)', 'drill log row'],
  ['Operations', 'O3', 'Monitoring decision recorded: remote error telemetry enabled (with CSP + privacy update) OR documented alternative with an owner who checks logs weekly', 'decision in OPERATIONS.md'],
  ['Operations', 'O4', 'Lighthouse mobile (Slow 4G, 4x CPU) run on staging; LCP <= 2.5 s and TBT <= 300 ms or accepted exceptions recorded', 'Lighthouse report'],
  ['Product claims', 'C1', 'Owner has read every user-facing string against docs/CLAIMS.md and approves (landing text, results, science page, exports, store/marketing copy)', 'owner sign-off'],
  ['Beta', 'B1', 'Beta completed: >= 12 consented participants finished the assessment and the comprehension quiz (docs/BETA_PLAN.md)', 'anonymised results sheet'],
  ['Beta', 'B2', 'Beta thresholds met: comprehension, usefulness, example-giving, no one reports being misled about clinical validity (thresholds in BETA_PLAN.md, fixed BEFORE the beta)', 'beta summary'],
  ['Beta', 'B3', 'Beta defects triaged: no open S1/S2 from beta; each remaining item has owner and due date', 'DEFECTS.md']
];
const AUTO = [
  ['Functional', 'F0', 'Unit, integration, security-static and policy tests pass (npm test)'],
  ['Analysis quality', 'Q2', 'Insight output on the fixed evaluation set matches the reviewed snapshot'],
  ['Operations', 'O5', 'Performance budgets met (npm run perf)'],
  ['Security/privacy', 'S0', 'No open S1 (critical) or S2 (high) defects in docs/DEFECTS.md'],
  ['Product claims', 'C0', 'Claims lint passes (part of npm test)']
];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function openSevere(defectsText) {
  const rows = String(defectsText || '').split('\n').filter(l => /^\|\s*D\d+\s*\|/.test(l));
  return rows.map(l => l.split('|').map(s => s.trim())).filter(c => (c[2] === 'S1' || c[2] === 'S2') && /^\*\*Open/i.test(c[4] || c[c.length - 2] || '')).map(c => c[1] + ' (' + c[2] + ')');
}

function evaluate(evidence, auto, defectsText) {
  const rows = [], byId = {}; (evidence.gates || []).forEach(g => { byId[g.id] = g; });
  AUTO.forEach(([group, id, text]) => {
    let ok = !!auto[id], detail = ok ? 'passed' : 'failed or not run';
    if (id === 'S0') { const open = openSevere(defectsText); ok = open.length === 0; detail = ok ? 'none open' : open.length + ' open: ' + open.join(', '); }
    rows.push({ group, id, text, kind: 'auto', met: ok, detail });
  });
  MANUAL.forEach(([group, id, text, need]) => {
    const e = byId[id]; let met = false, detail = 'no evidence recorded (needs: ' + need + ')';
    if (e && e.status === 'met') {
      const missing = []; if (!DATE.test(e.date || '')) missing.push('date'); if (!e.by) missing.push('by'); if (!e.evidence) missing.push('evidence');
      if (missing.length) detail = 'marked met but missing ' + missing.join(', ');
      else { met = true; detail = e.date + ' by ' + e.by + (e.attached === false ? ' (evidence not attached yet)' : ''); }
    } else if (e && e.note) detail = e.note;
    rows.push({ group, id, text, kind: 'manual', met, detail, unattached: !!(e && e.status === 'met' && e.attached === false) });
  });
  const open = rows.filter(r => !r.met);
  return { rows, open: open.length, ready: open.length === 0 };
}
function render(res) {
  let md = '| Gate | ID | Status | Detail |\n|---|---|---|---|\n';
  res.rows.forEach(r => { md += '| ' + r.group + ' | ' + r.id + ' | ' + (r.met ? 'MET' : 'OPEN') + ' | ' + r.text.replace(/\|/g, '/') + ' — ' + r.detail.replace(/\|/g, '/') + ' |\n'; });
  return md + '\n**Release decision: ' + (res.ready ? 'all gates met' : 'NOT READY — ' + res.open + ' gate(s) open') + '**\n';
}
module.exports = { MANUAL, AUTO, evaluate, render, openSevere };
