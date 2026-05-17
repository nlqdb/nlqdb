# Packages · Next — Agents Guide

`@nlqdb/next` — Next.js 15 App Router helpers. Re-exports `<NlqData>` from `@nlqdb/react` and adds `<NlqScript />` (next/script) + `/server` factory for `sk_live_*`-keyed Route Handlers.

> Read root [`AGENTS.md`](../../AGENTS.md) first, then [`docs/features/framework-wrappers/FEATURE.md`](../../docs/features/framework-wrappers/FEATURE.md).

## Features relevant to this area

- [`framework-wrappers`](../../docs/features/framework-wrappers/FEATURE.md) — mandatory pre-read.
- [`sdk`](../../docs/features/sdk/FEATURE.md) — `/server` factory wraps `@nlqdb/sdk`.

## Commands

```bash
bun run --filter @nlqdb/next test
bun run --filter @nlqdb/next typecheck
```

## Local rules

- `/server` is gated by `import "server-only"` — never re-export it from the package root.
- `<NlqScript />` ships with `strategy="afterInteractive"` to avoid blocking first paint.
- All HTTP goes through `@nlqdb/sdk` (`GLOBAL-001`).
