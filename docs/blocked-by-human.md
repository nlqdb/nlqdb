# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Engine baselines are stale and agents can no longer dispatch the eval to refresh them.** `workflow_dispatch` on the three `quality-eval-*.yml` fails for the daily agent — the Claude GitHub App returns `403 Resource not accessible by integration` (lacks `actions:write`) and the `GH_TOKEN_WORKFLOW` PAT is egress-proxy-blocked. **Fix (either):** grant the Claude GitHub App **Actions: write** on `nlqdb/nlqdb` so agents auto-dispatch per `/daily`, *or* run the three workflows yourself from the Actions tab on the current `main` SHA. Blocks the engine north-star (Spider EX 0.1852 vs 0.75, scorecard row 7); BIRD/Spider baselines now 12–14 d stale.
- **Run `scripts/mirror-secrets-gha.sh` once** (from your machine — needs your `gh` repo-admin auth, which agents don't have). This is the only remaining step for two now-wired secrets:
  - `OPENROUTER_FRONTIER_API_KEY` — eval-CI only (never a Worker secret); the mirror now defaults it to your `OPENROUTER_API_KEY` (same paid OpenRouter account), so the **free-vs-frontier delta** (GLOBAL-025 headline KPI, scorecard row 9) lands on the next `include_frontier=true` eval dispatch. No separate key to buy.
  - `BYO_SECRET_KEK` — the BYO-connect envelope key (GLOBAL-031). Ensure it's in `.envrc` first (generate: `openssl rand -base64 32`); it then mirrors to the prod Worker on the next merge to `main`, and `/v1/db/connect` stops returning 503 `sealing_unconfigured`.
- **Final legal copy for `/privacy` + `/terms` — free, no lawyer, no subscription.** The live pages (`apps/web/src/pages/{privacy,terms}.astro`) are **pre-alpha drafts**. Use **Termly's free tier** (`termly.io`) — a short-form questionnaire that outputs a GDPR + CCPA privacy policy and **discloses our LLM/cloud subprocessors** (built-in vendor checklist + a custom-vendor field) at $0; generate the Terms of Service free from **TermsFeed's** base T&C. You decide only: real legal entity name, jurisdiction / governing law, and retention period — then an agent wires the generated copy + subprocessor list into the two pages.

## Suggestions needing approval (to amend the guidelines)

- **Extend a D4 carve-out to `docs/progress/quality-score-verification-log.md`?** It's an append-only per-lever evidence log (~20 KB) — the same shape as the exempt ICP tracker; if exempted, agents stop net-shrinking it on every recross. *(Settled 2026-06-24: `scorecard.md` restructured to a bounded current-state tracker — no changelog, nothing to prune — per the founder's "no pruner" steer. `distribution-queue.md` stays self-pruning under the cap via its own archive/collapse policy, so it needs no carve-out. The other near-cap docs — `agent-memory-pivot/FEATURE.md` and the `quality-score-source-of-truth.md` lever table — are fixable by sharding per the `decisions/` precedent: agent-doable, no approval needed.)*
