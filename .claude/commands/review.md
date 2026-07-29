# /review — PR review + merge loop

You review one open, non-draft pull request end-to-end: find issues, fix
them, keep the branch mergeable, and merge it once it's clean. Obey
`CLAUDE.md` P1–P5 and the §8 quality gates throughout. Read the §5
path-map `FEATURE.md` for anything the PR touches before judging it.

## Review criteria

Judge the diff against all of these — a PR can fail on any one of them:

- **Security**, including SQL injection and other OWASP top 10 classes.
- **Readability.**
- **Scalability.**
- **Consistency** with surrounding code and documented decisions.
- **Reusability.**
- **Developer experience.**
- **User experience, most importantly** — minimum actions for maximum
  value, and minimum user-regretted-seconds (interruptions, spam,
  anything that costs the user time without giving them something back).
- **Observability** — present, but non-spammy (no noisy spans/logs/metrics
  that drown the signal).
- **Robustness.**
- **Comments** — at most one judicious sentence where the WHY is
  non-obvious; never spammy, never restating the code.
- **Docs kept in sync** with the change (`FEATURE.md`, `GLOBAL-NNN`,
  README, per P1/P3).
- **Design for leverage** — run the `design-for-leverage` skill's check:
  does this diff invest (add capacity to add capabilities) or merely
  spend (add one capability)? Apply its N+1 test and diff-composition
  test before judging the change done.

## The loop, per PR

1. **Fix pass.** Review the PR against every criterion above. Fix what
   you find directly on the PR's branch. Rebase onto the base branch and
   carefully resolve any conflicts — never drop either side's intent
   silently. Get CI green; if a failure is unrelated to the PR (fails on
   the base branch too), say so in a PR comment rather than papering over
   it.
2. **Re-review gate.** If step 1 applied any fix, do not merge yet —
   the fixes themselves need review. Run another full pass against the
   same criteria list.
3. **Repeat** step 2 until a pass finds zero fixable issues.
4. **Before merging any PR:** ensure `docs/blocked-by-human.md` exists
   (create it if missing). Add a bullet only for something a human must
   actually do — a new env var, a click on some website, a legal/bank/
   money decision — or a decision you couldn't disambiguate from
   `docs/guidelines.md` and the rest of the docs and need human approval
   to resolve (including approval to amend `docs/guidelines.md` itself
   to unblock the decision permanently). If you can disambiguate a
   decision yourself using the existing guidelines, do that instead of
   queuing it — don't park what you can resolve.
5. **Merge** once a pass finds zero fixable issues and CI is green. Package
   version bumps and vulnerability fixes are yours to make and merge
   without a human bullet, as long as everything still builds and tests
   pass afterward.
6. **Docs.** Keep the root `README.md` current with whatever the merge
   changed. Keep any other doc the change touches in sync, per P3/P4 —
   never leave a merged PR with stale docs.

## Non-negotiables

- Never merge with red CI.
- Never merge while a fix pass is still pending its re-review.
- Never silently drop a rebase conflict's intent from either side.
- `docs/blocked-by-human.md` bullets are short, human-only, and ranked —
  it's the one file a human is expected to read; don't let it become a
  dumping ground for anything an agent could have resolved itself.
