Progress tracker — platform integrations. Each row is a P0/P1/P2/P3 commitment. Move rows in as they're scoped, edit as they ship, archive when done. Other progress information (Phase 0/1/2 slice status) lives in `docs/architecture.md` §24.

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

| Package                  | Stack                          | Tier   | Why this wraps the element                                                                  |
| :----------------------- | :----------------------------- | :----- | :------------------------------------------------------------------------------------------ |
| `@nlqdb/nuxt`            | Nuxt 3 / 4 module              | **P1** | Auto-injects script; `useNlq()` / `useNlqQuery()` composables; SSR-safe; devtools tab.      |
| `@nlqdb/next`            | Next.js                        | **P1** | Server / client / RSC helpers; `next/script` auto-load; route handler boilerplate for `sk_live_…` calls. |
| `@nlqdb/sveltekit`       | SvelteKit                      | **P1** | Server `load` helpers; `<svelte:head>` injection; types.                                    |
| `@nlqdb/astro`           | Astro integration              | **P1** | Auto script in head; partial-hydration helpers; matches `apps/web`.                         |

### Mobile + desktop

| Package                 | Distribution                  | Tier   | Notes                                                                                  |
| :---------------------- | :---------------------------- | :----- | :------------------------------------------------------------------------------------- |
| `@nlqdb/react-native`   | npm                           | **P1** | Hooks (`useNlqQuery`); native fetch path; secure-storage refresh tokens.               |
| `@nlqdb/expo`           | Expo Modules                  | **P1** | `expo-config-plugin` for the keychain entitlement; works alongside the RN package.     |

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

Cursor, Windsurf, Zed, VS Code Continue, JetBrains AI Assistant all speak MCP — covered by `@nlqdb/mcp` per Phase 2 (`architecture.md` §24.5). The list below is for editor surfaces MCP doesn't reach.

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

**1st-party (canonical):** `@nlqdb/elements`, `@nlqdb/sdk`, `@nlqdb/mcp`, the `nlq` CLI (Go), and the framework modules tagged P0/P1 above (`@nlqdb/{nuxt,next,sveltekit,astro,react-native,hono,express}` + the official `nlqdb-go` and `nlqdb-python` clients). We own these. They version with the API; breaking changes ride a major bump.

**2nd-party (templated):** every folder under [`examples/`](../examples). Single-file, framework-native. Maintained by us, no installable artefact — copy-paste is the install. Where adoption signals demand, we promote a 2nd-party template to a 1st-party package.

**3rd-party (community):** everything else. Documented in the README's integrations index, listed at `nlqdb.com/integrations`, but published and maintained by partners or community contributors. We provide:

1. A typed reference implementation in `packages/sdk` that contributors can build against.
2. A CI template (`.github/workflows/integration-conformance.yml`) that runs an integration's smoke tests against `api.nlqdb.com/v1` so contributions stay correct as the API evolves.
3. A dedicated channel + monthly review cadence to triage integrations PRs.

**What this matrix does NOT do.**

- **Replace the `<nlq-data>` element.** The element is still the simplest way to embed nlqdb anywhere. Every framework module in §2 (Frontend framework modules) is sugar on top of it.
- **Bind us to the listed package names.** Names are working titles; final names ride with `architecture.md` §24.2.2 (`@nlqdb` npm scope, GitHub `nlqdb` org).
- **Promise calendar dates.** Tiers are dependency-ordered. P0/P1/P2 ship when the prerequisite primitive ships, in priority order set by user demand.

A new platform integration = open a PR adding a row to the relevant subsection + a folder under `examples/<platform>` showing the smallest working integration. Once it lands, the row gets a status badge and (when promoted) a 1st-party package.
