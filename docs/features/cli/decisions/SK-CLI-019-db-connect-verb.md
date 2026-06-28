# SK-CLI-019 — `nlq db connect` registers an existing engine; the connection URL is a credential read without echo and never persisted

Parent feature: [`cli/FEATURE.md`](../FEATURE.md). Wire counterpart:
`POST /v1/db/connect`. Parent GLOBALs:
`GLOBAL-002`/`GLOBAL-003` (surface parity — the CLI carries every shipped
endpoint),
[`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md)
(one-sentence next-action errors),
[`GLOBAL-017`](../../../decisions/GLOBAL-017-one-way-to-do-things.md)
(one way to do each thing). Sibling of the credential-handling pattern in
[`SK-CLI-016`](SK-CLI-016-byollm-keychain.md).

- **Decision:** The `db` command group gains `nlq db connect
  --engine <clickhouse|postgres> [--name <n>]`, wrapping
  `POST /v1/db/connect` to register an existing hosted engine by its
  connection URL. The URL is supplied via `--url`, piped on stdin, or an
  interactive prompt that reads it **without echo** (`term.ReadPassword`,
  mirroring `readByollmKey`). On 201 the CLI sets the returned `dbId` as
  the active DB in `state.json` and prints a confirmation —
  `dbId`, `engine`, `name`, the `schemaPreview`, the `pkLive` when
  present — and the next step (`nlq ask --db <dbId> "<question>"`). API
  errors (400/403/502/503) surface the server `message` verbatim through
  the shared `renderAPIError` mapper (`GLOBAL-012`). The connection URL is
  **never** printed back and **never** written to `config.toml`,
  `state.json`, or the credstore: it is sent to the API and discarded.
- **Core value:** Goal-first, Bullet-proof, Simple
- **Why:** `GLOBAL-003` obliges the CLI to carry every endpoint the SDK
  reaches; `POST /v1/db/connect` is a new surface, so a CLI without it is a
  parity hole. The URL is a live credential (it embeds DB user + password),
  so it gets the same off-argv, no-echo, never-persisted handling the
  BYOLLM key already gets in `SK-CLI-016` — process lists and shell history
  both expose positional args and flag values. `connect` lives under the
  existing `db` group (not a new top-level verb) because it is database
  management, keeping the verb surface flat per `GLOBAL-017`.
- **Consequence in code:** `cli/internal/cmd/db.go` gains `dbConnectCmd`,
  `readConnectionURL`, and `writeConnect`; `cli/internal/api` adds
  `ConnectRequest` / `ConnectResponse` (wire shape) and `Client.Connect`.
  Tests in `cli/internal/cmd/db_connect_test.go` cover the happy path
  (body forwarding + confirmation + next-step), verbatim error
  passthrough, bad-engine rejection before any HTTP call, and a disk walk
  proving the URL never lands in the config/state tree.
- **Alternatives rejected:**
  - **URL as a positional arg** — lands the credential in shell history and
    process lists; `--url`/stdin/no-echo prompt is the secure default.
  - **A top-level `nlq connect` verb** — multiplies the verb surface
    against `GLOBAL-017`; connecting a database is `db`-group management.
  - **Caching the URL locally for reconnects** — it's a credential; the
    server owns it after registration, the CLI holds only the `dbId`.
- **Source:** canonical here · wire counterpart `POST /v1/db/connect` ·
  governed by `GLOBAL-002` / `GLOBAL-003` / `GLOBAL-012` / `GLOBAL-017`.
