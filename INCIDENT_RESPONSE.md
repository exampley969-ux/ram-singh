# Incident response checklist (Phase 5)

**Incident owner:** TODO(owner) - name one person and one backup. Until a name is written here the roadmap gate "incident owner exists" is NOT met.
**Contact for reports:** see `/SECURITY.md`. Legal notification duties depend on where users live; ask a qualified adviser before relying on this document for them.

## Severity
- **S1** confirmed exposure or modification of other users' data, or credential/key compromise.
- **S2** exploitable weakness without evidence of abuse; service down for all users.
- **S3** limited weakness, degraded feature.

## Steps
1. **Receive and record** - time, reporter, what/where; open a private issue; do not discuss publicly.
2. **Triage** - reproduce on staging, never against real users' data. Assign severity.
3. **Contain (S1/S2)**, fastest first:
   - Supabase: disable sign-ups, or pause the project; revoke the leaked key (rotate JWT secret invalidates ALL sessions, expect everyone to sign in again).
   - Remove a bad policy/function: apply a corrective SQL migration (keep the previous file in git); `revoke execute` on an abusable function.
   - Render: roll back to the previous deploy; remove an infected script from `index.html` and redeploy.
4. **Assess** - which tables/rows, which time window (Supabase API and auth logs; keep copies before they roll off), how many users, which fields (emails? scores? answers never leave devices).
5. **Fix** - patch on a branch, add a regression test to `rls.test.sql` or `security.js`, deploy to staging, run both, then production.
6. **Notify** - affected account holders by email: what happened, what data, what we did, what they should do. Legal/regulator notices where required. Update `privacy.html` if practices change.
7. **Recover** - restore from backup only if data was corrupted (see restore drill in `STAGING_VERIFICATION.md`; not yet performed).
8. **Review within 7 days** - timeline, root cause, what test would have caught it, owners and dates for actions; add to `docs/DEFECTS.md`.

## Key and secret rotation
- Anon key: public by design; rotate only with the JWT secret. Update `config.js`, redeploy.
- Service-role key: must not exist in this repository or the site. If found anywhere, treat as S1: rotate immediately, review logs.
- Google OAuth client secret lives in the Supabase dashboard only.
- Render environment variables: none are used by the static site today.

## Drills
Run a tabletop of steps 1-6 once before launch and after any staffing change. Record date and outcome here: _not yet done_.
