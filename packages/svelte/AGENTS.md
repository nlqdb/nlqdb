# Packages · Svelte — Agents Guide

`@nlqdb/svelte` — Svelte 5 `<NlqData>` component (runes).

> Read root [`AGENTS.md`](../../AGENTS.md), then [`docs/features/framework-wrappers/FEATURE.md`](../../docs/features/framework-wrappers/FEATURE.md).

## Commands

```bash
bun run --filter @nlqdb/svelte typecheck
```

Runtime is exercised by [`examples/sveltekit/e2e/`](../../examples/sveltekit/e2e/) ([`e2e-coverage`](../../docs/features/e2e-coverage/FEATURE.md)).

## Local rules

- The `.svelte` file is the only public component; `index.ts` re-exports.
- Use `onMount` for `addEventListener` so the listener is torn down on unmount.
- No HTTP — delegate to `<nlq-data>` (GLOBAL-001).
