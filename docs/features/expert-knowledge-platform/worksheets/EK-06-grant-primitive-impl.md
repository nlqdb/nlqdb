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
      GUC-spoof + read-only + schema-widening kill-tests pass. RLS-bypass
      kill-test + live route wiring await the DB-role half; see header.)*
- [ ] Usage records emitted per granted query, idempotent under retry.
- [ ] Revocation latency measured and within the EK-02 bound — including
      the in-flight half (`statement_timeout` ≤ the 30 s cache bound; the
      env knob may only tighten).
- [x] SDK/CLI/MCP/elements updated or gap tracked. *(SDK 2026-08-08:
      `mintGrant`/`listGrants`/`revokeGrant`, session-only, mirroring the key
      verbs. CLI 2026-08-09: `nlq grants list/revoke`, session-only, mirroring
      `nlq keys` — `GET /v1/grants` + `DELETE /v1/grants/:id`, no `mint` verb
      (minting is the marketplace selling flow, not the terminal). MCP +
      elements are out-of-scope-by-design — a session-only cross-tenant
      control-plane op never rides a bearer or a display element; rationale in
      the FEATURE.md gap note. The `GLOBAL-003` surface-parity gap is closed;
      EK-06's engine boxes 2–4 remain the slice's open work.)*
