# GLOBAL-021 — Each external system has one canonical owning module

- **Decision:** Every external system the codebase talks to (Cloudflare
  D1 / R2 / KV / Queues, Neon Postgres, Stripe, Better Auth, LLM
  providers, Turnstile, OTel exporter, …) has exactly one canonical
  owning module. All access goes through that owner; no other file
  imports the system's SDK or its typed bindings. The owner exposes
  typed, intent-named functions to the rest of the codebase — never a
  pass-through of the underlying client. An owner module **may**
  depend on another owner module's client when the dependency is
  library-level rather than ad-hoc reach-past (e.g. Better Auth's
  `kysely-d1` reaching into D1 from `packages/auth-internal/`); such
  delegations are documented in the owner's `AGENTS.md`.
- **Core value:** Simple, Bullet-proof
- **Why:** Without an owner, knowledge of how to talk to D1 / Neon /
  Stripe spreads across files, and any change (auth-header tweak,
  retry policy, new OTel attribute, version bump) becomes a multi-file
  grep. One owner means one place to instrument (`GLOBAL-014`), one
  place to cap the bundle (`GLOBAL-013`), one place to fix a
  regression. It is the same shape as `GLOBAL-001` (SDK is the only
  HTTP client) generalised to every external dependency.
- **Consequence in code:** New external systems land with their owner
  module created in the same PR. Lint/CI rejects imports of an owned
  dependency from outside its owner — implemented as ESLint
  `no-restricted-imports` per package, plus a CI grep for typed
  bindings (e.g. `D1Database`) outside their owner. Tests stub at the
  owner's seam, not at the underlying client. Adding a new method on
  the owner is preferred to "just this once" reaching past it.
  Test-time platform setup (`apps/api/test/apply-migrations.ts`,
  `cloudflare:test` helpers) is exempt — the rule applies to runtime
  code only.
- **Alternatives rejected:**
  - One mega-`packages/db` covering both user engines (Neon) and the
    platform DB (D1) — collapses the engine-agnostic seam in
    `SK-DB-001` and forces D1's typed table operations through
    `execute(sql, params)` or a parallel API inside the same package.
  - Per-feature ownership (each skill owns its own D1 access) —
    exactly the drift `GLOBAL-001` was written to prevent; ends up
    with five different retry / OTel / connection-handling patterns
    for the same backend.
  - Lint-only enforcement without a documented rule — exceptions
    accumulate without review; the rule needs a citable home so
    PR reviewers can ground the conversation.

## Owner table

The canonical owner per external system. New external systems add a row
here in the same PR that introduces them.

| External system | Canonical owner | Notes |
|---|---|---|
| Neon Postgres (user data) | `packages/db/` via `DatabaseAdapter` | Documented exception: `apps/api/src/db-create/build-deps.ts` imports `@neondatabase/serverless` directly for the control-plane provisioner (CREATE SCHEMA / role / RLS); see `SK-HDC-*`. |
| Cloudflare D1 (platform DB) | `packages/platform-db/` | Holds auth, billing, rate-limit, registry, waitlist, idempotency tables. **Migration in progress** — current direct-D1 callers (`apps/api/src/db-registry.ts`, `waitlist.ts`, `ask/rate-limit.ts`, `anon-adopt.ts`, `db-create/neon-provision.ts`, `principal.ts`, `anon-rate-limit.ts`, `anon-global-cap.ts`) move to `@nlqdb/platform-db` in follow-up PRs. |
| Better Auth | `apps/api/src/auth.ts` (today); planned consolidation in `packages/auth-internal/` | The auth skill (`docs/features/auth/FEATURE.md`) tracks the consolidation. Better Auth's `kysely-d1` reach into D1 is a documented owner-to-owner library dependency, not a violation. |
| LLM providers | `packages/llm/` | All `@anthropic-ai/sdk`, `openai`, `@google/genai` imports live here. |
| OpenTelemetry exporter / SDK | `packages/otel/` | All `@opentelemetry/*` imports for instrumentation wrappers live here; consumers import from `@nlqdb/otel`. |
| Stripe | `apps/api/src/billing/` | Stripe SDK + webhook handling; R2 archive of webhook payloads is owned here today (re-home if R2 grows a second use case). |
| Cloudflare Queues | `apps/events-worker/` (consumer) + `packages/events/` (producer types) | Producer types imported by API; consumer code lives entirely in events-worker. |
| Cloudflare R2 | `apps/api/src/billing/` | Single-use today (Stripe payload archive). Pick a dedicated owner before second use case. |
| Cloudflare KV | TBD | Confirm whether used in runtime; add row when first use lands. |
| Turnstile | `apps/api/src/turnstile.ts` (server) + `apps/web/src/lib/turnstile.ts` (client) | Cross-process: each surface has one owner module for its half. |
| Workers Secret Store | TBD | Add row when the first programmatic Secret Store API call lands. |

## Migration backlog (this GLOBAL is being adopted incrementally)

The rule lands today; the codebase is not yet fully compliant. Tracked work:

1. **D1 ownership consolidation** — move all direct `D1Database`
   usages in `apps/api/src/` into `@nlqdb/platform-db`. Tracked as
   open work under `docs/features/db-adapter/FEATURE.md` and the
   forthcoming `platform-db` skill (or equivalent §10.1 promotion).
2. **Better Auth consolidation** — move Better Auth setup from
   `apps/api/src/auth.ts` into `packages/auth-internal/` once the
   package gets a `package.json`. Tracked under
   `docs/features/auth/FEATURE.md` open questions.
3. **R2 owner separation** — when a second R2 use case is proposed,
   carve a dedicated owner module before adoption.
4. **CI enforcement** — wire ESLint `no-restricted-imports` per
   package and the `D1Database` grep check. Until enforced, reviewers
   are the gate.

Until each item lands, the owner table records the **target** and the
**current state** in the same row. Reviewers should not allow new
violations even where the existing code is not yet migrated.
