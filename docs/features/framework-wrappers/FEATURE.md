---
name: framework-wrappers
description: Per-framework typed wrappers over `<nlq-data>` + `<nlq-action>` — React, Next, Vue, Nuxt, Svelte, SvelteKit, Astro, Solid.
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

**One-liner:** Per-framework typed wrappers over `<nlq-data>` + `<nlq-action>` — React, Next, Vue, Nuxt, Svelte, SvelteKit, Astro, Solid.
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

### SK-FW-004 — Wrappers expose the canonical CustomEvents as framework-idiomatic callback props

- **Decision:** Each wrapper translates the underlying elements' CustomEvents (`nlq-data:load`, `nlq-data:error`, `nlq-action:success`, `nlq-action:confirm-required`, `nlq-action:error`) into the framework's idiomatic event-prop shape: React `onLoad` / `onError` / `onSuccess` / `onConfirmRequired`, Vue `@load` / `@error` / `@success` / `@confirm-required`, Svelte `onload` / `onerror` / `onsuccess` / `onconfirmRequired`, Solid `onLoad` / `onError` / `onSuccess` / `onConfirmRequired`. The wrapper attaches listeners imperatively on mount and tears them down on unmount; it never relies on the framework's built-in event-prop mapping because React 19's mapping doesn't cover non-standard DOM events ([release note](https://react.dev/blog/2024/12/05/react-19#support-for-custom-elements)) and other frameworks' coverage is similarly partial.
- **Core value:** Effortless UX, Simple
- **Why:** The wrappers exist precisely so embedders don't have to remember which framework auto-binds which event. A single discoverable prop shape per wrapper, with payload types imported from `@nlqdb/elements`, keeps both `<NlqData />` and `<NlqAction />` looking like every other component the embedder uses.
- **Consequence in code:** `NlqDataLoadDetail`, `NlqDataErrorDetail`, `NlqActionSuccessDetail`, `NlqActionConfirmDetail`, `NlqActionErrorDetail` are re-exported from every wrapper. Unit tests assert that dispatching the underlying CustomEvent fires the wrapper's callback exactly once and stops firing after unmount.
- **Alternatives rejected:**
  - Expose the raw element ref and let embedders wire listeners — kills the ergonomics that motivate the wrapper in the first place.
  - Map only the events React/Vue support natively — works for some users, surprises others; the imperative attach is universally correct.

### SK-FW-005 — `<NlqAction>` ships in every wrapper in lockstep with `<NlqData>`

- **Decision:** Every wrapper exports both `NlqData` (the read element) and `NlqAction` (the write element with preview→Apply diff hop, `SK-ELEM-010..013`). A new `<nlq-*>` element added to `@nlqdb/elements` lands in every wrapper in the same PR per `GLOBAL-003`.
- **Core value:** Simple, Bullet-proof
- **Why:** Read + write is the minimum cohesive surface for a CRUD UI — shipping `<NlqData>` without `<NlqAction>` would force embedders to drop down to raw `<nlq-action>` tags (losing the type augmentation) or call `runSql()` directly (losing the trust-UX diff hop). The wrappers are the framework-typed door; both doors stay aligned.
- **Consequence in code:** Each wrapper's `index.ts` exports `NlqData` + `NlqAction` + the five event-detail types. Each wrapper's `JSX.IntrinsicElements` / `GlobalComponents` augmentation lists both tags. `configureNlqdb(app)` in Vue + the Nuxt `addComponent` calls register both. The Astro / SvelteKit packages re-export both from their `index`.
- **Alternatives rejected:**
  - Ship `<NlqData>` first, defer `<NlqAction>` to a follow-up — splits the migration cost across two releases; embedders writing forms drop straight to raw tags in the gap.
  - One mega-component (`<NlqElement variant="data|action">`) — collapses two structurally different APIs (read returns rows; write goes through preview→Apply) into one prop-driven blob; opposite of `GLOBAL-017`'s "one way to do each thing".

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
  - *In this feature:* peer-dep ranges are pinned to current stable majors (React 19, Vue 3.5, Svelte 5, Astro 6, Next 15, Nuxt 4, Solid 1.9). RC framework releases are not supported on the wrapper's critical path.
- **GLOBAL-019** — Free + Open Source core (FSL-1.1-ALv2 → Apache-2.0).

## Open questions / known unknowns

- **TanStack Query / `useQuery`-shaped composables — Parked until a design partner asks** (resolved per `GLOBAL-033`, speculative-scope → never build a new surface speculatively). The wrappers expose `<NlqData>` (drop-in) and, where the framework has one, a `useNlq()` composable over the native primitive (`useFetch` in Nuxt). A unified `{ data, isPending, error, refetch }` hook across React / Vue / Solid is a real ergonomic win but adds a parallel API to maintain across every wrapper, so it waits for a named design-partner request rather than landing on spec.
- **Bundle-size CI enforcement — Parked until the next wrapper PR** (`GLOBAL-033`, silent-drift → add the cheap assertion, but no speculative work before the matrix settles). Each wrapper's source is ≤200 LOC; the only enforced budget today is `packages/elements`'s 6 KB CDN cap. The `size-limit` job lands in the same PR as the next wrapper (the matrix is stable after Solid), so it ships with a real consumer rather than on spec.
- **`@nlqdb/qwik` — Deferred to Phase 2 P2** (`GLOBAL-033`, genuinely-deferred per [`progress.md`](../../progress.md)). Qwik's resumability model requires a lazy `import("@nlqdb/elements")` inside `useVisibleTask$` — the pattern is sketched in the research notes. Land it only when Solid usage justifies pulling in another ecosystem, not on spec.
- **`@nlqdb/react-native` / `@nlqdb/expo`.** Phase 2 P1 per [`progress.md`](../../progress.md). RN has no DOM — the wrapper is a pure JS hook + a native `<View>`-based component, not a custom-element wrapper. Lives outside this feature's scope; will land in `docs/features/react-native/FEATURE.md` (deferred to next PR per the research recommendation).
- **`@nlqdb/sdk/browser` vs `@nlqdb/sdk/server` split — Parked until the discriminated union proves error-prone** (resolved per `GLOBAL-033`, speculative-scope → don't pre-split). Stripe / Clerk separate publishable-vs-secret entry points; the TS SDK distinguishes via the `apiKey` vs `withCredentials` union (`SK-SDK-001`) today. A second entry point is a parallel API to maintain — it lands only if the union actually produces a misuse in practice, not on spec.
- **Astro integration: per-island vs global injection — Resolved** (`GLOBAL-033`, Simple → one way): keep the global `astro:config:setup` → `injectScript('page', …)`. It matches the rest of the marketing site (`apps/web`); per-island conditional injection adds an opt-in branch for a payload (one small CDN script) that doesn't justify the complexity.
