# Deploying Psyche Core (existing Supabase project + Render)

Supabase project: `https://gxojovnqxjymyrfwpanj.supabase.co` (already set in `psyche-core/config.js`, anon key only).
Production domain: **https://psyche.monster** (set in `render.yaml`). The app uses whatever address it is served from (`window.location.origin`), so no address is hard-coded.

## Order (do not skip step 1)
1. **Back up** the Supabase database (Dashboard -> Database -> Backups, or `pg_dump`).
2. SQL Editor, run in order: `supabase/schema.sql`, `supabase/social.sql`, `supabase/phase5-hardening.sql`.
   (All are meant to be re-runnable. If you re-run `social.sql`, re-run `phase5-hardening.sql` after it.)
3. Optional check: run `supabase/tests/rls.test.sql` (staging first if you can).
4. Supabase Auth settings: **Confirm email ON**, password min length 8+, refresh-token rotation ON,
   JWT expiry <= 1 hour, and set **Site URL** to `https://psyche.monster` and **Redirect URLs** to `https://psyche.monster` and `https://psyche.monster/**` (add your `*.onrender.com` address only if you also want to test there; remove it afterwards). If you use Google sign-in, also add `https://psyche.monster` under the Google OAuth authorised origins.
5. Render: New -> Blueprint -> connect the repo containing this folder (uses `render.yaml`),
   or create a Static Site with root dir `psyche-core`, build `sh tools/build-static.sh`, publish dir `dist`.
   Security headers come from `render.yaml`.
   Then in Render -> the service -> Settings -> Custom Domains, add `psyche.monster` and create the DNS record Render shows at your domain registrar (an A record for the apex; a CNAME for `www` if you add it). Render issues the HTTPS certificate automatically once DNS resolves.
6. Open https://psyche.monster, create an account, take the assessment, reload, sign out and back in.

## Known open items (see docs/RELEASE_STATUS.md)
Not run or not done: SRI hash for the supabase-js script (D32, needs network), beta, human review,
screen-reader test, rollback/restore drills, privacy-notice owner review, 8 open S2 defects (D3, D28, D32, D46, D48, D49, D57, D61).
Replace placeholder contacts before public launch: `psyche-core/.well-known/security.txt`, privacy.html, CODEOWNERS.
