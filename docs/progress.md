Progress tracker — platform integrations. Each row is a P0/P1/P2/P3 commitment; edit as it ships, archive when done. Phase 0/1/2 slice status lives in `docs/architecture.md` §10.

## 0. Surface status matrix — single source of truth

**Canonical status for every surface advertised on the homepage.** On a status flip, **edit this table first**, then update [`apps/web/src/components/CodePanel.astro`](../apps/web/src/components/CodePanel.astro) to match — the `nlqdb.com` badge row mirrors it, so a status here without a CodePanel update is a regression.

| Status     | Surface                  | Implemented as                                                                          | Notes                                                                  |
| :--------- | :----------------------- | :-------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **Shipped**  | `<nlq-data>` + `<nlq-action>` HTML elements | `packages/elements`; CDN bundle at `elements.nlqdb.com/v1.js` (R2)                       | Default surface; `goal=` leads, `db=` is the power-user form. `<nlq-action>` is the write counterpart with preview→Apply confirm. See [`elements/FEATURE.md`](./features/elements/FEATURE.md). |
| **Shipped**  | TypeScript SDK            | `@nlqdb/sdk` — `packages/sdk`                                                            | Sole HTTP client per `GLOBAL-001`.                                      |
| **Shipped**  | Public anonymous `/v1/ask` | `POST /v1/ask` w/ `Bearer anon_<token>` — `apps/api/src/{principal,anon-rate-limit,anon-global-cap}.ts` | Real-LLM, no sign-in; backs the marketing hero. Global anon cap soft-promotes to sign-in. See [`anonymous-mode/FEATURE.md`](./features/anonymous-mode/FEATURE.md). |
| **Shipped**  | Chat surface              | `nlqdb.com/app` — `apps/web` Astro route + React island                                  | Streaming three-part response; Cmd+K, Cmd+/ trace toggle.              |
| **Shipped**  | Hosted db.create          | `apps/api/src/db-create/**`                                                              | Typed-plan + Zod + libpg_query + Neon provisioner. See [`hosted-db-create/FEATURE.md`](./features/hosted-db-create/FEATURE.md). |
| **Phase 1**  | curl recipes              | `docs.nlqdb.com/curl/` (markdown, no code surface)                                       | One-liner HTTP-API reference.                                           |
| **Phase 2**  | `nlq` CLI                 | Static Go binary; `curl \| sh`, Homebrew tap, npm shim `@nlqdb/cli` — `cli/`             | Bootstrap landed (`ask`, `new`, `db`, `query`, `keys`, `run`); device-flow `nlq login` deferred. See [`cli/FEATURE.md`](./features/cli/FEATURE.md). |
| **Shipped**  | MCP server                | Hosted at `mcp.nlqdb.com` (default) + local stdio fallback `@nlqdb/mcp` — `packages/mcp` | Hosted end-to-end with per-key rate-limit + auth-failure observability. `nlq mcp install` host-detect tracked in CLI. See [`mcp-server/FEATURE.md`](./features/mcp-server/FEATURE.md). |
| **Built**  | Frontend framework modules | `@nlqdb/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}` — `packages/{…}`              | Typed components, SSR-safe lazy CE registration, `/server` `sk_live_*` factories. All `private: true` — not on npm yet (publish gate per `.changeset/README.md`). See [`framework-wrappers/FEATURE.md`](./features/framework-wrappers/FEATURE.md). |
| **Built**  | Swift Package             | `Nlqdb` — `packages/nlqdb-swift`                                                         | Swift 6 actor, async/await; `NlqDataView` SwiftUI helper. Not SPM-resolvable yet (lives in the monorepo, no package mirror/tag). See [`sdk-swift/FEATURE.md`](./features/sdk-swift/FEATURE.md). |
| **Phase 2**  | Python SDK                | `pip install nlqdb`                                                                      | Sync + async; first user is the Jupyter magic.                          |
| **Phase 2**  | Go SDK                    | `github.com/nlqdb/nlqdb-go`                                                              | First user is the CLI itself.                                           |
| **Phase 2**  | BYOLLM ([`SK-PREMIUM-008`](./features/premium-tier/decisions/SK-PREMIUM-008-byollm.md)) | `api_keys.scope = "byollm"` — every tier (free included); through-Gateway dispatch; 0% markup | Paste a provider key in `/app/keys`; fail-loud on key error (`GLOBAL-012`). |
| **Shipped**  | Quality-eval harness      | `tools/eval/` + `workflow_dispatch` GH Action; `POST /v1/events/eval` → LogSnag | BIRD + Spider runners, EX scorer, baseline + McNemar, `feature.eval.*` events, and the `agentic-frontier` exec-retry lane (`free_vs_agentic_frontier_delta` KPI). See [`quality-eval/FEATURE.md`](./features/quality-eval/FEATURE.md). |
| **§6-gated** | Hosted-premium LLM lane  | `packages/llm/src/chains/premium.ts` + Stripe metered items                | Frontier-only, paid plans only; flat sub + allowance + 0%-markup overage (`SK-PREMIUM-009`). Dark until `phase-plan.md §6` trips. See [`premium-tier/FEATURE.md`](./features/premium-tier/FEATURE.md). |
| **Wishlist** | VSCode extension          | (clicks → `home.surface_wishlist`)                                                       | Sidebar panel + inline `<nlq-data>` preview in HTML files.              |
| **Wishlist** | JetBrains plugin          | (clicks → `home.surface_wishlist`)                                                       | Same shape as VSCode for IntelliJ / WebStorm.                           |
| **Wishlist** | Slack bot                 | (clicks → `home.surface_wishlist`)                                                       | `/nlq <goal>` in any channel; per-workspace API key.                    |
| **Wishlist** | Discord bot               | (clicks → `home.surface_wishlist`)                                                       | Same shape as Slack.                                                    |

