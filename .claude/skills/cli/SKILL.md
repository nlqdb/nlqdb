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
**Status:** planned (Phase 2) — design locked in DESIGN §3.3 / §4.3 / §14.3; no Go code yet (no `go.mod`; CI's `lint-go` job conditionally skips)
**Owners (code):** `cli/**`
**Cross-refs:** docs/design.md §3.3 (CLI surface) · §4.3 (session lifecycle, device-flow) · §14.3 (happy-path) · docs/surfaces.md (matrix) · docs/implementation.md §5 (Phase 2 CLI slice) · `cli/AGENTS.md` · `cli/README.md`

## Touchpoints — read this skill before editing

- `cli/**` (the canonical source tree once Phase 2 starts)
- npm shim `@nlqdb/cli` distribution
- Homebrew tap `nlqdb/tap`
- `https://nlqdb.com/install` (curl-pipe-sh entry point)
- OS keychains via `zalando/go-keyring` (Keychain / libsecret / Credential Manager)
- AES-GCM fallback file at `~/.config/nlqdb/credentials.enc` (machine-keyed)
- Non-secret prefs at `~/.config/nlqdb/config.toml`

## Decisions

### SK-CLI-001 — Single static Go binary; 3-char name `nlq`; no PATH collision

- **Decision:** The CLI is a single static Go binary named `nlq`. The npm scope `@nlqdb/*` is owned and the binary name `nlq` and npm name `nlqdb` are both reserved so we can ship under either without forcing a fork.
- **Core value:** Effortless UX, Fast, Goal-first
- **Why:** A 3-char name is what gets typed twenty times a day. Static Go means zero runtime deps — copy the binary, run it. The performance budget is `binary < 8 MB, starts in < 30 ms, first byte < 200 ms on cache hit` (DESIGN §0 "Fast"); achieving that in Node or Python introduces enough start-up latency to break the cache-hit promise. PATH-collision-free is the boring win — every user already has `nlq` available without aliasing.
- **Consequence in code:** The binary entrypoint lives in `cli/cmd/nlq/main.go` (path TBC at slice start). Bundle size is checked in CI; binaries beyond 8 MB fail the build. No system-wide config that requires sudo to install. `go.mod` lives at the `cli/` root.
- **Alternatives rejected:**
  - Node CLI — start-up cost (~150 ms even for "Hello world") blows the cold first-byte budget.
  - Rust CLI — comparable performance to Go but slower compile-edit cycle and steeper hire bar at our team size.
  - Python — `pip install` is heavier than `curl | sh`; cross-platform packaging is harder.

### SK-CLI-002 — Distribution: curl-pipe-sh primary, Homebrew tap, npm shim

- **Decision:** Three install paths, in priority order: (1) `curl -fsSL https://nlqdb.com/install | sh` → `~/.local/bin/nlq`, (2) `brew install nlqdb/tap/nlq`, (3) `npm i -g @nlqdb/cli` (Node shim that downloads the right Go binary). All three resolve to the same binary version pinned per release.
- **Core value:** Free, Effortless UX, Open source
- **Why:** Curl-pipe-sh is the lowest-friction install for the Phase 2 developer audience — we control the install script and can sign for tamper detection. Homebrew is the Mac-default for many devs and gives version pinning + uninstall for free. The npm shim closes the loop for teams whose toolchain is "if it's not on npm, it's not happening" — and reuses the same Go binary we already build.
- **Consequence in code:** The release pipeline (DESIGN §13.4) builds a Go binary per (OS, arch) and publishes (a) signed tarballs to a CDN behind `nlqdb.com/install`, (b) a Homebrew formula in the `nlqdb/tap` repo, (c) an `@nlqdb/cli` package whose `postinstall` fetches the right binary. Installer signing keys are documented in `docs/runbook.md`. The npm shim must NOT contain Go source — only download logic.
- **Alternatives rejected:**
  - Single-channel install (only curl-pipe-sh) — closes the door on devs who can't run shell scripts in their environment (e.g. corporate Windows).
  - Cross-compile via npm install (build Go on user's machine) — Go toolchain is not a reliable assumption on user hardware.

### SK-CLI-003 — Subcommand-first verbs (`nlq <noun> <verb>`); two canonical operations on data

- **Decision:** Verb shape follows `gh` / `fly` / `wrangler`: subcommand-first, `nlq <noun> <verb>` for power-user ops. The two canonical *data* operations are `nlq ask` (NL query) and `nlq run` (raw query). All other verbs (`new`, `chat`, `db create|list`, `query`, `login`, `logout`, `whoami`, `keys list|rotate|revoke`, `mcp install`, `init`, `connection`, `use`, `export`) are helpers — they don't introduce additional ways to do `ask` or `run`.
- **Core value:** Simple, Effortless UX
- **Why:** `GLOBAL-017` is the load-bearing rule here: two endpoints, two CLI verbs, one chat box, one way to do each thing. `nlq new` and bare `nlq "..."` are conveniences over the same ask path; they don't fork the pipeline. Subcommand-first matches the developer audience's mental model from `gh` and `wrangler`, so muscle memory transfers.
- **Consequence in code:** A new conceptual operation gets explicitly justified in PR review against `GLOBAL-017`. Reviewers reject aliases like `nlq query == nlq ask`. Helpers (`init`, `keys`, `login`) are scaffolding; the data path is `ask` + `run`. Bare `nlq "<goal>"` is sugar for `nlq ask "<goal>"`; `nlq new "<goal>"` is sugar for "create-or-resolve a DB from goal, then `ask`".
- **Alternatives rejected:**
  - REST-style verb explosion (`nlq queries new`, `nlq runs list`) — adds surface, harms learnability, contradicts `GLOBAL-017`.
  - Single bare-form invocation only (`nlq "..."`) — power-user paths need named verbs for scriptability and discoverability via `--help`.

### SK-CLI-004 — Human output by default; `--json` for scripts; never TTY-detect

- **Decision:** Every CLI command emits human-formatted output by default and machine-parseable JSON only when the user passes `--json`. The CLI does **not** sniff `isatty(stdout)` to switch modes. Errors, success messages, traces, and tables follow the default human format unless `--json` is set.
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** TTY-sniffing is convenient until it isn't — piping `nlq ask` into `tee` silently changes the output format and breaks scripts that worked yesterday. Explicit `--json` is one extra flag that produces stable behaviour under pipes, redirects, CI logs, and `xargs`. Humans see colour and tables; scripts see JSON. The behaviour is the same in both directions.
- **Consequence in code:** The CLI's output layer takes a `format` parameter that defaults to `"human"` and is set to `"json"` by `--json`. Any code path that calls `os.Stdout.IsTerminal()` for output decisions fails review. The trace renderer for `GLOBAL-011` (live trace) emits the same step events in both modes — JSON gets one line per step, human gets the prettified TTY output.
- **Alternatives rejected:**
  - TTY-sniff for default — silent format flips under pipes; user-reported bug surface.
  - JSON by default — better for scripts, terrible for the bare `nlq "..."` interactive path that's the activation moment.

### SK-CLI-005 — Anonymous-first: bare queries work before any sign-in

- **Decision:** `nlq new "..."` and bare `nlq "..."` mint an anonymous device token (72h window per `docs/design.md §4.1`) and immediately produce a working answer. The token is written to the OS keychain. `nlq login` runs the device-code flow only when the user wants to keep their work past 72h.
- **Core value:** Goal-first, Effortless UX, Free, Seamless auth
- **Why:** The activation moment is the user typing a goal and getting an answer. A login wall before the first answer flips the moment from "wow" to "homework". The 72h window is the explicit agreement: long enough to demo the value, short enough that we're not running an unbounded anonymous storage tier. This is the CLI manifestation of `GLOBAL-007` and `GLOBAL-020`.
- **Consequence in code:** The first invocation of any data verb mints the anonymous token via `POST /v1/auth/anonymous` (or whatever the slice settles on) and stores it in the keychain. Subsequent calls reuse it. On `nlq login`, anonymous DBs are adopted by updating one row server-side (`docs/design.md §4.1`); no client-side migration. **CI mode skips this entirely** — see SK-CLI-008.
- **Alternatives rejected:**
  - Force `nlq login` before first use — measurably worse for activation; contradicts `GLOBAL-007`.
  - Anonymous tokens in a flat config file, not the keychain — leaks via cloud backups + dotfile syncs; contradicts `GLOBAL-010`.

### SK-CLI-006 — `nlq login` uses OAuth 2.0 Device Authorization Grant with `verification_uri_complete`

- **Decision:** `nlq login` runs the OAuth 2.0 Device Authorization Grant. The browser lands on `verification_uri_complete` with the code pre-filled in the URL — one "Approve this device?" click, no typing. The raw user_code is printed as a fallback for SSH / headless / `--no-browser` cases. On approval: anonymous DBs are adopted; refresh token (90d, rotated on every use) writes to OS keychain; access token (1h, JWT) stays in memory.
- **Core value:** Seamless auth, Effortless UX, Bullet-proof
- **Why:** Device-code with `verification_uri_complete` is the lowest-friction sign-in for a CLI — no copy-paste of codes, no port-binding callback (which fails on remote SSH and behind firewalls), and the code is visible in the browser URL so the human verifies they're approving the right device. 90d refresh + 1h access matches `docs/design.md §4.3` exactly so refresh logic is shared with `packages/sdk` (`GLOBAL-001`).
- **Consequence in code:** The login flow POSTs `/v1/auth/device`, opens `verification_uri_complete` (or prints it on `--no-browser`), polls `/v1/auth/device/token`, writes the refresh token to keychain on success. Refresh token rotation is mandatory — every refresh issues a new refresh token; the old one is revoked. Tests cover the SSH-no-browser path and the firewall-blocks-localhost path.
- **Alternatives rejected:**
  - localhost-callback OAuth — fails on SSH / headless; brittle behind firewalls.
  - Long-lived bearer tokens with no refresh — would force re-login on expiry; breaks the seamless-auth value.
  - Username/password — banned by `docs/design.md §4.1` ("No passwords, ever").

### SK-CLI-007 — Silent refresh: 401 → refresh → retry once; refresh fail → re-run device flow in place

- **Decision:** On any 401 response, the CLI's HTTP layer (via `packages/sdk`) silently calls `POST /v1/auth/refresh`, retries the original call once, and proceeds. If the refresh itself fails (refresh token revoked or expired), the CLI re-runs the device flow in the same shell, then resumes the original command. The user **never** sees a bare 401 or "session expired" message.
- **Core value:** Seamless auth, Effortless UX, Bullet-proof
- **Why:** A user-visible 401 is a regression — the refresh path is supposed to be reliable enough that auth-expiry never breaks a long-running CLI session. This is the CLI manifestation of `GLOBAL-009`. Re-running device flow in place (rather than failing the command) preserves the user's intent: they wanted an answer, not to be told their session expired.
- **Consequence in code:** This logic lives once in `packages/sdk` (per `GLOBAL-001`); `cli/` consumes it without re-implementing. The `Once` semantics matter — recursive 401-on-refresh-retry is a bug, not a feature. The re-auth path prints a single `→ Re-authenticating…` line and resumes. Tests cover (a) 401-then-200-after-refresh, (b) 401-on-refresh-then-device-flow.
- **Alternatives rejected:**
  - Force re-login on expiry — kills long-running CLI / agent sessions.
  - Aggressive proactive refresh on every call — wastes the auth server's budget.

### SK-CLI-008 — CI mode: `NLQDB_API_KEY` takes precedence, no keychain access attempted

- **Decision:** When `NLQDB_API_KEY` is set in the environment, the CLI uses it directly as the bearer token, skips `nlq login`, and does not attempt any keychain access. This is the CI / Docker / air-gapped escape hatch — explicit, auditable, single env var. No config-file fallback. No `~/.nlqdb/credentials.json`.
- **Core value:** Seamless auth, Bullet-proof, Free
- **Why:** Headless environments don't have a keychain. A keychain-attempt that gracefully degrades to a config file becomes the default in CI, leaking credentials into shell history and `ps` output. Making the env-var path explicit (and the only headless path) keeps the config-file leak vector closed by construction. This is the CLI manifestation of `GLOBAL-010`.
- **Consequence in code:** The credential resolver checks `NLQDB_API_KEY` first; if set, it returns immediately and the rest of the auth flow (keychain read, device flow) is bypassed. Keychain backends are only invoked when `NLQDB_API_KEY` is unset. CI documentation (`docs/runbook.md`) names `NLQDB_API_KEY` explicitly. Reviewers reject any `~/.nlqdb/*` credential file fallback.
- **Alternatives rejected:**
  - Plain config-file storage in `~/.nlqdb/credentials.json` — leaks via cloud backups / dotfile syncs (forbidden by `GLOBAL-010`).
  - Required env vars (no keychain on local laptops) — bad UX for the developer-laptop default.

### SK-CLI-009 — Credential storage: `zalando/go-keyring` primary, machine-keyed AES-GCM fallback file

- **Decision:** Long-lived credentials (CLI refresh tokens, MCP host keys) live in the OS keychain via `zalando/go-keyring`: Keychain (macOS), libsecret (Linux), Credential Manager (Windows). When the keychain is unavailable (some Linux distros without libsecret), the fallback is an AES-GCM-encrypted file at `~/.config/nlqdb/credentials.enc`, keyed to the machine, with a one-line warning printed at write time. **Plaintext is never an option.**
- **Core value:** Bullet-proof, Seamless auth
- **Why:** Keychain storage means credentials survive reboots, are encrypted at rest by the OS, and don't leak into shell history / `ps` output / env-dump screenshots. The AES-GCM fallback covers headless Linux without sacrificing encryption-at-rest; the machine-key derivation means a backup of `credentials.enc` to a different host is useless. This is the CLI manifestation of `GLOBAL-010`.
- **Consequence in code:** `cli/internal/credstore/` (path TBC) wraps `zalando/go-keyring` with the AES-GCM fallback. Keys are derived from a stable machine identifier (`/etc/machine-id` on Linux, `IOPlatformUUID` on macOS, registry GUID on Windows). The fallback path emits a single-line warning the first time it's written. No code path writes `credentials` to a plaintext file.
- **Alternatives rejected:**
  - Plaintext `~/.nlqdb/credentials.json` — leaks via cloud backups / dotfile syncs.
  - GPG-encrypted file with a user passphrase — adds a passphrase prompt to every `nlq` invocation; fails the latency budget.

### SK-CLI-010 — Non-secret prefs in `~/.config/nlqdb/config.toml`; secrets never live in config

- **Decision:** User preferences (default DB, default output format, telemetry opt-out) live in `~/.config/nlqdb/config.toml`. Secrets — refresh tokens, API keys, anonymous device tokens — never live in config files. The two stores are completely separate.
- **Core value:** Simple, Bullet-proof
- **Why:** Mixing secrets and preferences in a single file makes "share my config" a credential leak. Splitting them gives users a config they can commit to dotfiles repos / share in screenshots without leaking. The XDG path is the unsurprising location for non-secret prefs on every platform.
- **Consequence in code:** Two separate readers in the CLI: one for `config.toml` (preferences), one for keychain/env (secrets). Reviewers reject any preference key that reads a token. The `init` verb writes `config.toml`; it never writes secrets.
- **Alternatives rejected:**
  - Single `~/.nlqdb/config.json` with both prefs and tokens — credential leak vector.
  - Environment variables for prefs — clutters `env`; doesn't survive reboots without shell-rc gymnastics.

### SK-CLI-011 — `nlq mcp install` auto-detects hosts; explicit `<host>` is the override

- **Decision:** `nlq mcp install` (no arg) scans known host configs for Claude Desktop, Cursor, Zed, Windsurf, VS Code, Continue. One host found → silent install. Multiple → numbered prompt (or `--all`). None → prints install links. Explicit `nlq mcp install <host>` targets the named host even if not detected. The CLI mints `sk_mcp_<host>_<device>_…` keys via `POST /v1/keys` and writes them straight into the host's config (never displayed). Self-check via `nlqdb_list_databases()` confirms wiring.
- **Core value:** Seamless auth, Effortless UX, Goal-first
- **Why:** MCP setup today across hosts is a JSON-config minigame; auto-detect collapses it to one command. Per-host keys (`sk_mcp_<host>_<device>_…`) keep credentials siloed — see `.claude/skills/api-keys/SKILL.md` for the rotation/revocation surface. Never displaying the key prevents copy-into-screenshot leaks; the self-check catches partial wires before the user notices.
- **Consequence in code:** Each host has a detector + writer in `cli/internal/mcphosts/`. Hot-reloading hosts (Cursor / Zed / Windsurf) pick up the change in seconds; Claude Desktop gets a restart prompt. Adding a new host = new file in `mcphosts/`, no changes elsewhere. CI test: each host's writer round-trips a config file without touching unrelated keys.
- **Alternatives rejected:**
  - Print JSON for the user to paste — high error rate; defeats the seamless-auth value.
  - One key shared across all hosts — single revocation kills every host; per-host keys are surgical.

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-001** — SDK is the only HTTP client.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.

## Open questions / known unknowns

- **No Go code yet.** `cli/` has only `AGENTS.md` + `README.md`; CI's `lint-go` job conditionally skips while `go.mod` is absent. Phase 2 slice will land the binary; until then every `SK-CLI-*` decision is design-locked but unimplemented. Reviewers must surface any conflict with these decisions when the slice opens.
- **Bare-form vs `ask` verb sugar.** Bare `nlq "<goal>"` is sugar for `nlq ask`; `nlq new "<goal>"` adds the create-or-resolve step. Decide the precise sugar resolution (does bare `nlq "<goal>"` create on first call, or fail with "no DB selected"?) before the slice opens. Today, DESIGN §14.3 implies create-on-first-bare-call but the SK-CLI-005 anonymous flow is loose on this.
- **`nlq init` semantics.** DISPATCH §14 lists `init` in the verb surface but DESIGN §3.3 doesn't show it. Decide whether `init` writes a per-project `.nlqdb/config.toml` (project-level prefs) or a global one. Per `GLOBAL-020` and `SK-CLI-010`, the former is more consistent — but it's not yet a committed decision.
- **Telemetry opt-out flag.** OTel spans on the CLI side are valuable for the trace UX (`GLOBAL-011`) but raise a "what does the CLI send home?" question. Decide on a default-on-with-opt-out via `~/.config/nlqdb/config.toml` and document the wire format before the slice ships.
- **Update flow.** No decision on how the CLI self-updates. Options: silent on next-call, prompt-on-stale, manual `nlq update`. Pick one before the binary ships so the channel is set in stone.
- **Windows experience.** All design decisions reference Keychain / libsecret / Credential Manager symmetrically, but Windows shells (cmd, PowerShell) and PATH semantics differ enough to warrant explicit testing. Capture per-platform quirks in `cli/AGENTS.md` once the binary lands.
- **`nlq mcp install` for hosts not yet in DESIGN §3.4 / SK-CLI-011.** New MCP hosts emerge regularly. Document the "add a host" recipe in `cli/AGENTS.md` so the supported list grows without re-architecting `mcphosts/`.
