# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Connect the Claude GitHub App to the `nlqdb` org — blocks all agent PR automation.** Agent sessions can `git` fetch/push through the proxy but cannot reach the GitHub API: every call returns `GitHub access is not enabled for this session. An org admin must connect the Claude GitHub App for this organization` and the `github` MCP server never finishes connecting. Until an org admin installs/authorizes the app (GitHub → org Settings → Claude GitHub App), agents cannot list open PRs, read CI/review state, comment, or merge — so the "review-and-merge my open PRs" loop cannot run. Org-admin click, human-only. See https://docs.anthropic.com/en/docs/claude-code/github-actions.
- **Stripe live-mode go-live — final deploy.** Live Dashboard setup is done (products, prices, webhook [5 events], Stripe Tax, Customer-portal) and the live keys/prices are in `.envrc` + GHA. Remaining: trigger `deploy-api.yml` so the prod Worker picks up the live secrets — until then prod `/v1/billing/checkout` 503s (a local `secrets:remote` hits Cloudflare 10214).
- **Reddit ICP source** (deferred by founder 2026-06-12) — set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` after manually approving a Reddit OAuth app (Reddit's Nov-2025 policy needs a human). The source self-skips until they're wired (`SK-ICP-011`).
- **Final legal copy for `/privacy` + `/terms`** — the live pages (`apps/web/src/pages/{privacy,terms}.astro`) are **pre-alpha drafts**. Before GA, regenerate them (e.g. iubenda ~$4–6/mo or Termageddon $119/yr) covering GDPR + CCPA and **disclosing our LLM/cloud subprocessors** (schema + queries go to third-party LLMs); then decide jurisdiction, retention, and a real entity name.
- **Verify the `GEMINI_API_KEY` project has NO Cloud Billing account** (Google Cloud Console — human only) — the previous key was suspended 2026-06-15 after a *billed* project accrued a charge that went unpaid (we expected $0 per `GLOBAL-013`; a billed project bills even free-model calls). The 2026-06-17 key works today, but if its project has billing linked it will silently bill again and can be re-suspended. Confirm no billing account is attached (or unlink it) so the project is hard-capped to the free tier. See `docs/history/gemini-free-tier-billing-suspension.md`.
- **Privacy bet — feed sampled user cell-values to the free third-party LLM chain?** Today only schema DDL leaves the system (`apps/api/src/ask/orchestrate.ts` passes `db.schemaText`). The `value-retrieval` engine lever would additionally send a few real cell-values per column — a new data-exposure posture. Conservative default is **applied** (not built; `quality-eval/FEATURE.md` Open questions, run 18 showed it flips ~0 BIRD rows standalone anyway), so nothing is blocked — but if you want to revisit it as an engine lever, this is the call only you can make.
- **Set the `OPENROUTER_FRONTIER_API_KEY` repo secret to unblock the free-vs-frontier delta (GLOBAL-025 headline KPI, scorecard row 9).** Run 58 dispatched `quality-eval-persona-bench.yml` with `include_frontier=true`; the job log shows `OPENROUTER_FRONTIER_API_KEY:` resolves **empty**, so `buildLanes` built only the free lane and `free_vs_frontier_delta` came back `null`. The free chain scored **0.90 EX** on the ICP shape — but the frontier comparison (and the same secret behind the BIRD/Spider frontier lanes) needs this OpenRouter paid key added under repo Settings → Secrets → Actions. Until then row 9 stays null on every eval, not for lack of dispatching.
- **Set the `BYO_SECRET_KEK` secret on the prod API Worker to enable BYO-connect.** The bring-your-own-database connect path (`POST /v1/db/connect`) seals each connection URL at rest with this key-encryption key (AES-256-GCM, GLOBAL-031); without it the endpoint returns 503 `sealing_unconfigured`. Generate a high-entropy value (`openssl rand -base64 32`), add it under the Worker's secrets, then `deploy-api.yml`. Operator-only.
- **Enable `MEMORY_PRESET=1` on the prod API Worker to unblock E-06.** The
  agent-memory preset create path (`POST /v1/databases { preset:
  "agent_memory_v1" }`) and the engine-track E-06 on-ramp are flag-gated and
  **dark in prod** — every preset call returns `preset_disabled` 400. The code
  (E-01/E-02) is shipped + tested; flipping this Worker var (then `deploy-api.yml`)
  turns the preset path on so E-06's authed UI slice can land. Roll back by
  clearing the var. See `docs/features/agent-memory-pivot/worksheets/engine/E-06-*.md`.

## Suggestions needing approval (to amend the guidelines)

- **Extend a D4 carve-out to `docs/progress/quality-score-verification-log.md`?** It's an append-only per-lever evidence log (~20 KB) — the same shape as the exempt ICP tracker; if exempted, agents stop net-shrinking it on every recross. *(Settled 2026-06-24: `scorecard.md` restructured to a bounded current-state tracker — no changelog, nothing to prune — per the founder's "no pruner" steer. `distribution-queue.md` stays self-pruning under the cap via its own archive/collapse policy, so it needs no carve-out. The other near-cap docs — `agent-memory-pivot/FEATURE.md` and the `quality-score-source-of-truth.md` lever table — are fixable by sharding per the `decisions/` precedent: agent-doable, no approval needed.)*
