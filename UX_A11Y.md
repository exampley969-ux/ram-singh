# UX, accessibility and onboarding (Phase 4)

Status: automated checks pass; **manual screen-reader and real-device testing has not been done.** Do not describe the app as "accessible" or "WCAG compliant" until the manual checklist below is run.

## What was changed and why
| Area | Decision |
|---|---|
| First session | `intro` screen before question 1 (copy in `ux.js` `INTRO`, guarded by tests/claims). Time shown as "5-8 minutes (estimate)": not yet timed with real users; replace with beta data. |
| Resume | Draft key `psyche_core_v1_draft`: only answers given and position. Removed on finish or Start over. Same retention class as D6 (raw answers on device); Phase 5 decides the long-term policy. |
| Skipped questions | Review screen before the result; skipping is still allowed. Scores unchanged (skips count as neutral, D2). |
| Report | Summary tab in the roadmap order: profile, strongest findings, profile dynamics, practical actions, method and limits. Deeper tabs unchanged. |
| Score meaning | `PsycheUX.scoreMeaning`: "does not mean" text comes from `CONSTRUCTS.md`. Ranges: lower <= 38, higher >= 62 (same cut-offs the compatibility code already used). |
| Colour | Every score has its number and a range word; ticks on bars mark the cut-offs; facet rows say the range. Dimension colours are decoration. |
| Keyboard | Skip link; one `h1` per screen; focus moves to it (or to the question) on change; tabs are `role=tab` with arrow, Home, End; 1-5 answer; `role=button` elements take Enter and Space. |
| Targets and text | Controls >= 44px (pills 36px), text >= 12px except the print report. |
| Motion | Existing `prefers-reduced-motion` rule kept; answer auto-advance delay skipped when set. |
| Failure states | Error boundary, no-result, offline, account-unavailable, persistent unreadable-save banner. |
| Contrast tokens | Light `--I` #B45309 to #A34A07; dark `--P` #8B5CF6 to #9B78F9; number badge text uses `--bg`; hero tint 10%. All text tokens >= 4.5:1 on bg, surf and surf2 in both themes. |

## How to run
```
npm test            # includes tests/ux.test.js (jsdom)
npm run test:e2e    # real Chromium: keyboard journey + axe audit (set PSYCHE_CHROMIUM if not auto-found)
```

## Results (this build)
- axe-core 4.10, tags wcag2a/2aa/21a/21aa/22aa, 13 screens x light/dark x 320/390/768/1280px: **0 violations** (baseline before Phase 4: nested-interactive 16, progressbar-name 16, scrollable-region-focusable 56, color-contrast 10 nodes).
- Horizontal page overflow: **0** at all four widths.
- Keyboard-only journey: 40 questions by number keys, all 6 result tabs by arrows, 25 focus stops with a visible indicator.

## Not covered (be honest in any claim)
- Real screen readers and real phones; low-powered device performance (Phase 6).
- Compare, Group, Account and Auth screens with live data (needs staging Supabase); only signed-out states were audited.
- Text-resize to 200% and browser zoom to 400%: reflow at 320px is checked, resize is not.
- Whether people understand the copy. Exit criterion "users can explain what a score means, what it does not mean and what to do next" needs a small think-aloud study (5-8 people, diverse reading levels) before it can be called met.

## Manual checklist (run before beta)
1. NVDA + Firefox/Chrome (Windows), VoiceOver + Safari (macOS and iOS), TalkBack + Chrome (Android).
2. Complete the assessment with the screen reader on: is each question read with its number, are answers announced as pressed, is the new question read after answering?
3. Result: headings navigation lists the five sections; each dimension disclosure reads score and range; radar is not read twice.
4. Tabs announce "tab, 2 of 6, selected"; panel is reached after the tab.
5. Resume after a refresh; skipped-question review; offline banner announcement.
6. 200% text size, 400% zoom, Windows high-contrast, Android large text, landscape phone.
7. Record defects in DEFECTS.md with the device and assistive technology used.
