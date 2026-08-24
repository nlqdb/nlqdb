// Granted-read RESOLVE leg (SK-EKP-008, EK-06 box 2). The pure planner
// `grant-read.ts` (`planGrantedRead`) decides "given a resolved grant plus the
// owner's schema, what runs"; this module owns the I/O that produces those
// inputs, fail-closed. So the (forthcoming) cross-tenant `/v1/ask` branch
// reduces to: `resolveGrantedRead` → `planGrantedRead` → run `execSteps` → skip
// narration (EK-09 box 2) → meter (`grant-usage.ts`).
//
// It answers one question: is this buyer's request against `requestedDbId` a
// LIVE cross-tenant grant read, and if so, on which owner DB? Every negative
// answer is a typed fail-closed reject — a buyer never resolves an owner DB
// without an active grant, and it is the grant (not the buyer's own tenant)
// that authorizes the owner-scoped resolve.
//
// Pure by construction over two injected async resolvers — no D1, no env, no
// PG — so the full reject matrix is unit-testable without a live DB (the
// `grant-read.ts` idiom). The caller wires:
//   - `resolveActiveGrant` = the `getActiveGrant` D1 read behind the ≤30 s
//     `grant-status.ts` status cache (the NEW-query revocation bound), and
//   - `resolveOwnerDb` = the ordinary `db-registry.ts` `resolveDb`.

import type { DbRecord } from "./ask/types.ts";
import type { GrantRecord } from "./grants.ts";

export type GrantedReadResolveReject =
  // No live grant for this (buyer, DB): none minted, or revoked (filtered at
  // the `getActiveGrant` source and never cached past the bound).
  | { ok: false; reason: "no_grant" }
  // A live grant, but the owner's DB row is gone (owner deleted it after the
  // grant was minted). Fail closed — there is nothing to read.
  | { ok: false; reason: "owner_db_missing" }
  // A live grant on a DB that is not a platform-provisioned hosted Postgres
  // (BYO / ClickHouse). SK-EKP-008 v1 grants apply to hosted DBs only; the
  // grant role + FORCE-RLS the exec batch leans on exist only there.
  | { ok: false; reason: "not_grantable" };

export type GrantedReadResolved = {
  ok: true;
  // The authorizing grant — the route reads (grant, owner, buyer) off it for
  // (grant, buyer, seller) usage attribution (`grant-usage.ts`).
  grant: GrantRecord;
  // The owner's DB row, resolved under the OWNER's tenant (justified by the
  // grant), that the granted read executes against.
  ownerDb: DbRecord;
  // The owner DB's physical schema name — what `planGrantedRead` bakes into
  // the exec batch's `search_path`. Same convention as the hosted exec path
  // (`build-deps.ts`): strip the `db_` id prefix.
  schemaName: string;
};

// Resolve a buyer's granted read against `requestedDbId`. `resolveActiveGrant`
// returns the buyer's active grant on that DB (or null); `resolveOwnerDb`
// resolves a DB row scoped to a given tenant.
export async function resolveGrantedRead(input: {
  buyerTenantId: string;
  requestedDbId: string;
  resolveActiveGrant: (buyerTenantId: string, ownerDbId: string) => Promise<GrantRecord | null>;
  resolveOwnerDb: (dbId: string, ownerTenantId: string) => Promise<DbRecord | null>;
}): Promise<GrantedReadResolved | GrantedReadResolveReject> {
  const { buyerTenantId, requestedDbId, resolveActiveGrant, resolveOwnerDb } = input;

  const grant = await resolveActiveGrant(buyerTenantId, requestedDbId);
  if (!grant) return { ok: false, reason: "no_grant" };

  // `getActiveGrant` already scopes by (grantee, ownerDb, revoked_at IS NULL);
  // re-assert the identity the row must carry so no wiring bug can ever let a
  // grant authorize a DB (or a buyer) it was not minted for. Defence in depth,
  // fail-closed.
  if (grant.granteeTenantId !== buyerTenantId || grant.ownerDbId !== requestedDbId) {
    return { ok: false, reason: "no_grant" };
  }

  // The owner-scoped resolve is authorized by the grant, not the buyer: the
  // (id, ownerTenantId) pair comes from the trusted grant row, never from
  // buyer input, so `resolveDb`'s tenant WHERE clause still fences the read to
  // exactly the granted owner DB.
  const ownerDb = await resolveOwnerDb(grant.ownerDbId, grant.ownerTenantId);
  if (!ownerDb) return { ok: false, reason: "owner_db_missing" };

  // SK-EKP-008 v1: grants apply to platform-provisioned hosted Postgres only.
  // Mint enforces this, but a DB's shape can change after mint, and the grant
  // role + owner RLS the exec batch assumes exist only on a hosted row — so
  // re-check here and fail closed rather than run the batch against a BYO /
  // ClickHouse target it does not fit.
  if (ownerDb.engine !== "postgres" || ownerDb.connectionBlob) {
    return { ok: false, reason: "not_grantable" };
  }

  const schemaName = ownerDb.id.startsWith("db_") ? ownerDb.id.slice(3) : ownerDb.id;
  return { ok: true, grant, ownerDb, schemaName };
}
