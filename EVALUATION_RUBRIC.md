# Human review rubric for insights (roadmap Phase 2 exit criterion, reused in Phase 8)

The automated tests check structure and safety. They cannot judge whether an insight is *useful*. Use this rubric on the fixed evaluation set (`tests/fixtures/eval-profiles.json`) and on a sample of real profiles from the beta.

## Procedure
1. Run `node tools/gen-eval-pack.js` to produce `docs/eval-pack.md` (rendered insights for each evaluation profile, scores hidden from the reviewer sheet order).
2. Two reviewers score each insight independently, **without** seeing each other's scores or the engine's confidence label.
3. Record results in a spreadsheet: profile, insight id, the six scores below, free-text note.
4. Resolve disagreements of 2+ points by discussion. Report the distribution, including bad results. Do not select favourable examples.

## Scores (1 = poor, 3 = acceptable, 5 = excellent)
| Dimension | Question |
|---|---|
| Specificity | Is it tied to these scores rather than being true of nearly everyone? |
| Evidence alignment | Do the scores and answers shown actually support the statement? |
| Non-repetition | Does it add something not already said elsewhere in the report? |
| Tone | Neutral, concrete, non-flattering, non-alarming? |
| Actionability | Is the experiment small, clear and measurable? |
| Calibration | Does the wording avoid unsupported certainty? Is confidence plausible? |

## Gate (before beta)
- Mean ≥ 3.5 on every dimension, and no single insight with Calibration or Tone ≤ 2.
- Any insight scored ≤ 2 by both reviewers is fixed or removed, then the set is re-reviewed.
- Record reviewers, date, engine and catalogue versions. Reviewers are not the authors of the text.

Status: **not yet run** — requires human reviewers.
