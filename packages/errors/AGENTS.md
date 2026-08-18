# Packages · Errors — Agents Guide

The one registry from internal cause to user-facing copy. Every wire error's HTTP
status, recoverability, params schema, `message` and `action` live here — and
only here.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the behavioral principles, the full path → feature map, and the
> project-wide tech stack. This file narrows that guide to
> `packages/errors/`.

## Features relevant to this area

- [`error-taxonomy`](../../docs/features/error-taxonomy/FEATURE.md) — mandatory pre-read.

## Commands

```bash
bun run --filter @nlqdb/errors test
bun run --filter @nlqdb/errors typecheck
```

## The two rules that matter here

1. **Adding an error is one entry in `src/registry.ts`.** Never add a code to a
   surface's override table without adding it here first — the compile-time
   parity guard in `test/sdk-parity.test.ts` fails the build if the registry and
   `@nlqdb/sdk`'s `ApiErrorCode` union drift apart, in either direction.
2. **`params` is a closed schema, and it is a security boundary.** Bounded enums
   and slug-shaped identifiers only. A raw provider message can carry an API key
   or prompt fragments; a Postgres `DETAIL` line quotes the offending row values.
   Those belong on the OTel span and the `SK-ASK-023` KV diag sink, where
   operators read them and tenants can't. `renderError` drops anything the
   schema doesn't declare — don't widen a field to `z.string()` to make a
   message read better.

Copy follows `GLOBAL-012`: `message` is ONE sentence naming what happened,
`action` is the single next thing the reader can do. The vitest sweep in
`test/registry.test.ts` enforces both across every code × representative params.
