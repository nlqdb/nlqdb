# SK-GTM-002 — Admin gate: exact founder allowlist + `@nlqdb.com` domain, server-side only

- **Decision:** `isAdminEmail(email)` in `apps/api/src/admin/gate.ts` is
  the only authorization predicate for admin surfaces: case-insensitive
  match against the exact allowlist (`omer@salfati.group`) or the
  `nlqdb.com` domain. `GET /v1/admin/metrics` runs it after
  `requireSession` (cookie session only — an `sk_live_`/`pk_live_`/anon
  bearer never reaches admin data) and returns `403 {error: "forbidden"}`
  for a signed-in non-admin. The static `/app/admin/` page repeats the
  check client-side for UX only (redirect, `apps/web/src/lib/admin-gate.ts`)
  — a presentation-copy of the API predicate, never a security boundary.
- **Core value:** Seamless auth, Bullet-proof, Simple
- **Why:** `apps/web` ships as static assets with no server middleware
  (`SK-WEB-001`), so the page can't enforce anything — the data boundary
  is the API. Sign-in is OAuth/magic-link only (`SK-AUTH-002`), so a
  session email is a verified identity; `@nlqdb.com` matching admits
  teammates with zero code change, the allowlist covers the founder's
  domain.
- **Consequence in code:** Future admin endpoints reuse `requireSession` +
  `isAdminEmail` — reviewers reject a second predicate or a
  `requirePrincipal`-based admin route. The gate returns 403 (not 404):
  the route is documented in-repo, hiding it buys nothing. Allowlist
  changes are code-reviewed constants, not env vars.
- **Alternatives rejected:**
  - A `role` column on `user` — schema + backfill for two constants;
    revisit only if non-email-domain admins appear.
  - 404 for non-admins — obscurity with a debugging cost; the gate is the
    security, not the status code.
  - Client-side gate only — the page is a static asset; anyone reads the
    JS.
