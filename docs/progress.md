Progress tracker — platform integrations. Each row is a P0/P1/P2/P3 commitment. Move rows in as they're scoped, edit as they ship, archive when done. Other progress information (Phase 0/1/2 slice status) lives in `docs/architecture.md` §10.

## 0. Surface status matrix — single source of truth

**This table is the canonical status for every surface advertised on the homepage.** When a surface flips status, **edit this table first**, then update [`apps/web/src/components/CodePanel.astro`](../apps/web/src/components/CodePanel.astro) to match. The badge row on `nlqdb.com` mirrors this table; status here without a CodePanel update is a regression — the homepage advertises the truth.

| Status     | Surface                  | Implemented as                                                                          | Notes                                                                  |
| :--------- | :----------------------- | :-------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **Shipped**  | `<nlq-data>` HTML element | `packages/elements`; CDN bundle at `elements.nlqdb.com/v1.js` (R2)                       | Default surface; `goal=` attribute leads, `db=` is the power-user form. |
| **Shipped**  | TypeScript SDK            | `@nlqdb/sdk` — `packages/sdk`                                                            | Sole HTTP client per `GLOBAL-001`.                                      |
| **Shipped**  | Public anonymous `/v1/ask` | `POST /v1/ask` w/ `Authorization: Bearer anon_<token>` — `apps/api/src/principal.ts` + `apps/api/src/anon-rate-limit.ts` + `apps/api/src/anon-global-cap.ts` | Real-LLM, no sign-in. Backs the marketing hero (SK-WEB-008 retired the canned `/v1/demo/ask`). Global anon cap (100/hr, 1000/day, 10k/month) soft-promotes to sign-in (SK-ANON-010). |
| **Phase 1**  | Chat surface              | `nlqdb.com/app` — `apps/web` Astro route + React island                                  | Streaming, three-part response, Cmd+K, Cmd+/ trace toggle.              |
| **Phase 1**  | Hosted db.create          | `apps/api/src/db-create/**`                                                              | Typed-plan + Zod + libpg_query + Neon provisioner.                      |
| **Phase 1**  | curl recipes              | `docs.nlqdb.com/curl/` (markdown, no code surface)                                       | One-liner reference for HTTP-API users.                                 |
| **Phase 2**  | `nlq` CLI                 | Static Go binary; `curl \| sh`, Homebrew tap, npm shim `@nlqdb/cli` — `cli/`             | Device-code auth, OS-keychain credentials.                              |
| **Phase 2**  | MCP server                | Hosted at `mcp.nlqdb.com` (default) + local stdio fallback `@nlqdb/mcp` — `packages/mcp` | Three tools, no `nlqdb_create_database`.                                |
| **Shipped**  | Frontend framework modules | `@nlqdb/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}` — `packages/{…}`              | Typed components, SSR-safe lazy CE registration, `/server` `sk_live_*` factories. See [`framework-wrappers/FEATURE.md`](./features/framework-wrappers/FEATURE.md). |
| **Shipped**  | Swift Package             | `Nlqdb` — `packages/nlqdb-swift`                                                         | Swift 6, actor-based, async/await; `NlqDataView` SwiftUI helper. See [`sdk-swift/FEATURE.md`](./features/sdk-swift/FEATURE.md). |
| **Phase 2**  | Python SDK                | `pip install nlqdb`                                                                      | Sync + async; first user is the Jupyter magic.                          |
| **Phase 2**  | Go SDK                    | `github.com/nlqdb/nlqdb-go`                                                              | First user is the CLI itself.                                           |
| **Wishlist** | VSCode extension          | (clicks → `home.surface_wishlist`)                                                       | Sidebar panel + inline `<nlq-data>` preview in HTML files.              |
| **Wishlist** | JetBrains plugin          | (clicks → `home.surface_wishlist`)                                                       | Same shape as VSCode for IntelliJ / WebStorm.                           |
| **Wishlist** | Slack bot                 | (clicks → `home.surface_wishlist`)                                                       | `/nlq <goal>` in any channel; per-workspace API key.                    |
| **Wishlist** | Discord bot               | (clicks → `home.surface_wishlist`)                                                       | Same shape as Slack.                                                    |

**Conventions:**

