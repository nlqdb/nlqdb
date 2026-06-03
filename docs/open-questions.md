# Open questions — human action queue

> The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md), agents resolve value-decidable questions themselves — this file is **only** for what a human must do: operator actions an agent can't perform (set a prod secret, prune Neon, re-probe from production egress) and genuine money / strategy / legal bets. Keep each a very short bullet. Delete a bullet once resolved.

## Blocking for human

- (#302) To turn the live payment button on for real users (your call — gated on a [`phase-plan.md §6`](phase-plan.md#L241) demand-signal: ≥5 inbound "how do I pay" OR ≥30% test-checkout completion over 50 sessions): create live Stripe products + price IDs, add a live webhook endpoint, enable Stripe Tax, and set `STRIPE_SECRET_KEY` / `STRIPE_PRICE_HOBBY` / `STRIPE_PRICE_PRO` / `STRIPE_WEBHOOK_SECRET` via `wrangler secret put`. Until then the flow stays in test mode and the button shows "Not available yet" (`/v1/billing/checkout` 503s). Surrounding code to finish first so the flip is config-only (self-service billing portal + drop the unused publishable key) is tracked as ⭐ TODOs in `stripe-billing/FEATURE.md` Open questions.
