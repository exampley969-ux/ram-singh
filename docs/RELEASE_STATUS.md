# Release status

Generated 2026-10-26 from `tools/release-gates.js`. Manual gates are met only with date, owner and evidence in `docs/release-evidence.json`.

| Gate | ID | Status | Detail |
|---|---|---|---|
| Functional | F0 | MET | Unit, integration, security-static and policy tests pass (npm test) — passed |
| Analysis quality | Q2 | MET | Insight output on the fixed evaluation set matches the reviewed snapshot — passed |
| Operations | O5 | MET | Performance budgets met (npm run perf) — passed |
| Security/privacy | S0 | OPEN | No open S1 (critical) or S2 (high) defects in docs/DEFECTS.md — 8 open: D28 (S2), D32 (S2), D46 (S2), D3 (S2), D48 (S2), D49 (S2), D57 (S2), D61 (S2) |
| Product claims | C0 | MET | Claims lint passes (part of npm test) — passed |
| Functional | F1 | OPEN | End-to-end browser tests (keyboard, axe audit, security) pass in CI on the release commit — no evidence recorded (needs: CI run URL) |
| Functional | F2 | OPEN | Full production-like flow passed on staging: new account, assessment, report, reload, sync, sign-out, account switch, deletion (docs/MANUAL_E2E.md) — no evidence recorded (needs: completed checklist) |
| Functional | F3 | OPEN | Supported browsers/devices tested (at least one iPhone Safari, one Android Chrome, one desktop Chrome, one desktop Firefox or Safari) — no evidence recorded (needs: device list + results) |
| Analysis quality | Q1 | OPEN | Human review of the fixed evaluation set passed the rubric (docs/beta/review-result.md says PASS for the current engine/catalogue version) — no evidence recorded (needs: review-result.md) |
| Security/privacy | S1 | MET | phase5-hardening.sql and rls.test.sql run successfully on a staging project configured like production — 2026-10-26 by Aryan (owner-reported) (evidence not attached yet) |
| Security/privacy | S2 | OPEN | phase5-hardening.sql applied to PRODUCTION; "Confirm email" is ON in production Auth settings — no evidence recorded (needs: screenshot of settings + run output) |
| Security/privacy | S3 | OPEN | Privacy notice, retention periods (incl. backups), deletion process and a named incident owner exist and the owner has reviewed them (D3, D46) — no evidence recorded (needs: privacy.html + owner sign-off) |
| Accessibility | A1 | OPEN | Critical journeys checked with at least one real screen reader (VoiceOver or NVDA/TalkBack) and keyboard only — no evidence recorded (needs: tester notes) |
| Operations | O1 | OPEN | Frontend rollback drill completed on staging — no evidence recorded (needs: drill log row) |
| Operations | O2 | OPEN | Backup plan confirmed and restore drill into an empty project completed (incl. RLS test on the restored project) — no evidence recorded (needs: drill log row) |
| Operations | O3 | OPEN | Monitoring decision recorded: remote error telemetry enabled (with CSP + privacy update) OR documented alternative with an owner who checks logs weekly — no evidence recorded (needs: decision in OPERATIONS.md) |
| Operations | O4 | OPEN | Lighthouse mobile (Slow 4G, 4x CPU) run on staging; LCP <= 2.5 s and TBT <= 300 ms or accepted exceptions recorded — no evidence recorded (needs: Lighthouse report) |
| Product claims | C1 | OPEN | Owner has read every user-facing string against docs/CLAIMS.md and approves (landing text, results, science page, exports, store/marketing copy) — no evidence recorded (needs: owner sign-off) |
| Beta | B1 | OPEN | Beta completed: >= 12 consented participants finished the assessment and the comprehension quiz (docs/BETA_PLAN.md) — no evidence recorded (needs: anonymised results sheet) |
| Beta | B2 | OPEN | Beta thresholds met: comprehension, usefulness, example-giving, no one reports being misled about clinical validity (thresholds in BETA_PLAN.md, fixed BEFORE the beta) — no evidence recorded (needs: beta summary) |
| Beta | B3 | OPEN | Beta defects triaged: no open S1/S2 from beta; each remaining item has owner and due date — no evidence recorded (needs: DEFECTS.md) |

**Release decision: NOT READY — 16 gate(s) open**
