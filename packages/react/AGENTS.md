# Packages · React — Agents Guide

`@nlqdb/react` — typed React 19 wrapper for `<nlq-data>`. Re-exports from `@nlqdb/elements`; no HTTP of its own (per GLOBAL-001).

> Local guide. Read root [`AGENTS.md`](../../AGENTS.md) first, then
> [`docs/features/framework-wrappers/FEATURE.md`](../../docs/features/framework-wrappers/FEATURE.md).

## Features relevant to this area

- [`framework-wrappers`](../../docs/features/framework-wrappers/FEATURE.md) — mandatory pre-read.
- [`elements`](../../docs/features/elements/FEATURE.md) — the underlying custom element this wraps.

## Commands

```bash
bun run --filter @nlqdb/react test
bun run --filter @nlqdb/react typecheck
```

## Local rules

- No `fetch('/v1/...')` — GLOBAL-001. Server-side calls go through `@nlqdb/sdk`.
- `onLoad` / `onError` are wired imperatively in a `useEffect` — React 19 does not auto-bind custom-event `on*` props.
- Attribute names sent to the underlying element are kebab-case (`api-key` not `apiKey`).
- Bundle target: ≤2 KB gzipped over `@nlqdb/sdk` + `@nlqdb/elements`.
