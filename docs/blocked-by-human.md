# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Arm the 3rd independent free-LLM pool for the opencheck agent lane —
  set repo secret `FALLBACK2_LLM_API_KEY`** (SambaNova/Cerebras/Together
  free tier; lane wired in `_e2e-opencheck.yml`, degrades to "disabled"
  while unset). **Sole** fix for scorecard row #15 (E2E freshness ≈ 0.75):
  the 2 free lanes (NIM + OpenRouter `:free`) flap intrinsically, so a
  2-lane walk can't stay green (run 70). **Blocked ~6 days** (since ~07-13;
  history in `weekly-review.md`).

## Suggestions needing approval (to amend the guidelines)

_None open._
