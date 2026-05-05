# @nlqdb/platform-db

Owner module for **Cloudflare D1** — the platform database that holds
auth, billing, rate-limit, registry, waitlist, and idempotency tables.
Per `GLOBAL-021` (each external system has one canonical owning module),
all D1 access from runtime code routes through this package.

Distinct from `@nlqdb/db`: that package owns the **user-data** engine
(Postgres via Neon, plus Phase-3 engines). This package owns the
**platform-data** engine (Cloudflare D1).

Phase 0 / Slice 1. Planned — not yet implemented. Current direct-D1
callers in `apps/api/src/` (`db-registry.ts`, `waitlist.ts`,
`ask/rate-limit.ts`, `anon-adopt.ts`, `db-create/neon-provision.ts`,
`principal.ts`, `anon-rate-limit.ts`, `anon-global-cap.ts`) migrate
into this package in follow-up PRs. See
[`docs/decisions/GLOBAL-021-external-system-ownership.md`](../../docs/decisions/GLOBAL-021-external-system-ownership.md)
"Migration backlog" for the tracker.

The Better Auth library's `kysely-d1` reach into D1 from
`apps/api/src/auth.ts` is a documented owner-to-owner library
dependency, not a violation of `GLOBAL-021`.

Internal-only — never published to npm, never imported from browser
code.
