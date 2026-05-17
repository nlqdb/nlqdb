# Packages · Nuxt — Agents Guide

`@nlqdb/nuxt` — Nuxt 3 / 4 module that auto-registers `<NlqData>`, injects the elements CDN, and exposes `useNlq()`.

> Read root [`AGENTS.md`](../../AGENTS.md) first, then [`docs/features/framework-wrappers/FEATURE.md`](../../docs/features/framework-wrappers/FEATURE.md).

## Commands

```bash
bun run --filter @nlqdb/nuxt typecheck
```

(Tests live in `examples/nuxt/e2e/` per [`e2e-coverage`](../../docs/features/e2e-coverage/FEATURE.md) since the module needs a real Nuxt runtime to exercise.)

## Local rules

- The CDN script and `isCustomElement` mutation must run on the client only (`mode: 'client'` plugin). SSR custom-element compiler-options aren't reliable in Nuxt — see [nuxt#17263](https://github.com/nuxt/nuxt/discussions/17263).
- No new HTTP — `useNlq()` wraps `useFetch` so the response rides Nuxt's payload (no double-fetch on hydrate).
- Module options live under `runtimeConfig.public.nlqdb` so they're readable from both client and server.
