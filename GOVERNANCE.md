# Governance after launch (Phase 8)

## Roles (fill in; a one-person project still needs a second pair of eyes)
| Role | Person |
|---|---|
| Owner (decisions, claims, privacy) | Aryan |
| Second reviewer (scoring, security, claims changes) | ______ (name one: mentor, peer or professor) |
| Incident owner | ______ (see INCIDENT_RESPONSE.md) |

## Cadence
- **During beta:** review defects and feedback weekly.
- **After launch:** monthly quality review, 30 minutes: errors (logs/telemetry), defects, user feedback themes, support emails, dependency alerts, claims check. Write 5 lines in `CHANGELOG.md`.
- **Quarterly:** restore drill, RLS test on staging, Lighthouse run, re-read `CLAIMS.md` against current copy and any new evidence.

## Defect handling
| Severity | Meaning | Response |
|---|---|---|
| S1 | Data exposure/loss, broken core flow | Roll back or hotfix within 24 h; incident record |
| S2 | Wrong or misleading output, security/privacy weakness | Fix within 14 days or accept in writing with owner + expiry |
| S3 | Polish | Backlog, review quarterly |
Every open defect has an owner and a due date in `DEFECTS.md`. A release is blocked by any open S1/S2 (gate S0).

## Change control (these need the second reviewer, enforced by `.github/CODEOWNERS` and the PR template)
1. **Scoring, questions, archetypes**: golden fixtures reviewed in the diff; scoring version bumped; `npm run snapshot` diff read.
2. **Narrative, insight catalogue, prompts, copy that changes wording**: `npm run snapshot` diff read; if wording changed, repeat the human review on the changed insights (`npm run review-sheet`, `npm run review-score`) before release.
3. **Schema or saved-result format**: bump `schema`; old results must still load (`tests/schema.test.js`).
4. **SQL, RLS, auth settings**: run on staging, run `rls.test.sql`, keep migrations additive, record the output in `docs/evidence/`.
5. **Product claims** (anything that says what PRISM can do): checked against `CLAIMS.md` and `VALIDATION_PLAN.md`; stronger claims need evidence from a completed study, written down.
6. **Dependencies and CDN scripts**: pinned versions; SRI for third-party scripts (D32); `npm audit` reviewed.

## Versioning and explainability
Each saved result stores `versions` (scoring, questions, archetypes, narrative, quality); each insight carries `engineVersion`. To explain an old report: look up those versions in git tags (`vX.Y.Z`) and `CHANGELOG.md`. Never delete a tag that shipped.

## Claims reassessment triggers
New validation data (positive or negative), a user or reviewer reporting a misreading, a change in what the product does, or any complaint about hiring/selection use. Review within 14 days. Feedback ratings are a signal to investigate, not proof of accuracy.

## Releases and rollback
Follow `OPERATIONS.md` sections 5-6. Keep release notes in `CHANGELOG.md`, tag the commit, record the previous good Netlify deploy ID.
