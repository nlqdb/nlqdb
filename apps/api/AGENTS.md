# Apps · Api — Agents Guide

Cloudflare Workers HTTP API. Hosts /v1/ask, /v1/run, auth, billing, webhooks.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → skill map, and
> the project-wide tech stack. This file narrows that guide to
> `apps/api/`.

## Skills relevant to this area

- [`ask-pipeline`](../../.claude/skills/ask-pipeline/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`hosted-db-create`](../../.claude/skills/hosted-db-create/SKILL.md) — mandatory pre-read for changes that touch `src/db-create/**`, `src/ask/classifier.ts`, or `src/ask/sql-validate-ddl.ts`. Phase 1.
- [`plan-cache`](../../.claude/skills/plan-cache/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`sql-allowlist`](../../.claude/skills/sql-allowlist/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`idempotency`](../../.claude/skills/idempotency/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`rate-limit`](../../.claude/skills/rate-limit/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`auth`](../../.claude/skills/auth/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`api-keys`](../../.claude/skills/api-keys/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`stripe-billing`](../../.claude/skills/stripe-billing/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`observability`](../../.claude/skills/observability/SKILL.md) — mandatory pre-read for changes that touch the feature.

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
