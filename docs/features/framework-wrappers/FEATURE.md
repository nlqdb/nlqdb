---
name: framework-wrappers
description: Per-framework typed wrappers over `<nlq-data>` — React, Next, Vue, Nuxt, Svelte, SvelteKit, Astro, Solid.
when-to-load:
  globs:
    - packages/react/**
    - packages/next/**
    - packages/vue/**
    - packages/nuxt/**
    - packages/svelte/**
    - packages/sveltekit/**
    - packages/astro/**
    - packages/solid/**
  topics: [react, next, vue, nuxt, svelte, sveltekit, astro, solid, framework, wrapper]
---

# Feature: Framework wrappers

**One-liner:** Per-framework typed wrappers over `<nlq-data>` — React, Next, Vue, Nuxt, Svelte, SvelteKit, Astro, Solid.
**Status:** partial (Phase 2 — drop-in components shipped; idiomatic data composables tracked under Open questions)
**Owners (code):** `packages/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}/**`
**Cross-refs:** [`elements/FEATURE.md`](../elements/FEATURE.md) (the underlying `<nlq-data>` web component) · [`sdk/FEATURE.md`](../sdk/FEATURE.md) (server-side calls inside framework adapters) · `docs/progress.md §0` (surface status matrix) · `docs/architecture.md §3.1` (matrix row per surface).

## Touchpoints — read this feature before editing

- `packages/react/**`
- `packages/next/**`
- `packages/vue/**`
- `packages/nuxt/**`
- `packages/svelte/**`
- `packages/sveltekit/**`
- `packages/astro/**`
- `packages/solid/**`

## Decisions

### SK-FW-001 — One TypeScript core + thin per-framework adapters

- **Decision:** All framework wrappers delegate the wire layer to `@nlqdb/sdk` and the runtime layer to `@nlqdb/elements`. Per-framework packages own only the type augmentation, the framework-idiomatic component / module / integration shape, and (where the framework has a `useFetch`-style primitive) a SSR-payload-aware composable. No package re-implements `fetch('/v1/...')` and no package re-implements the `<nlq-data>` element.
- **Core value:** Simple, Bullet-proof, Free
- **Why:** `GLOBAL-001` mandates a single HTTP client per language; `GLOBAL-002` mandates behavior parity. The only way to honour both across N frameworks is to keep the wire shape, the retry budget, the idempotency-key semantics, and the error class in one place. The pattern is the one TanStack Query / Auth.js / `@lit-labs/react` settled on — a small framework-agnostic core plus paper-thin per-framework adapters.
- **Consequence in code:** Each wrapper's `package.json` lists `@nlqdb/elements` (and where relevant `@nlqdb/sdk`) under `peerDependencies`. CI's `lockfile-guard.sh` already forbids direct DB drivers across the workspace; framework wrappers add no new direct deps beyond the framework itself + the existing nlqdb packages. The wrapper packages are intentionally tiny (≤200 LOC) — a "wrapper" that re-implements the network layer is a bug.
- **Alternatives rejected:**
  - Per-framework duplication of the wire shape — drifts within a quarter; contradicts `GLOBAL-002`.
  - Code-generated wrappers from a Web Components Manifest — adds a build step and a watch-the-generator failure mode for ~50 lines of saved code per package.
  - One mega-package (`@nlqdb/ui`) that re-exports for every framework — drags every framework's `peerDependencies` into every consumer's `node_modules`.

### SK-FW-002 — Lazy element registration; SSR-safe by default

- **Decision:** No wrapper calls `import "@nlqdb/elements"` at the top of its module. Registration happens inside the component's mount hook (React `useEffect`, Vue `onMounted`, Svelte `onMount`, Solid `onMount`, Nuxt client plugin, Astro injected script). The import is wrapped in a `typeof customElements !== "undefined"` guard so server-side renders are inert.
- **Core value:** Bullet-proof, Free, Effortless UX
- **Why:** Eagerly registering at module top-level breaks SSR (no `customElements` global on the server) and forces the elements bundle into every code-split chunk that even mentions the wrapper. Lazy mount-time registration lets the framework's SSR pass render the inert `<nlq-data>` tag and lets the client upgrade it once hydration is done.
- **Consequence in code:** Every wrapper has the same pattern (`registerOnClient()` helper or equivalent). The Astro integration injects a small inline script (with the same idempotency guard) rather than bundling the element source. The Nuxt module's plugin is `mode: 'client'`. SvelteKit's `<NlqHead>` uses `<svelte:head>` (which is correctly SSR-aware). Next.js' `<NlqScript />` defaults to `strategy="afterInteractive"`.
- **Alternatives rejected:**
  - Top-of-module `import "@nlqdb/elements"` — breaks SSR (`ReferenceError: customElements is not defined`), defeats tree-shaking.
  - Make every wrapper "client-only" via `"use client"` / `<ClientOnly>` — pushes the SSR problem onto the embedder rather than solving it.
  - Custom-element registry shim on the server — adds bytes and a parallel rendering path; the inert markup approach is what the platform already supports.

### SK-FW-003 — Server-side endpoints are gated behind sub-paths, never re-exported from the package root

- **Decision:** Where a framework distinguishes server-only from client-safe modules (Next.js' `import "server-only"`, SvelteKit's `+page.server.ts`-only modules, Nuxt's server-route handlers), the `sk_live_*`-keyed `@nlqdb/sdk` factory lives behind a dedicated sub-path export (`@nlqdb/next/server`, `@nlqdb/sveltekit/server`). The package's root export is browser-safe.
- **Core value:** Bullet-proof, Seamless auth, Free
- **Why:** A `sk_live_*` reaching a browser bundle is a credential leak. The framework-level guards (`import "server-only"`, SvelteKit's per-file separation) only fire when the offending module is genuinely server-only; re-exporting the server factory from the root makes the build pass but ships the import-statement-shaped pointer to the secret-key path into the client bundle. Sub-path exports give the framework's static analyser a clean signal.
- **Consequence in code:** `packages/next/package.json` declares `./server` and `./script` as separate `exports` entries; `packages/next/src/server.ts` starts with `import "server-only"`; `packages/sveltekit/package.json` declares `./server`; consumers always import from the sub-path. The `@nlqdb/next/script` sub-path is similarly separate because it uses `next/script` and would pull Next's runtime into bundlers that don't have it.
- **Alternatives rejected:**
  - One module with conditional imports — bundlers still ship the import shape; `import "server-only"` doesn't fire on a re-export.
  - Env-var-only enforcement (`if (typeof window !== 'undefined') throw`) — runtime guard; too late, the key is already in the bundle.

### SK-FW-004 — Wrappers expose the canonical `nlq-data:load` / `nlq-data:error` CustomEvent as a framework-idiomatic callback prop

- **Decision:** Each wrapper translates the underlying element's two CustomEvents into the framework's idiomatic event-prop shape: React `onLoad` / `onError`, Vue `@load` / `@error`, Svelte `onload` / `onerror`, Solid `onLoad` / `onError`. The wrapper attaches listeners imperatively on mount and tears them down on unmount; it never relies on the framework's built-in event-prop mapping because React 19's mapping doesn't cover non-standard DOM events ([release note](https://react.dev/blog/2024/12/05/react-19#support-for-custom-elements)) and other frameworks' coverage is similarly partial.
- **Core value:** Effortless UX, Simple
- **Why:** The wrappers exist precisely so embedders don't have to remember which framework auto-binds which event. A single discoverable prop shape per wrapper, with a single payload type imported from `@nlqdb/elements`, keeps `<NlqData />` looking like every other component the embedder uses.
- **Consequence in code:** `NlqDataLoadDetail` and `NlqDataErrorDetail` are re-exported from every wrapper. Unit tests assert that dispatching the underlying CustomEvent fires the wrapper's callback exactly once and stops firing after unmount.
- **Alternatives rejected:**
  - Expose the raw element ref and let embedders wire listeners — kills the ergonomics that motivate the wrapper in the first place.
  - Map only the events React/Vue support natively — works for some users, surprises others; the imperative attach is universally correct.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-001** — SDK is the only HTTP client.
  - *In this feature:* every wrapper either renders `<nlq-data>` (which talks to `/v1/ask` via `packages/elements/src/fetch.ts`) or delegates to `@nlqdb/sdk` for server-side calls. No wrapper ships a `fetch('/v1/...')`.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-003** — New capabilities ship to all surfaces in one PR.
  - *In this feature:* a new `<nlq-data>` attribute lands in `packages/elements` *and* every framework wrapper in the same PR (or each affected wrapper documents the gap under Open questions).
- **GLOBAL-013** — $0/month free tier; Workers bundle ≤3 MiB compressed.
  - *In this feature:* per-wrapper bundle target ≤2 KB gzipped over `@nlqdb/sdk` + `@nlqdb/elements`. Astro integration ≤1 KB.
- **GLOBAL-016** — Reach for small mature packages; hard-pass on RC.
  - *In this feature:* peer-dep ranges are pinned to current stable majors (React 19, Vue 3.5, Svelte 5, Astro 5, Next 15, Nuxt 3.13+, Solid 1.9). RC framework releases are not supported on the wrapper's critical path.
- **GLOBAL-019** — Apache-2.0-compatible OSS core.

## Open questions / known unknowns

- **TanStack Query / `useQuery`-shaped composables.** The wrappers expose the `<NlqData>` component (drop-in) and, where the framework has one, a `useNlq()` composable that wraps the framework's native data primitive (`useFetch` in Nuxt). A unified `{ data, isPending, error, refetch }` hook surface across React / Vue / Solid would let embedders treat `@nlqdb/sdk` like any other TanStack Query source. Tracked here; decision deferred until a design partner asks.
- **Bundle-size CI enforcement.** Each wrapper's source is small (≤200 LOC) but no `size-limit` job exists yet — the only enforced bundle budget is `packages/elements`'s 6 KB CDN cap. Adding `size-limit` per wrapper is straightforward once the matrix stabilises.
- **`@nlqdb/qwik`.** Phase 2 P2 per [`progress.md`](../../progress.md). Qwik's resumability model requires a lazy `import("@nlqdb/elements")` inside `useVisibleTask$` — the pattern is documented in the research file at `/tmp/framework-wrappers-research.md` (unchecked into the repo). Defer until Solid usage justifies pulling in another Solid-adjacent ecosystem.
- **`@nlqdb/react-native` / `@nlqdb/expo`.** Phase 2 P1 per [`progress.md`](../../progress.md). RN has no DOM — the wrapper is a pure JS hook + a native `<View>`-based component, not a custom-element wrapper. Lives outside this feature's scope; will land in `docs/features/react-native/FEATURE.md` (deferred to next PR per the research recommendation).
- **`@nlqdb/sdk/browser` vs `@nlqdb/sdk/server` split.** Stripe / Clerk separate publishable-vs-secret-keyed entry points. The TS SDK currently distinguishes via the `apiKey` vs `withCredentials` discriminated union (`SK-SDK-001`); the per-key entry-point split is an open call to make later if the discriminated union proves error-prone in practice.
- **Astro integration: per-island vs global injection.** The current implementation injects the CDN script via `astro:config:setup` → `injectScript('page', …)`. An alternative is to ship `<NlqData />` with `client:visible` by default and inject only when at least one island opts in. Decision deferred — current shape matches the rest of the marketing site (`apps/web`).
