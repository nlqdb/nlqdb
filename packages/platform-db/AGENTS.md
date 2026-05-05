# Packages · Platform DB — Agents Guide

Owner module for Cloudflare D1 (platform DB: auth, billing, rate-limit,
registry, waitlist, idempotency). Per `GLOBAL-021`, all D1 access from
runtime code routes through this package.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → skill map, and
> the project-wide tech stack. This file narrows that guide to
> `packages/platform-db/`.

## Status

Planned — not yet implemented. The package exists today as the
documented owner per `GLOBAL-021`'s owner table. Current direct
`D1Database` consumers in `apps/api/src/` migrate here in follow-up
PRs (tracker: `GLOBAL-021` "Migration backlog").

## Skills relevant to this area

- [`GLOBAL-021`](../../docs/decisions/GLOBAL-021-external-system-ownership.md)
  — the rule that defines this package's responsibility.

## Owner-to-owner dependencies (allowed delegations)

- **Better Auth** (`packages/auth-internal/` future home; today
  `apps/api/src/auth.ts`) reaches into D1 via `kysely-d1`. This is a
  library-level delegation, documented per `GLOBAL-021`'s consequence
  clause.

## Local rules

- This is the only package allowed to import the `D1Database` typed
  binding or the `cloudflare:d1` runtime API at runtime. Test-time
  setup (`apps/api/test/apply-migrations.ts`, `cloudflare:test`
  helpers) is exempt.
- Expose typed, intent-named functions to the rest of the codebase
  (e.g. `getRateLimitCounter(env, key)`, `recordWaitlistSignup(env,
  email)`); never re-export the D1 client itself.
- A new external call (DB / LLM / HTTP / queue) needs an OTel span
  (`GLOBAL-014`).
- If a request is ambiguous or an error is unfamiliar — web-research
  current best practices first (see root `AGENTS.md` §2 P2).

## When you finish

1. If you added a decision, it has an ID, lives in the right place
   (`docs/decisions/GLOBAL-NNN-<slug>.md` for GLOBAL plus an index row
   in `docs/decisions.md`, or the relevant `FEATURE.md` for SK), and
   any affected skill's `## GLOBALs governing this feature` commentary
   is updated.
2. Open a PR; the root `AGENTS.md` §8 lists the pre-PR quality gates.
