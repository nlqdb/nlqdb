# SK-STRIPE-009 — `GET /v1/billing/status` is a pure D1 read projecting the caller's plan; price→tier map stays server-side

Parent feature: [`stripe-billing/FEATURE.md`](../FEATURE.md). Backs the
`/pricing` tier badge + the in-app dunning banner (web-app `SK-WEB-012`);
the checkout duplicate-guard `SK-STRIPE-010` reuses the same row read.

- **Decision:** `GET /v1/billing/status` (`requireSession`-gated) returns `{ plan, status, currentPeriodEnd, cancelAtPeriodEnd, manageable }` from a single indexed `customers` read — **no Stripe call**. `plan` maps the stored `price_id` against `STRIPE_PRICE_HOBBY`/`STRIPE_PRICE_PRO` (else `"unknown"`); no row → `{ plan: "free", status: "none", manageable: false }`. `status` is the Stripe status verbatim; `manageable` is true iff a row exists. Web-only (GLOBAL-003).
- **Core value:** Honest latency, Simple, Effortless UX
- **Why:** The page offered "Manage billing" to every signed-in user, so a free user who never checked out hit the portal's `404 no_customer`, and it could not show which tier a subscriber is on. A cheap read of the row the webhook keeps current fixes both with zero Stripe traffic; mapping price→tier server-side keeps the price IDs out of the client bundle.
- **Consequence in code:** `apps/api/src/stripe/billing-status.ts` is a pure resolver (row in, status out) mirroring `checkout.ts`/`portal.ts`; the route owns the D1 read and one `nlqdb.billing.status` span per request. `manageable` stays true for a `canceled` row (portal still serves invoices). `pricing.astro` badges "Current plan" only for statuses that still hold the tier (`active`/`trialing`/`past_due`) and treats `unknown` as "don't badge"; the fetch is a progressive enhancement. No new env var (reuses the checkout price IDs).
- **Alternatives rejected:**
  - Return the raw `customers` row — leaks the Stripe customer/subscription IDs for no UI need; the resolver projects only what the page renders.
  - Map price→tier in the browser — ships the price IDs in the client bundle and duplicates the mapping checkout owns server-side.
  - Probe subscriber-ness via the portal's 404 — couples a read to a mutating Stripe call and only answers after a click.
