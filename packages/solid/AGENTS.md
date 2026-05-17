# Packages · Solid — Agents Guide

`@nlqdb/solid` — SolidJS `<NlqData>` component.

> Read root [`AGENTS.md`](../../AGENTS.md), then [`docs/features/framework-wrappers/FEATURE.md`](../../docs/features/framework-wrappers/FEATURE.md).

## Commands

```bash
bun run --filter @nlqdb/solid typecheck
```

## Local rules

- Use Solid's `attr:` namespace — `<nlq-data>` observes attributes, not DOM properties.
- Custom events go through `on:` (Solid binds any DOM event by name).
- No HTTP — delegate to `<nlq-data>` (GLOBAL-001).
