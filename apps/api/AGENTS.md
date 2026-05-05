# Apps · Api — Agents Guide

Cloudflare Workers HTTP API. Hosts /v1/ask, /v1/run, auth, billing, webhooks.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → skill map, and
> the project-wide tech stack. This file narrows that guide to
> `apps/api/`.

## Skills relevant to this area

- [`ask-pipeline`](../../docs/features/ask-pipeline/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`hosted-db-create`](../../docs/features/hosted-db-create/SKILL.md) — mandatory pre-read for changes that touch `src/db-create/**`, `src/ask/classifier.ts`, or `src/ask/sql-validate-ddl.ts`. Phase 1.
- [`plan-cache`](../../docs/features/plan-cache/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`sql-allowlist`](../../docs/features/sql-allowlist/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`idempotency`](../../docs/features/idempotency/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`rate-limit`](../../docs/features/rate-limit/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`auth`](../../docs/features/auth/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`anonymous-mode`](../../docs/features/anonymous-mode/SKILL.md) — mandatory pre-read for changes that touch `src/principal.ts`, `src/anon-rate-limit.ts`, `src/anon-global-cap.ts`, `src/turnstile.ts`, or the anon `/v1/ask` path.
- [`api-keys`](../../docs/features/api-keys/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`stripe-billing`](../../docs/features/stripe-billing/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`observability`](../../docs/features/observability/SKILL.md) — mandatory pre-read for changes that touch the feature.

## Commands

```bash
bun run --filter apps/api dev
bun run --filter apps/api build
bun run --filter apps/api test
wrangler deploy --dry-run
```

## Local rules

- Every change here must respect the `GLOBAL-NNN` decisions in
  [`docs/decisions.md`](../../docs/decisions.md).
- A new external call (DB / LLM / HTTP / queue) needs an OTel span
  (`GLOBAL-014`).
- If a request is ambiguous or an error is unfamiliar — web-research
  current best practices first (see root `AGENTS.md` §2 P2).
- A decision change (new or amended) updates every place that copies
  it, in the same PR (root `AGENTS.md` §2 P3).

## When you finish

1. Run the commands above and ensure they all pass.
2. If you added a decision, it has an ID, lives in the right place
   (`docs/decisions.md` or the relevant `SKILL.md`), and any duplicate
   of an affected `GLOBAL-NNN` is updated.
3. Open a PR; the root `AGENTS.md` §8 lists the pre-PR quality gates.
