# Feature status (Phase 0)

Labels: **Verified** = exercised by an automated test in this repo · **Implemented** = code present, only source-reviewed ·
**Config-dependent** = needs a live Supabase project · **Unverified** = claimed in README, no test in repo.

| Feature | Status | Evidence / note |
|---|---|---|
| 40-question assessment, scoring, archetype match | Verified | tests/scoring.test.js: 69 golden cases generated from `v0-baseline` match exactly; boundary tests |
| Profile schema + validation (local, cloud) | Verified | tests/schema.test.js, tests/integration.test.js |
| Profile dynamics (insight pipeline v2, feedback) | Verified | tests/intelligence-engine.test.js, eval.test.js, integration.test.js. Human review of insight quality NOT yet done (docs/EVALUATION_RUBRIC.md) |
| Report text de-duplication | Verified | tests/dedupe.test.js |
| Generated traits (individual) | Implemented | README cites a 500-profile test not present in repo |
| Generated traits (pair, group) | Verified | tests/trait-duo.test.js; jsdom render check |
| Deep Analysis, Career, Relationship | Implemented | README cites jsdom stress tests not present in repo |
| Archetype library (36) | Implemented | Label stability unmeasured; simulation suggests low (DEFECTS D15) |
| Response quality v2 (aligned consistency) | Verified | tests/psychometrics.test.js |
| Psychometric QA tooling (item, scale, retest) | Verified | tests/psychometrics.test.js; code correctness only, no real-data results |
| Reliability, structure, validity, fairness of PRISM | Unverified | No study run; see VALIDATION_PLAN.md |
| Claims register + guard | Verified | tests/claims.test.js |
| Engine Plus (patterns, pair lens, group roles/scenarios) | Implemented | |
| Compatibility, Deep compatibility, Group tabs | Implemented | |
| PDF export | Implemented | browser print only; not tested |
| Share cards (canvas) | Implemented | |
| Local-only mode (no account) | Implemented | |
| Email/Google auth, reset, change password | Config-dependent | |
| Cloud result sync | Config-dependent | newest copy wins; no validation (see DEFECTS D1) |
| Connections / groups / invitations | Config-dependent | RLS unverified |
| Account deletion (`delete_my_account`) | Config-dependent | not tested against deployed DB |
| Scientific breakdown page | Implemented | states no validation study exists |
| Privacy / Terms pages | Implemented | see DEFECTS D3 |
| Onboarding, save/resume, skipped-question review | Verified | tests/ux.test.js (jsdom) |
| Keyboard-only core journey (home to result to tabs) | Verified | tests/e2e/keyboard.js, real Chromium |
| Automated accessibility (axe WCAG 2.2 AA) and reflow at 320-1280px | Verified | tests/e2e/audit.js; signed-out screens only |
| Screen-reader support (NVDA/JAWS/VoiceOver/TalkBack) | Unverified | manual checklist in docs/UX_A11Y.md; not run |
| Performance, offline | Unverified | offline banner only; no service worker; Phase 6 |
| Account switching, sign-out, deletion (client side) | Implemented (Phase 5), browser-tested against a fake backend | real-backend behaviour unverified |
| Hardened database policies and functions | Written (`phase5-hardening.sql`), **not applied or executed** | needs staging |
| CSP / referrer policy | Implemented (meta) and enforced in Chromium | production headers and SRI pending |

## Product boundary
Self-reflection and educational insight only. Not diagnosis, not hiring/selection, not a prediction of behaviour.
PRISM is described as a "structured self-reflection framework" until Phase 3 evidence exists.
