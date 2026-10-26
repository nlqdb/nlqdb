# SK-GTM-012 — Admin gate and internal population name only nlqdb-owned identities; the founder is `omer@nlqdb.com`

- **Decision:** The founder's one account in nlqdb is `omer@nlqdb.com`
  (owner decision, 2026-10-26). `isAdminEmail(email)` in
  `apps/api/src/admin/gate.ts` stays the only authorization predicate for
  admin surfaces: case-insensitive match against the exact allowlist
  (`omer@nlqdb.com`) or the `nlqdb.com` domain. `GET /v1/admin/metrics`
  runs it after `requireSession` (cookie session only: an
  `sk_live_`/`pk_live_`/anon bearer never reaches admin data) and returns
  `403 {error: "forbidden"}` for a signed-in non-admin. The static
  `/app/admin/` page **does not repeat the check**: its script guards
  sign-in only, and the island renders the 403 as a named state ("Signed
  in as X — this account isn't on the nlqdb admin list") with a sign-out
  link (`GLOBAL-012`). The internal-account population (`SK-GTM-001`'s
  `INTERNAL_EMAIL_SQL`, mirrored by `scripts/mcp-hosts.sh`) is the
  company domain plus the test domains (`*@nlqdb.com`, `*@example.com`,
  `*@preview.dev`). No personal address of the founder appears anywhere in
  the tree; `apps/web/src/data/founder-identity-integrity.test.ts` fails
  the build if one reappears.
- **Core value:** Seamless auth, Bullet-proof, Simple
- **Why:** The repo is public, and the previous allowlist and exclusion
  lists published the founder's personal and work addresses. The founder
  signing in as an nlqdb-owned address removes the need to name any
  personal one: the domain grant admits him, the domain pattern counts him
  as internal, and mail to `omer@nlqdb.com` reaches him through the
  catch-all `apps/email-router` forward (`FORWARD_TO` secret). `apps/web`
  ships as static assets with no server middleware (`SK-WEB-001`), so the
  data boundary is the API; sign-in is OAuth/magic-link only
  (`SK-AUTH-002`), so a session email is a verified identity. A duplicated
  web-side copy of the predicate once drifted and bounced the founder off
  his own dashboard (2026-08-12), which is why there is one predicate.
- **Consequence in code:** Future admin endpoints reuse `requireSession` +
  `isAdminEmail`; reviewers reject a second predicate (client-side
  included) or a `requirePrincipal`-based admin route. The gate returns
  403 (not 404). Allowlist changes are code-reviewed constants, not env
  vars, and may only name nlqdb-owned addresses. Accounts created under
  the founder's former personal addresses are no longer admin and count
  as strangers in `computeGtmMetrics` until they are re-pointed or
  removed in D1 (an owner data step; the addresses are never committed).
- **Alternatives rejected:**
  - Keep personal addresses as reviewed constants (the replaced
    `SK-GTM-002` stance) — publishes personal identities in a public repo.
  - Move the personal list to a Worker secret / env var — two sources of
    truth for one predicate, a secret-mirroring errand, and the list still
    has to be mirrored into the scorecard/script exclusions.
  - A `role` column on `user` — schema + backfill for one founder;
    revisit only if non-email-domain admins appear.
  - 404 for non-admins — obscurity with a debugging cost.
- **Replaces:** `SK-GTM-002` in full (its live substance is folded in
  above), and the internal-pattern enumeration in `SK-GTM-001`.
