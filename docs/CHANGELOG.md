## Unreleased — Phase 8 (beta, release gates, governance)
- Added the release-gate checker (`npm run gates`): 5 automatic and 16 manual gates; a manual gate counts only with date, owner and evidence in `docs/release-evidence.json`. Current status: **not ready** (see `docs/RELEASE_STATUS.md`).
- Added human-review tooling: `npm run review-sheet` (blank, confidence-blind CSV per insight), `npm run review-score` (rubric gate: mean >= 3.5, no calibration/tone <= 2, no insight <= 2 from all reviewers, >= 2 reviewers, full coverage, agreement report).
- Added engine-output snapshot of the fixed evaluation set (`npm run snapshot`, `snapshot:update`); `npm test` fails when insight output changes without a reviewed update.
- Docs: `BETA_PLAN.md` (thresholds are proposals), `BETA_CONSENT.md` (template), `BETA_SURVEY.md`, `MANUAL_E2E.md`, `RELEASE_GATES.md`, `GOVERNANCE.md`; PR template and CODEOWNERS (replace the placeholder username).
- Fixed D58: `ops.js` event versions were always empty (called a function `ProfileSchema` does not export). New regression test uses the real page wiring.
- Defects: D45 closed for staging (hardening + RLS test run, owner-reported); new D57-D61 (D61: connections can read each other's email via the API).
- Tests: `tests/phase8.test.js` (28 groups). Scoring and insight output unchanged.

## Unreleased — Phase 7 (comparison, groups, export, sharing)
- Added `share-policy.js`: consent scope text, similarity-vs-compatibility note, small-group advisory (2 / 3-4 / 5+), no-hiring use limits, selectable report sections, report metadata (date, engine versions, method, limits, snapshot notice), raw-answer guard.
- Compatibility ring is now labelled "similarity", with an explicit "similarity is not compatibility" note (formula unchanged). Comparison PDF says "profile similarity".
- Consent text shown on connection invitations, group invitations and share links, including that already-seen data cannot be recalled. Share links note the 14-day expiry.
- Group screens and group PDF show the size advisory and use limits.
- Individual PDF has a section chooser; every PDF ends with date/versions/method/limits/snapshot notice and states that answers are not included.
- Docs: `SHARING_AND_GROUPS.md`, `PRODUCT_METRICS.md`; defects D53-D56. Tests: `tests/phase7.test.js` (31 assertions). Scoring output unchanged.

## Unreleased — Phase 6 (performance, observability and resilience)
- Added `ops.js` (v1.1.0): redacted error reporting (fixed event shape, no messages/answers/ids, in-memory only, remote send off by default), retry with backoff for transient failures only, coalesced/idempotent result sync, fallback helper.
- `pushResult` now coalesces duplicate saves, retries transient failures, aborts if the account changed, shows an "offline" state and resumes on the `online` event. Render failures and insight-engine fallbacks are reported (code only).
- Added `perf-budget.json` + `npm run perf` (bundle size and compute-time budgets), enforced in CI.
- Added `docs/OPERATIONS.md`: monitoring, budgets, rollback, backup/restore drill, release checklist, drill log. **No drill has been run yet.**
- Tests: `tests/ops.test.js` (31 assertions). Scoring output unchanged.

# Changelog

## Unreleased - Phase 5 (security, privacy, data governance)
- **Client fixes**: account-switch leak (D30); `PsychePrivacy` module + "Clear data on this device"; sign-out and account deletion wipe all personal local keys; sync pause after "Delete my saved copy"; sign-up no longer reveals existing emails; generic backend errors; other sessions revoked on password change; CSP and referrer meta tags; render errors logged without error objects or state.
- **Database (not yet applied or executed)**: `supabase/phase5-hardening.sql` - confirmed-email identity, shape/size constraints, quotas, 14-day invitation expiry, failed-guess throttle, atomic `delete_my_result()`, column-level write grants, safer `delete_my_account()`.
- **Tests**: `tests/security.test.js` (static), `tests/e2e/security.js` (62 browser checks with a fake Supabase), `supabase/tests/rls.test.sql` (staging, unexecuted). e2e Chromium lookup fixed for `chrome-linux`.
- **Docs**: data inventory with retention and deletion paths, security design and threat model, incident response, staging verification runbook, `SECURITY.md`, `security.txt`, CI and Dependabot config, privacy notice updated (device data, retention, incidents, no trackers).
- Scoring, items, facets, archetypes, insight engine and the existing Supabase schema files are unchanged.
- Not done: SRI hash, live RLS verification, header configuration, dependency audit, backup restore drill, owner decisions (D32, D43, D45-D47).

## Unreleased — Phase 4 (UX, accessibility, onboarding)
- **Onboarding**: first Start opens a "Before you start" screen (purpose, time, how answers are used, privacy, non-clinical boundary); home carries a short version. Time claim changed from "4 min" to "5-8 min (estimate)": neither figure has been timed with users.
- **Save / resume**: answers are saved on this device after every answer (`psyche_core_v1_draft`), offered as "Resume" on home, cleared on finish or "Start over". Corrupt drafts are ignored.
- **Skipped-question review** before the result, with jump-to-question; "See my result anyway" still allowed (result stays flagged incomplete).
- **Report structure**: Profile tab is now a Summary in the roadmap order (overall profile, strongest findings, profile dynamics, what you could try, method and limits). Each dimension opens to what it means, what it does not mean, and one thing to try. Other tabs are "go deeper".
- **Archetype close call (D15 mitigation)**: when one or two different answers would change the label, the result names the neighbouring archetypes. Uses the real `Engine.match`; no thresholds duplicated.
- **Accessibility**: skip link, landmarks, one h1 per screen, focus moves to the new heading / question, real ARIA tabs with arrow-key support, `aria-pressed` answer buttons with 1-5 shortcuts, all clickable cards/pills/links are keyboard operable, charts have text alternatives and band words (never colour alone), 44px targets, 12px minimum text, contrast fixes (`--I` light, `--P` dark, hero tint), forced-colors and reduced-motion handling.
- **States**: error boundary per screen, "no result yet", offline banner, "account unavailable" banner, persistent dismissible banner for unreadable saved data (was a 2-second toast).
- Tests: `ux.test.js` (64 checks), `e2e/keyboard.js`, `e2e/audit.js` (axe, 104 screen x theme x width combinations; 0 violations, 0 overflow). Scoring, items, facets and archetype rules unchanged (69 golden cases still identical).

## Unreleased — Phase 3 (assessment quality and validation tooling)
- **Fixed D14**: response-quality consistency now uses direction-aligned answers (quality 2.0.0). Changes displayed confidence and the "Mixed response signal" trigger; dimension/facet scores, archetype keys and straight-lining flags are unchanged (verified on 69 golden cases; golden file keeps `quality_v1` / `confidence_v1` and carries reviewed regenerated values). Saved results from before are re-derived from stored answers, or consistency is set to unknown.
- Added `docs/CONSTRUCTS.md`, `docs/ITEM_REVIEW.md` (+ `tools/item-review.json`), `docs/VALIDATION_PLAN.md`, `docs/CLAIMS.md`, `docs/ASSESSMENT_DESIGN_ANALYSIS.md`.
- Added `tools/psychometrics.js` (+ lib) for item/scale/retest analysis of consented data, and `tools/design-analysis.js` (seeded simulation).
- Product copy corrected (Scientific breakdown, README): no equivalence to Big Five/HEXACO, no "standard psychometric practice", no usefulness claim, score resolution and archetype instability disclosed.
- Tests: `psychometrics.test.js` (97 groups), `claims.test.js`. No change to items, scoring formula, dimensions, facets or archetype rules.

## Unreleased — Phase 2 (analysis intelligence)
- Insight pipeline v2 (`intelligence-engine.js`, engine 2.0.0 / catalogue 2.0.0): 8 documented rules x 4 states, evidence-linked, stable IDs, confidence separate from trait strength (never "high"), abstention, safety lint, one experiment with window and success signal per insight, local opt-in feedback.
- Profile dynamics card rebuilt: 3 shown + 2 on request, "Why am I seeing this?", abstention message, accuracy feedback (device-only, removable).
- Fixed a catalogue sentence that the safety lint was silently removing.
- Added `text-dedupe.js`; repeated sentences across the 20 traits, Deep Analysis and tabs removed (within-tab repeats ~16% to ~1-2%, cross-tab 0). Narrative version 1.1.0.
- Hypothesis labels on Deep Analysis, Career and Relationships.
- Docs: generated insight catalogue, content style guide, human evaluation rubric, reviewer pack generator. Fixed evaluation set (14 profiles) and test.

## Unreleased — Phase 1 (stable contracts and test foundation)
- Added `profile-schema.js`: versioned result schema (`schema: 1`, `versions`), pure `build(answers)`, `validate()` for saved/cloud results, `validateShared()` for shared profile rows.
- Saved and cloud results are now validated; unreadable data is never rendered, a rejected local copy is kept under `psyche_core_v1_rejected`, an invalid cloud copy never overwrites a valid local one. Derived fields (archetype, dimension consistency) are re-derived; answers that contradict the scores are dropped.
- Skipped questions are recorded (`skipped`) and shown as an "Incomplete assessment" notice. Scoring formula unchanged.
- Tests: `npm test` runs scoring/golden, schema, trait-duo, intelligence and jsdom integration tests.
- Scoring output verified identical to `v0-baseline` on 69 fixtures.

## Phase 0
- Tagged baseline `v0-baseline`; added docs/INVENTORY.md, FEATURE_STATUS.md, ACCEPTANCE.md, DEFECTS.md.
