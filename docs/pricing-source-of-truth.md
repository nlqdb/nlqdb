# Pricing — Source of Truth

Progress tracker for the pricing page and Stripe integration.

**Cross-refs:**
- Canonical pricing table → `docs/architecture.md §5`
- Stripe webhook decisions → `docs/features/stripe-billing/FEATURE.md`
- Premium tier decisions → `docs/features/premium-tier/FEATURE.md`
- Monetization trigger → `docs/phase-plan.md §6`
- Phase gating → `docs/phase-plan.md §3` (Phase 2, item 9) and `§5` (Phase 3)

---

## Goal

Enable users to upgrade from Free → Hobby ($10/mo) or Pro ($25/mo) via Stripe Checkout in test mode.
Measure checkout completion rate; when ≥30% over 50 sessions the §6 trigger fires and we flip to live mode.

---

## Pricing tiers (canonical — from `docs/architecture.md §5`)

| Tier | Price | Key limits |
|---|---|---|
| **Free** | $0 forever | 1k queries/mo, 500MB/DB, 7d backups, strict-$0 LLM chain |
| **Hobby** | $10/mo | 50k queries/mo, 5GB/DB, no pausing, 30d backups, email support |
| **Pro** | $25/mo min + usage | $0.0005/query over 50k, $0.10/GB-mo over 5GB |
| **Premium models** (add-on, Hobby+) | Flat sub + metered overage | Frontier routing; §6-gated |
| **BYOLLM** (any tier) | $0 | Paste a provider key; router dispatches at 0% markup |
| **Enterprise** | Custom | SSO, VPC, audit log, on-prem |

**Honest billing rules (hard):** no card for free tier ever; hitting a limit rate-limits, never silently upgrades; soft cap email at 80%; export always free; one-click cancel.

---

## Stripe environment

| Variable | Purpose | Status |
|---|---|---|
| `STRIPE_SECRET_KEY` | Outbound API calls (Checkout creation) | Test mode key in env + GHA + Cloudflare |
| `STRIPE_PUBLISHABLE_KEY` | Frontend Stripe.js (future) | Test mode key in env + GHA + Cloudflare |
| `STRIPE_WEBHOOK_SECRET` | Webhook HMAC verification | Test mode webhook secret in env + GHA + Cloudflare |
| `STRIPE_PRICE_HOBBY` | Stripe price ID for Hobby $10/mo | Must be set before checkout goes live |
| `STRIPE_PRICE_PRO` | Stripe price ID for Pro $25/mo | Must be set before checkout goes live |

API version pinned to `2026-04-22.dahlia` via the `stripe` npm SDK (see `SK-STRIPE-007`).

---

## What is done

### Stripe webhook pipeline (Slice 7 — PR #33; status: `implemented`)

- **Signature verification** (SK-STRIPE-001): raw-body HMAC via `constructEventAsync` + Web Crypto. Bad sig → 400.
- **Idempotency** (SK-STRIPE-002): `stripe_events` D1 table, `INSERT ... ON CONFLICT DO NOTHING RETURNING 1`. Duplicate → 200 no-op.
- **Subscription state machine** (SK-STRIPE-005): `checkout.session.completed` → create customers row; `customer.subscription.created` → emit `billing.subscription_created`; `customer.subscription.updated` → state sync only; `customer.subscription.deleted` → status=canceled + emit `billing.subscription_canceled`.
- **R2 archive** (SK-STRIPE-006): raw payload archived at `stripe-events/YYYY/MM/DD/{event_id}.json` via `ctx.waitUntil`.
- **D1 schema** (`migrations/0004_stripe.sql`): `customers` (user_id PK, stripe fields, status) + `stripe_events` (event_id PK, idempotency log).
- **OTel span**: `nlqdb.webhook.stripe` with `signature_valid`, `event_id`, `event_type`, `duplicate` attributes.
- **Customer linkage** (SK-STRIPE-004): `client_reference_id: userId` on Checkout Sessions; `checkout.session.completed` handler reads it.

### Checkout creation endpoint (this PR)

- `POST /v1/billing/checkout` — `requireSession`-gated, creates a Stripe Checkout Session.
  - Accepts `{ plan: "hobby" | "pro", success_url?, cancel_url? }`.
  - Returns `{ url }` for client-side redirect.
  - Idempotency-Key header forwarded to Stripe.
  - OTel span: `nlqdb.billing.checkout.create`.
  - 503 when `STRIPE_SECRET_KEY` or plan price ID is not configured.
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_HOBBY`, `STRIPE_PRICE_PRO` added to `env.d.ts`.
- `stripe/client.ts`: wires `STRIPE_SECRET_KEY` for outbound calls (previously placeholder).

### Pricing page (this PR)

- `apps/web/src/pages/pricing.astro` — static page at `/pricing`.
- Shows Free / Hobby / Pro / Enterprise tiers with honest billing rules.
- CTA buttons call `POST /v1/billing/checkout` (authed) or redirect to sign-in (anon).
- "Pricing" link added to `Topnav.astro`.

---

## What is next

1. **Create Stripe products and price IDs** in the Stripe Dashboard (test mode) and set `STRIPE_PRICE_HOBBY` / `STRIPE_PRICE_PRO` via `wrangler secret put`. Without these the checkout returns 503.
2. **`/app?checkout=success` landing**: add a success banner to the chat page that appears when `?checkout=success` is in the URL.
3. **Dunning UX**: `invoice.payment_failed` → in-app banner + email. Currently only state-synced (SK-STRIPE-005 open question).
4. **§6 trigger measurement**: once Stripe price IDs are set and checkout is live in test mode, track completion rate toward the 30%/50-sessions threshold.
5. **Live mode flip**: when §6 trips, replace test-mode keys with live-mode keys via `wrangler secret put` + update Stripe Dashboard webhook endpoint.
6. **Premium models add-on** (`POST /v1/billing/checkout/premium { db_id }`): gated on §6 + Phase 2 `quality-eval` baseline.
7. **Lago wiring**: metered overage for Pro queries + premium LLM tokens (Phase 3).
8. **R2 lifecycle policy**: configure "delete > 90 days" rule on `nlqdb-assets` (SK-STRIPE-006 open question).
