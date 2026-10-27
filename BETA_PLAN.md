# Beta plan (Phase 8)

Purpose: find out whether real people understand the results, find them useful, and are not misled about what PRISM can claim. It is **not** a validation study (that is `VALIDATION_PLAN.md`). Do not describe beta results as validation.

**Before you start (owner decisions, record them in `release-evidence.json` notes):**
1. Confirm the pass thresholds in section 5. They are proposals. Fix them *before* seeing any data, otherwise you will be tempted to move them.
2. Ask your institution (BKBIET) whether research with people needs ethics/committee approval or a supervisor's sign-off, even for a small non-clinical pilot. Do not skip this question.
3. Fill the contact and data-handling blanks in `BETA_CONSENT.md`.

## 1. Who
- Target **12 minimum, 20 ideal** adults (18+) who have not seen the product. No friends-only sample: aim for a mix of ages, study/work backgrounds, first languages, phone types, and at least two people who use a screen reader, magnification or other assistive tech.
- Exclude anyone who wants it as a mental-health assessment or for a hiring decision (say so up front).
- Record only: participant code (P01...), age band, device/browser, assistive tech yes/no. No names in results sheets. Keep the code-to-name list (if any) separate and delete it after the beta.

## 2. Session (about 30 minutes, moderated, screen shared or in person)
1. Consent (read, ask questions, sign/agree). Offer to stop at any time.
2. **Think-aloud** first run: open the site, do the assessment. Do not help unless they are stuck for >60 seconds; note where.
3. Read the result. Ask them to explain in their own words: what does this score mean, what does it *not* mean, what would you do next?
4. Open "Profile dynamics" and one "Why am I seeing this?". Ask: is any of this specific to you? Give a real example from your life, or say there isn't one.
5. Comparison (pairs of participants who agree, or the moderator's test account): read the similarity score; explain what it means.
6. Quiz and survey (`BETA_SURVEY.md`).
7. Debrief. Remind them the result is a self-reflection snapshot, not a diagnosis. Delete their test data on request, on the spot.

## 3. What to record per participant
Completion (yes/no, where they stopped), time taken, confusion points, quiz answers, 1-5 ratings, the example (yes/no), verbatim misunderstandings, defects seen (with severity per `ACCEPTANCE.md`).

## 4. Stop conditions
- A participant is upset by a result: pause, say it is non-clinical, do not interpret further, suggest speaking to someone they trust or a health professional if they are worried, and end their session if they wish.
- Any data exposure (one participant sees another's data): stop the beta, follow `INCIDENT_RESPONSE.md`.
- Two participants misread the product as diagnostic: stop and fix the wording before continuing.

## 5. Proposed pass thresholds (confirm before starting)
| Measure | Pass |
|---|---|
| Completion of the assessment among those who start | >= 90% |
| Quiz Q1-Q4 (what it is / is not / similarity / hiring) all correct | >= 80% of participants |
| Quiz Q5 (what is shared) correct | >= 80% |
| Specificity rating ("this is about me, not everyone"), median | >= 3.5 / 5 |
| Actionability rating, median | >= 3.5 / 5 |
| Gave a real-life example for at least one insight | >= 70% |
| Said or implied the tool is a diagnosis / hiring tool / predicts success, after reading the result | 0 participants (any case = fix wording, re-test with 3 new people) |
| New S1 or S2 defects | 0 open at the end |
Report **all** results including failures. Small samples give wide uncertainty: with 12 people, 80% means "at least 10 of 12". Say that.

## 6. After
Write `docs/beta/BETA_SUMMARY.md`: sample description, each threshold with the number, defects found, what changed, what did not change and why. Update `release-evidence.json` (B1-B3) only with that summary as evidence. Delete raw session notes on the schedule in the consent form.
