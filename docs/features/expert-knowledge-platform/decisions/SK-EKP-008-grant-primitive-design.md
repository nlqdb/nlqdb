# SK-EKP-008 — Cross-tenant read-grant primitive: platform-brokered per-query grant under a non-owner SELECT-only role, billed on successful execution, fail-closed within 30 s

The EK-02 design record. Confirms (does not shift) the recommended baseline
in [`worksheets/EK-02-grant-primitive-design.md`](../worksheets/EK-02-grant-primitive-design.md)
and settles its five open questions. Minted alongside `SK-EKP-007` (the
EK-01 interview-extraction record); this is the primitive `EK-06` implements.

- **Decision (2026-08-06, resolved from the documented values per
  [`GLOBAL-033`](../../../decisions/GLOBAL-033-resolution-defaults.md)):**
  Tenant A sells tenant B's agents **read-only, revocable, fail-closed,
  per-query-metered** access to a named knowledge DB via a
  **platform-brokered** query, not a copy and not a capability token. The
  shape:

  - **Grant object (control-plane).** A `grants` row in platform-db
    `{grant_id, owner_db_id, grantee_tenant_id, scope, price_model, status,
    created_at, revoked_at}`. It lives above Postgres because Neon has **no
    cross-project sharing primitive** (read replicas + per-project
    permissions only) — the Worker is the broker.
  - **Per-request authorization, fail-closed.** The buyer's `/v1/ask` names
    the granted DB; the Worker checks the grant is `active` **on every
    request** (status cached ≤ 30 s, env-tunable). If the check cannot
    confirm an active grant — revoked, expired, unknown, or the check itself
    errors — the query is **rejected** (never served on stale cache past the
    bound). This is the `SK-PIVOT-009` RESTRICTIVE/fail-closed posture
    extended, never relaxed.
  - **Execution under a non-owner, SELECT-only role.** The brokered query
    runs on the **owner's** DB under a dedicated role that is
    `SELECT`-only over the granted scope and is **not** the table owner.
    Two separate table-level/role-level controls (fixed 2026-08-07, Fable
    review of #919 — the original sentence conflated them): granted tables
    carry `ALTER TABLE … FORCE ROW LEVEL SECURITY` (closing the
    table-**owner** bypass), *and* execution uses the non-owner role
    (RLS applies to it regardless). The role is assumed with
    `SET LOCAL ROLE` **inside the request transaction** — never a session
    `SET ROLE`, which bleeds identity across pooled connections. Identity
    is **role-level**, immune to the GUC-spoofing failure mode (`app.*`
    GUCs are set with `SET LOCAL` for audit only, never as the security
    boundary). Views in the scope use `security_invoker` to avoid
    definer-view leakage; predicate functions are treated as non-leakproof
    (reviewable invariant: a grant scope containing any function-backed
    surface is rejected at mint in v1). **v1 grants are mintable on
    platform-provisioned hosted DBs only** — on a BYO DB none of the role /
    FORCE-RLS / no-DDL-functions assumptions hold (`sql-validate-ddl.ts`
    cannot vouch for DDL it never saw); BYO grantability is a separate
    future decision, deny-by-default.
  - **Metering (public half only).** Each granted query that executes
    successfully emits **one usage record** attributable to
    `(grant_id, grantee_tenant_id, owner_db_id)`. **A granted query
    *requires* an idempotency key** (fixed 2026-08-07, Fable review of
    #919): `GLOBAL-005` makes the `Idempotency-Key` header optional and
    `/v1/ask` has no dedupe middleware today, so the record's billing
    invariant was unimplementable as written — EK-06 must (a) synthesize
    and persist a key in the broker when the client omits one, and
    (b) implement replay on the granted path (same key ⇒ same response,
    **no second usage record**). The public engine emits the *usage
    record*; turning usage into a **billed fee** is `SK-PIVOT-023` axis 2
    and lives **only** in the private `experts` surface (`SK-EKP-003`) —
    no fee logic, no fee %, and no Stripe call in nlqdb's public core.
    When billing ships, the meter event's `identifier` is that same key
    (Stripe 2026 Billing Meters dedupe on `identifier`).

  **Five open questions, settled:**

  1. **Billable unit → the successfully-executed authorized query,
     row-count-independent.** A query that passes validation + authorization
     and executes to completion (HTTP 200) emits exactly one usage record,
     whether it returns 0 rows or 10 000. *(Honest / Goal-first §0 + mirror
     AWS Data Exchange "metered per successful request".)* Rejected:
     Snowflake's "touched paid data even if 0 rows" — gaming-resistant but
     buyer-hostile, and the honest unit is "the buyer asked and got a
     truthful answer." Gaming by crafting 0-row queries is a non-issue
     because billing keys on **successful execution**, not row count.
  2. **The granted schema is free for introspection; the rows are the paid
     product.** A listing exposes its schema (table/column names,
     descriptions, golden queries) for discovery and NL→SQL planning without
     a grant; the grant + fee gate **row** access only. *(Consistent with
     `GLOBAL-037` — schema is the one thing an LLM may see — and with
     `SK-EKP-006`'s one-catalog discovery surface.)*
  3. **Owner-side compute pre-revenue is bounded, not absorbed open-endedly.**
     The query runs **in place** on the owner's already-provisioned DB (no
     copy, no new compute line), so marginal cost is near-zero on the Neon
     free tier (`GLOBAL-013`); as with Snowflake the provider's engine bears
     the query. Exposure is capped by **rate-limiting every granted query
     against the grant** (reusing the existing rate-limit rails), so a buyer
     cannot exhaust an owner's free-tier quota. **Parked until a listing
     breaches free-tier:** the per-grant read-replica escape hatch (the
     research's noisy-neighbour answer) — a decision-to-defer with a concrete
     trigger, not an open question.
  4. **Merchant-of-record follows `SK-EKP-002`** — payout mechanics are
     **founder-set when the selling surface ships** (`EK-05`, private repo);
     no mechanism is fixed here. The design's **conservative working
     assumption** (so `EK-06` is not blocked) is **platform-as-MoR** —
     matching the two closest analogues (Snowflake, Apify) and correct for
     the non-technical pilot seller (`SK-EKP-004` language tutor) who cannot
     run multi-jurisdiction tax themselves. Two honesty notes for the
     ship-time call (added 2026-08-07): "conservative" here means
     *conservative for the seller's experience*, not for nlqdb —
     platform-as-MoR is the **maximum** tax/liability posture for the
     platform, and the founder should weigh that explicitly; and nothing in
     EK-06 builds on this assumption, so overriding it costs no rework.
     This is *not* a new founder escalation: `SK-EKP-002` already routes
     payout mechanics to the founder at ship time, so no 🔒 bullet is spent
     (`GLOBAL-033`: a codified decision already decides *where* the call is
     made).
  5. **Buyer-agent identity v1 = the existing tenant API key.** The grant is
     keyed to `grantee_tenant_id`; the buyer's agent already authenticates
     with a tenant API key, which identifies the buyer for authorization and
     metering. *(Simple / "one way to do each thing" §0 + reuse.)* **Parked
     until buyers without an nlqdb tenant appear:** HTTP message signatures
     (Cloudflare pay-per-crawl style) / x402 agent-native rails — a
     decision-to-defer with a concrete trigger.

  **NL→SQL scope validation (EK-02 Done-when box 2).** The grant's `scope`
  enumerates the tables/views the buyer may read — and it is **authoritative
  over role privileges** when the two disagree (the role is provisioned
  *from* the scope; drift between them is a bug that fails closed at
  validation). A table the owner adds later is **not** auto-included:
  schema widening never widens a grant (deny-by-default; the owner re-scopes
  explicitly). Scope is enforced at the
  **validation layer** (the existing `sql-validate` allowlist path), not only
  by RLS: a granted query that references any table/view **outside** the
  grant scope — including via a JOIN, subquery, or CTE to a non-granted table
  — is **rejected at validation, before execution**. The `SET`/`set_config`
  rejection and single-statement rule stay in force (GUC identity is only as
  trustworthy as the SQL path). This is layered guardrails (`GLOBAL-033`
  security row): validation-layer scope rejection **and** the non-owner
  SELECT-only role **and** `FORCE ROW LEVEL SECURITY` — join-leakage is
  refused even if any single control regresses, defending against the
  Postgres RLS-bypass modes the EK-02 research catalogued.

  **Revocation-latency bound (EK-02 Done-when box 3).** A revoked grant fails
  closed within the grant-status cache TTL, **bounded at 30 s** (env-tunable
  **downward only** — config may tighten the bound, never widen it past 30 s;
  fail-safe: unknown/errored status → reject). The bound covers **new**
  queries; an **in-flight** query at revoke time is bounded separately by the
  granted path's `statement_timeout`, which EK-06 sets ≤ the same 30 s (fixed
  2026-08-07 — the original bound silently excluded in-flight queries). This
  is **testable** and `EK-06` must test it, not assume it: revoke a live
  grant, then assert queries against it are rejected within the bound. This is strictly tighter
  than Databricks Delta Sharing's cautionary model, where revocation latency
  is bounded by *bearer-token lifetime*; an online per-request check bounds
  it by cache TTL instead.

  **Honesty bound on revocation (noted 2026-08-10).** Revocation bounds
  **future** queries only. Rows already served are a buyer-side copy no
  mechanism recalls — one successful broad `SELECT` over the granted scope
  is a de-facto export at single-query price. Every queried-in-place
  incumbent carries the same residual; v1 accepts it. The binding
  consequence is on **copy**: seller-facing text (the EK-05 listing flow,
  the EK-03 ToS) presents revocation as *stopping future queries*, never as
  recalling served data — `SK-EKP-001`'s never-exceed-substance rule applies
  to seller-facing claims exactly as to buyer-facing ones. Volume-shaped
  mitigations (per-grant row caps, export-shaped-query heuristics) are
  parked until a real seller asks.

- **Core value:** Bullet-proof, Simple, Free, Goal-first

- **Why:** Every incumbent data marketplace (Snowflake shares, BigQuery
  Analytics Hub, AWS Data Exchange) converges on the same shape — the grant
  is a **named control-plane object, data is queried in place, and
  revocation is near-immediate because every query passes an online
  authorization check** — and the one divergent model, Delta Sharing's
  long-lived bearer tokens, is the documented failure (Databricks is
  force-expiring them). Neon offers no native cross-project share, so
  brokering above Postgres in the Worker is not a preference but a
  constraint. Role-level identity + validation-layer scope + FORCE RLS is the
  layered answer to the RLS-bypass modes (session-`SET` bleed, table-owner
  bypass, definer-view leakage, non-leakproof predicates) the research
  named; relying on RLS alone would inherit every one of them. Keeping fee
  logic out of the public engine preserves `GLOBAL-019` and `SK-EKP-003`: the
  primitive an operator self-hosts emits usage records and grants; only the
  private surface turns them into money.

- **Consequence in code:** `EK-06` implements exactly this: grant
  mint/revoke/list behind the public API (idempotent, `GLOBAL-014` spans),
  cross-tenant read only through a live grant, per-query usage records
  idempotent under retry, a measured revocation-latency test against the 30 s
  bound, and the `GLOBAL-003` surface sweep (SDK/CLI/MCP/elements or a tracked
  gap). A reviewer rejects: a grant that confers write/DDL or reaches another
  of the grantor's DBs; revocation bounded by anything other than the online
  check (no capability tokens as the v1 default); join/subquery reach to
  non-granted tables passing validation; **any fee %, fee logic, or Stripe
  call in nlqdb's public core** (that is `experts`-only per `SK-EKP-003`);
  metering that double-counts under retry. `EK-06`'s contract sketch is
  **unchanged** by this record — the baseline was confirmed, so its
  invariants stand, now anchored to this decision.

- **Alternatives rejected:**
  - **Capability / bearer tokens (Delta-Sharing model)** — revocation latency
    is bounded by token lifetime, not by an online check; the documented
    force-expiry migration is the tell. Kept out of v1.
  - **Per-grant read replicas as the v1 default** — free-tier cost
    (`GLOBAL-013`); kept as the **parked** noisy-neighbour escape hatch for
    hot listings (trigger: a listing breaches free-tier), not the default.
  - **Copy/export of granted rows to the buyer's tenant** — breaks
    revocation entirely (a copy cannot be recalled) and the "queried in
    place" invariant every incumbent holds.
  - **RLS as the sole scope control** — inherits every Postgres RLS-bypass
    mode in the research; scope must also be refused at validation and by a
    non-owner SELECT-only role.
  - **Billing per row returned** — invites 0-row gaming and is buyer-hostile;
    the honest, incumbent-matching unit is the successful query.
  - **Fixing merchant-of-record here** — `SK-EKP-002` already routes payout
    mechanics to the founder at ship time; pre-deciding it in the engine
    layer would contradict that and leak a money call into the public core.
