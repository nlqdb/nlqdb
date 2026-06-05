# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Stripe live-mode go-live** (your call — gated on the [`phase-plan.md §6`](phase-plan.md) demand signal: ≥5 inbound "how do I pay" OR ≥30% test-checkout completion over 50 sessions). Steps, all human: create live products + price IDs; add the live webhook endpoint (Dashboard → copy `whsec_…`); enable Stripe Tax in live mode; then `wrangler secret put` for `STRIPE_SECRET_KEY` / `STRIPE_PRICE_HOBBY` / `STRIPE_PRICE_PRO` / `STRIPE_WEBHOOK_SECRET`. Until then the flow stays in test mode and `/v1/billing/checkout` 503s. Config-only after the surrounding ⭐ TODOs in `stripe-billing/FEATURE.md` ship (self-service portal; drop unused `STRIPE_PUBLISHABLE_KEY`).
- **`wrangler secret put API_KEY_SECRET`** — Phase 2: a dedicated HMAC secret for API-key signing, separate from `BETTER_AUTH_SECRET` (`SK-APIKEYS-008`), so one can rotate without invalidating the other.
- **Confirm `CEREBRAS_API_KEY` GitHub Actions repo secret is set** — the free-chain planner now leads with Cerebras (`SK-LLM-023`). The Worker secret is staged, but if the **repo** secret is missing the weekly eval cron silently falls back to Gemini-first and the engine-quality KPI won't move. Card-free free tier, so no billing risk — just verify it's present.
- **Reddit ICP source** — set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` after manually approving a Reddit OAuth app (Reddit's Nov-2025 policy needs a human). The source self-skips until they're wired (`SK-ICP-011`).
- **Anthropic Connectors Directory submission** — fill out `https://clau.de/mcp-directory-submission`. Engineering prereqs (Origin-header validation in `apps/mcp/src/index.ts` + branded 256×256 SVG logo) can ship without this; the form itself needs a human.
