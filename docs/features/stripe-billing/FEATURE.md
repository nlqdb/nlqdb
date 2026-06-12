---
name: stripe-billing
description: Stripe webhook ingest, subscription state, idempotent processing, R2 archive.
when-to-load:
  globs:
    - apps/api/src/stripe/**
  topics: [stripe, billing, webhook, subscription, r2-archive]
---

# Feature: Stripe Billing

**One-liner:** Stripe webhook ingest, subscription state, idempotent processing, R2 archive.
**Status:** implemented (Slice 7 — PR #33; live-mode flip in Phase 2)
**Owners (code):** `apps/api/src/stripe/**`, `apps/api/src/index.ts`, `POST /v1/stripe/webhook`
**Cross-refs:** docs/architecture.md §6 (pricing) · docs/phase-plan.md (Phase 2 stripe slice) · docs/runbook.md §6 (webhook + R2 archive) · docs/performance.md §3.1 (`nlqdb.webhook.stripe` span), §4 Slice 7, §5 · `apps/api/src/stripe/webhook.ts` (canonical pipeline doc-comment)

**Touchpoints (read before editing):** `apps/api/src/stripe/**` · `apps/api/src/index.ts` (`/v1/stripe/webhook`, `/v1/billing/{checkout,portal,status}`) · `apps/events-worker/src/sinks/dunning-email.ts` (SK-STRIPE-013) · D1 `stripe_events` + `customers` · R2 `nlqdb-assets` (binding `ASSETS`).

## Decisions

### SK-STRIPE-001 — Verify the Stripe signature against the raw request body

- **Decision:** `POST /v1/stripe/webhook` reads the body with `c.req.text()` (never `c.req.json()`) and verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` via `Stripe.WebhookSignature.constructEventAsync` before any downstream work. Missing signature or verification failure → `400 invalid_signature`. Missing secret → `503 secret_unconfigured`.
- **Core value:** Bullet-proof, Seamless auth
- **Why:** Stripe authenticates webhooks by HMAC over the exact request bytes. Any JSON parser normalizes whitespace and key order, silently invalidating the signature. A handler that "works in dev" against unsigned payloads is a security hole; making bad signatures the only way the route fails closed is the structural fix.
- **Consequence in code:** The route handler in `apps/api/src/index.ts` is forbidden from touching `c.req.json()` for this path. The Stripe SDK is initialised with `Stripe.createSubtleCryptoProvider()` at module load (Web Crypto on Workers) — Node `crypto` is unavailable. A missing webhook secret returns `503` with `error: "secret_unconfigured"` instead of silently bypassing verification.
- **Alternatives rejected:**
  - Parse JSON first, then verify against `JSON.stringify(body)` — re-serialised bytes don't match the original; signatures fail randomly.
  - Skip verification in dev — drift between dev and prod is exactly what produces "the webhook works locally" outages.

### SK-STRIPE-002 — Idempotency keyed on `event_id` via `stripe_events` ON CONFLICT DO NOTHING

- **Decision:** Every verified event is inserted into the `stripe_events` D1 table with `event_id` as PK using `INSERT ... ON CONFLICT(event_id) DO NOTHING RETURNING 1`. First insert returns the row → process; duplicate returns `null` → respond `200 { received: true, duplicate: true }` with no side effects. A genuine D1 error (not a duplicate) increments `nlqdb.webhook.stripe.idempotency_errors.total`, logs structured JSON for replay, and returns `500` so Stripe retries.
- **Core value:** Bullet-proof
- **Why:** Stripe retries any non-2xx response and may also re-deliver during partial outages. Dispatching state-changing handlers (customers row writes, `billing.*` event emission) twice for the same `event_id` corrupts subscription state. A single atomic insert-or-skip is the only place where dedup can be enforced without a second SELECT race.
- **Consequence in code:** All side-effectful work in `processWebhook` runs strictly *after* the insert succeeds with a non-null row. `dispatchEvent` and `processed_at` UPDATE are gated on insert success. Operators replay stuck events via the Stripe Dashboard "Resend webhook" button — the duplicate path is the safety net. This decision is the per-feature manifestation of `GLOBAL-005`.
- **Alternatives rejected:**
  - Hash-of-payload dedup — different delivery attempts can carry semantically equivalent but byte-different payloads; Stripe's `event.id` is the only stable identifier.
  - In-memory dedup — Workers are stateless; a cold start drops the cache and a retry double-processes.

### SK-STRIPE-003 — Dispatch failure after a recorded insert returns 200, not 500

- **Decision:** When `dispatchEvent` throws *after* a successful `stripe_events` insert, the route returns `200` with `duplicate: false`, leaves `processed_at = NULL`, records the exception on the OTel span, and emits a structured `stripe_dispatch_failed` log. Only insert failure returns `500`.
- **Core value:** Bullet-proof, Honest latency
- **Why:** The event is already recorded; a Stripe retry would just hit the duplicate path and return 200 with no side effects, so 5xx-ing here gains nothing and trains us to trust Stripe-driven retries for replay. The `processed_at = NULL` row is the queryable signal an operator (or sweeper) uses to find stuck events. Replays go through the Dashboard "Resend webhook" surface.
- **Consequence in code:** The `dispatchOk` flag in `processWebhook` gates the `processed_at` UPDATE so a successful insert + failed dispatch leaves the row marked unprocessed. Tests cover the (insert-ok, dispatch-throws) branch and assert `processed_at IS NULL`. Unhandled `event.type` values fall through `dispatchEvent`'s `default` arm — recorded for audit but never break the response.
- **Alternatives rejected:**
  - 5xx on dispatch failure to force Stripe retry — Stripe's retry just hits dedup and 200s; the failure repeats with no progress.
  - Roll back the insert on dispatch failure — loses the audit row and re-introduces double-processing risk on the next retry.

### SK-STRIPE-004 — Customer linkage via `client_reference_id: userId` on Checkout Sessions

- **Decision:** Every Phase 2 `Checkout.Session` MUST be created with `mode: 'subscription'`, `client_reference_id: userId`, **and** `subscription_data.metadata.nlqdb_user_id = userId` (the latter for SK-STRIPE-012). The `checkout.session.completed` handler reads `client_reference_id` to link the Stripe customer to an `nlqdb` user; missing or non-string `client_reference_id` → log `checkout_completed_missing_ids` and skip rather than create an orphan `customers` row.
- **Core value:** Bullet-proof, Simple
- **Why:** Stripe-side metadata is the only signal we control at Checkout time; an unlinked subscription leaves a customer who paid but has no nlqdb capability. Skipping with a warn log is recoverable (operator can backfill); creating an orphan row is not (the next event silently writes to the wrong user).
- **Consequence in code:** The Checkout Session creation endpoint (Phase 2 slice — see `docs/phase-plan.md`) is required by review to set both fields. `handleCheckoutCompleted` defaults `status = 'incomplete'` until the subsequent `customer.subscription.created` event fires — checkout completion alone is not enough state to call the customer "active". The pair `(user_id, stripe_customer_id, stripe_subscription_id)` lives in the `customers` D1 table with `user_id` as the unique key.
- **Alternatives rejected:**
  - Match by email — emails change, are non-unique across Stripe accounts, and arrive after the session anyway.
  - Pass `userId` via `metadata` instead of `client_reference_id` — `client_reference_id` is the dedicated Stripe field with stronger lifecycle guarantees and is surfaced in the Dashboard.

### SK-STRIPE-005 — Subscription state machine: only `created` and `canceled` emit events; `updated` is pure state sync

- **Decision:** Three Stripe events drive the customer state: `customer.subscription.created` (emits `billing.subscription_created`), `customer.subscription.updated` (writes new fields, no event emission), `customer.subscription.deleted` (sets `status = 'canceled'`, emits `billing.subscription_canceled`). LogSnag idempotency keys are `billing.subscription_created.<sub.id>` and `billing.subscription_canceled.<sub.id>`. **No `trial.*` events** — the free tier IS the trial (PLAN §5.3); Stripe-side trial periods are not used.
- **Core value:** Simple, Honest latency, Free
- **Why:** Updates fire frequently (price changes, plan moves, period rollovers) and would dominate the 2,500/mo LogSnag quota with no founder signal. Created/canceled are the lifecycle moments worth notifying. Scoping the LogSnag idempotency key to the subscription id (not the wrapping `Stripe.Event.id`, which `dispatchEvent` doesn't see) means duplicate created events from any Stripe retry path collapse cleanly.
- **Consequence in code:** `handleSubscriptionUpdated` writes fields and returns — no `events.emit`. `handleSubscriptionCreated` and `handleSubscriptionDeleted` emit with explicit `{ id: "billing.subscription_*.<sub.id>" }` envelopes. This rule scopes the `customer.subscription.*` events only; the separate `invoice.payment_failed` event also emits (operator dunning alert — SK-STRIPE-011) and does not contradict it. Adding a new lifecycle event requires a new branch in `dispatchEvent`, a new variant in `packages/events/src/types.ts`, and a new `buildPayload()` case in `apps/events-worker/src/sinks/logsnag.ts` — see [SK-EVENTS-NNN] in the events-pipeline feature for the full producer contract.
- **Alternatives rejected:**
  - Emit `billing.subscription_updated` — burns the quota for non-actionable churn signal.
  - Synthesise a `trial.*` event from `created.status = 'trialing'` — there is no Stripe trial period in the pricing; the synthesis would lie about the funnel.

### SK-STRIPE-006 — R2 archive of the raw signed payload, scheduled via `ctx.waitUntil`

**Body:** [`decisions/SK-STRIPE-006-r2-archive.md`](./decisions/SK-STRIPE-006-r2-archive.md).
After a successful insert the route archives the raw body to R2 at `stripe-events/<yyyy>/<mm>/<dd>/<event_id>.json` via `c.executionCtx.waitUntil` — the 200 ships first; R2 failures count + warn-log, never retry; binding optional. Date-partitioned keys feed the 90-day lifecycle rule; `stripe_events.payload_r2_key` makes `(event_id → bytes)` queryable from D1.

### SK-STRIPE-007 — Pin the Stripe SDK version; bumping the SDK is the supported way to advance the API version

- **Decision:** The `stripe` npm SDK version is the source of truth for which Stripe API version we target. The client at `apps/api/src/stripe/client.ts` is constructed with the SDK's compiled-in default `apiVersion`; we do not hard-code a string. Currently pinned to API version `2026-04-22.dahlia` via the SDK install. Bumping requires a `stripe-node` upgrade PR with the changelog read.
- **Core value:** Bullet-proof, Simple
- **Why:** Stripe's API changes are tied to specific SDK versions — `current_period_end` moved from `Subscription` to `SubscriptionItem` in 2025-09 and is still there as of `2026-04-22.dahlia`. Pinning a string in code that disagrees with the SDK silently produces TypeScript types from one version and runtime payloads from another. Letting the SDK pick the version means the upgrade is one `bun update` + a code review of the changelog.
- **Consequence in code:** `extractSubscriptionFields` reads `current_period_end` from `sub.items.data[0]`, not from `sub` itself — the field's location is part of the API-version contract. When bumping the SDK, search for any field-access on `Stripe.Subscription` and re-validate against the new types. Tests stub the `WebhookSigner` interface (just `constructEventAsync`) so SDK upgrades don't require test fixture changes.
- **Alternatives rejected:**
  - Hard-code `apiVersion: "2026-04-22.dahlia"` — drifts from SDK types; the next field-relocation produces silent runtime mismatches.
  - Pin to the latest version on every CI run — Stripe's "latest" is a moving target; we don't want CI breaking on a Stripe-side version flip.

### SK-STRIPE-008 — Self-service billing portal via a Stripe-hosted session; entry point on `/pricing`

- **Decision:** `POST /v1/billing/portal` (`requireSession`-gated) looks up the caller's `stripe_customer_id` from `customers` and creates a Stripe-hosted Billing Portal session (`stripe.billingPortal.sessions.create({ customer, return_url })`). `return_url` is derived server-side (`${origin}/app`), never client-supplied. Forwards `Idempotency-Key`. `503` when `STRIPE_SECRET_KEY` is absent; `404 no_customer` when the user has no `customers` row; `500` on Stripe failure. Web entry point: a "Manage billing" control on `/pricing`, shown only to authed users. Web-only (GLOBAL-003), like checkout.
- **Core value:** Honest latency, Seamless auth, Simple
- **Why:** The no-dark-patterns rules require one-click cancel, card update, and downgrade; Stripe's hosted portal delivers all three and stays PCI-compliant without us building card forms — the same "let Stripe host it" stance as checkout (SK-STRIPE-004).
- **Consequence in code:** `apps/api/src/stripe/portal.ts` is a pure function (deps in, `{url}` out) mirroring `checkout.ts`; the route owns the D1 lookup + origin derivation. OTel span `nlqdb.billing.portal.create` carries `nlqdb.user.id` + `nlqdb.billing.portal_session_id`. The `/pricing` button maps `404 → "No active subscription yet"`, `503 → "Not available yet"`.
- **Alternatives rejected:**
  - Build cancel/update-card UI ourselves — re-implements PCI-sensitive flows Stripe already hosts; a liability for zero differentiation.
  - Accept a client-supplied `return_url` — open-redirect vector; the origin is the only trustworthy source.
  - Gate the build on §6 / live mode — inert without live secrets anyway; shipping early removes code risk from the go-live window.

### SK-STRIPE-009 — `GET /v1/billing/status` is a pure D1 read projecting the caller's plan; price→tier map stays server-side

**Body:** [`decisions/SK-STRIPE-009-billing-status-read.md`](./decisions/SK-STRIPE-009-billing-status-read.md).
`GET /v1/billing/status` (`requireSession`-gated) projects `{ plan, status, currentPeriodEnd, cancelAtPeriodEnd, manageable }` from a single indexed `customers` read — **no Stripe call**. `plan` maps the stored `price_id` against the env price IDs server-side (else `"unknown"`); no row → `{ plan: "free", status: "none", manageable: false }`. Backs the `/pricing` tier badge + portal gating; the fetch is a progressive enhancement. Web-only (GLOBAL-003).

### SK-STRIPE-010 — Checkout refuses a caller who already holds a live subscription; tier changes go through the Portal

**Body:** [`decisions/SK-STRIPE-010-checkout-duplicate-guard.md`](./decisions/SK-STRIPE-010-checkout-duplicate-guard.md).
`POST /v1/billing/checkout` returns `409 already_subscribed` unless the `customers` row is absent or in a *terminal* status (`canceled` / `incomplete_expired`); every other status keeps a live subscription, so tier changes go through the Portal (SK-STRIPE-008), where Stripe prorates. A second `mode: 'subscription'` Checkout would double-bill. `blocksNewCheckout` fails safe — any non-terminal status (incl. unrecognized future ones) blocks.

### SK-STRIPE-011 — `invoice.payment_failed` emits a per-invoice operator dunning alert; no DB write

**Body:** [`decisions/SK-STRIPE-011-payment-failed-dunning-alert.md`](./decisions/SK-STRIPE-011-payment-failed-dunning-alert.md).
`invoice.payment_failed` → emits `billing.payment_failed` (user from `invoice.customer`; deduped per `invoice.id`) → LogSnag `billing` channel, `notify: true`. No DB write — `customer.subscription.updated` (SK-STRIPE-005) owns the `past_due` status that drives the in-app banner (web-app `SK-WEB-012`). Operator half of dunning; the customer email is `SK-STRIPE-013`.

### SK-STRIPE-012 — The webhook pipeline is order-independent: `customer.subscription.created` self-heals the link from subscription metadata

**Body:** [`decisions/SK-STRIPE-012-order-independent-linkage.md`](./decisions/SK-STRIPE-012-order-independent-linkage.md).
Stripe doesn't guarantee webhook order, so `customer.subscription.created` can beat `checkout.session.completed`; the handler then resolves the user from `subscription_data.metadata.nlqdb_user_id` (SK-STRIPE-004) and creates the row via the same idempotent `upsertCustomerLink`. Whichever event lands first creates the row; the other upserts.

### SK-STRIPE-013 — Customer dunning email rides the existing `billing.payment_failed` event into a Resend sink

**Body:** [`decisions/SK-STRIPE-013-customer-dunning-email.md`](./decisions/SK-STRIPE-013-customer-dunning-email.md).
The customer reminder ships from the events-worker `billing.payment_failed` sink (not the webhook hot path): `customerEmail` rides the event, and the worker sends one idempotency-keyed email through the `@nlqdb/email` owner (GLOBAL-021) beside the operator LogSnag alert. Best-effort (its failure never retries the message); inert until `RESEND_API_KEY` is set.

### SK-STRIPE-014 — Re-subscribe reuses the existing Stripe customer instead of minting a new one

- **Decision:** When the checkout route runs against an existing `customers` row (only reachable on the re-subscribe path — a terminal `canceled` / `incomplete_expired` status survived the SK-STRIPE-010 guard), it passes that row's `stripe_customer_id` to the Checkout Session as `customer` and drops `customer_email`. With an existing customer + `automatic_tax`, the session also sets `customer_update: { address: 'auto' }` so the address collected at checkout is written back for tax. A first-time subscriber (no row) is unchanged: `customer_email` prefill, no `customer`.
- **Core value:** Bullet-proof, Honest latency
- **Why:** In `mode: 'subscription'`, Stripe mints a brand-new Customer object when no `customer` is supplied. A canceled user who re-subscribes would get a second Stripe customer, orphaning their invoice history, saved cards, and tax IDs; the `customers` row (keyed by `user_id`) would then point at the new customer and silently strand the old one. Reusing the customer keeps one billing identity per user.
- **Consequence in code:** `CheckoutDeps` gains `existingStripeCustomerId`; the route widens its existing duplicate-guard read to `SELECT status, stripe_customer_id` (no extra query) and passes the id through. Stripe forbids `customer` + `customer_email` together, so the params builder picks exactly one. The webhook is unaffected — `checkout.session.completed` upserts the same `stripe_customer_id` for the same `user_id`.
- **Alternatives rejected:**
  - Always pass `customer_email`, never `customer` — orphans a Stripe customer on every re-subscribe; the data-integrity bug this fixes.
  - Reconcile/merge duplicate Stripe customers after the fact — Stripe has no customer-merge API; prevention at Checkout time is the only clean path.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (index in [`docs/decisions.md`](../../decisions.md)). These rules constrain this feature:

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
- **GLOBAL-013** — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).

## Open questions / known unknowns

- **Dunning email — Resolved (`SK-STRIPE-013`).** All three halves now ship: operator alert (`SK-STRIPE-011`), in-app banner (web-app `SK-WEB-012`), and the customer reminder email from the events-worker `billing.payment_failed` sink. Inert until `RESEND_API_KEY` + live subscriptions exist; the go-live flip is config-only.
- **R2 lifecycle policy** — Resolved (`GLOBAL-033`): **90-day retention** on the date-partitioned keys (events are Dashboard-replayable, so the bucket is a convenience cache). One-time Cloudflare R2 config; **parked until** bucket size is load-bearing.
- **DLQ for stuck events** — **Parked until** a `processed_at IS NULL` backlog appears (PLAN §11): the queryable signal exists; the ops cron + alert is the wiring that lands when a dispatch first slips by.
- **Lago wiring.** Lago-on-Fly as the usage-metering layer batched into Stripe (PLAN §6); not yet wired. Phase 2 slice TBD.
- **Dashboard + live-mode cutover.** Endpoints are inert until the Stripe Dashboard is configured (price IDs, Stripe Tax, a saved Customer-portal config — `sessions.create` errors without one) and the test→live secret rollover runs (`wrangler secret put` + Dashboard webhook endpoint update). Capture the runbook in `docs/runbook.md §6` when the flip lands.

## Billing constraints and philosophy

Cross-cutting billing philosophy — no-dark-patterns rules, payment stack,
things we won't do, unit economics — lives in
[`billing-philosophy.md`](billing-philosophy.md) and constrains every billing
surface.
