# Defect list (Phase 0 findings, source review)

| ID | Sev | Finding | Reproduce | Expected | Status |
|---|---|---|---|---|---|
| D1 | S1 | Saved result is trusted without validation: `load()` reads localStorage and `syncAfterLogin` assigns the cloud `result` straight into state | Put `{"result":{"dims":{}}}` in `psyche_core_v1`, reload | Rejected safely; fall back to no result | **Fixed (Phase 1)** — `ProfileSchema.validate` at load and cloud sync; tests/integration.test.js |
| D2 | S2 | `Engine.score/quality` treat missing answers as neutral (3) silently, so partial/skipped data yields a confident-looking result | Call `Engine.score([])` | Flag as incomplete | **Mitigated (Phase 1)** — the UI has a Skip button (so A1 was wrong); results now carry `skipped` and show an "Incomplete assessment" notice. Formula unchanged (skips still count as neutral); phase 2 abstention rules should use `skipped` |
| D3 | S2 | privacy.html contact looks like a placeholder (`exampley969@gmail.com`) | Open privacy.html | Real support contact | Open — needs owner decision |
| D4 | S2 | supabase-js loaded from CDN without Subresource Integrity | index.html | SRI hash or self-hosted | Open (Phase 5) |
| D5 | S2 | RLS, `delete_my_account`, group-removal access not verified on a deployed project | — | Passing cross-user tests on staging | Open (Phase 5) |
| D6 | S2 | Raw answers (`ans`) persist in localStorage indefinitely | DevTools → Application | Retention stated or minimised | Open (Phase 5) |
| D7 | S2 | Group/pair insights have no small-group warning; joining a group shares profile with all current and future members | 2-person group → Traits tab | Warning/suppression and clear consent | Open (Phase 7) |
| D8 | S3 | README cites jsdom/500-profile/stress tests that are not in the repo | — | Tests committed | Partly closed: scoring, schema, trait-duo, integration tests now in repo; README's 500-profile and stress claims for traits/deep analysis still have no test |
| D9 | S2 | Insights lack stable IDs, engine version and "why am I seeing this" view | Profile dynamics | Phase 2 spec | **Fixed (Phase 2)** for Profile dynamics (stable IDs, versions, why-panel). The 20 traits and Deep Analysis are labelled as hypotheses; their per-item IDs/evidence panel remain only partly covered (20 traits has "Why this was identified") |
| D10 | S3 | No CI, lint or pinned dev tooling | — | PR checks | Open |

## Phase 1 residual gaps
- Integration tests cover assessment, reload, corrupt data, sync and skipped answers. They do **not** cover account switching or account deletion; those need a staging Supabase project (Phase 5).
- Shared profile rows (`validateShared`) are implemented and tested but not yet wired into `personOf` / group loading.
| D11 | S2 | Safety lint silently removed a catalogue insight (`empathy-boundary.lo-hi`, copy contained "always") | `PI.generate` for a harmony-high, empathy-low profile | Copy passes the lint | **Fixed (Phase 2)** — copy reworded; every catalogue field is now linted in tests |
| D12 | S2 | ~16% of sentences repeated within a tab (20 traits reused the same pool sentences) and 83 repeats across tabs per 12 profiles | measured with 12 random profiles | Repeats removed | **Fixed (Phase 2)** — 16% to ~1-2% within tab, 0 across tabs; guarded by tests/dedupe.test.js |
| D13 | S3 | Profile dynamics card was out of sync with the v2 engine (crashed on render) | open Profile tab | Renders | **Fixed (Phase 2)** |