**Conventions:** **Shipped** = a stranger can use it through its advertised install path (npm / CDN / hosted URL) — merged-on-`main` alone doesn't qualify. **Built** = code + tests complete on `main` but the install path isn't public yet (registry publish gated). **Phase 1** = on-ramp slice (before public alpha). **Phase 2** = developer-surfaces slice (before GA). **Wishlist** = not committed; homepage clicks fire `home.surface_wishlist` (`SK-EVENTS-011`).

The §1–§4 matrix below is finer-grained — one P0–P3 tier per package.

---

## 1. P0 — must-have for launch

P0 ships in Phase 1 — core surface, blocked on `apps/api` going live.

| Package                  | Stack                          | Tier   | Why this wraps the element                                                                  |
| :----------------------- | :----------------------------- | :----- | :------------------------------------------------------------------------------------------ |
| `@nlqdb/elements`        | Custom elements (universal)    | **P0** | The element runtime everything else builds on.                                              |
| `@nlqdb/sdk`             | Typed JS/TS client             | **P0** | Tiny, zero-dep, browsers + Workers + Node + Bun + Deno + React Native.                      |

## 2. P1 — fast follow

P1 ships in Phase 2 — depends on `@nlqdb/sdk` being published.

### Frontend framework modules

An "official" module adds typed props, auto script injection, SSR prefetch, and idiomatic composables on top of the universal `<nlq-data>` snippet.

| Package                  | Stack                          | Tier             | Why this wraps the element                                                                  |
| :----------------------- | :----------------------------- | :--------------- | :------------------------------------------------------------------------------------------ |
| `@nlqdb/react`           | React 19                       | **P1 · Built** | Foundation for `@nlqdb/next`.                                                              |
| `@nlqdb/next`            | Next.js 15 App Router          | **P1 · Built** | Same. `/server` factory keeps `sk_live_*` off the bundle.                                  |
| `@nlqdb/vue`             | Vue 3.5                        | **P1 · Built** | Foundation for `@nlqdb/nuxt`.                                                              |
| `@nlqdb/nuxt`            | Nuxt 4 module                  | **P1 · Built** | Module + `useNlq()`; injects elements CDN.                                                 |
| `@nlqdb/svelte`          | Svelte 5 (runes)               | **P1 · Built** | Foundation for `@nlqdb/sveltekit`.                                                         |
| `@nlqdb/sveltekit`       | SvelteKit                      | **P1 · Built** | `<NlqHead>` + `/server` `nlqdbLoad()`.                                                     |
| `@nlqdb/astro`           | Astro 6 integration            | **P1 · Built** | `astro:config:setup` injects the script.                                                   |
| `@nlqdb/solid`           | SolidJS                        | **P1 · Built** | Attribute pass-through; lazy CE registration.                                              |

### Mobile + desktop

