# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Run `scripts/mirror-secrets-gha.sh` once** (from your machine — needs your `gh` repo-admin auth, which agents don't have). This is the only remaining step for two now-wired secrets; deploys then mirror them to the prod Worker on the next merge to `main`:
  - `OPENROUTER_FRONTIER_API_KEY` — the mirror now defaults it to your `OPENROUTER_API_KEY` (same paid OpenRouter account), so the **free-vs-frontier delta** (GLOBAL-025 headline KPI, scorecard row 9) lands on the next `include_frontier=true` eval dispatch. No separate key to buy.
  - `BYO_SECRET_KEK` — the BYO-connect envelope key (GLOBAL-031). Ensure it's in `.envrc` first (generate: `openssl rand -base64 32`); once mirrored, `/v1/db/connect` stops returning 503 `sealing_unconfigured`.
- **Final legal copy for `/privacy` + `/terms` — free, no lawyer, no subscription.** The live pages (`apps/web/src/pages/{privacy,terms}.astro`) are **pre-alpha drafts**. Use **Termly's free tier** (`termly.io`) — a short-form questionnaire that outputs a GDPR + CCPA privacy policy and **discloses our LLM/cloud subprocessors** (built-in vendor checklist + a custom-vendor field) at $0; generate the Terms of Service free from **TermsFeed's** base T&C. You decide only: real legal entity name, jurisdiction / governing law, and retention period — then an agent wires the generated copy + subprocessor list into the two pages.
- **Verify the `GEMINI_API_KEY` project has NO Cloud Billing account** (Google Cloud Console — human only) — the previous key was suspended 2026-06-15 after a *billed* project accrued a charge that went unpaid (we expected $0 per `GLOBAL-013`; a billed project bills even free-model calls). The 2026-06-17 key works today, but if its project has billing linked it will silently bill again and can be re-suspended. Confirm no billing account is attached (or unlink it) so the project is hard-capped to the free tier. See `docs/history/gemini-free-tier-billing-suspension.md`.
- **Privacy bet — feed sampled user cell-values to the free third-party LLM chain?** Today only schema DDL leaves the system (`apps/api/src/ask/orchestrate.ts` passes `db.schemaText`). The `value-retrieval` engine lever would additionally send a few real cell-values per column — a new data-exposure posture. Conservative default is **applied** (not built; `quality-eval/FEATURE.md` Open questions, run 18 showed it flips ~0 BIRD rows standalone anyway), so nothing is blocked — but if you want to revisit it as an engine lever, this is the call only you can make.

## Suggestions needing approval (to amend the guidelines)

- **Extend a D4 carve-out to `docs/progress/quality-score-verification-log.md`?** It's an append-only per-lever evidence log (~20 KB) — the same shape as the exempt ICP tracker; if exempted, agents stop net-shrinking it on every recross. *(Settled 2026-06-24: `scorecard.md` restructured to a bounded current-state tracker — no changelog, nothing to prune — per the founder's "no pruner" steer. `distribution-queue.md` stays self-pruning under the cap via its own archive/collapse policy, so it needs no carve-out. The other near-cap docs — `agent-memory-pivot/FEATURE.md` and the `quality-score-source-of-truth.md` lever table — are fixable by sharding per the `decisions/` precedent: agent-doable, no approval needed.)*
