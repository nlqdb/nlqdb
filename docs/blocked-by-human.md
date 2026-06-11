# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Stripe live-mode go-live** (your call — gated on the [`phase-plan.md §6`](phase-plan.md) demand signal: ≥5 inbound "how do I pay" OR ≥30% test-checkout completion over 50 sessions). Steps, all human: create live products + price IDs; add the live webhook endpoint (Dashboard → copy `whsec_…`); enable Stripe Tax in live mode; then `wrangler secret put` for `STRIPE_SECRET_KEY` / `STRIPE_PRICE_HOBBY` / `STRIPE_PRICE_PRO` / `STRIPE_WEBHOOK_SECRET`. Until then the flow stays in test mode and `/v1/billing/checkout` 503s. Config-only after the surrounding ⭐ TODOs in `stripe-billing/FEATURE.md` ship (self-service portal; drop unused `STRIPE_PUBLISHABLE_KEY`).
- **Confirm `CEREBRAS_API_KEY` GitHub Actions repo secret is set** — the free-chain planner now leads with Cerebras (`SK-LLM-023`). The Worker secret is staged, but if the **repo** secret is missing a manual eval run silently falls back to Gemini-first and the engine-quality KPI won't move. Card-free free tier, so no billing risk — just verify it's present.
- **Confirm `MISTRAL_API_KEY` GitHub Actions repo secret is set** — the free-chain planner tail now backstops on Mistral (`SK-LLM-028`). Create a card-free Experiment-tier key (phone-verified, no card) and register it as the repo secret (plus `wrangler secret put` for the Worker). If the repo secret is missing a manual eval run silently omits the tail (`not_configured`) and the targeted ~10% full-chain-exhaustion `no_sql` recovery won't be measured. Card-free, so no billing risk — just verify it's present.
- **Run the canonical eval re-seed** — click **Run workflow** (mode: full) on `quality-eval-bird-mini.yml` and `quality-eval-spider2-lite.yml` in GitHub Actions. The agent GH integration can't `workflow_dispatch` (403); the gdown breakage is now fixed and all six card-free keys + `--throttle-ms` are wired, so the dispatch runs green and re-seeds `eval-baseline.ts` + `baseline-2026-06-15.json` with the production-fidelity 6-provider raw EX (the committed numbers are conservative 4-provider lower bounds). No billing risk — all keys are card-free.
- **Reddit ICP source** — set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` after manually approving a Reddit OAuth app (Reddit's Nov-2025 policy needs a human). The source self-skips until they're wired (`SK-ICP-011`).
- **Anthropic Connectors Directory submission** — fill out `https://clau.de/mcp-directory-submission`. Engineering prereqs (Origin-header validation in `apps/mcp/src/index.ts` + branded 256×256 SVG logo) can ship without this; the form itself needs a human.
- **Opencheck CI gate strategy** (2026-06-09 fork, still open) — gate CI on **per-suite green over an N-run window** (accepts Suite A's intermittent GLOBAL-027 NL-create→query bootstrap flake, ~50–75% green, as variance) **vs.** keep chasing a single all-green `abc` run. Engine-vs-process call, not value-decidable; agents must not pick (P1). Context in `docs/features/e2e-coverage/opencheck-operations.md`.