## Phase 3 findings
| ID | Sev | Finding | Reproduce | Expected | Status |
|---|---|---|---|---|---|
| D14 | S2 | Response-quality `consistency` compared raw answers of the two items in a facet, but the two items are keyed in opposite directions. A fully coherent respondent scored consistency 0 (confidence 5%), while agreeing with both poles of every facet scored 1.0. Also fed "Mixed response signal" in the insight engine | `Engine.quality` on `q.d>0?5:1` vs all 5 | Coherent answering is rewarded, contradictory answering penalised | **Fixed (Phase 3)** — quality v2 uses direction-aligned answers; `versions.quality = 2.0.0`; saved results re-derived from answers, or consistency set to unknown; scores unchanged on 69 golden cases; tests/psychometrics.test.js |
| D15 | S2 | Archetype labels are unstable by construction: assigned from small thresholds (6, 10, 18 points) on dimension scores that are means of 2-item facets. Simulated two sittings of the same person agree on archetype only 11-26% (assumption-dependent). Random answers still give a named archetype to ~everyone (50% "Twin") | `tools/design-analysis.js` section 2-3 | Archetype presented as a current reading, with real-data stability known | **Mitigated (Phase 3)** — Scientific breakdown copy and claims policy state this. Open: show next-nearest archetype / "close call" in the result UI (Phase 4); measure in S2 |
| D16 | S2 | Facet scores take only 9 values (0,13,25,...,100); copy implied e.g. 51 vs 98 | read `Engine.score` | Resolution disclosed | **Fixed (Phase 3)** — copy corrected; design analysis documents it |
| D17 | S2 | Scientific breakdown claimed the "same basic architecture" as the Big Five/HEXACO and "standard psychometric practice"; Limitations called the tool "genuinely useful" | app-core.js science tab | Claims match evidence | **Fixed (Phase 3)** — copy rewritten; `tests/claims.test.js` guards it |
| D18 | S2 | 22 of 40 items carry a wording or construct concern (7 double-barrelled, 6 absolute, 6 overlap with another facet, 4 not true opposites); every facet pairs one + and one − item in fixed adjacent order | `ITEM_REVIEW.md` | Items reviewed, tested with participants | **Open** — desk review done; interviews (S0), pilot (S1) and rewrites need owner decisions and participants |
| D19 | S2 | No reliability, structure, retest, convergent or fairness data exists | — | Studies run and reported | **Open** — plan and analysis tooling ready (`VALIDATION_PLAN.md`); needs data collection |
| D20 | S3 | README headed a testing section "Why it's safe to trust" | README | Software tests not presented as validation | **Fixed (Phase 3)** |

## Phase 4 findings
Measured with `tests/e2e/audit.js` (axe-core 4.10, WCAG 2.0-2.2 A/AA, 13 screens x 2 themes x 4 widths) and source review.
| ID | Sev | Finding | Status |
|---|---|---|---|
| D21 | S2 | Result tabs, lens/rank/group/science tabs, archetype cards, pills and "glossary" links were `div`/`span` click targets: not reachable or operable by keyboard | **Fixed (Phase 4)** — real buttons / `role=tab` / `role=button` with Enter and Space; `tests/ux.test.js`, `e2e/keyboard.js` |
| D22 | S2 | Axe baseline: nested-interactive (prism SVG, 16), unnamed progressbar (16), scrollable tab bar with no focusable content (56), contrast 4.3:1 (10) | **Fixed** — 0 violations on the same run |
| D23 | S2 | Dark-theme white-on-accent number badges failed contrast (1.7:1 to 4.2:1); result hero text on tinted gradient failed in both themes (3.3-4.3:1) | **Fixed** — badge uses `--bg`, tint 24% to 10%, tokens adjusted (`--I` light, `--P` dark) |
| D24 | S2 | Progress lived only in memory: refresh or closing the tab lost up to 39 answers | **Fixed** — draft + resume |
| D25 | S3 | "Unreadable saved result" explanation was a 2-second toast | **Fixed** — persistent banner |
| D26 | S3 | Home said "4 min"; no first-run explanation of purpose, privacy, non-clinical scope | **Fixed** — intro screen; estimate now "5-8 min", still unmeasured |
| D27 | S3 | Text at 10-11.5px in ~70 places; touch targets 38px | **Fixed** — 12px floor outside print, 44px controls |
| D15 | S2 | Archetype instability | **Mitigated further** — result shows neighbouring archetypes on a close call. Real-data stability still unmeasured |
| D28 | S2 | Screen-reader behaviour (NVDA, JAWS, VoiceOver, TalkBack) not tested; automated tools find roughly a third of real issues | **Open** — manual checklist in `UX_A11Y.md` |
| D29 | S3 | Compare, Group, Account and Auth screens were covered by axe only in their signed-out/empty states (need a live Supabase to populate) | **Open** — Phase 5 staging |

