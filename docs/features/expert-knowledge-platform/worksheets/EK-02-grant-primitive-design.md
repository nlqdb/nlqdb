# EK-02 — Cross-tenant read-grant primitive: research → design record

**Status:** **complete** (2026-08-07). Design record minted 2026-08-06 as
[`SK-EKP-008`](../decisions/SK-EKP-008-grant-primitive-design.md) (all four
`Done when` boxes below satisfied); the routing follow-up — the `FEATURE.md`
index stub and the `INDEX.md` Tracker tick, deferred to avoid a collision
with then-open PRs #918 (`FEATURE.md`) and #917 (`INDEX.md`) — landed once
both merged. ·
**Repo:** nlqdb (engine) · **Risk:** med · **Runs:** 1–2 · **Prereqs:** none

## Goal

Design the primitive EK-06 implements: tenant A sells tenant B's agents
**read-only, revocable, fail-closed, per-query-metered** access to a named
knowledge DB. Output: a design record minted as a new `SK-EKP` decision
(five fields), settling the open questions below.

## Research findings (2026-08-05)

Every incumbent marketplace converges on the same shape — **the grant is a
named control-plane object, data is queried in place (never copied), and
revocation is near-immediate because every query passes an online
authorization check**:

- **Snowflake** shares grant object privileges to a `SHARE`; revocable any
  time; paid listings support per-query pricing, free allowances, monthly
  caps, and platform-processed billing ([intro](https://docs.snowflake.com/en/user-guide/data-sharing-intro),
  [pricing plans](https://docs.snowflake.com/en/collaboration/provider-listings-pricing-model)).
- **BigQuery Analytics Hub** grants a read-only *linked dataset* pointer;
  publisher revokes any subscription instantly ([docs](https://docs.cloud.google.com/bigquery/docs/analytics-hub-introduction)).
- **AWS Data Exchange** bills per active grant and supports metered
  **per-successful-request** billing; revocation notifies the subscriber
  ([revoke](https://docs.aws.amazon.com/data-exchange/latest/userguide/revoking-revisions.html),
  [metered](https://aws.amazon.com/about-aws/whats-new/2022/06/metered-billing-aws-data-exchange-apis)).
- **Databricks Delta Sharing**'s bearer-token model is the cautionary tale:
  token lifetime bounds revocation latency, and Databricks is force-expiring
  all long-lived tokens (Dec 2026) ([docs](https://learn.microsoft.com/en-us/azure/databricks/opensharing/create-recipient-token)).
- **Postgres/RLS failure modes** to design against: session `SET` bleeding
  across pooled connections (use `SET LOCAL`); table-owner RLS bypass
  (`FORCE ROW LEVEL SECURITY`, non-owner execution role); definer-view
  leakage (use `security_invoker`); non-leakproof-function predicate side
  channels ([bytebase](https://www.bytebase.com/blog/postgres-row-level-security-limitations-and-alternatives/),
  [pganalyze](https://pganalyze.com/blog/5mins-postgres-row-level-security-bypassrls-security-invoker-views-leakproof-functions)).
  GUC identity is only as trustworthy as the SQL path — the allowlist must
  keep rejecting `SET`/`set_config`, single statements only.
- **Neon has no cross-project sharing primitive** — read replicas +
  per-project permissions only ([read replicas](https://neon.com/docs/guides/read-only-access-read-replicas)),
  so cross-tenant grants must be **brokered above Postgres** by the Worker.
- **Stripe 2026**: metered pricing requires **Billing Meters** (legacy
  usage-records API removed); meter events dedupe on a unique `identifier`
  ([recording usage](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api));
  Connect `application_fee_percent` + platform-pricing tools let the
  founder set/vary the fee without code
  ([platform pricing](https://docs.stripe.com/connect/platform-pricing-tools)).
  Agent-native rails exist when needed later: x402 (Linux Foundation,
  Workers middleware, [Cloudflare](https://developers.cloudflare.com/agents/agentic-payments/x402/))
  and Stripe's Machine Payments Protocol.
- **Paydog** ([paydog.app](https://paydog.app/)) already sells pay-per-query
  MCP knowledge — prose inside, but the billing shape is live; tracked in
  `docs/research/expert-knowledge-platform.md`.

## Recommended baseline (design record to confirm or refute)

**Platform-brokered query under a dedicated read-only role, grant row
checked per request.** A `grants` row in platform-db
`{grant_id, owner_db_id, grantee_tenant_id, scope, price_model, status}`;
buyer's `/v1/ask` names the granted DB → Worker checks the grant
(fail-closed; status cached ≤30 s) → executes on the owner's DB under a
**non-owner, SELECT-only role** over the granted scope (role-level identity,
immune to GUC spoofing) with `SET LOCAL` audit GUCs → one Stripe meter
event per **successful** query, `identifier` = the request's
`Idempotency-Key` (`GLOBAL-005` reused as the dedup key).

Rejected in research: capability tokens (Delta-Sharing revocation-latency
lesson); per-grant read replicas as v1 default (free-tier cost,
`GLOBAL-013` — keep as the noisy-neighbor escape hatch for hot listings).

## Open design questions (the design record must settle)

1. Billable unit: successful query vs "touched paid data even if 0 rows"
   (Snowflake's gaming-resistant but buyer-hostile choice).
2. Is the granted **schema** itself paid IP, or shared free for
   introspection while rows are brokered? (Interacts with `GLOBAL-037` —
   schema egress is the one thing the LLM may see.)
3. Who absorbs owner-side compute for buyer queries pre-revenue
   (`GLOBAL-013` free-tier constraint; Snowflake puts it on the provider).
4. Merchant-of-record: Stripe Connect standard vs platform-as-MoR
   (Snowflake and Apify chose platform-as-MoR; tax weight — founder-adjacent,
   money call).
5. Buyer-agent identity v1: existing tenant API keys suffice, or HTTP
   message signatures per Cloudflare's pay-per-crawl?

## Done when

- [x] Design record answers the five questions (money-ladder ones with a
      founder check-in) and is minted as a new `SK-EKP` decision —
      [`SK-EKP-008`](../decisions/SK-EKP-008-grant-primitive-design.md). The
      MoR money call routes to the existing `SK-EKP-002` ship-time founder
      gate (no new 🔒 bullet spent); the compute-cost call resolves from
      `GLOBAL-013` + rate-limit rails.
- [x] The NL→SQL scope-validation approach (grant tables only; joins to
      non-granted tables rejected at validation, not just RLS) is specified —
      `SK-EKP-008` "NL→SQL scope validation" (validation-layer scope refusal
      **and** non-owner SELECT-only role **and** `FORCE ROW LEVEL SECURITY`).
- [x] Revocation-latency bound stated and testable — `SK-EKP-008`:
      fail-closed within a **30 s** (env-tunable) grant-status cache bound;
      `EK-06` must test it (revoke → assert rejection within the bound).
- [x] EK-06's contract updated if the baseline shifts — baseline
      **confirmed, no shift**; `EK-06`'s invariants stand, now anchored to
      `SK-EKP-008`.
