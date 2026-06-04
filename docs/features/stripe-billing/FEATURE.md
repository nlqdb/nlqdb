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
**Cross-refs:** docs/architecture.md §6 (pricing) · docs/phase-plan.md (Phase 2 stripe slice) · docs/runbook.md §6 (webhook + R2 archive) · docs/performance.md §3.1 (`nlqdb.webhook.stripe` span) · §4 Slice 7 (instrumentation contract — `billing.subscription_created` / `billing.subscription_canceled` map 1:1; no `trial.*`) · §5 (100 % trace sampling on Stripe webhook) · `apps/api/src/stripe/webhook.ts` (canonical pipeline doc-comment)

## Touchpoints — read this feature before editing

- `apps/api/src/stripe/**`
- `apps/api/src/index.ts` (`POST /v1/stripe/webhook` route)
- D1 tables `stripe_events`, `customers` (schema in `apps/api/migrations/`)
- R2 bucket `nlqdb-assets` (binding `ASSETS`)

## Decisions

### SK-STRIPE-001 — Verify the Stripe signature against the raw request body

- **Decision:** `POST /v1/stripe/webhook` reads the body with `c.req.text()` (never `c.req.json()`) and verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` via `Stripe.WebhookSignature.constructEventAsync` before any downstream work. Missing signature or verification failure → `400 invalid_signature`. Missing secret → `503 secret_unconfigured`.
- **Core value:** Bullet-proof, Seamless auth
- **Why:** Stripe authenticates webhooks by HMAC over the exact request bytes. Any JSON parser normalizes whitespace and key order, which silently invalidates the signature. A handler that "works in dev" against unsigned payloads is a security hole; making bad signatures the only way the route fails closed is the structural fix.
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

- **Decision:** Every Phase 2 `Checkout.Session` MUST be created with `mode: 'subscription'` and `client_reference_id: userId`. The `checkout.session.completed` handler reads `client_reference_id` to link the Stripe customer to an `nlqdb` user; missing or non-string `client_reference_id` → log `checkout_completed_missing_ids` and skip rather than create an orphan `customers` row.
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
- **Consequence in code:** `handleSubscriptionUpdated` writes fields and returns — no `events.emit`. `handleSubscriptionCreated` and `handleSubscriptionDeleted` emit with explicit `{ id: "billing.subscription_*.<sub.id>" }` envelopes. Adding a new lifecycle event requires a new branch in `dispatchEvent`, a new variant in `packages/events/src/types.ts`, and a new `buildPayload()` case in `apps/events-worker/src/sinks/logsnag.ts` — see [SK-EVENTS-NNN] in the events-pipeline feature for the full producer contract.
- **Alternatives rejected:**
  - Emit `billing.subscription_updated` — burns the quota for non-actionable churn signal.
  - Synthesise a `trial.*` event from `created.status = 'trialing'` — there is no Stripe trial period in the pricing; the synthesis would lie about the funnel.

### SK-STRIPE-006 — R2 archive of the raw signed payload, scheduled via `ctx.waitUntil`

- **Decision:** After a successful insert, the route schedules the raw request body to R2 at `stripe-events/<yyyy>/<mm>/<dd>/<event_id>.json` via `c.executionCtx.waitUntil(result.archive)`. The 200 response ships before the R2 put completes. R2 failures increment `nlqdb.webhook.stripe.archive_failures.total`, emit a `stripe_r2_archive_failed` warn log, and do not retry. R2 binding (`ASSETS`) is optional — when undefined (dev / tests) the archive step is skipped silently.
- **Core value:** Bullet-proof, Fast, Honest latency
- **Why:** The Stripe Dashboard's "Resend webhook" button is rate-limited and history-bounded; for forensics or schema changes against historical events we need the original signed bytes. R2 is essentially free for this volume. Putting the archive on the response path would couple webhook latency to R2 — `waitUntil` runs the put after the 200 ships, keeping the response budget intact while preserving the audit trail.
- **Consequence in code:** `processWebhook` returns the put promise on the result rather than awaiting it; the route handler in `index.ts` is responsible for `c.executionCtx.waitUntil(result.archive)`. R2 keys are date-partitioned for easy `glob-by-day` and future R2 lifecycle rules ("delete > 90 days"). The `stripe_events.payload_r2_key` column carries the key so `(event_id → archived bytes)` is queryable from D1 alone. **Cloudflare requires a payment method on file** to use R2 even at $0 usage (RUNBOOK §6); removing the payment method takes effect at the end of the billing period.
- **Alternatives rejected:**
  - Inline `await` of the R2 put before responding — adds R2 p95 latency to every webhook, breaks Stripe's 30s acknowledgement budget on slow days.
  - Archive only on dispatch failure — loses the audit trail for the 99% case where everything works and we later want to replay.

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

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
- **GLOBAL-013** — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).

## Open questions / known unknowns

- **Dunning / failed-payment behaviour.** Slice 7 records `customer.subscription.updated` (state sync only) but doesn't surface `invoice.payment_failed` or `customer.subscription.past_due` to the user. Phase 2's flip to live mode will need a dunning UX (email + in-app banner) before paid Hobby goes public.
- **R2 lifecycle policy** — Resolved per `GLOBAL-033` (pin-a-number → choose a value, fail-safe): **90-day retention** on the date-partitioned keys. Stripe events are replayable from the Dashboard, so the bucket is a convenience cache, not a system of record — 90 days bounds storage while covering any realistic dispute/reconciliation window. The lifecycle rule is a one-time Cloudflare R2 dashboard/API config; **parked until** bucket size becomes load-bearing — capture the rule in `docs/runbook.md §6` when it's set.
- **DLQ for stuck events** — **Parked until** a `processed_at IS NULL` backlog appears (tracked under PLAN §11): the queryable NULL signal exists today; the ops cron + Grafana alert is wiring that lands the first time a dispatch failure goes unnoticed.
- **Stripe Tax activation.** Test-mode is configured (`NLQDB.COM` descriptor, Switzerland/CHF merchant). Live-mode + Stripe Tax flip is a Phase 2 task — capture the activation steps in `docs/runbook.md §6` when it lands.
- **Lago wiring.** PLAN §6 / DESIGN §6 calls for Lago-on-Fly as the usage-metering layer batched into Stripe; not yet wired. Slice TBD in Phase 2.
- **Live-mode webhook secret.** `STRIPE_WEBHOOK_SECRET` today is the test-mode value; cutting over needs a coordinated `wrangler secret put` + Stripe Dashboard endpoint update; document the rollover playbook in `docs/runbook.md §6`.
- **Billing Portal Dashboard config.** `SK-STRIPE-008` ships the endpoint, but `sessions.create` errors until a portal configuration (switchable plans, cancel behaviour, invoice history) is saved in the Stripe Dashboard → Billing → Customer portal. Capture the activation steps in `docs/runbook.md §6` alongside price-ID setup.

## Billing constraints and philosophy

### No dark patterns — hard rules

These apply to every billing surface. Violating any one of them is a product defect, not a configuration choice:

- **No credit card for the free tier, ever.** Not "to verify identity." Not "for spam protection." No.
- **The trial is the free tier itself.** There is no separate "14-day Pro trial" with a countdown. When a user exceeds free limits, rate-limit with a clear message — "You've used your 1,000 queries. Add a card to continue — or wait until next month." The user's data is never held hostage. Export is one click, always free.
- **First charge confirmation.** When a card is added, email before the first charge: "You'll be billed $X on Y. Reply NO to cancel." No silent auto-upgrades from Hobby to Pro; tier changes require a deliberate click.
- **Usage predictability.** Hard caps on Pro are opt-in; the default is a soft cap: email at 80% of the user's monthly budget, email + require a one-click extension at 100%. No surprise $4,000 bills. Ever.
- **Downgrade is as easy as upgrade.** One click. Pro-rated refund on the unused portion.
- **Cancellation is one click** — no call, no chat, no exit survey. Optional exit survey *after* cancellation is acceptable.

### Payment tech stack

- **Stripe Billing** — invoicing + payment method capture. Checkout is Stripe-hosted; we do not build card forms.
- **Lago** (self-hosted, open source) — usage metering in front of Stripe. Meters queries, LLM tokens, GB-mo. Emits invoice events to Stripe. Not yet wired (Phase 2).
- **Stripe Tax** — enabled from day 1 in live mode. Handles VAT/GST automatically.
- **Paddle** — optional Merchant of Record if we expand internationally before setting up entities. Deferred until needed.

### Things we will NOT do

- Charge for the number of seats in Phase 1. The billing unit is the DB and the query, not the human.
- Gate features we'd have shipped anyway behind Pro to manufacture upgrade urgency.
- Offer "lifetime deals" on AppSumo. That audience is not ours and the support cost is real.
- Hide prices behind "Contact sales" for anything under the Enterprise tier.

### Unit economics (napkin, Phase 1)

| Tier | Our cost | Margin target |
|---|---|---|
| Free (100 queries/mo) | ~$0.15–$0.40 | — (CAC substitute) |
| Hobby ($10/mo) | ~$2–4 | 60–80% at target plan-cache hit rate |
| Pro ($25/mo+) | — | 75%+ once self-hosted classifier is online |

**LLM cost is the dominant variable.** Plan cache hit rate (60–80% at maturity) is the primary lever. Small-model-first chain + batch embeddings + no summarization for structured-output API calls are the secondary levers.
