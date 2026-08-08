# EK-06 — Cross-tenant read-grant primitive (implementation)

**Status:** in-flight · **Repo:** nlqdb (engine) · **Risk:** high ·
**Runs:** multi · **Prereqs:** EK-02 design record + minted decision —
satisfied: [`SK-EKP-008`](../decisions/SK-EKP-008-grant-primitive-design.md) ·
**Box 1 shipped 2026-08-08:** `grants` control plane (migration 0026 +
`apps/api/src/grants.ts` + `/v1/grants` mint/list/revoke, session-only,
KV-idempotent, spanned). `getActiveGrant` is the fail-closed read box 2's
enforcement consumes; hosted-only + scope-shape checks run at mint.

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
      RLS bypass, GUC spoofing, and join-leakage pass.
- [ ] Usage records emitted per granted query, idempotent under retry.
- [ ] Revocation latency measured and within the EK-02 bound — including
      the in-flight half (`statement_timeout` ≤ the 30 s cache bound; the
      env knob may only tighten).
- [~] SDK/CLI/MCP/elements updated or gap tracked. *(2026-08-08 — SDK done:
      `mintGrant`/`listGrants`/`revokeGrant`, session-only, mirroring the key
      verbs. CLI (`nlq grants list/revoke`) is the remaining surface, a
      follow-up run. MCP + elements are out-of-scope-by-design — a session-only
      cross-tenant control-plane op never rides a bearer or a display element;
      rationale recorded in the FEATURE.md gap note.)*
