# Security and privacy engineering notes (Phase 5)

## What is verified, and how (read this first)
| Layer | Evidence | Status |
|---|---|---|
| Client behaviour (escaping, CSP, account switching, sign-out/delete wipes, enumeration, session revocation) | `tests/e2e/security.js`: real Chromium against a **fake** Supabase client | **Passing (62 checks)** |
| Repository guard rails (RLS enabled on every table, anon revoked, definer functions pinned, no secrets, storage inventory, no sensitive logging, CSP) | `tests/security.test.js` | **Passing** |
| Row Level Security and database functions on a real project | `supabase/tests/rls.test.sql` (about 70 checks) | **Written, NOT executed** - no Postgres was available. Release gate until it passes on staging |
| `phase5-hardening.sql` | linted statically only | **Not applied anywhere yet** |
| Auth dashboard settings, rate limits, redirect allow-list, backups, headers on Render | checklist in `STAGING_VERIFICATION.md` | **Not verified** (needs the dashboards) |
| Dependency vulnerability scan | `npm audit` needs network | **Not run**; CI job added |
| Screen readers, penetration test, privacy/legal review | - | **Not done** |

Nothing in this phase says the product is secure; it says which defences exist and which still await verification.

## Threat model (summary)
Assets: assessment scores and answers, email addresses, who is connected to whom, group membership.
Actors: other signed-in users (curious, malicious), anonymous internet users, someone using the same device, someone who knows an email address, a compromised CDN script.

| Threat | Control | Where |
|---|---|---|
| User A reads/edits User B's data | RLS per table; `can_see_profile()` only for self, accepted connections, shared accepted groups | `schema.sql`, `social.sql`; test T2, T4 |
| Removed member keeps access with an old session | policies evaluate live membership on every query | test T6 |
| Role/id tampering in requests | `with check` on every write; client can insert only named columns; groups update limited to `name`; groups created only via `create_group()` | `phase5-hardening.sql`; tests T3, T4, T6 |
| Claiming someone else's invitation by signing up with their address | `my_email()` reads the **confirmed** address from `auth.users`; needs "Confirm email" ON | hardening; test T5 |
| Account enumeration | sign-up answers identically for new and existing emails; generic error text; reset never reveals | `auth.js`; browser test |
| Share-link guessing | 244-bit tokens, 14-day expiry, 10 failed attempts per hour per user | hardening; test T7 |
| Abuse / storage growth | size and shape constraints, invitation / group / member quotas | hardening; tests T3, T8 |
| Stored XSS via names, group names, emails | escaping on every render path; CSP without `unsafe-inline` scripts | browser test (CSP on and off) |
| Malicious or compromised script | CSP `script-src 'self' cdn.jsdelivr.net`, pinned version | SRI still missing (D32) |
| Next person on a shared device sees or inherits data | owner binding of the local result; wipe on sign-out when saved; Clear data control | browser test |
| Secrets in the bundle | only the anon key ships (JWT role is checked); service-role key never in client | `security.test.js` |
| Raw answers leaving the device | stripped before upload; database rejects `ans` | browser test; constraint |
| Other sessions surviving a password change | `signOut({ scope: 'others' })` after update | browser test |

Residual risks: the anon key is public by design, so every protection depends on RLS being right; the supabase-js script is a third-party dependency; free-tier Supabase auth email limits can lock out sign-ups; `profiles.email` is readable by connections through the API.

## Required Supabase dashboard settings (verify on staging, then production)
Authentication: **Confirm email ON**; minimum password length 8 or more (the UI asks for 8); leaked-password protection if the plan has it; refresh-token rotation ON; JWT expiry 1 hour or less; Site URL and Redirect URLs limited to the production and staging origins only; disable providers you do not use; CAPTCHA on sign-up if abused; review the built-in rate limits (sign-ups, sign-ins, emails) and use custom SMTP before launch.
Database: no `service_role` key in any client; Network restrictions if available; enable backups appropriate to the plan; schedule `purge_expired_invitations()`.

## Headers (Render static site -> Headers) - not settable from `<meta>`
```
/*   Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'none'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'; worker-src 'none'
/*   Strict-Transport-Security: max-age=31536000
/*   X-Content-Type-Options: nosniff
/*   Referrer-Policy: same-origin
/*   Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```
`frame-ancestors` only works as a header (clickjacking protection). If `SUPABASE_URL` is a custom domain, add it to `connect-src` in both places; `security.test.js` checks the meta tag. `'unsafe-inline'` remains for styles only because the UI uses inline `style` attributes; it does not allow inline scripts.

## Add SRI (D32, open)
Needs network, so it could not be done here:
```
curl -s https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```
Add `integrity="sha384-<result>" crossorigin="anonymous"` to that `<script>` tag. Or download the file into the repo and serve it from `'self'` (then drop the CDN from `script-src`). `STRICT_SECURITY=1 node tests/security.test.js` fails until this is done.

## Dependency process
Dev dependencies: Dependabot weekly + `npm audit` in CI. Shipped site: no npm runtime dependencies; the only third-party script is supabase-js (pinned, check monthly for advisories and upgrade deliberately, keeping the version at least two weeks old). Changes to scoring, policies, data migrations or product claims need a reviewed pull request.

## Re-running SQL
Order: `schema.sql`, `social.sql`, `phase5-hardening.sql`. Re-running `social.sql` re-grants table-wide privileges, so re-run `phase5-hardening.sql` afterwards.
