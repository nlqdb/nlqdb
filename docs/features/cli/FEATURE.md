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
- `cli/go.mod` + the goal-first data verbs: `ask`, `new`, bare `nlq "<goal>"`, `db list`, `db create`, `query`, `use`, `whoami`, `logout`, `mcp detect`, `update`, `--json`, `--version`.
- Credential store (keychain + AES-GCM fallback with per-user salt) per `SK-CLI-009`.
- State (`SK-CLI-013`, file-locked load-mutate-save) + config (`SK-CLI-010`).
- Background update check (`SK-CLI-015`).
- MCP host detection (`SK-CLI-011` — the auto-detect half).

**Key-management verbs:** `nlq keys list` and `nlq keys revoke <id>` ship — backed by `GET /v1/keys` ([`SK-APIKEYS-010`](../api-keys/decisions/SK-APIKEYS-010-list-endpoint.md)) and `DELETE /v1/keys/:id` ([`SK-APIKEYS-011`](../api-keys/decisions/SK-APIKEYS-011-hard-revoke.md)).

**Raw-SQL escape hatch:** `nlq run [--db <id>] <sql>` ships — backed by `POST /v1/run` ([`SK-SDK-009`](../sdk/FEATURE.md), [`GLOBAL-015`](../../decisions/GLOBAL-015-power-user-escape-hatch.md)). Same allow-list as `/v1/ask` (SELECT / INSERT / UPDATE / DELETE / WITH / EXPLAIN / SHOW); DDL still rejected. SQL can ride positional args or stdin (`cat schema.sql | nlq run --db finance`). `--db` resolution mirrors `nlq ask`: explicit flag wins, else the active DB from `state.json`.

Deferred to follow-up slices — gated on server endpoints that don't exist yet:
- `nlq login` device-flow (needs `POST /v1/auth/device` per `SK-AUTH-004`).
- `nlq mcp install` config-write (needs the device-flow session for `POST /v1/keys` to mint `sk_mcp_*`; the cobra command is wired to print the deferral hint).
- `nlq chat` REPL (UX-only deferral; design intact).
- `nlq keys rotate <id>` (needs `POST /v1/keys/:id/rotate` per [`SK-APIKEYS-005`](../api-keys/decisions/SK-APIKEYS-005-rotation-grace.md)).
- `nlq connection <db>` (needs API to expose `connection_url` on `GET /v1/databases` rows).
**Owners (code):** `cli/**`
**Cross-refs:** docs/architecture.md §3.3 (CLI surface) · §4.3 (session lifecycle, device-flow) · §14.3 (happy-path) · docs/architecture.md §3 (matrix) · docs/phase-plan.md (Phase 2 CLI slice) · `cli/AGENTS.md` · `cli/README.md`

## Touchpoints — read this feature before editing

- `cli/**` (the canonical source tree once Phase 2 starts)
- npm shim `@nlqdb/cli` distribution
- Homebrew tap `nlqdb/tap`
- `https://nlqdb.com/install` (curl-pipe-sh entry point)
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

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-001** — SDK is the only HTTP client.
  - *In this feature:* the Go CLI cannot import the TypeScript `@nlqdb/sdk`, so it consumes `cli/internal/api/` — the Go port of the same wire contract (same auth modes, retry budget, idempotency-key reuse, error envelopes). All HTTP calls from `cli/` route through that one package; no other file opens connections.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.
- **GLOBAL-023** — Trust UX baseline.
  - *In this feature:* `nlq` prints the diff in TTY mode and as a JSON field in `--json` mode (per `SK-TRUST-001`); every `nlq ask` response prints the compiled SQL under a `─ trace ─` separator (per `SK-TRUST-002`); `low_confidence` refusals offer arrow-key disambiguation (per `SK-TRUST-003`). See [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md).
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* a bare-form `nlq "..."` invocation that hits an unknown verb (post-CLI ship) emits `feature.requested.unknown_cli_verb` via the SDK's event sink.

## Open questions / known unknowns

