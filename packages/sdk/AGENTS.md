# Packages · SDK — Agents Guide

@nlqdb/sdk — the only HTTP client per GLOBAL-001. Browser-cookie vs server-bearer.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → feature map, and
> the project-wide tech stack. This file narrows that guide to
> `packages/sdk/`.

## Features relevant to this area

- [`sdk`](../../docs/features/sdk/FEATURE.md) — mandatory pre-read for changes that touch the feature.
- [`observability`](../../docs/features/observability/FEATURE.md) — mandatory pre-read for changes that touch the feature.
- [`idempotency`](../../docs/features/idempotency/FEATURE.md) — mandatory pre-read for changes that touch the feature.

## Commands

```bash
bun run --filter @nlqdb/sdk build
bun run --filter @nlqdb/sdk test
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

## E2E coverage

SDK persona contract tests live at [`tests/e2e/sdk/`](../../tests/e2e/sdk/) — vitest + checked-in cassettes replayed through the SDK's `FetchLike` shim. No network. Persona mapping: [P1](../../tests/personas/P1-solo-builder/README.md), [P4](../../tests/personas/P4-backend-engineer/README.md), [P6](../../tests/personas/P6-analytics-engineer/README.md).

After an SDK change that could shift wire shape, retry behaviour, header semantics, or error mapping:

```bash
gh workflow run e2e.yml -f surface=sdk
gh workflow run e2e.yml -f surface=all
```

Local run (hermetic):

```bash
cd tests/e2e/sdk && bun install && bun run test
```

Cassette re-record (live, against staging):

```bash
RECORD=1 NLQDB_API_URL=https://<staging> NLQDB_API_KEY=sk_live_… bun run test
```

A new persona test lands as `tests/e2e/sdk/pN_<persona>.test.ts` + the matching JSON cassette under `cassettes/`. Add the row to the persona README.

Future Ruby + Rust SDKs ship pre-shipped skeletons under [`packages/nlqdb-rb/spec/e2e/`](../nlqdb-rb/spec/e2e/) and [`packages/nlqdb-rs/tests/e2e/`](../nlqdb-rs/tests/e2e/) (SK-E2E-006); not wired to CI today.

See [`docs/features/e2e-coverage/FEATURE.md`](../../docs/features/e2e-coverage/FEATURE.md).

## When you finish

1. Run the commands above and ensure they all pass.
2. If you added a decision, it has an ID, lives in the right place
   (`docs/decisions.md` or the relevant `FEATURE.md`), and any duplicate
   of an affected `GLOBAL-NNN` is updated.
3. Open a PR; the root `AGENTS.md` §8 lists the pre-PR quality gates.
