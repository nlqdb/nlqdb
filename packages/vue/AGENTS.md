# Packages · Vue — Agents Guide

`@nlqdb/vue` — Vue 3.5 `<NlqData>` component + `configureNlqdb(app)` plugin.

> Read root [`AGENTS.md`](../../AGENTS.md) first, then [`docs/features/framework-wrappers/FEATURE.md`](../../docs/features/framework-wrappers/FEATURE.md).

## Commands

```bash
bun run --filter @nlqdb/vue test
bun run --filter @nlqdb/vue typecheck
```

## Local rules

- `configureNlqdb(app)` is the only place that touches `app.config.compilerOptions.isCustomElement` — keep it idempotent.
- The component delegates everything to `<nlq-data>`; do not add any networking here (GLOBAL-001).
