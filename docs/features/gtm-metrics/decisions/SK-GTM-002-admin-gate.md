# SK-GTM-002 — Admin gate: exact founder allowlist + `@nlqdb.com` domain, server-side only

- **Decision:** `isAdminEmail(email)` in `apps/api/src/admin/gate.ts` is
  the only authorization predicate for admin surfaces: case-insensitive
  match against the exact allowlist (the founder's real sign-in account
  `omer@salfati.group`, plus `omer@nlqdb.com`) or the `nlqdb.com` domain.
  `GET /v1/admin/metrics` runs it after `requireSession` (cookie session
  only — an `sk_live_`/`pk_live_`/anon bearer never reaches admin data)
  and returns `403 {error: "forbidden"}` for a signed-in non-admin. The
  static `/app/admin/` page **does not repeat the check**: its script
  guards sign-in only, and the island renders the 403 as a named state
  ("Signed in as X — this account isn't on the nlqdb admin list") with a
  sign-out link (`GLOBAL-012`).
- **Core value:** Seamless auth, Bullet-proof, Simple
- **Why:** `apps/web` ships as static assets with no server middleware
  (`SK-WEB-001`), so the page can't enforce anything — the data boundary
  is the API. Sign-in is OAuth/magic-link only (`SK-AUTH-002`), so a
  session email is a verified identity; `@nlqdb.com` matching admits
  teammates with zero code change, and the exact list must name the
  address the founder actually signs in with — a duplicated web-side copy
  drifted from it and silently bounced the founder off his own dashboard
  (2026-08-12), which is why the copy is gone rather than re-synced.
- **Consequence in code:** Future admin endpoints reuse `requireSession` +
  `isAdminEmail` — reviewers reject a second predicate (client-side
  included) or a `requirePrincipal`-based admin route. The gate returns
  403 (not 404): the route is documented in-repo, hiding it buys nothing.
  Allowlist changes are code-reviewed constants, not env vars.
- **Alternatives rejected:**
  - A `role` column on `user` — schema + backfill for two constants;
    revisit only if non-email-domain admins appear.
  - 404 for non-admins — obscurity with a debugging cost; the gate is the
    security, not the status code.
  - A presentation-only client copy of the predicate (the shipped v1) —
    two lists to keep in sync, and its redirect hid the honest 403 the
    island already renders.
