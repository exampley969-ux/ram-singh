# Operations, performance and resilience (Phase 6)

Status legend: **Built** = in the repo and covered by tests. **Procedure written, not drilled** = you must run it once and record the date. Nothing here is marked done until the drill log at the bottom has an entry.

## 1. What is monitored (and what is deliberately not)

| Signal | How | Status |
|---|---|---|
| JavaScript errors, unhandled promise rejections | `ops.js` global handlers -> in-memory ring buffer (50 events) | Built |
| Render failures, insight-engine fallbacks, sync failures | `PsycheOps.report()` calls in `app-core.js` | Built |
| Remote collection of those events | Off by default. Set `TELEMETRY_URL` (https) in `config.js` **and** add its origin to `connect-src` in `index.html` | Built, opt-in, **not enabled** |
| Supabase auth / database errors | Supabase dashboard -> Logs (server side, not client) | Procedure below |
| Hosting errors / deploy failures | Netlify dashboard -> Deploys and Functions/Logs | Procedure below |

**Event shape (fixed, tested):** `id` (request id `r-xxxxxxxxxxxx`), `t`, `kind`, `name` (allowlisted error type), `code` (short slug), `at` (`file.js:line` only), `screen`, `online`, `app` (app version), `v` (scoring/questions/archetypes/narrative/quality versions).
**Never recorded:** error messages, answers, scores, names, emails, user ids, URLs, query strings, stack arguments. `tests/ops.test.js` feeds secrets into every field and fails if any survive. Adding a field to the event is a reviewed decision.
Flood control: identical events are capped at 3 per page load; at most 20 events are sent per session if telemetry is on.

**Correlating a user report:** ask the user for the request id shown in the error screen/diagnostics (`PsycheOps.reporter.diagnostics()` in the console, or add a "Copy diagnostics" button later), match it to server logs by time + app version. No personal data is needed.

**Alert owners (fill in):** Owner: Aryan. Backup contact: ______. Review cadence: weekly during beta, then monthly.

## 2. Performance budgets (enforced in CI)

`perf-budget.json` + `npm run perf`. Fails the build when exceeded. Measured at Phase 6 on the build machine (not a phone):

| Budget | Limit | Measured |
|---|---|---|
| JS gzip, everything loaded on first paint | 210 KB (unchanged; the trait lab and the compatibility/group tools load on demand from `tools-lazy.js`, budgeted separately at 22 KB gzip) | ~195 KB |
| Largest single script (gzip) | 80 KB | ~64 KB (`app-core.js`) |
| index.html gzip | 9 KB | ~6 KB |
| Font | 140 KB | 131.5 KB |
| Script tags | 19 | 19 (+1 in Phase 7 for `share-policy.js`, reviewed) |
| Build profile from 40 answers (median) | 5 ms | ~0.2 ms |
| Generate insight report (median) | 20 ms | ~0.4 ms |

**What this does NOT prove:** real load time on a low-end phone over a slow network. The engine is not the bottleneck; JS parse/execute of ~630 KB raw and the Supabase CDN script are. To close this, run Lighthouse (mobile, Slow 4G, 4x CPU throttle) on the deployed staging URL and record LCP/TBT in the drill log. Suggested targets: LCP <= 2.5 s, TBT <= 300 ms. Do not optimise before that measurement. If it fails, the likely first fixes are (a) `defer` scripts, (b) lazy-load group/compatibility modules, (c) split `app-core.js`.

## 3. Sync behaviour (offline, retries, duplicates)

- Saving a result is an **upsert keyed by `user_id`**: replaying it writes the same row again.
- Rapid or duplicate saves are **coalesced**: at most one request in flight plus one trailing request (latest wins).
- Transient failures (network, timeout, 429, 5xx) retry up to 3 times with exponential backoff + jitter. Permission/validation/RLS errors are never retried.
- Offline: the result stays on the device, status shows "offline", and sync resumes automatically on the browser `online` event.
- A retry **aborts** if the user signed out or switched account mid-flight, so one account's result is never uploaded to another.
- Conflict rule (unchanged from Phase 1): newest timestamp wins; an invalid cloud copy never overwrites a valid local one.
- Known limit: last-write-wins means two devices saving at nearly the same time keep the later one. Acceptable for a single-result-per-user model; revisit if history/versioning is added.

