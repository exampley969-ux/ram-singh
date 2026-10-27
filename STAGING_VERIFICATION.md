# Staging verification runbook (Phase 5 release gate)

Nothing below has been run yet. Fill the result column as you go; keep this file in git.

## 0. Create staging
Separate Supabase project (not production data). Separate Render static site or preview deploy. Add the staging URL to Supabase Auth > URL Configuration. Put the staging project URL and anon key in a **staging copy of `config.js`**.

## 1. Apply SQL in order
SQL editor: `supabase/schema.sql`, `supabase/social.sql`, `supabase/phase5-hardening.sql`. Read the output for `WARNING` lines (existing rows violating constraints; tables without RLS).

## 2. Auth settings (see `docs/SECURITY.md`)
Confirm email ON; password length; redirect URLs; rate limits; providers; JWT expiry; refresh rotation. Note the values here: _______.

## 3. Run the database tests
Paste `supabase/tests/rls.test.sql` into the SQL editor (or `psql -v ON_ERROR_STOP=1 -f`). Expected last line: `RLS tests finished: all checks passed`; it rolls back.
If the harness itself errors (for example the `auth.users` insert on your Supabase version), fix the harness and note it; a `FAIL [...]` on a policy check is a real finding: add it to `DEFECTS.md` as S1/S2.

## 4. Manual cases with two real browsers/accounts (Alice, Bob, Carol; real mailbox)
| # | Case | Expected | Result |
|---|---|---|---|
| 1 | Sign up with an existing email | same message as a new sign-up, no "already exists" | |
| 2 | Sign up, do NOT confirm, try to sign in | refused until the link is clicked | |
| 3 | Alice and Bob connect by link; Alice removes; Bob reloads | Bob no longer sees Alice's scores | |
| 4 | Group: Alice invites Bob and Carol; Alice removes Bob while Bob stays on the Group screen, then Bob clicks Refresh | group and members disappear | |
| 5 | Open the link while signed out, sign up, confirm email | invitation accepted after sign-in | |
| 6 | Share link after 14 days (set `expires_at` in the past by SQL) | "invalid, used or expired" | |
| 7 | Change password in browser 1; browser 2 acts | browser 2 is signed out at its next refresh | |
| 8 | Alice finishes the test offline, signs out, Bob signs in on the same browser | Bob does not get Alice's result; Alice's cloud row unchanged | |
| 9 | "Delete my saved copy", sign out/in | result is not re-uploaded; Bob/Carol see no scores | |
| 10 | "Delete my account" with device wipe | `auth.users` row, profile, connections gone; DevTools > Application shows no `psyche_*` keys | |
| 11 | DevTools: edit own `profiles.dims` via the API with 101 | rejected | |
| 12 | Inspect Network and Supabase logs during a full session | no answers, no tokens in URLs, no secrets in logs or client errors | |

## 5. Hosting
Set the headers from `docs/SECURITY.md` on the Render staging site, then `curl -sI https://staging.example/ | grep -i -E "content-security|strict-transport|nosniff|referrer|permissions"`. Browser console shows no CSP violations during a full session. Add SRI (docs/SECURITY.md).

## 6. Operations
- Schedule `purge_expired_invitations()` with pg_cron; run it once by hand; confirm only expired pending rows go.
- Backup/restore drill: restore a backup into a scratch project; confirm a deleted test account's data state matches the stated retention. Record the restore time.
- Confirm who receives Supabase and Render alert emails.

## 7. Exit
All of: step 3 passes; table above all pass; no open S1/S2 in `DEFECTS.md`; privacy text reviewed by the owner; incident owner named. Date/sign-off: _______.
