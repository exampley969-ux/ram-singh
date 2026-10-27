# Psyche Core

A pure personality-analysis build of Psyche — the 40-question PRISM
assessment, 36-archetype classification, 20-facet breakdown, deep
NLP-generated analysis across 9 categories, and score-driven Career
insight. Nothing else.

## What's in this build

- The full 40-question assessment (`QUESTIONS`) — **fully deterministic**,
  same answers always produce the same scores and archetype
- PRISM scoring across 5 dimensions with response-quality-aware
  confidence (`Engine.score`, `Engine.quality`, `Engine.match`)
- 36-archetype classification
- **20 dynamic facts** — generated fresh from your actual scores every
  time (`generate20Facts`), not a fixed list. Wording changes with the
  magnitude of each score, not just a hi/lo binary.
- **Deep Analysis** — 12 large, NLP-generated sections:
  - Strength
  - Weakness
  - **Misunderstood as** — the real gap between how a trait reads to
    other people and what it actually is (e.g. "reads as vague, but is
    actually several steps ahead")
  - Shadow
  - Emotional side
  - Critical & logical side
  - Relationship handling (its own 5-part sub-breakdown, see below)
  - Social side
  - Dark traits (only surfaced where a genuine, well-established
    pattern exists — not fabricated for dimensions with no real
    dark-trait signal)
  - **At your best, vs. under sustained stress** — a contrasting pair:
    the specific conditions under which each dimension performs at
    its peak, set directly against what weeks (not a single crisis
    moment) of ordinary sustained pressure does to that same
    dimension
  - Career, in depth
- **Archetype library** — browse all 36 archetypes without taking the
  assessment. Each one gets the exact same full generative treatment
  as your own result (Deep Analysis, At Best/Under Stress, Career,
  Relationships) using a representative "exemplar" score profile for
  that archetype, clearly labeled as illustrative rather than a real
  reading. MBTI-style type library, but every entry is generated from
  real dimension data rather than one static block of copy per type.
- Expanded archetype description (base description + a generated
  elaboration paragraph + the archetype's growth-tip, now surfaced)
- **Complete PDF export** — one button generates a full printable report
  (archetype header, all 5 dimensions, signature traits, all 20 facts
  grouped by dimension, all 9 deep-analysis categories, career, and
  relationships) and hands it to the browser's native print-to-PDF —
  no external library, no server round-trip, works fully offline.
- **20 facts, redesigned** — grouped under 5 color-coded dimension
  headers instead of a flat "Fact 1 / Fact 2" numbered list, each facet
  shown with its pole label, score, generated sentence, and a score bar
- A canvas-drawn, downloadable share card
- **Compatibility through accounts** — sign in, then connect with one
  other person by email invite (they accept after signing in with that
  email) or a one-time share link. Once accepted, you each see the
  other's 5 scores + archetype (never answers) and the full comparison
  — score, shared ground, natural division, friction notes, Conflict
  Style with a suggested bridge — computes in the browser.
- **Deep Compatibility** — a full trait-by-trait NLP pass across all 5
  dimensions (`Engine.deepCompatibility`), not just the top 2-3
  headline notes. Every dimension is classified into one of four
  relational states (both high / both low / a wide split / aligned)
  and gets its own generated paragraph plus a side-by-side score bar
  and a "% aligned" harmony figure — same template-grammar,
  deterministic-per-pair approach as the personal Deep Analysis
  engine, applied to two profiles at once.
- **Group / team comparison** — create a group, invite members by
  email, and once they accept get six tabs: *Overview* (cohesion /
  diversity / coverage, group profile, team archetype), *Narrative*
  (the analysis written out as prose by a rule-based NLG engine, with the
  rule behind every label shown), *Members*
  (per-dimension ranking, member cards, sub-groupings), *Heatmap*
  (everyone x 5 dimensions + spread chart), *Insights* (strengths, blind
  spots, communication tips, decision style, conflict hotspots) and
  *Pairs* (tap any pair for the full 1:1 deep-dive). The PDF report
  includes all of it. Logic: `Engine.groupAnalysis` + `group-insights.js`
  (fixed rules over the 5 scores; describes composition, not performance).
- **Scientific breakdown page** — a dedicated, tabbed explainer
  covering the design influences behind the trait model, item design (Likert
  scale, reverse-keyed items), the exact scoring formula per facet and
  dimension, how response-quality/confidence and straight-lining
  detection work, the archetype classification rules, the
  compatibility-score formula, and an explicit limitations section
  (self-report bias, no published validation study, not a diagnostic
  tool).
- Light/dark theme, persisted locally

## Twenty traits (`traits-engine.js`)

The *20 Facts* section is replaced by **Twenty traits**: exactly 20 distinct, evidence-linked
insights (id, title, category, description, evidence from your answers, everyday manifestation,
strength, challenge, confidence + reason, practical insight). Rule-based, deterministic, offline.
Evidence quotes the actual questions and answers; confidence reflects answer agreement, distance
from the midpoint, skipped questions and straight-lining (never how strongly you hold the trait),
and combined traits (e.g. leadership) are capped. Raw answers are stored in local storage only and
stripped before any cloud sync; a result synced from another device falls back to score-only evidence
and says so. "Download traits (JSON)" exports the same structure. Tested on 500 random profiles,
with and without answers, plus all-same and all-skipped edge cases.

**Generative selection.** The engine builds a pool of candidates: 20 hand-written single-facet or
composite traits plus every two-facet interaction where both facets lean clearly (composed from a
40-pole lexicon, with 15 hand-written interplays such as "Insight kept inside"). Each is scored by
evidence strength, and the 20 strongest are chosen under diversity rules (facet-reuse caps, a limit
on generic pairings, every dimension covered at least twice). Different profiles therefore get
different *sets* of traits, not only different wording. Results are memoised per answer set.

## Profile Intelligence layer (engine 2.0.0, catalogue 2.0.0)

`intelligence-engine.js` is a nine-stage insight pipeline over the 20 facet scores: validate, extract typed features, detect (8 catalogue rules x 4 defined states), attach evidence (scores and, when available, the answers behind them), compute confidence, prioritise, synthesise, design an experiment, and safety-lint. It changes no scores, archetypes, schema or auth flow.

- Every insight has a stable ID (`rule.state`), engine and catalogue versions, evidence references, alternative explanations, a counterexample, limits, and a small experiment with a time window and success signal.
- Confidence is support for the inference, not trait strength, and is never "high". Fragile bands, disagreeing answers, skipped questions or missing answer-level evidence lower it.
- The engine abstains (with a stated reason) for straight-lined responses or more than 7 skipped questions; rules stay silent for mid-range scores.
- UI: the Profile tab shows 3 insights, 2 more on request, a "Why am I seeing this?" panel, and opt-in accuracy feedback stored only on the device (`psyche_feedback_v1`, removable).
- Docs: `../docs/INSIGHT_CATALOGUE.md` (generated by `node tools/gen-docs.js`), `../docs/CONTENT_STYLE_GUIDE.md`, `../docs/EVALUATION_RUBRIC.md`.
- Report text is de-duplicated by `text-dedupe.js` (across the 20 traits, Deep Analysis and between tabs).

## Generated traits for pairs and groups (`trait-duo.js`)

The generative trait engine (`TraitsEngine.generate`) now also drives Compatibility and Group. `TraitDuo` runs it once per person on their shared 20 facet scores (answers never leave the device, so evidence is score-based) and compares the generated traits themselves, using the facet-and-pole signature behind each one.

- **Compatibility** (Deeper — facet level, end of the page): a headline and summary, *Traits you share*, *Traits that pull opposite ways* (same facet, opposite poles, with each side's gift, watch-out and a try-this), and each person's three signature traits framed for the person closest to them.
- **Group** (new *Traits* tab): traits several members share, collective watch-outs, what only one person brings, the sharpest opposite-trait tensions between members, where the trait weight sits, and each member's signature.
- Both are included in the PDF reports. They need every person's 20 facet scores; anyone without them is listed as not included, as elsewhere.
- Deterministic and rule-based; trait copy written to "you" is converted to third person. Hypotheses from self-report, not verdicts.

Tests: `node tests/trait-duo.test.js`.

## Profile schema and tests (`profile-schema.js`)

Every result carries `schema` and `versions` (scoring, questions, archetypes, narrative). `ProfileSchema.build(answers)` is the pure scoring pipeline; `ProfileSchema.validate(result)` is the boundary check used when loading from the browser and from the cloud. See `../docs/` for the inventory, feature status, acceptance criteria and defect list.

Run everything: `npm install && npm test`. Golden fixtures in `tests/fixtures/golden-scores.json` were generated from the baseline engine; a change to them must be a reviewed, intentional scoring change (bump `VERSIONS.scoring`).

## The generative engine

`deep_analysis_nlp.py` is the authoritative Python engine — a real
template-grammar NLP system, not a thin wrapper: each of the 9
categories has content for all 5 PRISM dimensions across 3 score bands
(low/mid/high). **v3**: a person's paragraph now draws from every
dimension that has content for that category (not capped at 3 or 4),
and pulls every template variant for each matched dimension-band
(previously just one) — using zero new hand-authored content, this
roughly doubled every category's length again. Career now regularly
runs 200-500+ words; Strength, Weakness, Shadow, and the rest sit in
the 150-300 word range. Closes with a synthesis sentence naming the
top 2 dimensions actually driving that category for that person.

**20 Facts also got the same treatment.** Each facet now carries both
a short one-line `fact` (unchanged) and a new, genuinely large `deep`
field — a 30-115 word elaboration built by combining that fact with
real sentences pulled from the Strength / Misunderstood / At-Your-Best
pools for the facet's parent dimension. This isn't 20 new hand-written
facet-specific blocks; it's the same tested dimension-level content
recombined at a finer grain, so it stayed low-risk to add and is fully
covered by the existing test suite.

**Relationship Handling** doesn't use the top-N-extreme-dimensions
approach at all. It covers all 5 dimensions every time, each mapped to
a distinct relational sub-theme, and — same as v3 — now pulls every
template variant per sub-theme instead of just one, closing with its
own synthesis sentence naming which two sub-themes a partner will
notice first.

`deep-analysis.js` is a JS port of the exact same content and logic
(content transferred via JSON export, not retyped — zero drift), so
Psyche Core keeps working fully offline in the browser.

**The assessment itself stays deterministic on purpose** — the
question-to-score mapping never varies. Only the explanatory layer on
top of a computed score is generative.

## What's deliberately NOT in this build

- **Journal / Growth history**, **Braindump**,
  **CBT Coach** — Compatibility/Match, the Conflict Style Decoder, and
  Group comparison *are* in this build (see above); they're no longer
  excluded.

## Software testing performed (this is not psychometric validation)

Every piece was tested with real execution, not assumed. This shows the code behaves as specified; it says nothing about whether the scores measure what they intend to (see `docs/VALIDATION_PLAN.md`):
- Both engines (`deep_analysis_nlp.py` and `deep-analysis.js`) were
  stress-tested across 200+ random score profiles plus explicit edge
  cases (all-50, all-0, all-100, single-dimension-extreme) — zero
  errors, zero suspiciously short output, every category averaging
  45-160 words
- A real subject-verb agreement bug ("You becomes...") was caught and
  fixed during testing, not shipped
- A missing-return bug that silently produced `None` for the common
  case was caught by the stress test (word-count assertions), not by
  luck
- The full app was run end-to-end via jsdom: 40-question assessment
  completed via simulated clicks, all 5 result tabs rendered
  (including the new Deep Analysis tab), 50-run stress test across
  three answer strategies — zero errors

## Files

- `index.html` — shell + all CSS
- `core-logic.js` — questions, archetypes, scoring engine (deterministic)
- `implications_data.js` — the generative content data, ported from Python
- `deep-analysis.js` — the JS generation engine (mirrors `deep_analysis_nlp.py`)
- `deep_analysis_nlp.py` — the authoritative Python NLP engine
- `app-core.js` — screens, state, rendering, share-card export
- `profile-schema.js` — versioned profile contract, pure scoring pipeline, validation
- `text-dedupe.js` — sentence-level de-duplication of generated report text
- `intelligence-engine.js` — Profile dynamics insight pipeline (v2)
- `trait-duo.js` — generative traits for pairs and groups

## Accounts (Supabase auth)

Optional email + password accounts via Supabase: sign up (with email
confirmation), sign in, forgot/reset password, change password, sign
out. A signed-in user's computed result syncs to a private row so it
follows them across devices (newest copy wins). Individual answers are
never uploaded. With no Supabase config the app runs fully offline,
exactly as before.

### Setup (5 minutes)

1. Create a project at supabase.com.
2. SQL Editor -> paste and run `supabase/schema.sql`, then run
   `supabase/social.sql` (profiles, connections, groups — all with
   Row Level Security — needed for Compatibility and Groups).
3. Project Settings -> API -> copy the **Project URL** and **anon public
   key** into `config.js`. Never use the `service_role` key.
4. Authentication -> URL Configuration: set **Site URL** to your
   deployed URL and add it (and `http://localhost:8000/` for local dev)
   under **Redirect URLs** — confirmation and reset links redirect here.
5. Authentication -> Providers -> Email: keep "Confirm email" on for
   production (or turn it off while testing).
6. Serve over http(s), e.g. `python3 -m http.server 8000` (auth does not
   work from `file://`).

Notes: reset/confirm links use the PKCE flow, so open them in the same
browser you requested them from. Supabase's built-in email sender is
rate-limited; configure custom SMTP before real launch.

Every archetype also has its own emoji (`ARCH_EMOJI` in `core-logic.js`), shown on
the result, library, compare, group and share card.

### Delete account

Signed-in users can delete their own account from the Account page
("Delete my account…", typed `DELETE` to confirm). It calls the
`delete_my_account()` SQL function in `supabase/social.sql`, which removes
the auth user; every table cascades from it (results, profile,
connections, memberships, and groups they own). Pending invitations
addressed to their email are removed too. Re-run `social.sql` once to
install the function. The browser cannot delete auth users with the anon
key, which is why this is a `security definer` function limited to the
caller's own `auth.uid()`.

### Engine Plus (facet-level analysis)

`engine-plus.js` works on the 20 facet scores, not just the 5 dimensions:
a **Patterns** tab on your result (behaviour patterns, internal
tensions, 8 situational scenarios, growth plan, facet map); a facet-by-
facet pair comparison with a relationship lens (partners / friends /
colleagues / manager / family) and conversation starters; and for groups
a *Scenarios* tab (playbook + suggested actions), a *Roles* tab (8 team
roles + gaps) and a facet heatmap. Rule-based, deterministic, in-browser.
Sharing facet scores needs `supabase/social.sql` re-run once (adds
`profiles.facets`); older profiles fill in when each person next opens
the app while signed in.

## Deploying

Static files, zero build step:

```
netlify deploy --dir=.
```

## Data & privacy

Signed out: the current result is saved to `localStorage` under
`psyche_core_v1` and never sent anywhere. Signed in: the computed result
(scores, facets, archetype match) is also stored in your Supabase
project, readable only by that user (RLS). Signing out removes the local
copy once it is safely synced.

## UI refresh
- Bricolage Grotesque variable font is bundled in `fonts/` (OFL licence) — upload that folder too.
- Home: interactive prism hero (tap a ray), archetype carousel, tiles. Assessment: 40-segment progress in dimension colours, sliding question transitions. Results: radar chart, animated bars, count-up numbers, scroll position kept across tabs.
- All motion respects `prefers-reduced-motion`.

## Compatibility and Group additions (social-plus.js)
- Compatibility: how to talk to each other (per dimension, both directions), giving feedback, what each of you covers for the other, how the pairing tends to change over time, and a shareable image card.
- Group, new "Teamwork" tab: how a decision meeting is likely to go, who the group is missing, and the best pair for six kinds of work.
- All rule-based and deterministic; no external service. Needs only the five dimension scores.


## Assessment quality tooling (Phase 3)

- `docs/CONSTRUCTS.md`: what each dimension and facet is meant to describe, and what it must not be used to claim.
- `docs/ITEM_REVIEW.md` (from `tools/item-review.json`): desk review of all 40 items. A test fails if an item's wording changes without a re-review.
- `docs/ASSESSMENT_DESIGN_ANALYSIS.md` (`npm run design-analysis`): seeded simulation of what the item design can and cannot support (score resolution, archetype behaviour under random answers, measurement-noise ceiling). Simulation, not evidence.
- `tools/psychometrics.js responses.csv [--retest second.csv]`: item descriptives, floor/ceiling, corrected item-total, facet inter-item r with Spearman-Brown, dimension alpha, facet overlap, straight-lining, and test-retest (r, ICC, SEM, MDC95). Run it only on consented data. Helpers are unit-tested in `tests/psychometrics.test.js`.
- `docs/VALIDATION_PLAN.md`: studies, samples, pre-registration, decision rules. **No validation study has been run.**
- `docs/CLAIMS.md` and `tests/claims.test.js`: approved and prohibited product claims, enforced on user-facing copy.
- Response quality v2: consistency is computed on direction-aligned answers (see `docs/DEFECTS.md` D14). Scores, dimensions and archetype keys are unchanged.

## Phase 4 — UX, accessibility, onboarding
See `docs/UX_A11Y.md`. `npm test` runs the jsdom UX tests; `npm run test:e2e` runs the keyboard journey and an axe audit in Chromium. Automated results only: screen-reader and real-device testing are still to do.

## Phase 5 — Security, privacy, data governance
- Apply SQL in order: `supabase/schema.sql`, `supabase/social.sql`, **`supabase/phase5-hardening.sql`** (staging first), then run `supabase/tests/rls.test.sql` there. Re-run the hardening file after any re-run of `social.sql`.
- `npm test` includes `tests/security.test.js`; `npm run test:e2e` includes `tests/e2e/security.js` (real Chromium, fake Supabase client; proves client behaviour only).
- Read `docs/SECURITY.md` (what is and is not verified), `docs/DATA_INVENTORY.md`, `docs/STAGING_VERIFICATION.md`, `docs/INCIDENT_RESPONSE.md`, `/SECURITY.md`.
- Open before launch: SRI hash, live RLS verification, Render headers, dependency audit, backup drill, owner decisions (D32, D43, D45-D47).
