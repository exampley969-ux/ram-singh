# Validation plan (Phase 3)

Status: **plan, not results.** No validation study has been run. Until the studies below report, PRISM is a *structured self-reflection framework* (see `CLAIMS.md`). This plan covers the roadmap's Phase 3 list; the owner decisions it needs are at the end.

Tooling already in the repo: `tools/psychometrics.js` (item, scale, structure and test-retest analysis of a CSV), `tools/psychometrics-lib.js` (tested helpers), `tools/design-analysis.js` (model-based design limits), `ITEM_REVIEW.md`, `CONSTRUCTS.md`.

## 0. Principles
- Pre-register hypotheses and thresholds **before** looking at data (a dated file in this repo is enough). Report negative and inconclusive results in `docs/VALIDATION_REPORT.md` with N, recruitment, exclusions and confidence intervals. No cherry-picking, no post-hoc threshold changes without saying so.
- A high reliability coefficient alone does not show validity; two items per facet cannot support an alpha at all.
- Data collection is separate from the product: no research data is collected by the app today (answers stay on the device unless the user signs in; see `DEFECTS.md` D6). Study data is collected through a separate consented form, never by silently logging production users.
- A qualified psychometrician reviews the analysis plan and the report. This plan is a starting point for them, not a substitute.

## 1. Study sequence
| Study | Question | Sample (suggested) | Method | Output |
|---|---|---|---|---|
| S0 Cognitive interviews | Do people read each item as intended? | 8-12, from intended audience | Think-aloud on all 40 items, priority on items flagged in `ITEM_REVIEW.md` | Revised item set (new `versions.questions`) |
| S1 Pilot, structure and items | Do items behave (variance, floor/ceiling, item-total)? Does the 5x4 structure hold? | n >= 400 completes (rule of thumb 10 per item; confirm with a statistician) | `tools/psychometrics.js`; then exploratory then confirmatory factor analysis on split halves; ordinal (polychoric) methods | Item decisions, structure report |
| S2 Test-retest | Are scores stable beyond measurement noise? | n >= 150 invited for 100 complete pairs; interval 2-4 weeks (justify: long enough to limit memory, short enough for stable traits) | `tools/psychometrics.js --retest`; r, ICC(2,1), SEM, MDC95, archetype agreement | Stability table; MDC95 used in UI wording |
| S3 Convergent and discriminant | Do facets correlate with established measures as predicted (and not with unrelated ones)? | n >= 200 | Pre-registered correlation matrix against licensed or open reference instruments (below) | Validity table with CIs |
| S4 Fairness | Do items work equivalently across subgroups (age band, gender, language background, education)? | >= 200 per group compared; larger for DIF | Measurement invariance and DIF (ordinal), reviewed by a statistician | Item or wording changes; documented limits |
| S5 Usefulness | Are insights specific, accurate-feeling, actionable? | n >= 60 participants, rated blind to engine version | Rate each shown insight (specificity, fit, usefulness, can give a real example); compare against a **shuffled-profile control** (insights from a different person's profile) to see whether fit ratings exceed the generic baseline | Usefulness report (separate from measurement validity) |

Precision for planning (Fisher z, 95% CI, from `tools/psychometrics-lib.js` conventions): with n=100, an observed retest r of .75 has CI .65-.82; with n=200 and r=.50 the CI is .39-.60; with n=300 and r=.30 the CI is .19-.40. Smaller samples cannot distinguish "acceptable" from "poor" for individual facets.

## 2. Reference instruments (check licence and terms before use)
- IPIP item pools (public domain): usable for Openness, Conscientiousness, Extraversion and Agreeableness facets. Safest default.
- HEXACO-PI-R and BFI-2: free for non-commercial research with the authors' terms; confirm current terms and whether any commercial intent changes this.
- NEO-PI-R / NEO-3: licensed, paid. Needed only if a head-to-head with the standard is required.
- Single-construct scales for facets with no Big Five counterpart (self-concept clarity, need for uniqueness, risk-taking, grit): select after S0, record licence per scale.
Do not copy items from licensed instruments into this repository.

## 3. Pre-registered hypotheses to file before S3 (draft)
Convergent (expected r >= .50 with the matching reference scale): P.abstraction and P.curiosity with Openness/Intellect; S.gregarious with Extraversion/Gregariousness; S.warmth with Warmth/Agreeableness; M.discipline with Conscientiousness/Orderliness; M.persistence with Conscientiousness/Industriousness or Grit-Perseverance; I.distinct with need for uniqueness; I.stability with self-concept clarity.
Discriminant (expected |r| <= .30): P.attention and P.intuition with Conscientiousness; R.risk with Agreeableness; S.harmony with Openness.
Structure: the data separate into the five dimensions better than into a competing Big-Five-like model; if they do not, PRISM dimensions are described as a presentation grouping, not a measured structure.
Known risks stated in advance: overlap of R.adaptability with M.discipline, M.drive with M.ambition (see `CONSTRUCTS.md`).

## 4. Decision rules (proposed; owner and statistician to confirm)
| Result | Action |
|---|---|
| Facet inter-item r (direction-aligned) < .20 | Facet is not a coherent score: rewrite items or show only at dimension level |
| Facet retest r < .60 | No facet-level narrative language; dimension-level only |
| Dimension retest r < .70 or alpha < .70 (8 items) | Describe as indicative only; revise items |
| Facet pair correlation >= .70 | Merge, rewrite, or present as one facet |
| Archetype agreement on retest below ~50% | Archetype shown as a "current reading" with the next-nearest archetype, never as a stable type |
| Any item floor/ceiling > 15% or sd < .8 | Revise item |
| Subgroup DIF found | Revise or drop the item; document residual limits |
Thresholds are conventions, not laws; the report states what was chosen and why.

## 5. Already known without new data (from `ASSESSMENT_DESIGN_ANALYSIS.md`)
- Facet scores have nine possible values; a one-step answer change moves a facet 12-13 points.
- Under simulated measurement noise alone, the archetype label agreed across two sittings of the same simulated person only 11-26% of the time. This depends on assumptions (and real traits correlate), so it is a reason to run S2, not a measured rate; it already justifies the cautious archetype wording in `CLAIMS.md`.

## 6. Ongoing monitoring after launch
Re-run `tools/psychometrics.js` on any consented dataset after every item, scoring or threshold change. Any change to items or scoring bumps `versions.questions` or `versions.scoring`, regenerates golden fixtures with review, and reruns S1/S2 on the changed items.

## 7. Owner decisions needed
1. Who is the psychometric reviewer, and who owns recruitment and consent (ethics review if affiliated with an institution)?
2. Intended audience and languages (decides S0 sample and S4 groups).
3. Whether any commercial use is planned (decides reference-instrument licences).
4. Budget for licensed instruments, if any.
