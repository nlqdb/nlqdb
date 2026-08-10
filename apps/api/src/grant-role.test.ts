// EK-06 box 2 — per-grant role-name convention tests (SK-EKP-008, the
// DB-role half). Asserts the name is a safe `grant_<16hex>` identifier,
// stable per grant, distinct per grant, and never collides with a
// `tenant-role.ts` per-tenant role — the property that keeps a granted
// read from ever assuming an owner's full-tenant role.

import { describe, expect, it } from "vitest";
import { assertGrantRoleName, grantRoleName } from "./grant-role.ts";
import { tenantRoleName } from "./tenant-role.ts";

describe("grantRoleName — safe, stable, distinct", () => {
  it("derives a `grant_<16hex>` identifier", async () => {
    const role = await grantRoleName("11111111-2222-3333-4444-555555555555");
    expect(role).toMatch(/^grant_[0-9a-f]{16}$/);
  });

  it("is deterministic for the same grant id (provisioner ↔ exec cannot drift)", async () => {
    const a = await grantRoleName("grant-abc");
    const b = await grantRoleName("grant-abc");
    expect(a).toBe(b);
  });

  it("is distinct for different grant ids", async () => {
    const a = await grantRoleName("grant-abc");
    const b = await grantRoleName("grant-xyz");
    expect(a).not.toBe(b);
  });

  it("never collides with a per-tenant role (distinct `grant_` vs `tenant_` prefix)", async () => {
    // Even given the SAME input string, the two conventions produce
    // different names — a granted read can never assume the owner's role.
    const id = "shared-id";
    expect(await grantRoleName(id)).not.toBe(await tenantRoleName(id));
    expect(await grantRoleName(id)).toMatch(/^grant_/);
    expect(await tenantRoleName(id)).toMatch(/^tenant_/);
  });
});

describe("assertGrantRoleName — identifier guard", () => {
  it("accepts a well-formed grant role name", async () => {
    expect(() => assertGrantRoleName("grant_0123456789abcdef")).not.toThrow();
  });

  it("rejects a tenant role, wrong length, or injection-shaped input", () => {
    for (const bad of [
      "tenant_0123456789abcdef", // wrong prefix — never assume a tenant role
      "grant_0123456789ABCDEF", // uppercase hex outside the derivation
      "grant_short",
      "grant_0123456789abcdef0", // too long
      'grant_0123456789abcdef"; DROP ROLE x; --',
      "",
    ]) {
      expect(() => assertGrantRoleName(bad)).toThrow(/unsafe grant role name/);
    }
  });

  it("passes the derived name through the guard (defense-in-depth round-trip)", async () => {
    const role = await grantRoleName(crypto.randomUUID());
    expect(() => assertGrantRoleName(role)).not.toThrow();
  });
});
