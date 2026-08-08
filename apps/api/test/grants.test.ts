// Cross-tenant read-grant control plane (SK-EKP-008, EK-06 box 1).
//
// Two layers, same shape as the keys coverage:
//   - data-layer tests against the real Miniflare D1 (migration 0026):
//     mint round-trip, list visibility/ordering, revoke outcomes, and
//     the fail-closed `getActiveGrant` read the enforcement slice
//     (EK-06 box 2) will consume.
//   - SELF.fetch auth gates proving `/v1/grants` is session-only — a
//     leaked sk_* / anon bearer must not mint, enumerate, or revoke
//     grants (same threat model as `/v1/keys`).

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  getActiveGrant,
  listGrantsByTenant,
  mintGrant,
  revokeGrantById,
  validateScope,
} from "../src/grants.ts";

const OWNER = "tenant-owner";
const GRANTEE = "tenant-grantee";

function mint(overrides: Partial<Parameters<typeof mintGrant>[1]> = {}) {
  return mintGrant(env.DB, {
    ownerTenantId: OWNER,
    ownerDbId: "db-1",
    granteeTenantId: GRANTEE,
    scope: ["mistakes", "lessons"],
    priceModel: null,
    ...overrides,
  });
}

describe("validateScope", () => {
  it("accepts bare table names and dedupes preserving order", () => {
    const out = validateScope(["mistakes", "lessons", "mistakes"]);
    expect(out).toEqual({ ok: true, scope: ["mistakes", "lessons"] });
  });

  it("rejects an empty or missing scope", () => {
    expect(validateScope([])).toEqual({ ok: false, reason: "scope_required" });
    expect(validateScope(undefined)).toEqual({ ok: false, reason: "scope_required" });
    expect(validateScope("mistakes")).toEqual({ ok: false, reason: "scope_required" });
  });

  it("rejects qualified, quoted, or function-shaped entries", () => {
    // SK-EKP-008: a scope must not smuggle schema-qualified reach or a
    // function-backed surface past the mint check.
    for (const bad of ["public.mistakes", '"mistakes"', "f(x)", "TABLE", "a-b", "", " "]) {
      expect(validateScope([bad])).toEqual({ ok: false, reason: "scope_invalid_table" });
    }
    expect(validateScope([42])).toEqual({ ok: false, reason: "scope_invalid_table" });
  });

  it("rejects oversized scopes and overlong names", () => {
    const tables = Array.from({ length: 65 }, (_, i) => `t_${i}`);
    expect(validateScope(tables)).toEqual({ ok: false, reason: "scope_too_large" });
    expect(validateScope(["a".repeat(64)])).toEqual({
      ok: false,
      reason: "scope_invalid_table",
    });
  });
});

describe("grants data layer (D1)", () => {
  it("mints a grant and round-trips it through the owner and grantee lists", async () => {
    const grant = await mint({ priceModel: "per-query:v0" });
    expect(grant.revokedAt).toBeNull();
    expect(grant.createdAt).toBeGreaterThan(0);

    const ownerView = await listGrantsByTenant(env.DB, OWNER);
    const granteeView = await listGrantsByTenant(env.DB, GRANTEE);
    expect(ownerView.map((g) => g.id)).toContain(grant.id);
    expect(granteeView.map((g) => g.id)).toContain(grant.id);
    const row = ownerView.find((g) => g.id === grant.id);
    expect(row?.scope).toEqual(["mistakes", "lessons"]);
    expect(row?.priceModel).toBe("per-query:v0");

    // A third tenant sees nothing.
    expect(await listGrantsByTenant(env.DB, "tenant-stranger")).toEqual([]);
  });

  it("sorts active rows before revoked in the list", async () => {
    const first = await mint();
    await revokeGrantById(env.DB, OWNER, first.id);
    const second = await mint({ ownerDbId: "db-2" });

    const view = await listGrantsByTenant(env.DB, OWNER);
    const ids = view.map((g) => g.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    expect(view.find((g) => g.id === first.id)?.revokedAt).not.toBeNull();
  });

  it("revoke is owner-scoped and idempotent", async () => {
    const grant = await mint();
    // The grantee (or any other tenant) cannot revoke — and cannot tell
    // the grant exists (not_found, not a 403).
    expect(await revokeGrantById(env.DB, GRANTEE, grant.id)).toBe("not_found");
    expect(await revokeGrantById(env.DB, OWNER, grant.id)).toBe("revoked");
    expect(await revokeGrantById(env.DB, OWNER, grant.id)).toBe("already_revoked");
    expect(await revokeGrantById(env.DB, OWNER, "no-such-grant")).toBe("not_found");
  });

  it("getActiveGrant fails closed on revocation (the enforcement read)", async () => {
    const grant = await mint({ ownerDbId: "db-enforce" });
    const active = await getActiveGrant(env.DB, GRANTEE, "db-enforce");
    expect(active?.id).toBe(grant.id);
    expect(active?.scope).toEqual(["mistakes", "lessons"]);

    await revokeGrantById(env.DB, OWNER, grant.id);
    // The `revoked_at IS NULL` filter lives in the query itself, so any
    // status cache built on this read inherits fail-closed behaviour
    // (SK-EKP-008's ≤ 30 s bound is the cache TTL on top of this).
    expect(await getActiveGrant(env.DB, GRANTEE, "db-enforce")).toBeNull();
    // Wrong DB or wrong grantee never resolves.
    expect(await getActiveGrant(env.DB, GRANTEE, "db-other")).toBeNull();
    expect(await getActiveGrant(env.DB, "tenant-stranger", "db-enforce")).toBeNull();
  });
});

describe("/v1/grants — auth gates (session-only)", () => {
  it("POST returns 401 without a session", async () => {
    const res = await SELF.fetch("https://example.com/v1/grants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dbId: "db-1", granteeTenantId: "t2", scope: ["mistakes"] }),
    });
    expect(res.status).toBe(401);
  });

  it("POST rejects anon and sk_live bearers (no mint from a leaked key)", async () => {
    for (const bearer of ["Bearer anon_abcdef0123456789", "Bearer sk_live_doesnotexist"]) {
      const res = await SELF.fetch("https://example.com/v1/grants", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: bearer },
        body: JSON.stringify({ dbId: "db-1", granteeTenantId: "t2", scope: ["mistakes"] }),
      });
      expect(res.status).toBe(401);
    }
  });

  it("GET returns 401 without a session", async () => {
    const res = await SELF.fetch("https://example.com/v1/grants");
    expect(res.status).toBe(401);
  });

  it("DELETE returns 401 without a session", async () => {
    const res = await SELF.fetch("https://example.com/v1/grants/g_1", { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});
