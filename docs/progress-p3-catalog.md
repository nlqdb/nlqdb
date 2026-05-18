# P3 platform integrations — catalog

Sharded from [`docs/progress.md`](./progress.md) §4 to keep that doc
under the 20 KB cap from [`CLAUDE.md` §2 D4](../CLAUDE.md). Content
unchanged — only the location moved. All sub-tables intact.

P3 = long-tail / community. Templates in [`examples/`](../examples)
invite PRs; we may take canonical maintenance later if traction
warrants.

## Mobile + desktop

| Package                 | Distribution                  | Tier   | Notes                                                                                  |
| :---------------------- | :---------------------------- | :----- | :------------------------------------------------------------------------------------- |
| `@nlqdb/electron`       | npm                           | **P3** | IPC adapter for keychain-stored refresh tokens in the main process.                    |

## Backend / server middleware

| Package              | Stack                 | Tier   | Notes                                                       |
| :------------------- | :-------------------- | :----- | :---------------------------------------------------------- |
| `nlqdb-spring`       | Maven Central         | **P3** | Spring Boot starter.                                        |
| `nlqdb-rust`         | crates.io             | **P3** | Async client built on `reqwest`.                            |
| `nlqdb-elixir`       | Hex.pm                | **P3** | Phoenix integration with a `Plug.NlqResponse` helper.       |

## IDE / editor extensions

| Extension              | Marketplace            | Tier   | Notes                                                            |
| :--------------------- | :--------------------- | :----- | :--------------------------------------------------------------- |
| `nlqdb.nvim`           | Lua plugin             | **P3** | Floating-window query runner.                                    |
| `nlqdb-mode` Emacs     | MELPA                  | **P3** | Org-mode source-block backend.                                   |
| `nlqdb` Sublime        | Package Control        | **P3** | Same surface, smaller community.                                 |

## Browser extensions

| Extension              | Store                       | Tier   | Use case                                                              |
| :--------------------- | :-------------------------- | :----- | :-------------------------------------------------------------------- |
| `nlqdb` for Safari     | Safari Extensions Gallery   | **P3** | Same; later because of the Safari notarisation tax.                   |
| `nlqdb` Arc Boost      | Arc                         | **P3** | Boost-as-a-feature: turn any DataTable on a SaaS dashboard into nlq.  |

## CMS, no-code, and site builders

| Plugin                        | Platform                    | Tier   | Notes                                                          |
| :---------------------------- | :-------------------------- | :----- | :------------------------------------------------------------- |
| `nlqdb` Wix app               | Wix App Market              | **P3** | Velo backend wrapper.                                          |
| Ghost integration             | Ghost custom integration    | **P3** | Members-aware queries via `pk_live_`.                          |
| Notion connector              | Notion Connections          | **P3** | Push query results into a Notion DB on schedule.               |
| Framer override               | Framer Code Components      | **P3** | `<NlqData />` Framer code component.                           |
| Softr block                   | Softr Marketplace           | **P3** | Same shape as Bubble plugin.                                   |
| FlutterFlow component         | FlutterFlow Marketplace     | **P3** | No-code mobile builder, mirrors `nlqdb_flutter`.                |

## Workflow, RPA, iPaaS

| Integration                  | Platform                    | Tier   | Notes                                                                       |
| :--------------------------- | :-------------------------- | :----- | :-------------------------------------------------------------------------- |
| Make module                  | make.com                    | **P3** | Mirror of the Zapier app.                                                   |
| Pipedream component          | pipedream.com               | **P3** | Same.                                                                       |
| Activepieces piece           | activepieces.com            | **P3** | Open-source iPaaS — community-friendly counterpart to Zapier.               |
| GitLab CI component          | GitLab Catalog              | **P3** | Same shape as the GH Action.                                                |
| Buildkite plugin             | Buildkite Plugins           | **P3** | Same.                                                                       |
| Temporal activity helper     | Temporal SDK                | **P3** | Wraps `@nlqdb/sdk` so workflows can query / insert without ad-hoc HTTP.     |

## Data + analytics tooling

| Integration                  | Platform                    | Tier   | Notes                                                       |
| :--------------------------- | :-------------------------- | :----- | :---------------------------------------------------------- |
| Observable Plot helper       | npm (`@nlqdb/observable`)   | **P3** | One-liner chart from an nlq query.                          |
| Streamlit component          | PyPI                        | **P3** | `st.nlqdb()` widget.                                        |
| Marimo cell                  | PyPI                        | **P3** | Reactive cell; same shape as Streamlit.                     |
| dbt source plugin            | dbt-core                    | **P3** | Treat an nlq DB as a source.                                |
| Airbyte source / destination | Airbyte                     | **P3** | Connector for ETL pipelines.                                |
| Fivetran connector           | Fivetran                    | **P3** | Same.                                                       |
| Metabase data driver         | Metabase Driver SDK         | **P3** | Show an nlq DB inside Metabase like any Postgres.            |

## Chat + collaboration platforms

| Integration                  | Platform                    | Tier   | Notes                                                       |
| :--------------------------- | :-------------------------- | :----- | :---------------------------------------------------------- |
| Discord bot                  | OAuth + Bot                 | **P3** | Slash command + ambient response.                           |
| Microsoft Teams app          | Teams Marketplace           | **P3** | Same shape as the Slack app.                                |
| Telegram bot                 | BotFather                   | **P3** | Slash + inline.                                             |
| Linear integration           | Linear Marketplace          | **P3** | Auto-tag issues with related rows from a connected DB.      |
