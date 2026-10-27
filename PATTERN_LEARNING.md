# Pattern discovery: today, and the path to a learned model

## Today (algorithmic, not a trained model)
`EnginePlus.discover(facets, covered, opts)` scans every pair and triple of a person's clearly high (62+) or clearly low (38-)
traits, drops combinations a named pattern already covers, ranks the rest with `defaultRank`, and writes notation and a hedged
sentence from the facet pole descriptions. It is deterministic, explainable and needs no data. The UI says "not a trained model"
and must keep saying so until a real model is deployed.

## What a learned model would need (not started)
Nothing here is collected today. No result, score or feedback leaves the person's device except for the existing opt-in account sync.

1. **Consent.** A separate, optional "Help improve Psyche" choice, off by default, explained in plain language, withdrawable at any
   time, with deletion included in "delete my data". Not bundled with sign-up. Needs an owner-reviewed privacy-notice change first.
2. **Data (minimum fields).** An anonymous random ID; the 20 facet scores; engine and catalogue versions; response-quality flags; per
   insight/pattern feedback (accurate / partly / inaccurate). No email, no name, no raw answers, no free text.
3. **Volume.** Several hundred consented results to explore structure (for example which facet combinations are common);
   about 1,000+ results with feedback before any ranking model is trusted. Fewer than that, keep the heuristic.
4. **Model options, simplest first.**
   - Population statistics: how unusual a combination is (a rarity score replaces the plain distance from 50).
   - Clustering / factor structure on the 20 facets, reviewed by a qualified psychometrician.
   - A ranking model that learns which discovered combinations people rate "accurate" (feedback is a signal, not ground truth).
5. **Evaluation before use.** Hold-out set; compare against the default ranker on a fixed review set (see `tests/fixtures`); human
   reviewers score specificity, repetition and unsupported certainty; subgroup check for bias; no release if it is less explainable
   without being clearly more useful.
6. **Claims.** Describe it as "ranked using patterns in anonymous, consented results" only when that is true. Never "AI-powered" for
   rule-based parts. Update `docs/CLAIMS.md` and the in-app wording together with the model.

## The hook
`discover(f, covered, { ranker })` accepts `ranker(combo) -> number`, where `combo` has `keys`, `zones`, `base` (mean distance from
50, 0-1), `min`, `diversity` (distinct dimensions / size). A non-numeric result falls back to `defaultRank`, so a bad model cannot
break the report. The model must run in the browser (small weights file) or the person's scores would have to leave the device,
which needs its own review.

## Decisions needed from the owner before any collection
- Whether to collect at all, and the retention period.
- Where it is stored (a separate table with its own access rules, never joined to the account table).
- Who reviews the privacy notice change and the model evaluation.
