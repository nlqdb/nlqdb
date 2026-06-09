# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Stripe live-mode go-live** (your call — gated on the [`phase-plan.md §6`](phase-plan.md) demand signal: ≥5 inbound "how do I pay" OR ≥30% test-checkout completion over 50 sessions). Steps, all human: create live products + price IDs; add the live webhook endpoint (Dashboard → copy `whsec_…`); enable Stripe Tax in live mode; then `wrangler secret put` for `STRIPE_SECRET_KEY` / `STRIPE_PRICE_HOBBY` / `STRIPE_PRICE_PRO` / `STRIPE_WEBHOOK_SECRET`. Until then the flow stays in test mode and `/v1/billing/checkout` 503s. Config-only after the surrounding ⭐ TODOs in `stripe-billing/FEATURE.md` ship (self-service portal; drop unused `STRIPE_PUBLISHABLE_KEY`).
- **Confirm `CEREBRAS_API_KEY` GitHub Actions repo secret is set** — the free-chain planner now leads with Cerebras (`SK-LLM-023`). The Worker secret is staged, but if the **repo** secret is missing the weekly eval cron silently falls back to Gemini-first and the engine-quality KPI won't move. Card-free free tier, so no billing risk — just verify it's present.
- **Confirm `MISTRAL_API_KEY` GitHub Actions repo secret is set** — the free-chain planner tail now backstops on Mistral (`SK-LLM-028`). Create a card-free Experiment-tier key (phone-verified, no card) and register it as the repo secret (plus `wrangler secret put` for the Worker). If the repo secret is missing the weekly eval cron silently omits the tail (`not_configured`) and the targeted ~10% full-chain-exhaustion `no_sql` recovery won't be measured. Card-free, so no billing risk — just verify it's present.
- **Reddit ICP source** — set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` after manually approving a Reddit OAuth app (Reddit's Nov-2025 policy needs a human). The source self-skips until they're wired (`SK-ICP-011`).
- **Anthropic Connectors Directory submission** — fill out `https://clau.de/mcp-directory-submission`. Engineering prereqs (Origin-header validation in `apps/mcp/src/index.ts` + branded 256×256 SVG logo) can ship without this; the form itself needs a human.

## Deferred dependency major-version bumps (security)

Three `bun audit` advisories remain (1 moderate, 2 low) — each needs a breaking major bump, deferred to avoid a framework migration:
- **astro 5 → 6** (`apps/web`, `apps/docs`, `packages/astro`) — clears `define:vars` XSS (moderate) + server-island replay (low); fixed only in astro ≥6.1.10. Needs a real Astro 5→6 migration.
- **cookie ≥0.7.0** (low, via `@sveltejs/kit`) — SvelteKit still pins `cookie ^0.6.0` even at latest (upstream unfixed: sveltejs/kit#13089). A forced override would violate kit's range; wait for a kit release that bumps cookie.