- **Device-flow server endpoints.** `nlq login` / `nlq logout` / `nlq mcp install` are stubbed (return a "ships in the next slice" error) until `POST /v1/auth/device` + `POST /v1/auth/device/token` land per `SK-AUTH-004`. The credential storage layer is already in place — the missing piece is the wire endpoints. The CLI's `auth.Resolve` already returns `KindSignedIn` when a refresh token exists in the keychain, so the rollout is "land the endpoints, wire the device-flow polling loop, done."
- ~~**`nlq run` (raw SQL escape hatch).**~~ Shipped — `POST /v1/run` lives in `apps/api/src/run/orchestrate.ts`; the CLI verb in `cli/internal/cmd/run.go`; the TS SDK's `client.runSql()` in `packages/sdk/src/index.ts`. All three landed in one slice per `GLOBAL-002` / `GLOBAL-003`.
- **`nlq chat` REPL.** A separate slice; intentionally deferred because the typed-line UX is non-trivial and the bootstrap focuses on the goal-first single-command path.
- **`nlq keys rotate`.** `list` + `revoke` ship. Rotation needs `POST /v1/keys/:id/rotate` plus the 60-day grace + webhook + events-pipeline rotation event per [`SK-APIKEYS-005`](../api-keys/decisions/SK-APIKEYS-005-rotation-grace.md). Lands as one slice with those.
- **`nlq connection <db>` for hosted Postgres.** Wants a raw `postgres://…` URL on `GET /v1/databases` rows. Today the SDK returns it on the create response only. The unblock is one API field; the CLI verb is one cobra command.
- **Windows experience.** The bootstrap PR cross-compiled to windows/amd64 and the binary builds, but Windows shell quirks (cmd, PowerShell), the Credential Manager backend, and `~/.config` semantics under `APPDATA` need a manual round-trip on real hardware. Per-platform quirks land in `cli/AGENTS.md` once they're observed.
- **`nlq mcp install` for hosts not yet covered by SK-CLI-011.** New MCP hosts emerge regularly. Add-a-host recipe in `cli/AGENTS.md` so the supported list grows without re-architecting `cli/internal/mcphosts/` — runbook concern, not a design decision.

## Happy path walkthrough

### §14.3 CLI (`nlq`)

**Default path** (one line, no setup, no sign-in until you want it):

```bash
$ nlq new "an orders tracker"
✓ Ready. Try: nlq "add an order: alice, latte, $5.50, just now"
ℹ Saved as anonymous. Run `nlq login` within 72h to keep it.

$ nlq "add an order: alice, latte, $5.50, just now"
✓ Added. orders-tracker-a4f now has 1 row.
```

That's it. The DB exists. There is no `nlq db create` step the user had to know about.

**Adopting the anonymous DB** (seamless):

```bash
$ nlq login
→ Opening browser to approve this device… (fallback code: ABCD-1234)
✓ Signed in as maya@example.com. Adopted 1 anonymous DB: orders-tracker-a4f.
```

The browser lands on a single "Approve this device?" screen with the code already pre-filled in the URL — one click, no typing. The refresh token is written to the macOS Keychain (or libsecret / Credential Manager on other OSes). Every subsequent call silently refreshes the access token as needed.

**Day-2 ops** (still one line each):

```bash
$ nlq "how many orders today, by drink"
latte    ████████████  12
flat-white ██████      6
mocha    ██            2

$ nlq "export today's orders as csv > today.csv"
✓ Wrote 20 rows to today.csv
```

**Power-user path** (explicit, when the user cares):

```bash
$ nlq db create finance --engine postgres --region us-east
$ nlq query finance "monthly revenue last 12 months"
$ nlq connection finance     # raw Postgres URL — drop into your own app
```

### §15.2 Persona walkthrough — Jordan, the Agent Builder

**Goal:** ship a research-agent that remembers things between sessions.

| Step | Jordan does | nlqdb does |
|---|---|---|
| 1 | On his laptop: runs `nlq mcp install`. The CLI auto-detects Claude Desktop + Cursor, opens the browser, he clicks Approve once. | Signs him in, mints a scoped MCP key per host, patches both configs, prompts him to restart Claude Desktop. |
| 2 | In the agent's system prompt: *"You have a tool `nlqdb_query`. Call it with a `db` and a `q` in plain English. The `db` can be any string — it'll be created if new."* | — |
| 3 | Agent runs first session. `nlqdb_query("research-memory", "remember: the user is researching solar panels in Berlin")` | DB `research-memory-...` materialized, row inserted |
| 4 | Agent ends session, reopens hours later: `nlqdb_query("research-memory", "what do I know about the user's research topic?")` | Returns the stored fact |
| 5 | Jordan watches the platform: clicks `research-memory`, sees every query the agent ran today | Trace + query log |
| 6 | Deploys the agent on Modal. Sets `NLQDB_API_KEY` as a Modal secret — the one env var he touches. | Agent uses the `sk_live_` key; Modal's env-var flow stays idiomatic. |

**What Jordan never wrote:** a vector-store glue layer, a schema for memory, a session-lifecycle service, a per-agent provisioning script.
