# Content style guide (roadmap 2.4)

Applies to every generated or hand-written insight: Profile dynamics, 20 traits, Deep Analysis, Career, Relationships, Compatibility, Group.

## Voice
- **Concrete, neutral, plain.** Say what the pattern may look like in a situation, not what the person "is".
- **Hypothesis, not verdict.** Use "may", "can", "tends to", "check whether". Name the context in which it would not apply.
- **No flattery loops** ("you are rare / special / gifted"), no dramatic labels ("dark", "toxic", "broken"), no false precision (no percentages implying accuracy the instrument cannot support).
- **No diagnosis or prediction.** Never imply a clinical state, a destiny, or a guarantee. Blocked by the safety lint: diagnos*, disorder, syndrome, clinical, pathology, true self, real you, always, never, definitely, certainly, proves, guarantee, destined, doomed, "you are a/an".
- **Second person for the reader, third person for pairs and groups.** Trait copy written to "you" is converted by `TraitDuo`.

## Structure of an insight
1. The pattern and the exact scores behind it.
2. An interpretation framed as a possibility.
3. One small experiment, with a time window and an observable success signal.
4. Confidence for *this inference* (not trait strength), with reasons.
5. "Why am I seeing this?": rule, thresholds, scores, answers, other explanations, a counterexample, limits.

## Rules the code enforces
- A rule speaks only for a defined state; mid-range scores produce no filler.
- One insight per theme; a facet is used at most twice; 3 shown, 2 more on request.
- Abstain on straight-lined or heavily skipped responses; lower specificity and confidence when answer-level evidence is missing.
- Confidence is never "high".
- Sentence-level de-duplication (`text-dedupe.js`) removes repeats across the 20 traits, the Deep Analysis sections and between tabs. Text is only removed, never rewritten. Regression test: `tests/dedupe.test.js` (cross-tab repeats must be 0; within-tab under 3%).
- Scores and archetypes are computed outside any text generation. There is no language model in this build; if one is added, it must use schema-constrained output, minimised input, timeouts, cost limits, content checks and the deterministic templates as fallback.

## Adding or changing an insight rule
1. Add the rule to `RULES` with all four states, rationale, two alternatives, a counterexample, limits and an experiment.
2. Run `node tools/gen-docs.js`, `npm test`.
3. Bump `CATALOGUE_VERSION` for any wording or threshold change, `ENGINE_VERSION` for pipeline changes.
4. Have a second person review the new text against the rubric in `EVALUATION_RUBRIC.md`.
