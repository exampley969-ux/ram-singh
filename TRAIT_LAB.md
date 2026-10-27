# Trait lab: how the numbers are made

Everything is computed in the browser from the 20 facet scores on screen. Nothing is stored, synced or sent. Lab state is in memory and resets when the result changes.

## What-if
`EnginePlus.whatIf(scores, edits)` copies the scores, applies the edits (0-100, whole numbers; unknown keys and non-numbers ignored), runs the normal `individual()` and `discover()` on both versions and reports the difference. It uses the same rules as the report, so a what-if score behaves exactly like a real one. It is a thought experiment, not a prediction.

## Interaction heatmap
For a trait pair (a, b) and each of the 8 situations that both traits feed: each trait "pushes" the situation by `sign(weight) x (score - 50) / 50`. If both push the same way the pair reinforces; if opposite ways it pulls against. The cell value is `(reinforce - oppose) / capacity`, in -1..+1. An active entry in the tension list forces the value below zero. A pair that shares no situation and no tension but sits in a named pattern is "linked" with value 0. Every other pair is "no rule" (68 of 190 are linked). **This is not a correlation between traits in any population.** It says how this app's own situation formulas combine two traits.

## Drill-down
Shows the two questions behind a trait and the answers stored on the device (each answer moves the score up to 25 points from 50; see `Engine.score`), the situations and patterns that use the trait, and its strongest partners from the heatmap rule. If the answers are not stored (older result, cleared data), it says so and shows nothing invented.

## Limits to keep in the copy
- Two questions per trait: the score is coarse. Do not describe it as precise.
- Reinforce / oppose describes formula behaviour, not how two traits interact in a person.
- Do not call any of this a trained model or a prediction.
