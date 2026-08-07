# EK-06 — Cross-tenant read-grant primitive (implementation)

**Status:** planned · **Repo:** nlqdb (engine) · **Risk:** high ·
**Runs:** multi · **Prereqs:** EK-02 design record + minted decision —
satisfied: [`SK-EKP-008`](../decisions/SK-EKP-008-grant-primitive-design.md)

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
- **Metered per query** — every granted-access `/v1/ask` emits a usage
  record attributable to (grant, buyer, seller) — the unit `SK-EKP-002`'s
  fee later bills against. Metering is idempotent under retries
  (`GLOBAL-005` applies to any mutating surface this adds).
- **Observable** — OTel spans on the new surface (`GLOBAL-014`); seller
  can see who queried how much (their income statement), buyer can see
  what they spent.
- **GLOBAL-003** — new capability lands in SDK + CLI + MCP + elements, or
  the gap is tracked in the FEATURE.md.

## Done when

- [ ] Grant mint/revoke/list shipped behind the public API with
      idempotency + spans.
- [ ] Cross-tenant read works only through a live grant; kill-tests for
      RLS bypass, GUC spoofing, and join-leakage pass.
- [ ] Usage records emitted per granted query, idempotent under retry.
- [ ] Revocation latency measured and within the EK-02 bound.
- [ ] SDK/CLI/MCP/elements updated or gap tracked.
