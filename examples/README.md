# nlqdb — examples

Smallest-scaffold integrations of nlqdb in popular frontends + a CLI-only path. Each folder is one file's worth of business logic on top of whatever the framework needs to render it.

## Folders

| Path                              | Stack                  | Wrapper                | Persona |
| :-------------------------------- | :--------------------- | :--------------------- | :------ |
| [`html/`](./html)                 | Plain HTML, no build   | raw `<nlq-data>`       | P5 student |
| [`nextjs/`](./nextjs)             | Next.js (App Router)   | raw `<nlq-data>`       | P1 solo builder |
| [`nuxt/`](./nuxt)                 | Nuxt 3                 | raw `<nlq-data>`       | P4 backend engineer |
| [`sveltekit/`](./sveltekit)       | SvelteKit              | raw `<nlq-data>`       | P4 backend engineer |
| [`astro/`](./astro)               | Astro                  | raw `<nlq-data>`       | P1 solo builder |
| [`react/`](./react)               | Vite + React 19 SPA    | `@nlqdb/react`         | P1 solo builder |
| [`vue/`](./vue)                   | Vite + Vue 3.5 SPA     | `@nlqdb/vue`           | P1 solo builder |
| [`svelte/`](./svelte)             | Vite + Svelte 5 (runes)| `@nlqdb/svelte`        | P5 student |
| [`solid/`](./solid)               | Vite + SolidJS         | `@nlqdb/solid`         | P6 analytics engineer |
| [`cli/`](./cli)                   | Bash + `nlq`           | n/a (CLI)              | P6 analytics engineer |
| [`curl/`](./curl)                 | Raw HTTP, no client    | n/a (HTTP)             | P6 analytics engineer |

Two flavours: **raw custom-element** examples (`html`, `nextjs`, `nuxt`, `sveltekit`, `astro`) drop `<nlq-data>` straight into the framework's template and load the runtime from `elements.nlqdb.com/v1.js`. **Wrapper** examples (`react`, `vue`, `svelte`, `solid`) import the framework-native `@nlqdb/<framework>` package for typed props, idiomatic event handlers, and auto-loaded runtime. Pick raw when you want zero npm install; pick the wrapper when you want IDE autocomplete on `goal` / `apiKey` / `template`.

## Status

> Phase 0 (Slice 4) — `apps/api` ships in Slices 6–7 and `@nlqdb/elements` ships in Phase 1.
> Until then these examples document the call shapes the slices are building toward — they parse, type-check, and embed in the listed framework, but the live runtime is not wired yet. Once Phase 1 lands, every example will run end-to-end with no edits.

Each folder's `README.md` includes:

- The 3-step "scaffold + drop in this file + run" recipe.
- The exact `<nlq-data>` snippet — same in every example, deliberately.
- A pointer to the framework-native idiom (e.g. how Astro hydrates custom elements, how Next.js handles `'use client'`).

## Authentication

Every example uses a publishable key (`pk_live_…`) inlined into the HTML/JSX/template. That's by design: publishable keys are read-only, origin-pinned, and meant for client-side embed (`docs/architecture.md §4.1`). For server-side usage where a `sk_live_…` is required, see `examples/cli/` and the (forthcoming) `@nlqdb/sdk` snippets.

To get a key, after Phase 1 lands:

```bash
nlq login          # one click in browser
nlq keys create pk # prints pk_live_…
```

Or use anonymous mode (`docs/architecture.md §3.3`): no sign-in, DB lives 72 h, adopt later via `nlq login`.

## Contributing a new example

PRs welcome — especially for stacks not yet here (SolidStart, TanStack Start, Qwik, React Native, Expo, Tauri, etc.) and creative use-cases (Discord bot, GitHub Action, browser extension, weekly digest cron). Keep each example to one source file plus a 10-line README. For raw-element examples use the same `<nlq-data>` snippet across all of them; for wrapper examples import the typed component from `@nlqdb/<framework>`.

Each example also ships an `e2e/` subfolder with a Playwright spec (`smoke.spec.ts`) or shell smoke (`smoke.sh`) that exercises the README's quickstart — see [`SK-E2E-005`](../docs/features/e2e-coverage/FEATURE.md#sk-e2e-005--examples-as-tests-every-examplesframework-ships-a-smoke-test-wired-to-a-workflow). When adding a new framework, copy the closest existing `<framework>/e2e/smoke.spec.ts` and retag it. Run the matrix:

```bash
gh workflow run e2e-examples.yml
# or locally:
( cd tests/e2e/examples && bun install && bun run install:browsers && bun run test )
```

The full target list — every framework, mobile platform, server middleware, IDE extension, no-code platform, iPaaS, analytics tool, and chat integration we plan to ship into — lives in [`../docs/progress.md`](../docs/progress.md). Each row there is a future 1st-party or 3rd-party integration; this folder is where the templated 2nd-party versions live.