## 4. Fallbacks when something optional fails

| Failure | Behaviour |
|---|---|
| Insight engine throws | Profile still renders; "Profile dynamics" card is omitted; event `insight_fallback` recorded |
| A screen's render throws | Generic error screen, no state or answers logged; event `render_<screen>` recorded |
| Supabase script blocked/unavailable | App runs in offline, no-account mode (existing behaviour) |
| Cloud copy unreadable | Ignored, local copy kept, notice shown (Phase 1) |

## 5. Release checklist (run for every production deploy)

1. `npm ci && npm test && npm run perf` pass locally and in CI. `npm run test:e2e` passes in CI.
2. Any scoring/narrative/schema change: golden fixtures reviewed in the PR diff, `docs/CHANGELOG.md` updated, engine/narrative version bumped.
3. Any SQL change: written as additive/backward-compatible; run on **staging** first; `supabase/tests/rls.test.sql` executed and output saved (see `STAGING_VERIFICATION.md`).
4. Deploy to a Netlify **deploy preview / branch deploy** (staging). Smoke test: new account -> assessment -> report -> reload -> sync -> sign out -> switch account -> delete.
5. Note the **current production deploy ID** (Netlify -> Deploys) as the rollback target.
6. Promote to production. Watch Netlify deploy log and browser console for 15 minutes.
7. Tag the commit `vX.Y.Z` and record it in `docs/CHANGELOG.md`.

## 6. Rollback

**Frontend (static site) — minutes, no data risk:**
Netlify -> Deploys -> pick the previous good deploy -> **Publish deploy**. (Or `git revert <sha>` and push.) Saved results are versioned (`schema`, `versions`), and old clients ignore unknown fields, so a rolled-back frontend can still read data written by a newer one **as long as the schema version did not change**. If `schema` was bumped, do not roll back past it without checking `profile-schema.js` `validate()` handles both.

**Database — avoid needing this:**
Keep migrations additive (new nullable columns, new functions). Do not drop or rename columns in the same release that stops using them; drop one release later. `supabase/phase5-hardening.sql` is written to be re-runnable. If a policy change locks users out, restore the previous policy from the SQL file in the previous git tag and re-run it in the SQL editor.

## 7. Backup and restore

- **What exists:** Supabase project backups depend on your plan. Free-tier projects have no downloadable point-in-time backup. **Confirm your plan** in Supabase -> Project Settings -> Database -> Backups and write the result in the drill log.
- **Minimum for the free tier:** a scheduled logical dump. From a trusted machine:
  `pg_dump "$SUPABASE_DB_URL" --no-owner --schema=public -Fc -f psyche-$(date +%F).dump`
  Store it encrypted, off the machine (it contains personal results). Keep the last 7 daily + 4 weekly. Never commit it. Do not put `SUPABASE_DB_URL` in the repo or CI logs.
- **Restore drill (do once before launch, then quarterly):**
  1. Create a **new, empty** Supabase project (never restore over production first).
  2. Run `supabase/schema.sql`, `social.sql`, `phase5-hardening.sql`.
  3. `pg_restore --no-owner --data-only -d "$NEW_DB_URL" psyche-YYYY-MM-DD.dump`
  4. Run `supabase/tests/rls.test.sql` against it.
  5. Point a Netlify deploy preview at it (`config.js`), sign in with a test account, confirm the saved result loads.
  6. Record time taken and anything missing.
- **Deletion vs backups:** deleted users reappear in old dumps. Retention for dumps must be <= the retention stated in `privacy.html` / `DATA_INVENTORY.md` (suggested: 35 days max), and a restore must re-apply deletions made since the dump (keep a list of deleted user ids, ids only, for that window).

## 8. Incident handling
Follow `INCIDENT_RESPONSE.md`. For availability incidents: check Netlify status/deploys -> Supabase status/logs -> roll back the frontend first (section 6) -> only then consider database action.

## 9. Drill log (fill in; nothing above is "done" until a row exists)

| Date | Drill | Result | Time taken | Follow-ups |
|---|---|---|---|---|
| | Frontend rollback on staging | | | |
| | Backup plan confirmed | | | |
| | Restore into empty project + RLS test | | | |
| | Lighthouse mobile on staging | | | |
| | Offline -> online sync on a real phone | | | |
