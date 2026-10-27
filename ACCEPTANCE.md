# Acceptance criteria — P0 features

| ID | Journey | Passes when |
|---|---|---|
| A1 | First visit → assessment | 40 questions answerable by keyboard and touch; progress shown; skipped items are allowed but counted, stored as `skipped`, and flagged on the result |
| A2 | Scoring | Same answers always give same dims, facets, archetype; all-1, all-3, all-5 and tie cases covered by tests |
| A3 | Result reload | Valid saved result renders after refresh; corrupt/old/foreign data is rejected safely (no blank or broken report) |
| A4 | Result views | Every tab renders for any valid profile without console errors |
| A5 | Sign-in sync | Newest valid copy wins; an invalid cloud copy never replaces a valid local one; failure shows status |
| A6 | Sharing | Only 5 dims, 20 facets and archetype are shared; never answers; requires an accepted connection/group |
| A7 | Deletion | Account deletion removes result, profile, connections, memberships, groups owned; local copy cleared |
| A8 | Claims | No copy implies diagnosis, validation, or prediction beyond available evidence |

Defect severity: **S1** data loss/exposure/broken core flow · **S2** wrong or misleading output · **S3** polish.

## Phase 4 additions
| ID | Journey | Passes when |
|---|---|---|
| A9 | First session | Purpose, time, answer use, privacy and non-clinical scope are shown before question 1 |
| A10 | Interrupted session | A refresh, closed tab or "Save and finish later" resumes at the same question with the same answers; Start over discards |
| A11 | Skipped questions | The user is shown which were skipped and can answer them before the result |
| A12 | Keyboard | Home to result and every result tab work with the keyboard alone; focus is always visible; focus moves to the new heading |
| A13 | Meaning | Each dimension explains what the score means, what it does not mean, and one next step; ranges are text, not colour only |
| A14 | Layout | No horizontal page scroll at 320, 390, 768 and 1280px; controls at least 44px |
| A15 | Failure | A broken screen, missing result, unreadable save and offline state each show a recoverable message |

## Phase 5 additions
Status key: **auto** = passes in this repo's tests; **staging** = written, needs a live project; **manual** = needs a person.
| Criterion | Status |
|---|---|
| User A cannot read, edit or delete User B's result | staging (`rls.test.sql` T2) |
| Removed group member loses access with an old session | staging (T6) + manual case 4 |
| Role / id / status changes in client requests are rejected | staging (T3, T4, T6) |
| Unverified email cannot claim invitations | staging (T5) |
| Deletion removes live records and states the backup window | staging (T9); backup period owner decision (D46) |
| No secrets or raw answers in uploads, logs, client errors | auto (`security.test.js`, `e2e/security.js`) |
| Account switching never moves one person's result into another account | auto (browser test) |
| Sign-out / delete leave no personal local data | auto (browser test) |
| Existing-email sign-up is indistinguishable from a new one | auto |
| Other sessions end on password change | auto (fake backend); manual case 7 for the real behaviour |
| CSP enforced, no violations in normal use | auto in Chromium; production headers manual |
| Data inventory, retention, deletion paths, incident process, vulnerability route documented | done; owner names and periods pending (D46) |
