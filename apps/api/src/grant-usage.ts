// Cross-tenant granted-query usage ledger (SK-EKP-008, EK-06 box 3).
//
// The metering half of the grant primitive. `grants.ts` is the
// control-plane (mint/revoke/list + the fail-closed `getActiveGrant`
// read); `grant-scope.ts` is the validation-layer scope guard (box 2
// layer 1). This module owns the usage record every *successfully
// executed* granted `/v1/ask` emits — the unit SK-PIVOT-023 axis-2 later
// bills against.
//
// Posture (SK-EKP-008):
//   - Billable unit = the successfully-executed authorized query,
//     row-count-independent (0 rows or 10 000 → exactly one record). The
//     route emits AFTER a granted query returns HTTP 200; a rejected or
//     errored query emits nothing.
//   - Idempotent under retry BY CONSTRUCTION. A granted query requires an
//     idempotency key (the route synthesizes + persists one when the
//     client omits it); the `UNIQUE (grant_id, idempotency_key)` index +
//     `ON CONFLICT DO NOTHING` mean a replay records nothing new. This is
//     structural, not a read-then-write race — same fail-safe idiom as the
//     `grants` revoke UPDATE. Dedupe is per-grant: the same client key seen
//     under two different grants is two distinct billable events.
//   - NO fee logic, NO fee %, NO Stripe call here (SK-EKP-002 / SK-EKP-003):
//     the public core emits the record; only the private `experts` surface
//     turns usage into money. When billing ships, the Stripe meter event's
//     `identifier` is this same idempotency key.

export type GrantUsageInput = {
  grantId: string;
  ownerTenantId: string;
  ownerDbId: string;
  granteeTenantId: string;
  idempotencyKey: string;
};

// Emit one usage record for a successfully-executed granted query.
// Returns whether THIS call created the row: `recorded: false` means the
// key was already seen for this grant (a replay), so no second record and
// no double-count. The route uses that to decide whether a fresh billable
// event occurred — the same-key ⇒ same-response replay contract lives on
// the route with the response cache; the no-double-count invariant lives
// here, in the constraint.
export async function recordGrantUsage(
  d1: D1Database,
  input: GrantUsageInput,
): Promise<{ recorded: boolean }> {
  const res = await d1
    .prepare(
      "INSERT INTO grant_usage " +
        "(id, grant_id, owner_tenant_id, owner_db_id, grantee_tenant_id, idempotency_key) " +
        "VALUES (?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT (grant_id, idempotency_key) DO NOTHING",
    )
    .bind(
      crypto.randomUUID(),
      input.grantId,
      input.ownerTenantId,
      input.ownerDbId,
      input.granteeTenantId,
      input.idempotencyKey,
    )
    .run();
  return { recorded: res.meta.changes === 1 };
}
