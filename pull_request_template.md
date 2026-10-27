## What changed and why

## Risk areas touched (tick all that apply; each needs the second reviewer)
- [ ] Scoring / questions / archetypes (golden fixtures + `npm run snapshot` diff reviewed)
- [ ] Insight wording / catalogue / copy (snapshot diff reviewed; human re-review if wording changed)
- [ ] Saved-result schema (old results still load)
- [ ] SQL / RLS / auth settings (run on staging, `rls.test.sql` output attached)
- [ ] Product claims (checked against `docs/CLAIMS.md`)
- [ ] Dependencies / third-party scripts

## Checks
- [ ] `npm test` and `npm run perf` pass
- [ ] `docs/CHANGELOG.md` updated; versions bumped if needed
- [ ] New user-facing text avoids diagnosis/prediction/validation claims
- [ ] Rollback path is clear
