# Billing constraints and philosophy

Reference shard of [`stripe-billing/FEATURE.md`](FEATURE.md), split out per
P4/D4 (FEATURE.md reached the 20 KB cap). Decisions (`SK-STRIPE-*`) stay in
FEATURE.md; this file holds the cross-cutting billing philosophy that
constrains every billing surface, not just the webhook handler.

## No dark patterns — hard rules

These apply to every billing surface. Violating any one is a product defect, not a config choice:

- **No credit card for the free tier, ever.** Not for identity, not for spam protection.
- **The trial is the free tier itself** — no countdown "Pro trial". Exceeding free limits rate-limits with a clear message; data is never held hostage; export is one click, always free.
- **First charge confirmation.** Email before the first charge with amount + date and a way to cancel. No silent Hobby→Pro auto-upgrades; tier changes require a deliberate click.
- **Usage predictability.** Pro hard caps are opt-in; default is a soft cap (email at 80%, one-click extension at 100%). No surprise bills.
- **Downgrade is as easy as upgrade** — one click, pro-rated refund on the unused portion.
- **Cancellation is one click** — no call, no chat, no exit survey (an optional survey *after* cancellation is fine).

## Payment tech stack

- **Stripe Billing** — invoicing + payment-method capture; Checkout is Stripe-hosted, we build no card forms.
- **Lago** (self-hosted) — usage metering in front of Stripe (queries, LLM tokens, GB-mo). Not yet wired (Phase 2).
- **Stripe Tax** — enabled day 1 in live mode; handles VAT/GST automatically.
- **Paddle** — optional Merchant of Record if we expand internationally before setting up entities. Deferred.

## Things we will NOT do

- Charge per seat in Phase 1 — the billing unit is the DB and the query, not the human.
- Gate features we'd have shipped anyway behind Pro to manufacture urgency.
- Offer AppSumo "lifetime deals" — wrong audience, real support cost.
- Hide prices behind "Contact sales" for anything below Enterprise.

## Unit economics (napkin, Phase 1)

| Tier | Our cost | Margin target |
|---|---|---|
| Free (100 queries/mo) | ~$0.15–0.40 | — (CAC substitute) |
| Hobby ($10/mo) | ~$2–4 | 60–80% at target plan-cache hit rate |
| Pro ($25/mo+) | — | 75%+ once self-hosted classifier online |

**LLM cost is the dominant variable.** Plan-cache hit rate (60–80% at maturity) is the primary lever; small-model-first chain + batch embeddings are secondary.
