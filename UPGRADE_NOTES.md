# Psyche Core — Profile Intelligence Upgrade

## Included

- Added `psyche-core/intelligence-engine.js`, a deterministic cross-trait synthesis layer over the existing 20 PRISM facets.
- Added a **Profile dynamics** card to the existing Profile results tab.
- Each surfaced interpretation includes the two source scores, an evidence-strength label, an experiment to test the hypothesis, and a caveat explaining uncertainty.
- Uses existing response-quality metadata when present; explicitly discloses when only saved scores are available.
- Added `psyche-core/tests/intelligence-engine.test.js` for deterministic behavior, interaction ranking, balanced profiles, low-quality response flags, and missing/invalid input.
- Documented the upgrade in `psyche-core/README.md`.

- Added `psyche-core/trait-duo.js`: the generative trait engine applied to Compatibility (shared traits, opposite traits, signature traits) and Group (new Traits tab), plus PDF report sections and `tests/trait-duo.test.js`.

## Architecture preserved

No changes to the 40-question assessment, scoring formula, five PRISM dimensions, 20 facet definitions, 36 archetypes, Supabase authentication, database schema, or existing account flows. The new script is loaded after the existing analysis modules and before `app-core.js`.

## Verification performed

- `node tests/intelligence-engine.test.js` — passed.
- `node --check` — passed for `intelligence-engine.js`, `app-core.js`, `core-logic.js`, `traits-engine.js`, `engine-plus.js`, `group-insights.js`, and `social-plus.js`.

## Remaining before an industry-level launch

This is a completed first implementation slice, not a certification of the whole product. Still required: browser end-to-end tests on desktop/mobile, accessibility review, Supabase RLS and account-deletion verification against the deployed project, dependency/security review, privacy/data-retention review, performance checks, and a real validation study before presenting PRISM as a scientifically validated assessment.

## Roadmap execution
Phase 8 (beta and release governance: gate checker, human-review scoring, output snapshot, beta plan/consent/survey, manual E2E checklist, governance; **the beta, human review, drills and most gates are NOT done; `npm run gates` reports not ready**, see `docs/RELEASE_STATUS.md`). Phase 7 (comparison wording, consent scope, small-group advisory, selectable PDF sections with report metadata; **not built by design: hosted share links, remote metrics, anonymous-aggregate suppression; comprehension of the new wording is untested with users**, see `docs/SHARING_AND_GROUPS.md`). Phase 6 (performance, observability, resilience: `ops.js` redacted error reporting, coalesced + retried sync with offline recovery, CI-enforced performance budgets, `docs/OPERATIONS.md`; **rollback, restore and real-device performance drills are written but not yet run**). Phase 5 (security, privacy, data governance: client fixes for account switching, local-data wipe, enumeration, CSP, session revocation; hardening SQL and RLS test script **written but not executed**; data inventory, incident response, staging runbook; see `docs/SECURITY.md` and `docs/DEFECTS.md` D30-D47). Phase 4 (UX, accessibility, onboarding: onboarding screen, save/resume, skipped-question review, summary-first report, keyboard and contrast fixes; **automated checks only, no screen-reader testing yet**, see `docs/UX_A11Y.md`). Phases 0 (baseline), 1 (schema, validation, tests), 2 (insight pipeline, dedupe, docs; human review pending) and 3 (assessment QA tooling, construct and item docs, claims fixes, validation plan; **no validation study has been run**) are done — see `docs/CHANGELOG.md` and `docs/DEFECTS.md`.
