# Skill Index

Every feature has a folder under `docs/features/<feature>/FEATURE.md`. The
`FEATURE.md` is **mandatory pre-reading** before editing any code that
touches the feature (see the before-editing path map in the root
[`AGENTS.md`](../../AGENTS.md) §5).

How a skill is structured: [`docs/skill-conventions.md`](../skill-conventions.md).
Cross-cutting decisions cited by skills: [`docs/decisions.md`](../decisions.md).

## Implemented

| Skill | One-liner | Touchpoints |
|---|---|---|
| [`auth`](./auth/FEATURE.md) | Better Auth identity, device-flow, refresh, magic-link, GitHub/Google. | `apps/api/src/routes/auth/**`, `packages/auth-internal/**` |
| [`api-keys`](./api-keys/FEATURE.md) | Long-lived keys for CI / MCP hosts; revocation. | `apps/api/src/keys/**` |
| [`ask-pipeline`](./ask-pipeline/FEATURE.md) | `/v1/ask` orchestration: rate-limit → cache → router → allowlist → exec → summary. | `apps/api/src/ask/**` |
| [`plan-cache`](./plan-cache/FEATURE.md) | Content-addressed plan storage by `(schema_hash, query_hash)`. | `apps/api/src/plan-cache/**` |
| [`llm-router`](./llm-router/FEATURE.md) | Model selection, fallback, prompt strategy, credit accounting. | `packages/llm/**` |
| [`sql-allowlist`](./sql-allowlist/FEATURE.md) | Safety boundary on generated SQL. | `apps/api/src/ask/sql-validate.ts` |
| [`db-adapter`](./db-adapter/FEATURE.md) | Engine-agnostic DB interface (Phase 0 = Postgres via Neon). | `packages/db/**` |
| [`observability`](./observability/FEATURE.md) | OTel span / metric / label catalog; on every external call. | `packages/otel/**` |
| [`stripe-billing`](./stripe-billing/FEATURE.md) | Webhook ingest, subscription state, idempotent ingest, R2 archive. | `apps/api/src/billing/**` |
| [`events-pipeline`](./events-pipeline/FEATURE.md) | EVENTS_QUEUE producer + consumer (events-worker → sinks). | `apps/events-worker/**`, `packages/events/**` |
| [`elements`](./elements/FEATURE.md) | `<nlq-data>` web component; framework-free embedding. | `packages/elements/**` |
| [`sdk`](./sdk/FEATURE.md) | `@nlqdb/sdk` — the only HTTP client (cookie vs bearer). | `packages/sdk/**` |
| [`mcp-server`](./mcp-server/FEATURE.md) | MCP server, `nlq mcp install` host detection. | `packages/mcp/**` |
| [`ci-permissions`](./ci-permissions/FEATURE.md) | Least-privilege GitHub Actions `permissions:` blocks; default-deny; OIDC for publish. | `.github/workflows/**`, `nlqdb/actions/**` |

## Partial

| Skill | One-liner | What's done · what's open |
|---|---|---|
| [`web-app`](./web-app/FEATURE.md) | Marketing site + product web app. | Marketing site live · real-LLM hero (`/`) + permalink alias (`/app/new`) shipped (SK-WEB-008) · sign-in UI replays `nlqdb_pending` (Phase 1 exit gate) · chat surface remains |
| [`schema-widening`](./schema-widening/FEATURE.md) | "Schemas only widen" invariant; `schema_hash` semantics. | `schema_hash` plumbed end-to-end · observed-fields collector + widening trigger ship post-Phase-0 |
| [`idempotency`](./idempotency/FEATURE.md) | `Idempotency-Key` on every mutation; dedupe store; retry-safety. | natural-key dedupe shipped (Stripe webhook, waitlist) · general-purpose `Idempotency-Key` middleware on `/v1/ask` open |
| [`rate-limit`](./rate-limit/FEATURE.md) | Per-key, per-IP rate-limit middleware. | per-account D1 limiter, per-IP anon-tier KV limiter (`anon-rate-limit.ts`), and global anon KV cap (`anon-global-cap.ts`) all shipped with `X-RateLimit-*` parity · legacy `/v1/demo/ask` per-IP limiter retired with the route under SK-WEB-008 · per-account anon-create cap pending adoption |
| [`anonymous-mode`](./anonymous-mode/FEATURE.md) | No-login first value across web / CLI / MCP. | Anon `/v1/ask` create flow + `/v1/anon/adopt` shipped · adopt-time tenant_id rewrite + RLS-policy refresh on sign-in remain (Phase 1 exit gate) |
| [`onboarding`](./onboarding/FEATURE.md) | First-60-seconds experience — zero-friction signup, goal-first on-ramp, anti-patterns we refuse. | Anti-patterns locked (SK-ONBOARD-001..004) · web implementation remaining (Phase 1 exit gate) |

## Planned

| Skill | One-liner | Phase |
|---|---|---|
| [`hosted-db-create`](./hosted-db-create/FEATURE.md) | Hosted db.create — typed-plan SchemaPlan, deterministic DDL compiler, Zod + libpg_query validation, provisioner, semantic layer at create-time. | Phase 1 — design locked in `docs/architecture.md` §3.6; sub-modules listed in `docs/architecture.md §10` §4 |
| [`cli`](./cli/FEATURE.md) | `nlq` verb surface, OS-keychain credential storage. | Phase 2 — design locked in `docs/architecture.md` §3.3 / §4.3 / §14.3; no code yet |
| [`premium-tier`](./premium-tier/FEATURE.md) | Premium-models add-on — opt-in frontier-model routing, pay-per-token, surface-parity model picker, BYOK decision tree. | Phase 2 pricing-row design-locked in `docs/architecture.md` §6; Phase 3 ships alongside Pro tier |
| [`engine-migration`](./engine-migration/FEATURE.md) | Auto-migrate Postgres ↔ Mongo / Redis / etc. | Phase 3 |
| [`multi-engine-adapter`](./multi-engine-adapter/FEATURE.md) | Adapters beyond Postgres. | Phase 3 |

## Adding a new skill

1. Create `docs/features/<feature>/FEATURE.md` with the template from
   [`docs/skill-conventions.md`](../../docs/skill-conventions.md) §3.
2. Add the row to the right table here.
3. Add the path glob → skill mapping to root [`AGENTS.md`](../../AGENTS.md) §5
   and the relevant per-area `AGENTS.md`.
4. Reserve the SK-ID prefix (e.g. `SK-NEW-FEATURE-NNN`); pick a
   monotonic numbering and never re-use IDs.

A planned skill scaffolds with frontmatter + status + scope + a
`Decisions: TBD when implemented` placeholder. The PR that introduces
the feature also lands the first decision blocks.
