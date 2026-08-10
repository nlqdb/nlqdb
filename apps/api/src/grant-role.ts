// Canonical per-grant Postgres role-name convention (SK-EKP-008, EK-06
// box 2 — the DB-role half). One source so the grant provisioner and the
// cross-tenant exec path can never drift — the same rationale as
// `tenant-role.ts`, applied to the marketplace grant primitive.
//
// A cross-tenant granted `/v1/ask` runs on the **owner's** knowledge DB
// under a **dedicated, non-owner, SELECT-only role** assumed with
// `SET LOCAL ROLE` inside the request transaction (SK-EKP-008:
// role-level identity, immune to the GUC-spoof failure mode; never a
// session `SET ROLE`, which bleeds across pooled connections). The role
// is provisioned **from the grant's scope** — SELECT on exactly the
// scoped tables, nothing else — so it is per-**grant**, not per-tenant or
// per-DB: two grants on the same owner DB may enumerate different scopes,
// and scope is authoritative over role privileges (SK-EKP-008; drift
// between them is a bug that fails closed at validation).
//
// The name is `grant_` + the first 16 hex chars of SHA-256(grantId). The
// `grant_` prefix is distinct from `tenant-role.ts`'s `tenant_`, so a
// grant role can never collide with a per-tenant role — a granted read
// can never accidentally assume an owner's full-tenant role. The result
// matches `^grant_[0-9a-f]{16}$`, safe to interpolate into a quoted SQL
// identifier (`SET LOCAL ROLE` / `CREATE ROLE` cannot be parameterised).

export async function grantRoleName(grantId: string): Promise<string> {
  const data = new TextEncoder().encode(grantId);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return `grant_${hex}`;
}

// Defense-in-depth: the role name is derived from a SHA-256 hex prefix, so
// it is always safe, but the provisioner and exec path double-check the
// shape before interpolating it into `SET LOCAL ROLE "…"` / `CREATE ROLE
// "…"` (mirrors `tenant-role.ts` / SK-HDC-009 identifier-guard posture).
const ROLE_NAME_RE = /^grant_[0-9a-f]{16}$/;

export function assertGrantRoleName(role: string): void {
  if (!ROLE_NAME_RE.test(role)) {
    throw new Error(`unsafe grant role name "${role}"`);
  }
}

// Posture difference from `tenant-role.ts`, made explicit: a **missing**
// grant role FAILS CLOSED — the granted query is rejected, never
// auto-healed. `tenant-role.ts` heals a missing per-tenant role at exec
// time (a tenant always owns its own data), but a grant role encodes a
// cross-tenant *authorization* that only the mint / re-scope path may
// create; synthesising one on a `SET LOCAL ROLE` failure would fabricate
// consent the grantor never gave (SK-EKP-008 fail-closed, SK-PIVOT-009
// posture extended never relaxed). So there is intentionally NO
// `isGrantRoleMissingError` heal here: the exec path treats any failure to
// assume the role as a hard reject.
