# Psyche Core — Inventory (Phase 0)

Baseline: git tag `v0-baseline` = the original `psyche-core-industry-upgrade.zip` exactly as received.
Source-only inventory; runtime behaviour is labelled in FEATURE_STATUS.md.

## Run / test
- Serve statically: `cd psyche-core && python3 -m http.server 8000` (auth needs http(s), not file://)
- Tests: `cd psyche-core && node tests/run-all.js` (added in Phase 1)
- Build: none. Deploy: static files (README: Netlify; privacy page names Render).

## Screens (`state.screen`)
home, assessment, results, archlib, archdetail, compare, group, science, glossary, auth, account, recovery

## Result tabs (`state.resultsTab`)
profile (incl. Profile dynamics), facets, deep, career, relationship, plus (patterns)

## Group tabs
overview, story, members, heat, insights, scen, roles, traits, team, pairs

## Modules (load order in index.html)
config.js → auth.js → core-logic.js (questions, archetypes, `Engine`) → implications_data.js → deep-analysis.js →
traits-engine.js → engine-plus.js → group-insights.js → social-plus.js → trait-duo.js → intelligence-engine.js → app-core.js
(+ deep_analysis_nlp.py: Python reference for deep-analysis.js, not loaded by the app)

## Score fields (result object)
`dims{P,R,I,S,M}` 0–100, `facets{20 keys}` 0–100, `match{key,arche,primary,secondary,code,confidence,lowSignal}`,
`quality{engagement,spread,consistency,straightLining}`, `ans[40]` (1–5; local only), timestamps `resultAt` (ms).
Phase 1 adds `schema`, `versions`.

## Browser storage
- `psyche_core_v1` — {result (incl. raw `ans`), resultAt, theme}
- `psyche_pending_join_v1` — pending invitation token

## Database (Supabase)
Tables: assessment_results, profiles (dims, facets, arch_key), connections, groups, group_members.
RPC: accept_connection, accept_link, create_group, accept_group_invite, delete_my_account.
Files: supabase/schema.sql, supabase/social.sql. RLS is declared in SQL; NOT verified against a deployed project.

## External dependencies / calls
- Supabase project `gxojovnqxjymyrfwpanj.supabase.co` (anon key in config.js — public by design)
- `@supabase/supabase-js@2.45.4` from cdn.jsdelivr.net (no SRI hash)
- Google OAuth via Supabase (provider must be enabled in the project)
- No fetch/XHR in app code; no analytics; no LLM calls from the browser build

## Environment variables
None. Config lives in config.js (URL + anon key). `service_role` must never be added.
