# Packages · DB — Agents Guide

Engine-agnostic DB adapter. Phase 0 = Postgres via Neon.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → skill map, and
> the project-wide tech stack. This file narrows that guide to
> `packages/db/`.

## Skills relevant to this area

- [`db-adapter`](../../.claude/skills/db-adapter/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`schema-widening`](../../.claude/skills/schema-widening/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`observability`](../../.claude/skills/observability/SKILL.md) — mandatory pre-read for changes that touch the feature.

## Commands

```bash
bun --filter @nlqdb/db run build
bun --filter @nlqdb/db run test
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
