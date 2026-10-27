# Product metrics (Phase 7) — what to measure, and how without watching people

**Principle:** measure usefulness and trust, not time spent. Nothing here is collected remotely today (`TELEMETRY_URL` is off, see OPERATIONS.md). Anything turned on needs: an entry in DATA_INVENTORY.md, a privacy-notice update, a CSP change, and an opt-in.

| Metric | Why | How to get it without personal data | Status |
|---|---|---|---|
| Assessment completion rate | Is the test too long/confusing? | Count of `assessment_started` and `assessment_completed` events with no user id; or manual count in beta | Not collected |
| Report comprehension | Do users understand what scores mean/do not mean? | 3-question quiz in the beta session, scored by the researcher | Beta task |
| Perceived usefulness / specificity | Are insights useful, not generic? | Beta survey (1-5 + one example they can recall); device-only insight feedback ratio, shared only if the user exports it | Beta task |
| Return use | Do people come back for a reason? | Beta interview; not tracked per user | Not collected |
| Error rate | Reliability | `ops.js` events (needs telemetry on) or Netlify/Supabase logs | Partly (logs only) |
| Deletion success | Trust | Manual test per release (STAGING_VERIFICATION.md) + support tickets | Manual |
| Misuse signals | Hiring/selection use of group features | Support emails, beta interviews | Manual |

**Do not optimise for:** session length, share counts, or "accuracy" ratings as proof of validity (feedback is user opinion, not ground truth; people tend to rate flattering text as accurate).
**Review cadence:** after each beta cohort, write 5 lines in CHANGELOG: what we learned, what we changed, what we did not change and why.
