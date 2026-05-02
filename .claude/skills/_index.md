# Skill Index

Every feature has a folder under `.claude/skills/<feature>/SKILL.md`. The
`SKILL.md` is **mandatory pre-reading** before editing any code that
touches the feature (see the before-editing path map in the root
[`AGENTS.md`](../../AGENTS.md) §5).

How a skill is structured: [`docs/skill-conventions.md`](../../docs/skill-conventions.md).
Cross-cutting decisions cited by skills: [`docs/decisions.md`](../../docs/decisions.md).

## Implemented

| Skill | One-liner | Touchpoints |
|---|---|---|
| [`auth`](./auth/SKILL.md) | Better Auth identity, device-flow, refresh, magic-link, GitHub/Google. | `apps/api/src/routes/auth/**`, `packages/auth-internal/**` |
| [`api-keys`](./api-keys/SKILL.md) | Long-lived keys for CI / MCP hosts; revocation. | `apps/api/src/keys/**` |
| [`ask-pipeline`](./ask-pipeline/SKILL.md) | `/v1/ask` orchestration: rate-limit → cache → router → allowlist → exec → summary. | `apps/api/src/ask/**` |
| [`plan-cache`](./plan-cache/SKILL.md) | Content-addressed plan storage by `(schema_hash, query_hash)`. | `apps/api/src/plan-cache/**` |
| [`llm-router`](./llm-router/SKILL.md) | Model selection, fallback, prompt strategy, credit accounting. | `packages/llm/**` |
| [`sql-allowlist`](./sql-allowlist/SKILL.md) | Safety boundary on generated SQL. | `apps/api/src/ask/sql-validate.ts` |
| [`db-adapter`](./db-adapter/SKILL.md) | Engine-agnostic DB interface (Phase 0 = Postgres via Neon). | `packages/db/**` |
| [`observability`](./observability/SKILL.md) | OTel span / metric / label catalog; on every external call. | `packages/otel/**` |
| [`stripe-billing`](./stripe-billing/SKILL.md) | Webhook ingest, subscription state, idempotent ingest, R2 archive. | `apps/api/src/billing/**` |
| [`events-pipeline`](./events-pipeline/SKILL.md) | EVENTS_QUEUE producer + consumer (events-worker → sinks). | `apps/events-worker/**`, `packages/events/**` |
| [`elements`](./elements/SKILL.md) | `<nlq-data>` web component; framework-free embedding. | `packages/elements/**` |
| [`sdk`](./sdk/SKILL.md) | `@nlqdb/sdk` — the only HTTP client (cookie vs bearer). | `packages/sdk/**` |
| [`mcp-server`](./mcp-server/SKILL.md) | MCP server, `nlq mcp install` host detection. | `packages/mcp/**` |

## Partial

| Skill | One-liner | What's done · what's open |
|---|---|---|
| [`web-app`](./web-app/SKILL.md) | Marketing site + product web app. | Marketing site live · sign-in UI, chat surface, anon-mode web flow remaining (Phase 1 exit gate) |
| [`schema-widening`](./schema-widening/SKILL.md) | "Schemas only widen" invariant; `schema_hash` semantics. | `schema_hash` plumbed end-to-end · observed-fields collector + widening trigger ship post-Phase-0 |
| [`idempotency`](./idempotency/SKILL.md) | `Idempotency-Key` on every mutation; dedupe store; retry-safety. | natural-key dedupe shipped (Stripe webhook, waitlist) · general-purpose `Idempotency-Key` middleware on `/v1/ask` open |
| [`rate-limit`](./rate-limit/SKILL.md) | Per-key, per-IP rate-limit middleware. | per-account D1 limiter (`/v1/ask`) + per-IP KV limiter (`/v1/demo/ask`) shipped · unified middleware open |
| [`anonymous-mode`](./anonymous-mode/SKILL.md) | No-login first value across web / CLI / MCP. | API shipped (`/v1/anon/adopt`) · web UI remaining (Phase 1 exit gate) |

## Planned

| Skill | One-liner | Phase |
|---|---|---|
| [`hosted-db-create`](./hosted-db-create/SKILL.md) | Hosted db.create — typed-plan SchemaPlan, deterministic DDL compiler, Zod + libpg_query validation, provisioner, semantic layer at create-time. | Phase 1 — design locked in `docs/design.md` §3.6; sub-modules listed in `docs/implementation.md` §4 |
| [`cli`](./cli/SKILL.md) | `nlq` verb surface, OS-keychain credential storage. | Phase 2 — design locked in `docs/design.md` §3.3 / §4.3 / §14.3; no code yet |
| [`engine-migration`](./engine-migration/SKILL.md) | Auto-migrate Postgres ↔ Mongo / Redis / etc. | Phase 3 |
| [`multi-engine-adapter`](./multi-engine-adapter/SKILL.md) | Adapters beyond Postgres. | Phase 3 |

## Adding a new skill

1. Create `.claude/skills/<feature>/SKILL.md` with the template from
   [`docs/skill-conventions.md`](../../docs/skill-conventions.md) §3.
2. Add the row to the right table here.
3. Add the path glob → skill mapping to root [`AGENTS.md`](../../AGENTS.md) §5
   and the relevant per-area `AGENTS.md`.
4. Reserve the SK-ID prefix (e.g. `SK-NEW-FEATURE-NNN`); pick a
   monotonic numbering and never re-use IDs.

A planned skill scaffolds with frontmatter + status + scope + a
`Decisions: TBD when implemented` placeholder. The PR that introduces
the feature also lands the first decision blocks.
