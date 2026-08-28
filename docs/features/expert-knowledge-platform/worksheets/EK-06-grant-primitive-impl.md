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
narration (EK-09 box 2) → meter (`grant-usage.ts`). **Box 2 — live-PG RLS-bypass kill-test shipped 2026-08-23 (sub-piece e):**
`apps/api/src/grant-scoping.integration.test.ts` — the "owner rows, nothing
else" invariant executed by Postgres, not asserted about a string. It
provisions a grant role from the real `buildGrantRoleDdl` and runs reads
through the real `buildGrantExecSteps`, then proves against a live Neon branch
(gated on `NEON_TEST_BRANCH_URL`, skips in CI without it — the
`memory-scoping.integration.test.ts` idiom): a granted read sees the whole
owner knowledge DB across every owner agent (tenant-literal arm) minus expired
rows; **cross-tenant reach fails closed** — a fully-qualified read of another
tenant's schema, directly *or* via JOIN, is `permission denied` (the grant
role holds USAGE on the owner schema only); granted writes are denied at the
role level (SELECT-only); and FORCE RLS is confirmed on every scoped table
(guardrail #3). So the DB-role guarantees the exec batch leans on are proven
now — a later route bug can't be mistaken for a grant-primitive bug.
**Box 2 — granted-read RESOLVE leg shipped 2026-08-24 (sub-piece f):**
`apps/api/src/grant-resolve.ts` (`resolveGrantedRead`) — the I/O-owning
counterpart to the pure `grant-read.ts` planner: given (buyer, requestedDbId)
it returns either a typed fail-closed reject (`no_grant` / `owner_db_missing` /
`not_grantable`) or the resolved `{ grant, ownerDb, schemaName }` that
`planGrantedRead` consumes. Pure composition over two injected async resolvers
(the caller wires `getActiveGrant` behind the ≤30 s `grant-status.ts` cache, and
the ordinary `db-registry.ts` `resolveDb`), so the full reject matrix is
unit-tested without a live DB (`grant-resolve.test.ts`, 9 cases). Load-bearing
fail-closed choices: the owner DB is resolved under the OWNER's tenant from the
**trusted grant row** (never buyer input, so `resolveDb`'s tenant fence still
holds); the returned grant's (grantee, ownerDb) identity is re-asserted against
the request; and hosted-Postgres is re-checked at resolve (SK-EKP-008 v1) so a
BYO/ClickHouse target the grant role + FORCE-RLS don't fit fails closed rather
than mis-executing.
**Box 2 — granted-read EXECUTOR shipped 2026-08-25 (sub-piece g, the execution
keystone):** `apps/api/src/grant-orchestrate.ts` (`executeGrantedRead`) — the
pure composition the live route reduces to: `resolveGrantedRead` →
`planGrantedRead` → run `execSteps` (injected owner-DB runner) → meter
(`grant-usage.ts`) → return the owner's rows UN-NARRATED. Pure over injected I/O
(no D1/env/PG), so the full happy + reject + meter matrix is unit-tested without
a live DB (`grant-orchestrate.test.ts`, 10 cases), pinning three load-bearing
contracts: every resolve/plan reject fails closed **before** any exec runs and
**before** any usage is metered; usage is metered **only** after a successful
exec (a thrown exec propagates and meters nothing — SK-EKP-008's "errored query
emits nothing"), with the client's idempotency key or a synthesized one, and a
replay records nothing new while the read still returns; and the result is
rows-only (no summarize seam) so cell values never reach narration
(GLOBAL-037 / EK-09 box 2). Still box 2's open work: wiring `executeGrantedRead`
into the buyer's live `/v1/ask` route (detect the granted DB, thread the owner
schema to the schema-only planner, render rows-only) plus the live
revoke-while-in-flight latency measurement (its own box below).
**Box 2 — production I/O wiring shipped 2026-08-26 (sub-piece h, "the caller
wires"):** the executor is pure over an injected `GrantedReadIo`; this ships the
production assembly of that IO from live deps (all already shipped). Split for
test-safety: `apps/api/src/grant-ask-io.ts` (`buildGrantedReadIo`) is the
node-safe composition — active-grant lookup behind the ≤30 s `grant-status.ts`
cache keyed per (buyer, owner-DB), `resolveDb` for the owner DB, `recordGrantUsage`
on the same D1 handle, `crypto.randomUUID` idempotency default — unit-tested end
to end over a fake D1 (`grant-ask-io.test.ts`, 7 cases); `apps/api/src/grant-ask-wire.ts`
owns the two runtime-touching pieces the test must never import — the
isolate-local status cache (one per isolate, env-tunable downward only) and
`runGrantExecSteps`, the Neon runner that executes the pre-built grant exec batch
verbatim (grant `statement_timeout` + owner RLS GUCs + non-owner role already
baked by `buildGrantExecSteps`) under a `db.query` span, resolving the owner URL
from `env[connectionSecretRef]` and failing closed on a missing ref. `grantedReadIo(d1)`
is the single call the forthcoming route branch makes.
**Box 2 — schema-only planning half shipped 2026-08-26 (sub-piece i, "thread the
owner schema to the planner"):** `apps/api/src/grant-ask.ts`
(`orchestrateGrantedAsk`) — the granted-read analogue of `orchestrateAsk`, and the
one piece above `executeGrantedRead` that was still missing: it resolves the grant
for the owner's schema, plans the buyer's goal against that OWNER schema
(schema-only — owner table/column names in, **never** owner cell values;
GLOBAL-037 / SK-EKP-001), normalises the plan schema-relative (`schemaRelativeSql`,
so the exec `search_path` resolves it AND `validateGrantScope` sees bare names —
SK-ASK-025 applied to the owner schema), then delegates the audited resolve →
guardrail → run → meter → rows-only flow to `executeGrantedRead` unchanged. Pure
over injected I/O (the `GrantedReadIo` + a `planReadSql` wrapper), so the full
matrix — every resolve/scope reject fails closed with no plan/exec/meter, an
unschema'd owner DB is `schema_unavailable`, the planner sees schema-only, and the
plan is stripped schema-relative before the scope guardrail — is unit-tested
without a live DB (`grant-ask.test.ts`, 9 cases, driving the REAL executor over
fake I/O).
**Box 2 — the `/v1/ask` route branch shipped 2026-08-27 (sub-piece j, the live
keystone):** `apps/api/src/ask/route-granted-ask.ts` — `tryGrantedRead` + the pure
exhaustive `renderGrantedAsk` mapping `orchestrateGrantedAsk`'s union to an HTTP
render: rows-only 200 (UN-NARRATED — GLOBAL-037 / EK-09 box 2); `no_grant` →
`fallthrough` so the handler keeps its plain `db_not_found` (fail-closed, never
confirms the DB to a non-grantee); typed 403/404/409 for authorized-but-unservable
rejects. Wired in `index.ts` on the JSON `/v1/ask` `db_not_found` branch ONLY (a
pinned dbId that isn't the buyer's own), so an own-DB ask never pays the grant
lookup; buyer identity v1 = an authenticated tenant (session / `sk_live` /
`sk_mcp`). Exhaustively unit-tested (`route-granted-ask.test.ts` over the REAL
orchestrator); the executor's live-PG proof stays
`grant-scoping.integration.test.ts`; box 4's in-flight revocation bound is now
measured live by `grant-revocation.integration.test.ts` (detail in the box-4
row under *Done when*). Remaining EK-06 work: the box-3 route-level live
usage-emission assertion.

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
- [x] Cross-tenant read works only through a live grant; kill-tests for
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
      shipped 2026-08-23 — `grant-scoping.integration.test.ts` proves against a
      live Neon branch: owner rows across every owner agent, cross-tenant reach
      (direct + JOIN) `permission denied`, SELECT-only writes denied, FORCE RLS
      on every scoped table. Granted-read RESOLVE leg shipped 2026-08-24 —
      `grant-resolve.ts` `resolveGrantedRead` (fail-closed `no_grant` /
      `owner_db_missing` / `not_grantable`; owner DB resolved under the owner
      tenant from the trusted grant row; hosted-only re-check; unit-tested).
      Granted-read EXECUTOR shipped 2026-08-25 — `grant-orchestrate.ts`
      `executeGrantedRead` composes resolve → plan → run → meter → rows-only,
      pure over injected I/O, full reject/meter matrix unit-tested. The buyer's
      live `/v1/ask` route branch is wired 2026-08-27 (see header) — no grant ⇒
      `db_not_found`, fail-closed.)*
- [ ] Usage records emitted per granted query, idempotent under retry.
      *(Meter primitive shipped 2026-08-10 — migration `0028_grant_usage.sql`
      + `apps/api/src/grant-usage.ts` `recordGrantUsage`: one row per
      successful granted query, attributed to (grant, buyer, seller),
      idempotent by the `UNIQUE (grant_id, idempotency_key)` constraint so a
      retry never double-counts (SK-EKP-008's 2026-08-07 hardening). No fee
      logic — public-half meter only (SK-EKP-002/003). The meter-after-success
      + idempotency-key-synthesis composition landed 2026-08-25 in
      `grant-orchestrate.ts` `executeGrantedRead` (metered only after a
      successful exec; a synthesized key when the client omits one; replay
      records nothing new — unit-tested). The route branch is wired 2026-08-27
      (header sub-piece j), so live per-query emission now runs on the granted
      `/v1/ask`; a route-level live assertion rides the box-4 Neon test.)*
- [x] Revocation latency measured and within the EK-02 bound — including
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
      unit-measured (`grant-status.test.ts`). Box 2's route wiring landed
      2026-08-27, so this `statement_timeout` + cache run live; the in-flight
      measurement shipped 2026-08-27 —
      `grant-revocation.integration.test.ts` proves against a live Neon branch
      that the wired batch sets `statement_timeout` to the ≤30 s ceiling
      (`SHOW`) and that Postgres cancels a granted read that outlives the bound
      (57014), under the real grant role and batch order.)*
- [x] SDK/CLI/MCP/elements updated or gap tracked. *(SDK 2026-08-08:
      `mintGrant`/`listGrants`/`revokeGrant`, session-only, mirroring the key
      verbs. CLI 2026-08-09: `nlq grants list/revoke`, session-only, mirroring
      `nlq keys` — `GET /v1/grants` + `DELETE /v1/grants/:id`, no `mint` verb
      (minting is the marketplace selling flow, not the terminal). MCP +
      elements are out-of-scope-by-design — a session-only cross-tenant
      control-plane op never rides a bearer or a display element; rationale in
      the FEATURE.md gap note. The `GLOBAL-003` surface-parity gap is closed;
      EK-06's engine boxes 2–4 remain the slice's open work.)*
