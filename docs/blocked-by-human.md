# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Stripe live-mode go-live — final deploy.** Live Dashboard setup is done (products, prices, webhook [5 events], Stripe Tax, Customer-portal) and the live keys/prices are in `.envrc` + GHA. Remaining: trigger `deploy-api.yml` so the prod Worker picks up the live secrets — until then prod `/v1/billing/checkout` 503s (a local `secrets:remote` hits Cloudflare 10214).
- **Reddit ICP source** (deferred by founder 2026-06-12) — set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` after manually approving a Reddit OAuth app (Reddit's Nov-2025 policy needs a human). The source self-skips until they're wired (`SK-ICP-011`).
- **Final legal copy for `/privacy` + `/terms`** — the live pages (`apps/web/src/pages/{privacy,terms}.astro`) are honest plain-English **pre-alpha drafts** of what we actually collect/do today. Before general availability, replace them with lawyer-reviewed text (decide on jurisdiction, GDPR/CCPA stance, data-retention specifics, and a real entity name).
- **Verify the `GEMINI_API_KEY` project has NO Cloud Billing account** (Google Cloud Console — human only) — the previous key was suspended 2026-06-15 after a *billed* project accrued a charge that went unpaid (we expected $0 per `GLOBAL-013`; a billed project bills even free-model calls). The 2026-06-17 key works today, but if its project has billing linked it will silently bill again and can be re-suspended. Confirm no billing account is attached (or unlink it) so the project is hard-capped to the free tier. See `docs/history/gemini-free-tier-billing-suspension.md`.
- **Privacy bet — feed sampled user cell-values to the free third-party LLM chain?** Today only schema DDL leaves the system (`apps/api/src/ask/orchestrate.ts` passes `db.schemaText`). The `value-retrieval` engine lever would additionally send a few real cell-values per column — a new data-exposure posture. Conservative default is **applied** (not built; `quality-eval/FEATURE.md` Open questions, run 18 showed it flips ~0 BIRD rows standalone anyway), so nothing is blocked — but if you want to revisit it as an engine lever, this is the call only you can make.
- **Enable `MEMORY_PRESET=1` on the prod API Worker to unblock E-06.** The
  agent-memory preset create path (`POST /v1/databases { preset:
  "agent_memory_v1" }`) and the engine-track E-06 on-ramp are flag-gated and
  **dark in prod** — every preset call returns `preset_disabled` 400. The code
  (E-01/E-02) is shipped + tested; flipping this Worker var (then `deploy-api.yml`)
  turns the preset path on so E-06's authed UI slice can land. Roll back by
  clearing the var. See `docs/features/agent-memory-pivot/worksheets/engine/E-06-*.md`.

## Suggestions needing approval (to amend the guidelines)

- **D4 (20 KB net-shrink) vs the daily-loop ledgers.** `docs/scorecard.md` (~28 KB) and `docs/research/distribution-queue.md` (~33 KB) are both already over the 20 KB cap, yet the `/daily` loop *requires* appending a delta + artifact every run, so every compliant run grows them and violates D4. Pick one: (a) add a documented D4 carve-out for the daily-loop ledgers (analogous to the `GLOBAL-028` exemption for the ICP tracker), or (b) mandate a weekly prune of published/stale entries. Until then agents face a standing rule conflict on these two files.
  - *Concrete instance (PR #431, WS-09):* the PR net-shrinks `scorecard.md` (−836 B) and trims its own `distribution-queue.md` contribution hard (launch post added, runs 18–19 full drafts collapsed, editorial preamble cut), but the publishable launch post still leaves `distribution-queue.md` ~+0.1 KB over its 33.2 KB base. The residual is live publishable content that can't be dropped without losing the artifact — exactly the carve-out-vs-prune call above.
  - *Concrete instance (PR #441, SK-PIVOT-010):* `agent-memory-pivot/FEATURE.md` is the canonical home for new `SK-PIVOT-*` decisions, but the file already sits > 20 KB, so adding any required canonical decision grows it. **Partially resolved (PR #445, SK-PIVOT-011):** the `decisions/` shard now exists for this feature — the new SK-PIVOT-011 body lives in `decisions/SK-PIVOT-011-ttl-sweep.md` with a one-line body link in FEATURE.md (the llm-router precedent), which net-shrank the file under cap. **Remaining human/owner call:** finish migrating the other nine inline `SK-PIVOT-*` bodies into the shard so the feature is fully consistent (its own PR, all cross-refs updated) — until then the feature mixes one sharded + nine inline decisions and each new decision must again offset its bytes via D5 trims.
  - *Same class — the engine-quality progress ledgers.* `docs/progress/quality-score-source-of-truth.md` (crossed 20 KB at ~21.0 KB once the §4 lever table reached T23) and `docs/features/llm-router/FEATURE.md` (~23 KB) accrete one row/reference per lever shipped, just like the daily ledgers accrete per run; `docs/progress/quality-score-verification-log.md` (~20 KB) is the same append-only evidence log. Each compliant lever PR grows them. Same carve-out-vs-prune call — or shard the §4 lever table / verification log into per-quarter files. Until decided, agents trim duplication (as PR #443 did for the T23 rows) but cannot get fully back under cap without a structural split.