- **Shipped** — usable on `main`. CI builds it, runtime owns it.
- **Phase 1** — committed for the on-ramp slice. Ships before the public alpha.
- **Phase 2** — committed for the developer-surfaces slice. Ships before GA.
- **Wishlist** — not committed. Surfaced on the homepage so user clicks become signal for what to prioritize next. Click fires `home.surface_wishlist` (`SK-EVENTS-011`); wiring lives in `apps/web/src/components/CodePanel.astro` + `apps/api/src/events-feature.ts`.

The integration matrix in §1–§4 below is *finer-grained* — every row is a P0/P1/P2/P3 priority tier for a specific package. `@nlqdb/elements` (P0) and `@nlqdb/sdk` (P0) are also surfaces above; the rest wrap one of them.

---

## 1. P0 — must-have for launch

P0 ships in Phase 1 — core surface, blocked on `apps/api` going live.

### Frontend framework modules

| Package                  | Stack                          | Tier   | Why this wraps the element                                                                  |
| :----------------------- | :----------------------------- | :----- | :------------------------------------------------------------------------------------------ |
| `@nlqdb/elements`        | Custom elements (universal)    | **P0** | The element runtime everything else builds on.                                              |
| `@nlqdb/sdk`             | Typed JS/TS client             | **P0** | Tiny, zero-dep, browsers + Workers + Node + Bun + Deno + React Native.                      |

## 2. P1 — fast follow

P1 ships in Phase 2 — depends on `@nlqdb/sdk` being published.

### Frontend framework modules

What an "official" framework module adds beyond the universal `<nlq-data>` snippet from `examples/`: typed props, auto script injection, SSR prefetch, devtools, framework-idiomatic composables.

| Package                  | Stack                          | Tier             | Why this wraps the element                                                                  |
| :----------------------- | :----------------------------- | :--------------- | :------------------------------------------------------------------------------------------ |
| `@nlqdb/react`           | React 19                       | **P1 · Shipped** | Foundation for `@nlqdb/next`. Details in [`framework-wrappers/FEATURE.md`](./features/framework-wrappers/FEATURE.md). |
| `@nlqdb/next`            | Next.js 15 App Router          | **P1 · Shipped** | Same. `/server` factory keeps `sk_live_*` off the bundle.                                  |
| `@nlqdb/vue`             | Vue 3.5                        | **P1 · Shipped** | Foundation for `@nlqdb/nuxt`.                                                              |
| `@nlqdb/nuxt`            | Nuxt 3 / 4 module              | **P1 · Shipped** | Module + `useNlq()` composable; injects elements CDN.                                      |
| `@nlqdb/svelte`          | Svelte 5 (runes)               | **P1 · Shipped** | Foundation for `@nlqdb/sveltekit`.                                                         |
| `@nlqdb/sveltekit`       | SvelteKit                      | **P1 · Shipped** | `<NlqHead>` + `/server` `nlqdbLoad()`.                                                     |
| `@nlqdb/astro`           | Astro 5 integration            | **P1 · Shipped** | `astro:config:setup` injects the script.                                                   |
| `@nlqdb/solid`           | SolidJS                        | **P1 · Shipped** | Attribute pass-through; lazy CE registration.                                              |

### Mobile + desktop

| Package                 | Distribution                  | Tier             | Notes                                                                                  |
| :---------------------- | :---------------------------- | :--------------- | :------------------------------------------------------------------------------------- |
| `Nlqdb` (Swift Package) | Swift Package Manager         | **P1 · Shipped** | Swift 6 actor + SwiftUI view. See [`sdk-swift/FEATURE.md`](./features/sdk-swift/FEATURE.md). |
| `@nlqdb/react-native`   | npm                           | **P1**           | Hooks (`useNlqQuery`); native fetch path; secure-storage refresh tokens.               |
| `@nlqdb/expo`           | Expo Modules                  | **P1**           | `expo-config-plugin` for the keychain entitlement; works alongside the RN package.     |

### Backend / server middleware

For server-side integration where a `sk_live_…` is held by the server and forwarded.

| Package              | Stack                 | Tier   | Notes                                                       |
| :------------------- | :-------------------- | :----- | :---------------------------------------------------------- |
| `@nlqdb/hono`        | Hono                  | **P1** | Middleware; matches our own `apps/api`.                     |
| `@nlqdb/express`     | Express               | **P1** | Middleware + route helpers.                                 |
| `@nlqdb/fastify`     | Fastify               | **P1** | Plugin (`fastify-plugin`).                                  |
| `nlqdb-go`           | Go module             | **P1** | Official Go client; first user is the CLI.                  |
| `nlqdb-python`       | PyPI                  | **P1** | Sync + async client; first user is the Jupyter magic.       |

