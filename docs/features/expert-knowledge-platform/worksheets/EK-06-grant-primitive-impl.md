# EK-06 — Cross-tenant read-grant primitive (implementation)

**Status:** in-flight · **Repo:** nlqdb (engine) · **Risk:** high ·
**Runs:** multi · **Prereqs:** EK-02 design record + minted decision —
satisfied: [`SK-EKP-008`](../decisions/SK-EKP-008-grant-primitive-design.md) ·
**Box 1 shipped 2026-08-08:** `grants` control plane (migration 0026 +
`apps/api/src/grants.ts` + `/v1/grants` mint/list/revoke, session-only,
KV-idempotent, spanned). `getActiveGrant` is the fail-closed read box 2's
enforcement consumes; hosted-only + scope-shape checks run at mint.
**Box 2 — layer 1 shipped 2026-08-09:** the validation-layer scope guard
(`apps/api/src/ask/grant-scope.ts` `validateGrantScope`) — `SK-EKP-008`
guardrail #1 of 3. Composes on the base `/v1/ask` allowlist and rejects,
before execution: reach to any non-scope table via JOIN / subquery / CTE
body (join-leakage), schema-widened tables (deny-by-default), any write
(a grant is SELECT-only), and — inherited — the `set_config` GUC-spoof
primitive. Fail-closed on unparseable SQL (base allowlist rejects
`parse_failed` first, so `extractTables` can never fail open). The DB-role
half — the non-owner SELECT-only role assumed via `SET LOCAL ROLE` and
`FORCE ROW LEVEL SECURITY` (guardrails #2–3, where the RLS-bypass
kill-test lives) — and the live wiring into the buyer's `/v1/ask` route
remain box 2's open work.
**Box 2 — DB-role half, role-name convention shipped 2026-08-10:**
`apps/api/src/grant-role.ts` (`grantRoleName`/`assertGrantRoleName`) — the
single source of truth for the per-grant, non-owner, SELECT-only role name
(`grant_<16hex of SHA-256(grantId)>`) the provisioner and the exec path both
use, so they can never drift (the `tenant-role.ts` rationale applied to the
grant primitive). Per-**grant** (not per-tenant/per-DB) because the role is
provisioned *from* the grant's scope and scope is authoritative
(`SK-EKP-008`); the `grant_` prefix is disjoint from `tenant_`, so a granted
read can never assume an owner's full-tenant role, and a **missing** grant
role fails **closed** (no auto-heal, unlike the tenant role) — a grant role
is created only by the mint / re-scope path, never fabricated on a
`SET LOCAL ROLE` error.
**Box 2 — provisioning DDL builder shipped 2026-08-17 (sub-piece a):**
`apps/api/src/grant-provision.ts` (`buildGrantRoleDdl`) — the pure,
unit-tested statement batch that `CREATE ROLE`s the `grant-role.ts` name,
`GRANT SELECT`s **exactly** the scope tables (never `ALL TABLES` — schema
widening never widens a grant), `GRANT … TO CURRENT_USER WITH SET TRUE` so
the owner can `SET LOCAL ROLE`, and `ALTER TABLE … FORCE ROW LEVEL SECURITY`
per scoped table (guardrail #3), mirroring `neon-provision.ts`. Re-scope
safe: `REVOKE ALL … FROM` the role precedes the re-`GRANT`, so a re-scope
that drops a table removes its SELECT; the idempotent DO-block create means
mint and every re-scope run the identical batch. Fail-closed on an empty
scope or an unsafe schema/table identifier (SK-HDC-009 re-check before
interpolation).
**Box 2 — granted-exec step builder shipped 2026-08-18 (sub-piece b):**
`apps/api/src/grant-exec.ts` (`buildGrantExecSteps`) — the pure,
unit-tested `buildHostedExecSteps` analogue that assembles the granted
read's transaction (`app.*` GUCs → grant `statement_timeout` → `SET LOCAL
ROLE "grant_…"` → user statement). The load-bearing statement ORDER moved
to a new pure module `apps/api/src/ask/exec-steps.ts` (`buildExecSteps`)
that both the hosted path (`buildHostedExecSteps`) and the grant path
delegate to, so the two can never drift (the `grant-role.ts` single-source
rationale, applied to the exec batch). The grant path's two deliberate
differences: it asserts the `grant_<hex>` role name (`assertGrantRoleName`,
fail-closed on a `tenant_` or unsafe name) and pins `statement_timeout` to
`GRANT_STATEMENT_TIMEOUT` (the SK-EKP-008 in-flight revocation bound), never
the 10 s request cap. The `app.tenant_id`/`app.agent_id` GUCs carry the
**owner's** identity so the owner's `agent_isolation` policy returns the
owner's published rows (full-tenant visibility via the tenant-literal arm);
buyer identity drives metering attribution at the app layer
(`grant-usage.ts`), not a GUC — so no buyer-side GUC is set.
**Box 2 — provisioning wired into mint shipped 2026-08-19 (sub-piece c,
provision leg):** `apps/api/src/grant-provision-exec.ts`
(`provisionGrantRole`) runs the `buildGrantRoleDdl` batch against the shared
Neon branch in one spanned transaction (`GLOBAL-014`; 30 s `statement_timeout`
cap, SK-HDC-010), and `POST /v1/grants` now calls it **before** the D1 grants
row is written — the `neon-provision.ts` "Postgres first, D1 second" order, so
a later D1 failure leaves only a harmless idempotent orphan role, never an
"active" grant whose buyer queries fail closed on a missing role (P6). Mint
fails closed with `provision_failed` if the role cannot be stood up. **Box 2 — the composition keystone shipped 2026-08-20 (sub-piece d):**
`apps/api/src/grant-read.ts` (`planGrantedRead`) — the single pure decision
that composes the box-2 guardrails in order: null grant → `no_grant`
(fail-closed); `validateGrantScope` (layer 1: base allowlist, read-only,
join-leakage) passed through unchanged; then the derived `grant_<hex>` role
(`grant-role.ts`) and the `buildGrantExecSteps` batch (owner-scoped RLS GUCs,
30 s in-flight bound, non-owner role last). Pure — no D1/env/PG (the caller
owns the `getActiveGrant` + `grant-status.ts` cache lookup and passes the
already-resolved grant) — so the full reject matrix is unit-tested
(`grant-read.test.ts`) without a live DB. The forthcoming `/v1/ask` branch
reduces to: resolve grant → `planGrantedRead` → run `execSteps` → skip
narration (EK-09 box 2) → meter (`grant-usage.ts`). Still box 2's open work:
that live `/v1/ask` **exec** wiring, whose `app.*` GUC values against the
`agent_memory_v1` `agent_isolation` RLS policy get their **live PG
verification** (owner rows returned, nothing else) alongside the RLS-bypass
kill-test.

## Goal

Implement EK-02's design: tenant A grants tenant B's agents **read-only**
query access to a named knowledge DB — revocable, fail-closed, metered.

Contract sketch (EK-02 finalizes; these are the invariants any design must
satisfy):

- **Read-only, named-DB scope** — a grant never confers write, DDL, or
  access to any other DB of the grantor; the `SK-PIVOT-009` posture
  (RESTRICTIVE, fail-closed) extends, never relaxes.
- **Revocable with bounded latency** — revocation takes effect within a
  stated bound (EK-02 sets the number); a revoked grant failing closed is
  tested, not assumed.
- **Metered per query** — every **successfully executed** granted-access
  `/v1/ask` (and only those; SK-EKP-008 Q1) emits a usage
  record attributable to (grant, buyer, seller) — the unit `SK-EKP-002`'s
  fee later bills against. **A granted query requires an idempotency key**
  (broker-synthesized and persisted when the client omits one) and the
  granted path implements **replay** — same key ⇒ same response, no second
  usage record (SK-EKP-008 as hardened 2026-08-07; `GLOBAL-005`'s optional
  header alone is not enough for money integrity).
- **v1 scope-of-applicability** — grants mint on **platform-provisioned
  hosted DBs only**; BYO grantability is a separate future decision,
  deny-by-default. Grant `scope` is authoritative over role privileges,
  and schema widening never widens a grant (SK-EKP-008).
- **Narration skipped from the first live grant** — EK-09 box 2 lands
  *with* this slice, not after it: granted-path asks default to
  un-narrated rows (`Accept: application/json` behavior), so expert cell
  values never transit the summarize lane on a cross-tenant query. A
  granted read that narrates rows through an LLM before EK-09's skip is
  in place would silently spend the trust claim EK-03/EK-09 are building.
- **Observable** — OTel spans on the new surface (`GLOBAL-014`); seller
  can see who queried how much (their income statement), buyer can see
  what they spent.
- **GLOBAL-003** — new capability lands in SDK + CLI + MCP + elements, or
  the gap is tracked in the FEATURE.md.

## Done when

- [x] Grant mint/revoke/list shipped behind the public API with
      idempotency + spans. *(2026-08-08 — HTTP API; the SDK/CLI/MCP/
      elements sweep is box 5.)*
- [ ] Cross-tenant read works only through a live grant; kill-tests for
      RLS bypass, GUC spoofing, and join-leakage pass. *(Layer 1 shipped
      2026-08-09 — `validateGrantScope`: join-leakage + validation-layer
      GUC-spoof + read-only + schema-widening kill-tests pass. Role-name
      convention shipped 2026-08-10 — `grant-role.ts` (per-grant non-owner
      SELECT-only role, fail-closed on missing). Provisioning DDL builder
      shipped 2026-08-17 — `grant-provision.ts` `buildGrantRoleDdl`
      (SELECT-only on exactly the scope, `WITH SET TRUE`, FORCE RLS,
      re-scope-safe REVOKE, unit-tested). Granted-exec step builder shipped
      2026-08-18 — `grant-exec.ts` `buildGrantExecSteps` (the
      `buildHostedExecSteps` analogue: grant role asserted, in-flight
      `statement_timeout` pinned to the revocation bound, owner-scoped RLS
      GUCs; load-bearing order shared via `ask/exec-steps.ts` so hosted and
      grant paths can't drift; unit-tested). Provisioning wired into mint
      2026-08-19 — `grant-provision-exec.ts` `provisionGrantRole` runs the
      DDL batch in one spanned transaction and `POST /v1/grants` calls it
      before the D1 write (Postgres-first, fail-closed). RLS-bypass kill-test
      + the buyer's live `/v1/ask` exec wiring await the rest; see header.)*
- [ ] Usage records emitted per granted query, idempotent under retry.
      *(Meter primitive shipped 2026-08-10 — migration `0028_grant_usage.sql`
      + `apps/api/src/grant-usage.ts` `recordGrantUsage`: one row per
      successful granted query, attributed to (grant, buyer, seller),
      idempotent by the `UNIQUE (grant_id, idempotency_key)` constraint so a
      retry never double-counts (SK-EKP-008's 2026-08-07 hardening). No fee
      logic — public-half meter only (SK-EKP-002/003). Live per-query
      emission from the granted `/v1/ask` route awaits box 2's executor
      wiring; this is the primitive it calls on HTTP 200.)*
- [ ] Revocation latency measured and within the EK-02 bound — including
      the in-flight half (`statement_timeout` ≤ the 30 s cache bound; the
      env knob may only tighten). *(Bound primitive shipped 2026-08-10 —
      `apps/api/src/grant-status.ts`: `GRANT_REVOCATION_BOUND_MS` = 30 s is
      the single ceiling both clocks read. `resolveGrantStatusTtlMs` parses
      `GRANT_STATUS_TTL_MS` and clamps **downward only** (absent/invalid →
      ceiling; a value past 30 s pins to 30 s; 0 = re-check every request);
      `GRANT_STATEMENT_TIMEOUT` fixes the in-flight clock at the ceiling as a
      PG interval, never 0 (which would disable it). `makeGrantStatusCache`
      is the fail-closed NEW-query cache — positive-only, so a revoke
      propagates within the TTL and a null/errored status is never cached;
      the injected clock makes the ≤ TTL latency deterministically
      unit-measured (`grant-status.test.ts`). Live per-route measurement —
      revoke a wired grant, assert rejection within the bound — awaits box
      2's executor wiring, which sets this `statement_timeout` and consumes
      this cache.)*
- [x] SDK/CLI/MCP/elements updated or gap tracked. *(SDK 2026-08-08:
      `mintGrant`/`listGrants`/`revokeGrant`, session-only, mirroring the key
      verbs. CLI 2026-08-09: `nlq grants list/revoke`, session-only, mirroring
      `nlq keys` — `GET /v1/grants` + `DELETE /v1/grants/:id`, no `mint` verb
      (minting is the marketplace selling flow, not the terminal). MCP +
      elements are out-of-scope-by-design — a session-only cross-tenant
      control-plane op never rides a bearer or a display element; rationale in
      the FEATURE.md gap note. The `GLOBAL-003` surface-parity gap is closed;
      EK-06's engine boxes 2–4 remain the slice's open work.)*