## Phase 5 findings (security, privacy, data governance)
Evidence: browser tests against a fake backend (`tests/e2e/security.js`), static checks (`tests/security.test.js`), SQL written but **not executed** (`supabase/phase5-hardening.sql`, `supabase/tests/rls.test.sql`). "Fixed (client)" = fixed and browser-tested; "Fixed in SQL (unverified)" = written, awaiting staging.
| ID | Sev | Finding | Status |
|---|---|---|---|
| D30 | S1 | **Account switching leaked data**: if sign-out happened while sync had not succeeded, the local result stayed and the next account to sign in on that device had it uploaded into its own account and shared profile (reproduced before the fix) | **Fixed (client)** - result is bound to its account; a different account never uploads it and the old copy is removed with a notice |
| D31 | S2 | Account deletion and sign-out left draft answers, feedback notes, rejected-result copy and pending share token in localStorage; the "also remove from this device" option removed only the result | **Fixed (client)** - `PsychePrivacy.wipeLocal`, "Clear data on this device" control, tested |
| D32 | S2 | supabase-js loaded from CDN without Subresource Integrity (was D4) | **Open** - needs network to compute the hash; steps in `docs/SECURITY.md`; `STRICT_SECURITY=1` fails until done |
| D33 | S2 | No Content-Security-Policy or referrer policy | **Fixed (client)** - meta CSP (no inline scripts, connect-src limited), enforced in Chromium; header-only directives (`frame-ancestors`, HSTS) still need Render configuration |
| D34 | S2 | Sign-up revealed whether an email is registered ("An account with that email already exists") | **Fixed (client)** |
| D35 | S3 | Unknown backend error text was shown to users | **Fixed (client)** - generic message; useful validation messages allow-listed |
| D36 | S2 | Changing the password did not end other sessions | **Fixed (client)** - `signOut({scope:'others'})` |
| D37 | S1 | Invitation and group checks trusted the JWT email claim; with email confirmation off or stale tokens, someone registering a victim's address could accept invitations addressed to it | **Fixed in SQL (unverified)** - `my_email()` reads the confirmed address; also requires "Confirm email" ON |
| D38 | S2 | No server-side shape/size limits on stored JSON and text (a client could store arbitrary JSON, huge blobs, raw answers, out-of-range scores) | **Fixed in SQL (unverified)** |
| D39 | S2 | No invitation expiry, quotas or throttling on link guessing | **Fixed in SQL (unverified)**; purge schedule is an owner action |
| D40 | S2 | "Delete my saved copy" was two separate calls (a failure between them left scores visible to connections) and the app re-uploaded the local copy at next sign-in | **Fixed** - atomic `delete_my_result()` (SQL unverified) + sync pause (client, tested) |
| D41 | S3 | Clients could set their own `expires_at`, `status`, `addressee_id` columns on insert, and update any group column the policy allowed | **Fixed in SQL (unverified)** - column-level grants |
| D42 | S3 | `delete_my_account()` skipped invitation cleanup when the email was unconfirmed | **Fixed in SQL (unverified)** |
| D43 | S3 | `tests/e2e/keyboard.js` reports no visible focus indicator on `summary` cards (dimension details, "Why am I seeing this?", word list) in Chromium 1194; reproduced on the unmodified Phase 4 app once the harness could find the browser. Either a real Phase 4 accessibility defect or a test-environment difference | **Open** - triage by hand with a keyboard |
| D44 | S3 | Phase 4 e2e scripts looked only for `chrome-linux64`, so they silently skipped on installs that use `chrome-linux` | **Fixed** |
| D45 | S1 | RLS, SECURITY DEFINER functions, account deletion and group-removal behaviour unverified on a live project (was D5) | **Closed for staging 2026-10-26** - `phase5-hardening.sql` and `rls.test.sql` ran successfully (owner-reported; attach the output to `docs/evidence/`). Remaining work is D57 |
| D46 | S2 | Backup and log retention periods not stated; incident owner not named; privacy text not reviewed by the owner or a lawyer | **Open - owner decision** |
| D47 | S3 | Expired invitations are only purged if `purge_expired_invitations()` is scheduled (pg_cron) | **Open - owner action** |
| D6 | S2 | Raw answers persist in localStorage | **Mitigated** - disclosed, listed in the inventory, removable (Clear data / sign-out / delete); still no automatic expiry |
| D3 | S2 | privacy.html contact is `exampley969@gmail.com`; used for security reports too | **Open - owner decision** |
| D29 | S3 | Account/Compare/Group screens only covered with the fake backend | **Partly closed** - escaping covered on every Compare/Group tab with populated fake data; axe on those populated screens still not run |
| D48 | S2 | No real-device performance measurement (Lighthouse mobile, low-end phone, slow network); budgets cover bundle size and engine time only | **Open - owner action** (see OPERATIONS.md section 2) |
| D49 | S2 | Frontend rollback, backup plan and restore drill written but never executed; Supabase plan/backup tier unconfirmed | **Open - owner action** (drill log in OPERATIONS.md section 9) |
| D50 | S3 | Sync retry/offline recovery is covered by unit tests and static checks on `app-core.js`, not by a browser/jsdom offline-to-online test | **Open** |
| D51 | S3 | Remote error telemetry is disabled; production errors are only visible if a user reports them or Netlify/Supabase logs show them | **Open - owner decision** (enable `TELEMETRY_URL` + CSP + privacy notice update) |
| D52 | S3 | Supabase script is loaded from a CDN without SRI and is the largest third-party cost (D32 still open) | **Open** |
| D53 | S3 | Group Roles/Team tabs name individuals as "natural fit"/"careful review"; copy disclaims it but misuse for selection is possible | **Open - watch in beta**; consider removing named champions |
| D54 | S3 | No minimum-size suppression for anonymous aggregates (none exist today; all group members consent to individual visibility) | **Open - must be built before any anonymous/aggregate feature** |
| D55 | S3 | Hosted expiring/revocable report links and remote product metrics not built (intentional; see SHARING_AND_GROUPS.md, PRODUCT_METRICS.md) | **Deferred by design** |
| D56 | S3 | Comparison/group consent text and the similarity wording have not been tested with real users (comprehension is a beta task) | **Open** |
| D57 | S2 | Hardening SQL not yet confirmed on PRODUCTION; "Confirm email" not confirmed ON in production; the manual real-session checks in `STAGING_VERIFICATION.md` (old session after removal, other sessions after password change) not done | **Open - owner action** (gate S2) |
| D58 | S2 | `ops.js` read `ProfileSchema.versions()` which is not exported, so error events carried no engine versions; the unit test mocked the value and missed it | **Closed in Phase 8** - now reads `ProfileSchema.VERSIONS`; regression test uses the real page wiring |
| D59 | S3 | Human review of insights (rubric gate) and the beta have not been run; the tooling exists (`review-sheet.js`, `review-score.js`) | **Open - needs people** (gates Q1, B1-B3) |
| D60 | S3 | Beta pass thresholds in `BETA_PLAN.md` are proposals; they must be confirmed by the owner BEFORE the beta starts | **Open - owner decision** |
| D61 | S2 | Found in Phase 8: the profile row stores each user's email and the read policy returns the whole row to accepted connections and group members, so anyone connected to you can read your email by calling the API directly (the app itself never selects or shows it). The consent text lists what the app shares and does not mention this | **Open - owner action**: test the commented column-privilege SQL at the end of `phase5-hardening.sql` on staging, run `rls.test.sql`, then apply; until then add "your email address" to `SCOPE_TEXT` in `share-policy.js` |