### IDE / editor extensions

Cursor, Windsurf, Zed, VS Code Continue, JetBrains AI Assistant all speak MCP — covered by `@nlqdb/mcp` per Phase 2 (`architecture.md` §10). The list below is for editor surfaces MCP doesn't reach.

| Extension              | Marketplace            | Tier   | Notes                                                            |
| :--------------------- | :--------------------- | :----- | :--------------------------------------------------------------- |
| `nlqdb` for VS Code    | VS Code Marketplace    | **P1** | Schema autocomplete; query playground; "Run from cursor".        |

### Workflow, RPA, iPaaS

| Integration                  | Platform                    | Tier   | Notes                                                                       |
| :--------------------------- | :-------------------------- | :----- | :-------------------------------------------------------------------------- |
| GitHub Action                | GitHub Marketplace          | **P1** | `nlqdb/cli@v1` — query DB in CI; comment results on PRs.                    |

## 3. P2 — defer

P2 ships in Phase 3 — depends on Pro tier / multi-engine being live, or on partner co-marketing.

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
| `nlqdb-android`         | Maven Central / KMP           | **P2** | Compose `NlqQueryComposable`; AndroidX Security crypto for tokens.                     |
| `@nlqdb/tauri`          | Tauri Plugin Registry         | **P2** | Native sidecar so desktop apps embed `nlq` without bundling Node.                      |

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

`<nlq-data>` already works in any CMS that allows raw HTML embed. The plugins below add a config UI so non-engineers don't have to know the snippet exists.

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
| Slack app                    | Slack App Directory         | **P2** | `/nlq` slash command; thread bot; native unfurl for shared queries. |
| Raycast extension            | Raycast Store               | **P2** | macOS launcher; query a DB in two keystrokes.               |

## 4. P3 — explicitly out of scope

Long-tail / community. Templates in `examples/` invite PRs; we may take canonical maintenance later if traction warrants.

### Mobile + desktop

| Package                 | Distribution                  | Tier   | Notes                                                                                  |
| :---------------------- | :---------------------------- | :----- | :------------------------------------------------------------------------------------- |
| `@nlqdb/electron`       | npm                           | **P3** | IPC adapter for keychain-stored refresh tokens in the main process.                    |

### Backend / server middleware

| Package              | Stack                 | Tier   | Notes                                                       |
| :------------------- | :-------------------- | :----- | :---------------------------------------------------------- |
| `nlqdb-spring`       | Maven Central         | **P3** | Spring Boot starter.                                        |
| `nlqdb-rust`         | crates.io             | **P3** | Async client built on `reqwest`.                            |
| `nlqdb-elixir`       | Hex.pm                | **P3** | Phoenix integration with a `Plug.NlqResponse` helper.       |

### IDE / editor extensions

| Extension              | Marketplace            | Tier   | Notes                                                            |
| :--------------------- | :--------------------- | :----- | :--------------------------------------------------------------- |
| `nlqdb.nvim`           | Lua plugin             | **P3** | Floating-window query runner.                                    |
| `nlqdb-mode` Emacs     | MELPA                  | **P3** | Org-mode source-block backend.                                   |
| `nlqdb` Sublime        | Package Control        | **P3** | Same surface, smaller community.                                 |

### Browser extensions

| Extension              | Store                       | Tier   | Use case                                                              |
| :--------------------- | :-------------------------- | :----- | :-------------------------------------------------------------------- |
| `nlqdb` for Safari     | Safari Extensions Gallery   | **P3** | Same; later because of the Safari notarisation tax.                   |
| `nlqdb` Arc Boost      | Arc                         | **P3** | Boost-as-a-feature: turn any DataTable on a SaaS dashboard into nlq.  |

### CMS, no-code, and site builders

| Plugin                        | Platform                    | Tier   | Notes                                                          |
| :---------------------------- | :-------------------------- | :----- | :------------------------------------------------------------- |
| `nlqdb` Wix app               | Wix App Market              | **P3** | Velo backend wrapper.                                          |
| Ghost integration             | Ghost custom integration    | **P3** | Members-aware queries via `pk_live_`.                          |
| Notion connector              | Notion Connections          | **P3** | Push query results into a Notion DB on schedule.               |
| Framer override               | Framer Code Components      | **P3** | `<NlqData />` Framer code component.                           |
| Softr block                   | Softr Marketplace           | **P3** | Same shape as Bubble plugin.                                   |
| FlutterFlow component         | FlutterFlow Marketplace     | **P3** | No-code mobile builder, mirrors `nlqdb_flutter`.                |

