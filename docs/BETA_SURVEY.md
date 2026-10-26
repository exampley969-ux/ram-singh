# Beta quiz and survey (Phase 8)

Read questions aloud or show on screen. Record the answer before revealing the key. Key is for the researcher only.

## Comprehension quiz
| # | Question | Options | Key |
|---|---|---|---|
| Q1 | What is this result best described as? | (a) who you really are (b) a snapshot of how you described yourself in this session (c) a clinical assessment (d) a prediction of how you'll behave | b |
| Q2 | Can this result tell you whether you have a mental-health condition? | yes / no / sometimes | no |
| Q3 | Two people get a similarity score of 85. What does that tell you? | (a) they will get on well (b) their scores are numerically close; it does not predict the relationship (c) one of them is wrong | b |
| Q4 | Should an employer use group results to decide who to hire or promote? | yes / no / only if scores are high | no |
| Q5 | If you accept a connection, what do they see? Pick all that apply. | name / dimension scores / facet scores / archetype / your individual answers / your email | name, dimension scores, facet scores, archetype (NOT individual answers). Note: the app does not display emails, but until D61 is fixed a connected person could read your email through the API; do not count "email" as wrong, record it and tell the participant |
| Q6 | How would you check whether an insight is based on your answers? | free text | mentions "Why am I seeing this", the scores shown, or trying the suggested experiment |

## Ratings (1 = strongly disagree, 5 = strongly agree)
1. The report was easy to understand.
2. The insights were specific to me, not something true of almost everyone. (**Specificity**)
3. The suggested experiments were clear and small enough to try. (**Actionability**)
4. I understood what the app is not able to tell me.
5. I would know what to do next after reading this.
6. The wording felt neutral and not flattering or alarming.
For every insight shown: "Can you give an example from your life where this was true or not true?" (yes / no + the example, in their words)

## Open questions
What was confusing? What did you expect that wasn't there? What would you tell a friend this app is for? Would you share your result with anyone? Why or why not? Did anything make you uncomfortable?

## Researcher sheet columns
`participant, age_band, device, assistive_tech, completed, minutes, stuck_at, Q1..Q6, rating1..6, example_given, misread_as_diagnostic, defects, notes`
