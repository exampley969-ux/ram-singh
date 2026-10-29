# Claims policy and register (Phase 3)

Governing rule (roadmap, Phase 3): until evidence supports stronger claims, PRISM is a **structured self-reflection framework**. The wording below is enforced on user-facing copy by `psyche-core/tests/claims.test.js`.

## Allowed now
| Claim | Why it is supported |
|---|---|
| Scores are computed deterministically from your 40 answers; same answers, same scores | `tests/scoring.test.js` (69 golden cases) |
| A self-reflection tool; gives starting points for reflection and conversation | Intent statement, not an effectiveness claim |
| Insights are tendencies and hypotheses, each with the scores behind it | Insight pipeline v2, `INSIGHT_CATALOGUE.md` |
| Not diagnostic, not clinical, not for hiring or selection, not a prediction of behaviour | Product boundary (`FEATURE_STATUS.md`) |
| Built on common ideas from trait psychology (dimensions with facets) | Design influence only; no equivalence is claimed |
| Results can change between sittings; archetype especially | Design analysis (`ASSESSMENT_DESIGN_ANALYSIS.md`); S2 will measure |

## Not allowed until the named evidence exists
| Claim | Needed evidence |
|---|---|
| "Scientifically validated", "proven", "research-backed" | S1-S4 reported (`VALIDATION_PLAN.md`) |
| "Same architecture / structure as the Big Five or HEXACO" | S1 structure result and S3 convergence |
| "Accurate", "precise", "reveals your true self" | Not claimable for self-report; avoid permanently |
| "Predicts career, relationship or team success" | Criterion-validity study; avoid |
| "Reliable" / "stable" | S2 retest results |
| "Useful", "helps you grow" (as a finding) | S5 usefulness study |
| Any facet-level precision (e.g. treating 63 vs 75 as meaningful) | S2 SEM and MDC95; today nine score values only |
| Clinical or diagnostic language other than as a disclaimer | Never |

## Wording guide
- Say: "tends to", "your answers suggest", "a starting point for reflection", "one possible reading".
- Avoid: "you are", "this proves", "scientifically", "accurate", "true self", "predicts".
- Archetype: "your closest archetype in this sitting"; mention that it can differ next time.
- Disclaimers are required wherever the words "diagnostic", "clinical", "validated" or "scientific" appear in user copy (the test checks the sentence for a negation or the Scientific breakdown context).

## Review rule
Changes to this file, to the claims test, or to copy that mentions validity need a second reviewer (roadmap: review for changes to product claims). When a validation study reports, update the register in the same change as the copy and cite the report.