### Workflow, RPA, iPaaS

| Integration                  | Platform                    | Tier   | Notes                                                                       |
| :--------------------------- | :-------------------------- | :----- | :-------------------------------------------------------------------------- |
| Make module                  | make.com                    | **P3** | Mirror of the Zapier app.                                                   |
| Pipedream component          | pipedream.com               | **P3** | Same.                                                                       |
| Activepieces piece           | activepieces.com            | **P3** | Open-source iPaaS — community-friendly counterpart to Zapier.               |
| GitLab CI component          | GitLab Catalog              | **P3** | Same shape as the GH Action.                                                |
| Buildkite plugin             | Buildkite Plugins           | **P3** | Same.                                                                       |
| Temporal activity helper     | Temporal SDK                | **P3** | Wraps `@nlqdb/sdk` so workflows can query / insert without ad-hoc HTTP.     |

### Data + analytics tooling

| Integration                  | Platform                    | Tier   | Notes                                                       |
| :--------------------------- | :-------------------------- | :----- | :---------------------------------------------------------- |
| Observable Plot helper       | npm (`@nlqdb/observable`)   | **P3** | One-liner chart from an nlq query.                          |
| Streamlit component          | PyPI                        | **P3** | `st.nlqdb()` widget.                                        |
| Marimo cell                  | PyPI                        | **P3** | Reactive cell; same shape as Streamlit.                     |
| dbt source plugin            | dbt-core                    | **P3** | Treat an nlq DB as a source.                                |
| Airbyte source / destination | Airbyte                     | **P3** | Connector for ETL pipelines.                                |
| Fivetran connector           | Fivetran                    | **P3** | Same.                                                       |
| Metabase data driver         | Metabase Driver SDK         | **P3** | Show an nlq DB inside Metabase like any Postgres.            |

### Chat + collaboration platforms

| Integration                  | Platform                    | Tier   | Notes                                                       |
| :--------------------------- | :-------------------------- | :----- | :---------------------------------------------------------- |
| Discord bot                  | OAuth + Bot                 | **P3** | Slash command + ambient response.                           |
| Microsoft Teams app          | Teams Marketplace           | **P3** | Same shape as the Slack app.                                |
| Telegram bot                 | BotFather                   | **P3** | Slash + inline.                                             |
| Linear integration           | Linear Marketplace          | **P3** | Auto-tag issues with related rows from a connected DB.      |

---

Static-site generators (Hugo, Eleventy, Jekyll, Gatsby, Docusaurus, Mintlify) need no plugin — drop the elements `<script>` tag in your base layout, the snippet from [`examples/html`](../examples/html) works as-is.

**Build philosophy.**

**1st-party (canonical):** `@nlqdb/elements`, `@nlqdb/sdk`, `@nlqdb/mcp`, the `nlq` CLI (Go), the shipped framework wrappers (`@nlqdb/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}`), the `Nlqdb` Swift Package, and the P1 modules still in flight (`@nlqdb/{react-native,hono,express}` + `nlqdb-go` and `nlqdb-python`). We own these; they version with the API.

**2nd-party (templated):** every folder under [`examples/`](../examples). Single-file, framework-native. Maintained by us, no installable artefact — copy-paste is the install. Where adoption signals demand, we promote a 2nd-party template to a 1st-party package.

**3rd-party (community):** everything else, listed at `nlqdb.com/integrations`, published and maintained by partners. We provide: a typed reference implementation in `packages/sdk`; a CI template (`.github/workflows/integration-conformance.yml`) that smoke-tests against `api.nlqdb.com/v1`; and a monthly review cadence.

**What this matrix does NOT do.** It doesn't replace `<nlq-data>` (every framework module is sugar on top), doesn't bind us to listed package names (working titles), and doesn't promise calendar dates (tiers are dependency-ordered).

A new platform integration = open a PR adding a row + a folder under `examples/<platform>` with the smallest working integration. Once it lands, the row gets a status badge and (when promoted) a 1st-party package.
