# Packages · SvelteKit — Agents Guide

`@nlqdb/sveltekit` — SvelteKit helpers around `@nlqdb/svelte` + `@nlqdb/sdk`.

> Read root [`AGENTS.md`](../../AGENTS.md), then [`docs/features/framework-wrappers/FEATURE.md`](../../docs/features/framework-wrappers/FEATURE.md).

## Commands

```bash
bun run --filter @nlqdb/sveltekit typecheck
```

## Local rules

- `/server` is the only entry that imports `@nlqdb/sdk`. Never expose it from the package root.
- The `<NlqHead />` component is the canonical place that emits the elements `<script type="module">` tag.
- Errors from `nlqdbLoad()` are re-thrown as plain `Error` with the original `NlqdbApiError` attached as `cause` so SvelteKit's `+error.svelte` shows a one-sentence message (`GLOBAL-012`).
