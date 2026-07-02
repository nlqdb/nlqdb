// Canonical per-tenant Postgres role-name convention (one source so the
// provisioner and the exec path can never drift).
//
// Hosted queries run under least privilege via `SET LOCAL ROLE
// tenant_<hash>` (see `docs/features/db-adapter/FEATURE.md` role/RLS
// wiring). The role name is `tenant_` + the first 16 hex chars of
// SHA-256(tenantId) — the same shape `neon-provision.ts` provisions.
// The result matches `^tenant_[0-9a-f]{16}$`, so callers may safely
// interpolate it into a quoted SQL identifier (`SET LOCAL ROLE` cannot
// be parameterised).

export async function tenantRoleName(tenantId: string): Promise<string> {
  const data = new TextEncoder().encode(tenantId);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return `tenant_${hex}`;
}

// Defense-in-depth: the role name is derived from a SHA-256 hex prefix,
// so it is always safe, but the exec path double-checks the shape before
// interpolating it into `SET LOCAL ROLE "…"` (mirrors SK-HDC-009's
// identifier-guard posture).
const ROLE_NAME_RE = /^tenant_[0-9a-f]{16}$/;

export function assertTenantRoleName(role: string): void {
  if (!ROLE_NAME_RE.test(role)) {
    throw new Error(`unsafe tenant role name "${role}"`);
  }
}
