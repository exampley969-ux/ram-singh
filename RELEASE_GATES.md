# Release gates and launch decision (Phase 8)

Run `cd psyche-core && npm run gates` for the live table (it runs the automatic checks and reads `docs/release-evidence.json`). `npm run gates:report` writes `docs/RELEASE_STATUS.md` without failing. **A gate is met only when the check was actually done and evidence is recorded** (date, owner, evidence). Code existing is not evidence.

| Roadmap gate | Gate ids |
|---|---|
| Functional | F0 (auto), F1, F2 (`MANUAL_E2E.md`), F3 |
| Analysis quality | Q1 (human review: `npm run review-sheet`, reviewers fill CSVs, `npm run review-score -- a.csv b.csv --out ../docs/beta/review-result.md`), Q2 (auto snapshot) |
| Security/privacy | S0 (auto: no open S1/S2), S1, S2, S3 |
| Accessibility | A1 |
| Operations | O1-O4, O5 (auto) |
| Product claims | C0 (auto), C1 |
| Beta | B1-B3 (`BETA_PLAN.md`) |

## How to record evidence
Edit `docs/release-evidence.json`: `{ "id": "O1", "status": "met", "date": "YYYY-MM-DD", "by": "name", "evidence": "what/where", "attached": true }`. Store screenshots/outputs in `docs/evidence/`. Mark `attached:false` if you are reporting a result without the proof yet; it stays visible in the report.

## Launch decision record (copy per release candidate)
```
Release candidate: vX.Y.Z   commit: ________   date: ________
Gate status: all met / exceptions below
Exceptions accepted (id, reason, owner, expiry date): ________
Rollback target (Netlify deploy ID): ________
Decision: GO / NO-GO     Owner: ________     Second reviewer: ________
```
A controlled public release means: every gate met, or each exception written down with an owner and an expiry. "Controlled" = small audience first, monitored, easy to roll back.