| Package                 | Distribution                  | Tier             | Notes                                                                                  |
| :---------------------- | :---------------------------- | :--------------- | :------------------------------------------------------------------------------------- |
| `Nlqdb` (Swift Package) | Swift Package Manager         | **P1 · Built** | Swift 6 actor + SwiftUI view. See [`sdk-swift/FEATURE.md`](./features/sdk-swift/FEATURE.md). |
| `@nlqdb/react-native`   | npm                           | **P1**           | Hooks (`useNlqQuery`); native fetch; secure-storage refresh tokens.                     |
| `@nlqdb/expo`           | Expo Modules                  | **P1**           | `expo-config-plugin` for the keychain entitlement; pairs with the RN package.           |

### Backend / server middleware

Server-side integration where the server holds and forwards a `sk_live_…`.

| Package              | Stack                 | Tier   | Notes                                                       |
| :------------------- | :-------------------- | :----- | :---------------------------------------------------------- |
| `@nlqdb/hono`        | Hono                  | **P1** | Middleware; matches our own `apps/api`.                     |
| `@nlqdb/express`     | Express               | **P1** | Middleware + route helpers.                                 |
| `@nlqdb/fastify`     | Fastify               | **P1** | Plugin (`fastify-plugin`).                                  |
| `nlqdb-go`           | Go module             | **P1** | Official Go client; first user is the CLI.                  |
| `nlqdb-python`       | PyPI                  | **P1** | Sync + async client; first user is the Jupyter magic.       |

### IDE / editor extensions

MCP-speaking editors (Cursor, Windsurf, Zed, Continue, JetBrains AI) are covered by `@nlqdb/mcp`. The list below is for editor surfaces MCP doesn't reach.

| Extension              | Marketplace            | Tier   | Notes                                                            |
| :--------------------- | :--------------------- | :----- | :--------------------------------------------------------------- |
| `nlqdb` for VS Code    | VS Code Marketplace    | **P1** | Schema autocomplete; query playground; "Run from cursor".        |

### Workflow, RPA, iPaaS

| Integration                  | Platform                    | Tier   | Notes                                                                       |
| :--------------------------- | :-------------------------- | :----- | :-------------------------------------------------------------------------- |
| GitHub Action                | GitHub Marketplace          | **P1** | `nlqdb/cli@v1` — query DB in CI; comment results on PRs.                    |

## 3. P2 — defer

P2 ships in Phase 3 — depends on Pro tier / multi-engine, or partner co-marketing.

### Frontend framework modules

| Package                  | Stack                          | Tier   | Why this wraps the element                                                                  |
| :----------------------- | :----------------------------- | :----- | :------------------------------------------------------------------------------------------ |
| `@nlqdb/solid-start`     | SolidStart                     | **P2** | `createResource` helpers + `<NlqData/>` Solid component.                                    |
| `@nlqdb/qwik`            | Qwik                           | **P2** | Resumable hydration; route loaders.                                                         |
| `@nlqdb/tanstack-start`  | TanStack Start                 | **P2** | Loader helpers; typed router context.                                                       |
| `@nlqdb/react-router`    | React Router 7                 | **P2** | `loader()` helpers; replaces ad-hoc fetch.                                                  |
| `@nlqdb/vite`            | Vite plugin                    | **P2** | Auto-inject the elements script; dev-mode mock proxy for `api.nlqdb.com`.                   |

### Mobile + desktop

| Package                 | Distribution                  | Tier   | Notes                                                                                  |
| :---------------------- | :---------------------------- | :----- | :------------------------------------------------------------------------------------- |
| `nlqdb_flutter`         | pub.dev                       | **P2** | Dart client + `NlqWidget`; uses `flutter_secure_storage`.                              |
| `Nlqdb` (Swift)         | Swift Package Manager         | **P2** | SwiftUI `NlqQueryView`; biometric-locked refresh token.                                |
| `nlqdb-android`         | Maven Central / KMP           | **P2** | Compose `NlqQueryComposable`; AndroidX Security crypto.                                |
| `@nlqdb/tauri`          | Tauri Plugin Registry         | **P2** | Native sidecar so desktop apps embed `nlq` without Node.                               |

### Backend / server middleware

| Package              | Stack                 | Tier   | Notes                                                       |
| :------------------- | :-------------------- | :----- | :---------------------------------------------------------- |
| `@nlqdb/elysia`      | Elysia (Bun)          | **P2** | Plugin; matches Bun-native apps.                            |
| `@nlqdb/nestjs`      | NestJS                | **P2** | Module + `@InjectNlq()` decorator.                          |
| `nlqdb-django`       | PyPI                  | **P2** | App + middleware + DRF integration.                         |
| `nlqdb-fastapi`      | PyPI                  | **P2** | Dependency factory + Pydantic response models.              |
| `nlqdb-rails`        | RubyGems              | **P2** | Engine; ActiveSupport-style helpers.                        |
| `nlqdb-laravel`      | Packagist             | **P2** | Service provider + Blade directive.                         |

