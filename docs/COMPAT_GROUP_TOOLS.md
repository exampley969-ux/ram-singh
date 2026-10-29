# Compatibility and group tools: how each is made

All rule-based and computed in the browser from the 20 facet scores people already shared. Nothing is stored or sent. Lab state (sliders) is in memory and resets when the scores change.

## Compatibility
- **What-if**: copies one person's scores, applies edits (0-100, whole numbers, bad input ignored), reruns `pair()`. Similarity = 100 minus mean absolute gap over 20 traits. Similarity is not compatibility.
- **Shared lean / covering**: per trait, high/low = 62+ / 38-. Both on the same pole = shared lean; clear opposite poles = covering; both balanced = flexible.
- **Friction forecast**: the three situations (of 8) with the largest score gap, at least 15 points. Text reuses the existing role lines and growth/leverage steps.
- **After a hard day**: voice = expression 50+, company = gregarious 50+, lingering = stability (38- slower, 62+ faster). Four plain-language styles; a tendency only.
- **Who leads what**: higher situation score leads, within 8 points either. Flags when one person would lead 75%+ of the decided situations.

## Group
- **Cover depth**: the 8 existing roles; a natural fit is a role score of 62+. Single cover = exactly one fit; backup = next best.
- **Fault lines**: every two-way split (each side at least 2 people when n >= 4) is scored as between-group sum of squares / total sum of squares across all 20 traits; the best split is shown with its top 3 driver traits. 0 to 1. Labels: 0.6+ clear split, 0.4+ moderate, below that no clear camps. Limited to 14 members. With 4 or fewer people some split always looks strong.
- **Meeting role rotation**: 4 roles with weighted trait formulas. Week 1 is a greedy best-fit assignment, later weeks rotate the order so everyone moves.
- **Learning buddies**: pair score = sum over traits of max(0, gap - 20). Perfect matching by bitmask dynamic programming (optimal; checked against brute force). With an odd group one person joins a pair as a third. Limited to 16.
- **What-if member**: edits one member's scores, reruns the group situation averages, role cover and fault line.

## Limits to keep in the copy
- Self-report, 2 questions per trait: coarse. Tendencies, not behaviour or performance.
- Not for hiring, firing or ranking people.
- Do not call any of it a trained model or a prediction.
