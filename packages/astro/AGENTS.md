# Packages · Astro — Agents Guide

`@nlqdb/astro` — Astro 6 integration + `<NlqData />` component.

> Read root [`AGENTS.md`](../../AGENTS.md), then [`docs/features/framework-wrappers/FEATURE.md`](../../docs/features/framework-wrappers/FEATURE.md).

## Commands

```bash
bun run --filter @nlqdb/astro typecheck
```

## Local rules

- The CDN bundle is injected via `astro:config:setup` → `injectScript('page', …)`. Idempotency guard checks `customElements.get('nlq-data')` so repeated client-side routing doesn't re-inject.
- The `.astro` component is intentionally a thin pass-through — no JS, no fetching (GLOBAL-001).
