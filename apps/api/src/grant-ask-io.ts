// Granted-read production I/O wiring (SK-EKP-008, EK-06 box 2 — sub-piece (h),
// "the caller wires"). `grant-orchestrate.ts` (`executeGrantedRead`) is pure
// over an injected `GrantedReadIo`; its header names exactly what the caller
// must wire. THIS module assembles that `GrantedReadIo` from the live
// dependencies — every one already shipped — so the forthcoming cross-tenant
// `/v1/ask` branch reduces to one call: `executeGrantedRead(input,
// buildGrantedReadIo(...))` plus a rows-only render.
//
// Kept pure and node-safe (no `cloudflare:workers`, no `neon`) so the wiring
// is unit-testable without a live DB — the `grant-read.ts` / `grant-resolve.ts`
// idiom. The one dependency that MUST touch Neon (the exec-batch runner) is
// injected as `runExecSteps`; its production implementation lives in the
// Neon-importing `grant-ask-wire.ts`, alongside the isolate-local status cache.
//
// Two load-bearing wirings a reviewer audits here, once:
//   1. The active-grant lookup goes through the ≤30 s status cache
//      (`grant-status.ts`), keyed per (buyer, owner-DB) — the NEW-query
//      revocation bound. A revoke propagates within the bound; a null/errored
//      status is never cached (fail-closed), inherited from `getActiveGrant`
//      filtering `revoked_at IS NULL` at the source.
//   2. Usage is metered on the SAME D1 handle the grant was read from, so the
//      (grant, buyer, seller) attribution can never straddle two stores.

import type { HostedExecStep } from "./ask/exec-steps.ts";
import type { DbRecord, QueryResult } from "./ask/types.ts";
import { resolveDb } from "./db-registry.ts";
import type { GrantedReadIo } from "./grant-orchestrate.ts";
import type { GrantLookup } from "./grant-status.ts";
import { recordGrantUsage } from "./grant-usage.ts";
import { type GrantRecord, getActiveGrant } from "./grants.ts";

// The minimal status-cache shape this wiring needs — satisfied by
// `makeGrantStatusCache(...)` from `grant-status.ts`. Named as an interface so
// the composition is testable with a trivial fake.
export type GrantStatusCache = {
  status: (key: string, lookup: GrantLookup) => Promise<GrantRecord | null>;
};

// The status-cache key for a (buyer, owner-DB) pair. Bare, space-joined — the
// same shape `memoResolveDb` uses — so two different pairs can never collide in
// the isolate-local positive cache.
export function grantStatusCacheKey(buyerTenantId: string, ownerDbId: string): string {
  return `${buyerTenantId} ${ownerDbId}`;
}

export type GrantedReadWiring = {
  d1: D1Database;
  // Isolate-local NEW-query revocation-bound cache (constructed once per
  // isolate in the wire module so the ≤30 s bound holds across requests).
  statusCache: GrantStatusCache;
  // The Neon exec-batch runner — injected so this module stays node-safe.
  // Production: `runGrantExecSteps` (grant-ask-wire.ts).
  runExecSteps: (ownerDb: DbRecord, execSteps: HostedExecStep[]) => Promise<QueryResult>;
  // Idempotency-key source for a client that omitted one. Defaults to
  // `crypto.randomUUID` (available in Workers + node); injectable for tests.
  newIdempotencyKey?: () => string;
};

// Assemble the production `GrantedReadIo` from live deps. The route calls this
// per request with the request's D1 handle and the shared status cache.
export function buildGrantedReadIo(w: GrantedReadWiring): GrantedReadIo {
  return {
    // Active grant behind the ≤30 s status cache (grant-status.ts). The lookup
    // filters `revoked_at IS NULL` at the D1 source; the cache is positive-only,
    // so a revoke is served no longer than the bound and a null never sticks.
    resolveActiveGrant: (buyerTenantId, ownerDbId) =>
      w.statusCache.status(grantStatusCacheKey(buyerTenantId, ownerDbId), () =>
        getActiveGrant(w.d1, buyerTenantId, ownerDbId),
      ),
    // The owner DB, resolved under the OWNER's tenant — `resolveGrantedRead`
    // passes the (id, ownerTenantId) pair off the trusted grant row, so
    // `resolveDb`'s tenant fence still bounds the read to exactly the grant.
    resolveOwnerDb: (id, tenantId) => resolveDb(w.d1, id, tenantId),
    runExecSteps: w.runExecSteps,
    // Metered on the same D1 handle; idempotent by the grant_usage UNIQUE
    // constraint, so a replay records nothing new.
    recordUsage: (input) => recordGrantUsage(w.d1, input),
    newIdempotencyKey: w.newIdempotencyKey ?? (() => crypto.randomUUID()),
  };
}
