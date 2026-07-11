---
name: cli
description: `nlq` command-line tool — verbs, OS-keychain credentials, device-flow auth.
when-to-load:
  globs:
    - cli/**
  topics: [cli, nlq, keychain, device-flow, mcp-install]
---

# Feature: Cli

**One-liner:** `nlq` command-line tool — verbs, OS-keychain credentials, device-flow auth.
**Status:** partial (Phase 2) — bootstrap PR landed:
- `cli/go.mod` + the goal-first data verbs: `ask`, `run`, `remember`, `new`, bare `nlq "<goal>"`, `db list`, `db create`, `db connect`, `query`, `use`, `whoami`, `logout`, `mcp detect`, `update`, `--json`, `--version`.
- Credential store (keychain + AES-GCM fallback with per-user salt) per `SK-CLI-009`.
- State (`SK-CLI-013`, file-locked load-mutate-save) + config (`SK-CLI-010`).
- Background update check (`SK-CLI-015`).
- MCP host detection (`SK-CLI-011` — the auto-detect half).

**Key-management verbs:** `nlq keys list` and `nlq keys revoke <id>` ship — backed by `GET /v1/keys` ([`SK-APIKEYS-010`](../api-keys/decisions/SK-APIKEYS-010-list-endpoint.md)) and `DELETE /v1/keys/:id` ([`SK-APIKEYS-011`](../api-keys/decisions/SK-APIKEYS-011-hard-revoke.md)).

**BYOLLM verbs:** `nlq byollm set|status|clear` ship ([`SK-CLI-016`](decisions/SK-CLI-016-byollm-keychain.md)) — store your own provider key in the keychain so `nlq ask` dispatches through it at 0% markup ([`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)). Signed-in only (the `x-nlq-byollm-key` lane, [`SK-LLM-021`](../llm-router/decisions/SK-LLM-021-byollm-header-wiring.md)); the CLI half of the `GLOBAL-003` surface-parity gap, SDK sibling of [`SK-SDK-010`](../sdk/decisions/SK-SDK-010-byollm-client-option.md).

**Raw-SQL escape hatch:** `nlq run [--db <id>] <sql>` ships — backed by `POST /v1/run` ([`SK-SDK-009`](../sdk/FEATURE.md), [`GLOBAL-015`](../../decisions/GLOBAL-015-power-user-escape-hatch.md)). Same allow-list as `/v1/ask` (SELECT / INSERT / UPDATE / DELETE / WITH / EXPLAIN / SHOW); DDL still rejected. SQL can ride positional args or stdin (`cat schema.sql | nlq run --db finance`). `--db` resolution mirrors `nlq ask`: explicit flag wins, else the active DB from `state.json`.

**Connect-an-engine verb:** `nlq db connect --engine <clickhouse|postgres> [--name <n>]` ships ([`SK-CLI-019`](decisions/SK-CLI-019-db-connect-verb.md)) — backed by `POST /v1/db/connect`, the CLI half of the `GLOBAL-003` surface-parity gap. Registers an existing hosted engine by its connection URL so `nlq ask` can query it. The URL is a credential: read via `--url`, stdin, or a no-echo interactive prompt (mirrors `SK-CLI-016`'s key handling), sent to the API, and **never** printed back or written to `config.toml` / `state.json` / the credstore. On 201 the returned `dbId` becomes the active DB and a one-line confirmation (`dbId`, engine, name, schema preview, `pkLive`) prints the next step. API errors surface the server `message` verbatim ([`GLOBAL-012`](../../decisions/GLOBAL-012-one-sentence-errors.md)).

**Agent-memory write verb:** `nlq remember [--db <id>] [--kind fact|episode|entity] <text>` ships — backed by `POST /v1/memory/remember` ([`SK-CLI-018`](decisions/SK-CLI-018-remember-verb.md), wire/SDK/MCP counterpart [`SK-PIVOT-008`](../agent-memory-pivot/FEATURE.md)). The CLI half of the `GLOBAL-003` parity gap the agent-memory E-02 worksheet tracked. Positional `<text>` is the row's primary content; `--kind` selects the table (default `fact`); `--type` (fact category / entity type), `--role` (episode), `--tag` (repeatable, fact), `--ttl 7d` (fact expiry), `--end-user` / `--thread` (scope). The target must be an `agent_memory_v1` preset DB or the call returns `wrong_preset`. **Third data verb** — admitted under `GLOBAL-017` because it mirrors an already-justified third *endpoint* (SK-PIVOT-008's typed-plan trust boundary forbids routing memory writes through `nlq run`).

Deferred to follow-up slices — gated on server endpoints that don't exist yet:
- `nlq login` device-flow (needs `POST /v1/auth/device` per `SK-AUTH-004`).
- `nlq mcp install` config-write (needs the device-flow session for `POST /v1/keys` to mint `sk_mcp_*`; the cobra command is wired to print the deferral hint). The wiring slice also fixes the config field key `zed.go` / `vscode.go` write: Zed reads `context_servers` and VS Code reads `servers`, not the `mcpServers` both writers emit today.
- `nlq chat` REPL (UX-only deferral; design intact).
- `nlq keys rotate <id>` (needs `POST /v1/keys/:id/rotate` per [`SK-APIKEYS-005`](../api-keys/decisions/SK-APIKEYS-005-rotation-grace.md)).

(`nlq connection <db>` was considered and dropped — see [`SK-CLI-020`](decisions/SK-CLI-020-connection-url-issue-once.md): the connection URL is issued once at create, never re-exposed on the read-scoped list.)
**Owners (code):** `cli/**`
**Cross-refs:** docs/architecture.md §3.3 (CLI surface) · §4.3 (session lifecycle, device-flow) · §14.3 (happy-path) · docs/architecture.md §3 (matrix) · docs/phase-plan.md (Phase 2 CLI slice) · `cli/AGENTS.md` · `cli/README.md`

## Touchpoints — read this feature before editing

- `cli/**` (the canonical source tree once Phase 2 starts)
- npm shim `@nlqdb/cli` (`packages/cli-shim/`) — postinstall downloads + verifies the matching Go binary from the GitHub Release pinned to the package's version, with `tar` extraction and sha256 verification against `checksums.txt`; workspace-aware (no-op inside the source monorepo)
- Homebrew tap `nlqdb/tap`
- `https://nlqdb.com/install` (curl-pipe-sh entry point — installer at `apps/web/public/install` resolves the latest `v*` GitHub Release, verifies sha256, lands the binary at `$NLQ_INSTALL_DIR` or `~/.local/bin/nlq`; falls back to build-from-source until the first `v*` tag is cut, per [SK-CLI-002](decisions/SK-CLI-002-distribution-channels.md))
- OS keychains via `zalando/go-keyring` (Keychain / libsecret / Credential Manager)
- AES-GCM fallback file at `~/.config/nlqdb/credentials.enc` (machine-keyed)
- Non-secret prefs at `~/.config/nlqdb/config.toml`
- Mutating state (active DB, update-check timestamp) at `~/.config/nlqdb/state.json`

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-CLI-NNN`. The list below is the index; open the linked file for the full five-field block.

- [**SK-CLI-001**](decisions/SK-CLI-001-static-go-binary.md) — Single static Go binary; 3-char name `nlq`; no PATH collision.
- [**SK-CLI-002**](decisions/SK-CLI-002-distribution-channels.md) — Distribution: curl-pipe-sh primary, Homebrew tap, npm shim.
- [**SK-CLI-003**](decisions/SK-CLI-003-subcommand-verbs.md) — Subcommand-first verbs; two canonical data operations (`ask` + `run`).
- [**SK-CLI-004**](decisions/SK-CLI-004-human-output-default.md) — Human output by default; `--json` for scripts; never TTY-detect.
- [**SK-CLI-005**](decisions/SK-CLI-005-anonymous-first.md) — Anonymous-first: bare queries work before any sign-in.
- [**SK-CLI-006**](decisions/SK-CLI-006-device-flow-login.md) — `nlq login` uses OAuth 2.0 Device Authorization Grant with `verification_uri_complete`.
- [**SK-CLI-007**](decisions/SK-CLI-007-silent-refresh.md) — Silent refresh: 401 → refresh → retry once; refresh fail → re-run device flow in place.
- [**SK-CLI-008**](decisions/SK-CLI-008-ci-api-key-precedence.md) — CI mode: `NLQDB_API_KEY` takes precedence; no keychain attempted.
- [**SK-CLI-009**](decisions/SK-CLI-009-credential-storage.md) — Credential storage: `zalando/go-keyring` primary, machine-keyed AES-GCM fallback.
- [**SK-CLI-010**](decisions/SK-CLI-010-prefs-vs-secrets.md) — Stable prefs in `config.toml`; mutating state in `state.json`; secrets in keychain.
- [**SK-CLI-011**](decisions/SK-CLI-011-mcp-install-autodetect.md) — `nlq mcp install` auto-detects hosts; explicit `<host>` is the override.
- [**SK-CLI-012**](decisions/SK-CLI-012-bare-form-active-db.md) — Bare `nlq "<goal>"` mints from goal when no active DB; reuses the active DB otherwise.
- [**SK-CLI-013**](decisions/SK-CLI-013-active-db-state.md) — Active DB in `~/.config/nlqdb/state.json`; no `nlq init` and no project-level config in v1.
- [**SK-CLI-014**](decisions/SK-CLI-014-no-client-telemetry.md) — No client-side telemetry pipeline; events ride the SDK's API calls.
- [**SK-CLI-015**](decisions/SK-CLI-015-update-check.md) — Background update check ≤ once/day; stderr only; auto-off in CI; explicit `nlq update` for curl-installed binaries.
- [**SK-CLI-016**](decisions/SK-CLI-016-byollm-keychain.md) — `nlq byollm set|status|clear` stores the BYOLLM key in the keychain; `nlq ask` rides it signed-in only (SDK sibling of `SK-SDK-010`).
- [**SK-CLI-017**](decisions/SK-CLI-017-run-dry-run.md) — `nlq run --dry-run` previews raw writes (reusing the `/v1/ask` diff) without executing; default `nlq run` stays immediate (`GLOBAL-015`). Wire/server/SDK counterpart of `SK-SDK-012`.
- [**SK-CLI-018**](decisions/SK-CLI-018-remember-verb.md) — `nlq remember` is the CLI's third data verb (positional `<text>` is the row content, `--kind` selects the table), mirroring the already-justified `/v1/memory/remember` endpoint (`SK-PIVOT-008`) for `GLOBAL-003` parity; the third-verb justification `GLOBAL-017` requires.
- [**SK-CLI-019**](decisions/SK-CLI-019-db-connect-verb.md) — `nlq db connect --engine …` registers an existing engine by its connection URL; the URL is read without echo and never printed back or persisted.
- [**SK-CLI-020**](decisions/SK-CLI-020-connection-url-issue-once.md) — the hosted connection URL is issued once at create and never returned on `GET /v1/databases`; a `nlq connection <db>` re-print verb is not built (re-obtain via rotation).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-001** — SDK is the only HTTP client.
  - *In this feature:* the Go CLI cannot import the TypeScript `@nlqdb/sdk`, so it consumes `cli/internal/api/` — the Go port of the same wire contract (same auth modes, retry budget, idempotency-key reuse, error envelopes). All HTTP calls from `cli/` route through that one package; no other file opens connections.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
  - *In this feature:* `nlq remember` ([`SK-CLI-018`](decisions/SK-CLI-018-remember-verb.md)) is a **third** data verb, admitted under GLOBAL-017's "explicit justification" clause: it mirrors the already-justified third *endpoint* `/v1/memory/remember` (SK-PIVOT-008 — memory writes can't ride `nlq run`'s raw-SQL hatch without breaking the typed-plan trust boundary), so it's parity for an existing operation, not a new one.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.
- **GLOBAL-023** — Trust UX baseline.
  - *In this feature:* `nlq` prints the diff in TTY mode and as a JSON field in `--json` mode (per `SK-TRUST-001`); every `nlq ask` response prints the compiled SQL under a `─ trace ─` separator (per `SK-TRUST-002`); `low_confidence` refusals offer arrow-key disambiguation (per `SK-TRUST-003`). See [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md).
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* a bare-form `nlq "..."` invocation that hits an unknown verb (post-CLI ship) emits `feature.requested.unknown_cli_verb` via the SDK's event sink.

## Open questions / known unknowns

- **Device-flow server endpoints.** `nlq login` / `nlq logout` / `nlq mcp install` are stubbed (return a "ships in the next slice" error) until `POST /v1/auth/device` + `POST /v1/auth/device/token` land per `SK-AUTH-004`. The credential storage layer is already in place — the missing piece is the wire endpoints. The CLI's `auth.Resolve` already returns `KindSignedIn` when a refresh token exists in the keychain, so the rollout is "land the endpoints, wire the device-flow polling loop, done."
- **`nlq chat` REPL.** A separate slice; intentionally deferred because the typed-line UX is non-trivial and the bootstrap focuses on the goal-first single-command path.
- **`nlq keys rotate`.** `list` + `revoke` ship. Rotation needs `POST /v1/keys/:id/rotate` plus the 60-day grace + webhook + events-pipeline rotation event per [`SK-APIKEYS-005`](../api-keys/decisions/SK-APIKEYS-005-rotation-grace.md). Lands as one slice with those.
- **`nlq connection <db>` for hosted Postgres — Resolved ([`SK-CLI-020`](decisions/SK-CLI-020-connection-url-issue-once.md)): dropped.** The proposed unblock ("one API field on `GET /v1/databases`") is a security regression — that list endpoint is reached by read-only `pk_live_` embed keys and the MCP list tool, so it would leak the live DB credential to the least-privileged scope (against `SK-APIKEYS-003`/`SK-CLI-019`), and `GLOBAL-031` seals the URL at rest (the row holds only a `connection_secret_ref`, no plaintext to return). The connection URL is issued once on the create response; a lost URL is re-obtained via rotation (`SK-APIKEYS-005`), not a re-read verb.
- **`nlq new --preset agent_memory_v1`.** `nlq remember` (SK-CLI-018) writes to a memory-preset DB, but `nlq new` routes through `/v1/ask`'s create branch, not the preset endpoint (`POST /v1/databases { preset }`, behind the `MEMORY_PRESET` flag — E-01/SK-HDC-020). Until the CLI calls that endpoint, a memory DB is created via the SDK/MCP `db.create` preset. The unblock is one API client call + a `--preset` flag; the natural companion slice to `remember`.
- **Windows experience.** The bootstrap PR cross-compiled to windows/amd64 and the binary builds, but Windows shell quirks (cmd, PowerShell), the Credential Manager backend, and `~/.config` semantics under `APPDATA` need a manual round-trip on real hardware. Per-platform quirks land in `cli/AGENTS.md` once they're observed.
- **`nlq mcp install` for hosts not yet covered by SK-CLI-011 — Resolved (2026-07-10): the add-a-host recipe ships.** It lives in `cli/AGENTS.md` § Local rules ("Adding a new MCP host") — one file implementing `Host`, a `Registry()` append (registry order = the `SK-CLI-011` prompt order), a round-trip config test; shared helpers (`writeMcpServersField`, `detectByDirExists`, `appSupport`) cover the standard `mcpServers` shape, so a new host is a follow-the-recipe runbook task, not a design question. Verified against `cli/internal/mcphosts/` (six hosts, one file each, all on the shared helpers).

## Happy path walkthrough

User-facing CLI flows (anonymous-first invocation, `nlq login` adoption,
day-2 ops, power-user explicit form) live on the docs site so they stay
in lockstep with the binary's actual output:

- [`docs.nlqdb.com/cli/`](https://docs.nlqdb.com/cli/) — auto-generated reference for every verb / flag (`SK-DOCS-003` slice c).
- [`docs.nlqdb.com/tutorials/cli/`](https://docs.nlqdb.com/tutorials/cli/) — tutorial sourced from `examples/cli/README.md`.

Jordan-the-Agent-Builder persona narrative (MCP install → memory DB →
deploy on Modal) lives in [`docs/research/personas.md`](../../research/personas.md)
alongside the other Phase 1 personas; it informs CLI decisions but is
research context, not a user how-to.
