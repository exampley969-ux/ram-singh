# Comparison, group, export and sharing rules (Phase 7)

Code: `psyche-core/share-policy.js` (rules), `app-core.js` (screens), `tests/phase7.test.js` (checks). Change a rule there first, then update this page.

## 1. What is shared, with whom
| Action | What the other person/group can see | Never shared |
|---|---|---|
| Accept a connection / create or open a share link | Your name, 5 dimension scores, 20 facet scores, archetype | Individual answers, drafts, skipped list |
| Join a group | Same fields, visible to everyone in the group including people who join later | Same |
| Save an image / PDF yourself | Whatever you choose to send on | Individual answers (never in any export) |

Private by default: your profile row exists for the app to work, but database policies only show it to accepted connections and group members (verified by `supabase/tests/rls.test.sql`, which still has to be **run against staging**, see D45).
Consent text (`SCOPE_TEXT`) appears on connection invitations, group invitations and the share-link screen, including the honest limit: **leaving or removing stops further access but cannot take back what someone already saw, saved or exported.**
Share links are one person, one use, and expire after 14 days (Phase 5 SQL).

## 2. Similarity is not compatibility
The ring score is labelled **similarity**: the average numeric closeness of two profiles. The screen states that similar scores do not guarantee a good relationship or team and that differences are questions to discuss. The feature and screen are still called "Compatibility" because users search for that; the score itself is not claimed to predict compatibility. The formula is unchanged (no scoring change).

## 3. Groups
| Size | Behaviour |
|---|---|
| 2 | Banner: this is a pair comparison, not a group pattern |
| 3-4 | Banner: one person changes every average and "X of N" count; treat as conversation starters |
| 5+ | Banner: describes how self-reported profiles combine, not performance |

Every group view and the group PDF also carry: *for self-reflection and conversation only, not for hiring, promotion, selection or exclusion decisions.*
**Why we warn rather than hide:** everyone in a group has already chosen to share their scores with all members, so hiding aggregates would not protect anyone from the group itself. The risk at small N is over-reading, so the product warns about that. If you later add **anonymous** aggregates (people who did not consent to individual visibility), you must suppress results below a minimum size instead; that rule does not exist yet.
Known limitation: the "Roles", "Team" and "careful review" tabs name individuals as natural fits. The copy says these are tendencies and anyone can step into any role, but a user could still misuse them. Consider removing named "champion" lists if beta feedback shows misuse (D53).

## 4. Export
- The individual PDF has a section chooser (summary, 20 traits, best/stress, deep analysis, career, relationships, patterns). Header with the archetype is always included. Choosing nothing is blocked.
- Every PDF (individual, comparison, group) ends with: date, engine versions, snapshot notice (does not update), method, limits, and "individual answers are not included".
- Image export and PDF are generated in the browser. Nothing is hosted, so there are no public share URLs to index or revoke.
- Expiring/revocable **hosted** report links are not built, deliberately: they would create a new public data surface. If added later they need random unguessable tokens, `noindex`, expiry, owner-revocation and unauthorized-access tests (Phase 5 style).

## 5. Feedback and metrics
Insight feedback (accurate / partly / inaccurate + note) stays on the device and can be removed (Phase 2). It does not change scores.
Metrics we want are listed in `PRODUCT_METRICS.md`, with how each can be measured without collecting personal data. None is collected remotely today.
