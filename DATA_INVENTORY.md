# Data inventory, retention and deletion (Phase 5)

Scope: everything Psyche Core stores, where, why, who can read it, how long it is kept, and how it is deleted.
"Proposed" retention is a decision for the product owner; nothing here has been reviewed by a lawyer.

## In the browser (this device only)
Managed by `privacy-local.js` (`PsychePrivacy.KEYS`); `tests/security.test.js` fails if the code writes a key that is not listed here.

| localStorage key | Contains | Purpose | Retention | Removed by |
|---|---|---|---|---|
| `psyche_core_v1` | latest result (scores, archetype, **raw answers**), result time, owning account id, "sync paused" flag, theme, intro-seen | show your result without an account; evidence view | until removed (no expiry) | Clear data on this device; sign-out once saved; delete account (+ device option); browser site-data clearing |
| `psyche_core_v1_draft` | answers of an unfinished assessment | resume | until finished, restarted or removed | same as above; finishing or "Start over" |
| `psyche_core_v1_rejected` | copy of a saved result that failed validation | recovery | until removed | same as above |
| `psyche_feedback_v1` | accurate / partly / inaccurate ratings and optional **free-text notes** | feedback on insights; never uploaded | until removed | same as above; "clear all feedback" |
| `psyche_pending_join_v1` | share-link token waiting for sign-in | finish accepting an invitation after sign-in | until used, then removed | used at sign-in; same as above |
| `sb-<project>-auth-token` | Supabase session (access + refresh token) | stay signed in | until sign-out / expiry | sign-out; delete account |

Theme and intro-seen are kept when clearing (not personal). Raw answers never leave the device (`withoutAnswers()` before upload; the database also rejects a result containing `ans`).

## In the database (Supabase, Postgres)
| Table | Contains | Who can read | Purpose | Retention (proposed) | Deleted by |
|---|---|---|---|---|---|
| `auth.users` (Supabase) | email, password hash, identities, sessions | the user (via Supabase Auth); site owner via dashboard | sign-in | until account deletion | `delete_my_account()` |
| `assessment_results` | result without answers (dims, facets, archetype, quality, versions) | only that user (RLS) | sync across devices | until user deletes it or the account | "Delete my saved copy" (`delete_my_result()`), account deletion (cascade) |
| `profiles` | display name, **email**, 5 dimension scores, 20 facet scores, archetype key | the user; accepted connections; members of a shared accepted group | Compatibility and Group | as above | `delete_my_result()` clears scores; account deletion removes the row |
| `connections` | requester id/name/**email**, invitee **email**, token, status, expiry | the two parties; the invitee by email | invitations and links | pending: 14 days then purged; accepted: until either party removes it or deletes their account | either party; account deletion; `purge_expired_invitations()` |
| `groups` / `group_members` | group name, owner, member **emails**, status | owner and accepted members; invitees see their own row and the group name | groups | until the owner deletes the group / member leaves / account deletion | owner, member, cascade |
| `rpc_attempts` | user id, kind, time of failed share-link guesses | nobody via the API (server functions only) | brute-force throttle | rows older than 1 day removed on the next failed attempt | cascade on account deletion |

Members of a group and accepted connections can technically read the `email` column of each other's `profiles` row through the API (the app never displays or requests it). An optional column-privilege change is in `phase5-hardening.sql` (commented, needs staging verification).

## Operational data held by providers
| Data | Provider | Notes |
|---|---|---|
| request logs with IP addresses | Render (hosting), Supabase (API / auth logs) | retention set by each provider's plan; **not yet reviewed by the owner** |
| email delivery (confirmation, reset) | Supabase Auth mail | built-in sender has low rate limits; custom SMTP recommended before launch |
| Google sign-in | Google | only if the user chooses it; app receives email and basic profile |
| database backups | Supabase | length depends on the plan; deleted rows can persist in backups until they roll off. **Owner must state the actual period** in `privacy.html` |

Not collected: analytics, advertising identifiers, cookies set by this site (the Supabase session uses localStorage), AI/model processing of answers (none exists today; adding one requires a new review: provider terms, retention, region, consent, minimisation).

## Deletion paths and what each leaves
1. **Clear data on this device** (Account page) - removes all personal local keys; account untouched. If the latest result is not synced it is lost (the dialog says so).
2. **Delete my saved copy** - deletes `assessment_results` and clears shared scores atomically; the local copy stays; automatic re-upload is paused until the user chooses "Sync now".
3. **Delete my account** - `delete_my_account()` removes the auth user and, by cascade, results, profile, connections, memberships, groups they own, throttle rows, plus pending invitations to their email; optionally wipes this device too. Irreversible. Backups age out per the provider.
4. **Sign-out** - clears local personal data when the result is saved to the account; otherwise keeps it (marked as belonging to that account) and says so. A different account signing in never inherits it.

## Retention decisions still needed from the owner
- Backup retention period to publish; log retention at Render and Supabase.
- Whether inactive accounts should be deleted after N months (none today).
- Schedule `purge_expired_invitations()` (pg_cron) - the privacy page says expired invitations are cleaned up.


## Phase 6 addendum — diagnostics
| Data | Where | Content | Retention | Notes |
|---|---|---|---|---|
| Error events | Browser memory only (50 max, lost on reload) | kind, error type, `file:line`, screen name, app/engine versions, online flag, request id | Page lifetime | No answers, scores, messages, ids or emails (tested). Nothing written to localStorage. |
| Remote telemetry | Disabled | Same fields, sent only if `TELEMETRY_URL` is configured | Defined by the receiving service; document it here **before enabling** | Requires CSP `connect-src` change and a privacy-notice update |

## Phase 7 addendum — exports
PDF and image exports are generated in the browser and handed to the user; Psyche Core stores no copy and hosts no link. Exports never contain individual answers (checked in `tests/phase7.test.js`). What a recipient does with a file the user sends is outside the app's control.
