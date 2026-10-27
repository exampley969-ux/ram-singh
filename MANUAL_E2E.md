# Production-like end-to-end checklist (gate F2)

Run on **staging** (real Supabase project configured like production, Confirm email ON), once per release candidate. Use two real email inboxes and two browsers/profiles (B1, B2). Mark each Pass/Fail with the commit and date. Any Fail on a P0 step blocks release.

| # | Step | Expected | Pass/Fail |
|---|---|---|---|
| 1 | Open the site fresh (B1). Read the first screen | Purpose, time, privacy and "not clinical" shown before question 1 | |
| 2 | Start the assessment, answer 10, close the tab, reopen | Resumes at question 11 with the same answers | |
| 3 | Skip 2 questions, finish | Skipped list shown; can answer them; result flagged if left skipped | |
| 4 | Read every result tab | No blank or broken tab, no console errors | |
| 5 | Reload the page | Same result, no flash of wrong data | |
| 6 | Sign up with email A | Confirmation email arrives; cannot use cloud features until confirmed | |
| 7 | Confirm, sign in | Result syncs; status shows saved | |
| 8 | Open B2, sign in as A | Same result appears | |
| 9 | Turn B1 offline (devtools), retake the test, go online | Status "offline", then syncs automatically; B2 shows the newer result after refresh | |
| 10 | Sign out in B1 | Local result and feedback cleared (or kept only per documented behaviour); no personal data left | |
| 11 | On the same browser sign in as user C (second account) | C never sees A's result; A's result is never uploaded to C | |
| 12 | A creates a share link, C accepts | Both see each other's scores; similarity screen shows the "similarity is not compatibility" note and scope text | |
| 13 | A removes the connection while C's tab stays open | C loses access on next request without re-login | |
| 14 | A creates a group of 4 (A, C, D, E), all join | Small-group notice shown; use-limits line shown | |
| 15 | A removes E; E keeps the old tab and refreshes | E can no longer read the group, members or their profiles | |
| 16 | Export the PDF with only "Deep analysis" ticked | Only that section + header + report details (date, versions, method, limits); no answers | |
| 17 | Export the comparison and group PDFs | Footer has similarity note / group-size note / use limits | |
| 18 | Change password in B1 | B2's session ends | |
| 19 | Delete saved result | Cloud result and shared scores cleared; profile no longer shows scores to connections | |
| 20 | Delete account | Can no longer sign in; A's connections and memberships gone; local data cleared | |
| 21 | Keyboard only (no mouse) through steps 1-5 and 16 | Everything reachable, focus visible, focus moves to new headings | |
| 22 | Screen reader (VoiceOver/NVDA/TalkBack) through steps 1-5 | Headings, form labels, progress and tab states are announced sensibly | |
| 23 | 320 px wide phone viewport | No horizontal scroll, controls usable | |
| 24 | Trigger a render error in a test build / block the Supabase script | Recoverable message; app still works offline | |