### IDE / editor extensions

| Extension              | Marketplace            | Tier   | Notes                                                            |
| :--------------------- | :--------------------- | :----- | :--------------------------------------------------------------- |
| `nlqdb` JetBrains      | JetBrains Marketplace  | **P2** | Same surface for IntelliJ / WebStorm / PyCharm / GoLand / RubyMine. |

### Browser extensions

| Extension              | Store                       | Tier   | Use case                                                              |
| :--------------------- | :-------------------------- | :----- | :-------------------------------------------------------------------- |
| `nlqdb` for Chrome     | Chrome Web Store            | **P2** | Highlight a table on any page → "ask nlqdb about this".               |
| `nlqdb` for Firefox    | Firefox Add-ons             | **P2** | Same.                                                                 |

### CMS, no-code, and site builders

`<nlq-data>` already works in any CMS allowing raw HTML embed. The plugins below add a config UI for non-engineers.

| Plugin                        | Platform                    | Tier   | Notes                                                          |
| :---------------------------- | :-------------------------- | :----- | :------------------------------------------------------------- |
| `nlqdb-wp`                    | WordPress.org (PHP)         | **P2** | Gutenberg block + shortcode; admin UI for keys.                |
| Webflow custom code           | Webflow Marketplace         | **P2** | Site + page-level snippet; CMS-binding helper.                 |
| `nlqdb` Shopify app           | Shopify App Store           | **P2** | Liquid block; theme-extension.                                 |
| Bubble plugin                 | Bubble Plugin Editor        | **P2** | Visual element + actions.                                      |
| Retool component              | Retool custom component     | **P2** | Drop-in DataGrid; auth via tenant token.                       |

### Workflow, RPA, iPaaS

| Integration                  | Platform                    | Tier   | Notes                                                                       |
| :--------------------------- | :-------------------------- | :----- | :-------------------------------------------------------------------------- |
| Zapier app                   | Zapier                      | **P2** | Triggers (new row matching goal); actions (insert via NL).                  |
| n8n node                     | n8n.io                      | **P2** | Self-hostable; same trigger/action shape.                                   |

### Data + analytics tooling

| Integration                  | Platform                    | Tier   | Notes                                                       |
| :--------------------------- | :-------------------------- | :----- | :---------------------------------------------------------- |
| Jupyter / IPython magic      | PyPI (`nlqdb-jupyter`)      | **P2** | `%%nlq` cell magic returns a DataFrame.                     |
| Hex notebook                 | Hex Magic / SQL cell        | **P2** | DB-as-source connector.                                     |

### Chat + collaboration platforms

| Integration                  | Platform                    | Tier   | Notes                                                       |
| :--------------------------- | :-------------------------- | :----- | :---------------------------------------------------------- |
| Slack app                    | Slack App Directory         | **P2** | `/nlq` slash command; thread bot + native unfurl.           |
| Raycast extension            | Raycast Store               | **P2** | macOS launcher; query a DB in two keystrokes.               |

## 4. P3 — explicitly out of scope

**Body:** [`docs/progress-p3-catalog.md`](./progress-p3-catalog.md) — all 8 sub-tables, sharded out under the §2 D4 cap. Long-tail / community; templates in `examples/` invite PRs.

---

Static-site generators (Hugo, Eleventy, Jekyll, Gatsby, Docusaurus, Mintlify) need no plugin — drop the elements `<script>` in your base layout; the [`examples/html`](../examples/html) snippet works as-is.

**Build philosophy.**

- **1st-party (canonical):** the elements, SDK, MCP, `nlq` CLI (Go), shipped framework wrappers, Swift Package, plus the P1 modules in flight. We own these; they version with the API.
- **2nd-party (templated):** every folder under [`examples/`](../examples) — single-file, framework-native; copy-paste is the install. Promoted to 1st-party where adoption demands.
- **3rd-party (community):** everything else, listed at `nlqdb.com/integrations`, published by partners against the `packages/sdk` reference impl + `integration-conformance.yml` CI.

Package names are working titles; tiers don't promise dates; every framework module is sugar on top of `<nlq-data>`, never a replacement. A new integration = a PR with a new row + an `examples/<platform>` folder holding the smallest working version, which earns a status badge (and, when promoted, a 1st-party package).
