---
name: mcp-server
description: MCP server + `nlq mcp install` host detection (Claude Desktop, Cursor, etc.).
when-to-load:
  globs:
    - packages/mcp/**
    - cli/src/mcp/**
  topics: [mcp, host-detection, claude-desktop, cursor]
---

# Feature: Mcp Server

**One-liner:** MCP server + `nlq mcp install` host detection (Claude Desktop, Cursor, etc.).
**Status:** implemented (Phase 2)
**Owners (code):** `packages/mcp/**`, `cli/src/mcp/**`
**Cross-refs:** docs/design.md §3.4 (MCP server) · docs/design.md §14.4 (MCP happy path) · docs/surfaces.md (MCP server row) · docs/implementation.md §5 (Phase 2 mcp slice)

## Touchpoints — read this skill before editing

- `packages/mcp/**`
- `cli/src/mcp/**`

## Decisions

### SK-MCP-001 — Two transports: hosted (default) and local stdio (npm fallback)

- **Decision:** The MCP server ships in two flavours. **Hosted at `mcp.nlqdb.com`** is the default — a Cloudflare Worker on Workers Free + Durable Objects (`McpAgent` class), OAuth-authenticated, paste-the-URL-into-the-host's-config install. **Local stdio via `npm @nlqdb/mcp`** is the fallback for offline / privacy-sensitive / CLI-everything workflows. Both share the same `/v1/ask` orchestration; neither holds DB credentials.
- **Core value:** Free, Effortless UX, Bullet-proof
- **Why:** Hosted gives "zero install, paste a URL" — the lowest-friction path on hosts that support MCP connectors (Claude Desktop *Connectors*, Cursor / Zed / Windsurf MCP settings). Local stdio is the escape hatch for users who refuse to send their queries through a hosted Worker. One transport would force every user into one tradeoff; two keeps the default frictionless and the escape hatch always available (`GLOBAL-015` energy applied to MCP).
- **Consequence in code:** `packages/mcp/` carries both transports behind a shared tool-handler core. The hosted Worker lives at `apps/api/` (or a sibling Worker) wired through the `McpAgent` Durable Object pattern. Each transport is independently testable; tool semantics are identical.
- **Alternatives rejected:**
  - Hosted only — cuts off the offline / privacy-sensitive segment of P2 (the Agent Builder).
  - Local only — every host requires `npx`, every update needs the user to bump a version; misses the "paste a URL" moment.

### SK-MCP-002 — Three tools, no `nlqdb_create_database`: `nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe`

- **Decision:** The MCP server exposes exactly three tools: `nlqdb_query(db, q)`, `nlqdb_list_databases()`, `nlqdb_describe(db)`. There is **no public `nlqdb_create_database` tool** — `nlqdb_query` materializes the DB on first reference (per the goal-first inversion in `docs/design.md §0.1`).
- **Core value:** Simple, Goal-first, Effortless UX
- **Why:** Two tools (`create`, then `query`) doubles the prompt the agent has to learn and creates an "agent forgot to call create" failure mode. One tool that does the right thing is the goal-first design applied to MCP — the agent never had a goal that was "create a database". Implicit creation is also what makes the persona walkthrough (P2 / Jordan) work: the system prompt has one tool, not two.
- **Consequence in code:** `packages/mcp/src/tools.ts` registers exactly three tool handlers. `nlqdb_query` POSTs to `/v1/ask` which routes through the typed-plan create path on first reference (`docs/design.md §3.6.2`). PRs adding more tools require explicit justification against `GLOBAL-017` ("one way to do each thing").
- **Alternatives rejected:**
  - Expose `nlqdb_create_database` as a power-user tool — dilutes the agent's prompt, contradicts §0.1 inversion.
  - One mega-tool that takes an `op` parameter — harder for the host LLM to plan with, no real simplification.

### SK-MCP-003 — `nlq mcp install` no-arg auto-detects hosts; explicit `<host>` is power-user override

- **Decision:** The default `nlq mcp install` (no arg) scans known host configs for Claude Desktop, Cursor, Zed, Windsurf, VS Code, and Continue, and prints what it found. One host → silent install. Multiple → numbered prompt (or `--all`). None → prints install links and exits. Explicit forms (`nlq mcp install <host>`, `--dry-run`, `--all`) are the escape hatches.
- **Core value:** Effortless UX, Seamless auth, Goal-first
- **Why:** Asking the user to name their MCP host is friction we can remove — every host stores its config in a known location. Detection-first ("what you have, set up") matches the on-ramp inversion principle. The explicit override exists for users who want to bypass detection (CI, custom builds, hosts not yet supported).
- **Consequence in code:** `cli/src/mcp/install.ts` ships per-host detectors that read each host's config path and return a `{detected, configPath, hotReloads}` tuple. Detection is transparent — the CLI prints what it's about to touch (`docs/design.md §3.4`). The `--dry-run` flag is mandatory parity with explicit / no-arg modes.
- **Alternatives rejected:**
  - Always require `<host>` — every install adds a "what's my host called?" question.
  - Detect *and* always confirm — adds a click for the 60% of users with one host.

### SK-MCP-004 — Per-host scoped keys: `sk_mcp_<host>_<device>_…`

- **Decision:** Each MCP install mints a distinct key of the form `sk_mcp_<host>_<device>_…` carrying `{ user_id, mcp_host, device_id, created_at, last_used_at }` claims. Agents do **not** share credentials across hosts. The dashboard lists each with its host, device, and last-used timestamp.
- **Core value:** Bullet-proof, Seamless auth
- **Why:** A leaked or compromised MCP key on one host (an exfiltrating extension, a misbehaving fork) should not blast across all hosts. Per-host keys give a one-click revocation surface (`GLOBAL-018`) that removes Cursor without removing Claude Desktop. They also make the audit log answer "which host did that query come from?" without inference.
- **Consequence in code:** `apps/api/src/routes/keys/` mints `sk_mcp_*` with the (`mcp_host`, `device_id`) claims. DBs created via MCP are tagged with `(mcp_host, device_id)` and default to visible only under that tuple; promote-to-account is one click. Dashboard / `nlq keys list` displays keys grouped by host + device.
- **Alternatives rejected:**
  - One key shared across hosts — single revocation surface, blast radius too wide.
  - Keys scoped per-(host, project) — over-fragmentation; agents move between projects within a host all day.

### SK-MCP-005 — Zero DB drivers in `@nlqdb/mcp`'s lockfile (CI-enforced)

- **Decision:** The local-stdio transport (`@nlqdb/mcp` on npm) holds no DB credentials and has no DB-driver dependencies in its lockfile. CI fails any PR that adds `pg` / `postgres` / `redis` / `mysql` / `mongodb` / equivalents to the package's transitive tree.
- **Core value:** Bullet-proof, Free
- **Why:** The MCP server is a thin adapter over the HTTP API — every request goes to `api.nlqdb.com`. A DB driver in the local package is a footgun: it could shortcut to a real DB, leak a connection string, or invite "support DB X locally" feature creep. Banning them at the lockfile level is the only defense that survives well-intentioned PRs.
- **Consequence in code:** `packages/mcp/package.json` carries no DB drivers. CI (`.github/workflows/`) greps the lockfile against a deny-list and fails on a hit. Postgres credentials never leave Cloudflare in either transport.
- **Alternatives rejected:**
  - Trust reviewers to catch it — drivers slip in transitively (a polyfill, a logger that depends on `pg-types`, etc.); a CI check is the only durable defense.
  - Allow drivers but block their use at runtime — runtime guards drift; the lockfile is the source of truth.

### SK-MCP-006 — Revocation surfaces a recoverable `401 key_revoked` with one-line CTA

- **Decision:** A revoked `sk_mcp_*` key returns `401 { code: "key_revoked", message: "…", action: "Sign in again: run `nlq mcp install`." }` on the next call. The MCP server passes that message through to the host LLM as a tool error, so the agent surfaces *"Sign in again: run `nlq mcp install`."* to the user.
- **Core value:** Bullet-proof, Seamless auth, Effortless UX
- **Why:** Revocation that "eventually" propagates is a security hole (`GLOBAL-018`), and a 401 with no next-action message strands the user (`GLOBAL-012`). One sentence + one command is the recovery path; re-running `nlq mcp install` auto-detects the original host and re-mints a key in seconds.
- **Consequence in code:** Auth middleware on the MCP server pulls `code/message/action` from the API error envelope and serializes it into the MCP tool-error shape. Tests cover "revoke from web → next MCP tool call returns the recoverable error".
- **Alternatives rejected:**
  - Drop a generic 401 — host LLMs render it as "tool unavailable" without recovery context.
  - Auto-prompt for re-install from the MCP server — the MCP server can't run a CLI; the recovery has to live where the user can act on it (`nlq mcp install` in the user's shell).

### SK-MCP-007 — Streamable-HTTP (hosted) and stdio (local) — same `/v1/ask` orchestration

- **Decision:** The hosted transport speaks Streamable-HTTP (per the MCP spec); the local transport speaks stdio to the host process. Both terminate at the same `/v1/ask` orchestration in the API. Neither transport holds DB credentials; neither bypasses the validator.
- **Core value:** Bullet-proof, Simple
- **Why:** Two transports with two orchestration paths would drift — bug fixes on one wouldn't cover the other, and the validator (the security boundary) would have two surfaces to harden. One orchestration with two transport adapters keeps the security review small and the behaviour parity (`GLOBAL-002`) honest.
- **Consequence in code:** `packages/mcp/` factors out a transport-agnostic `handleTool(name, args, ctx)` core; transport adapters (`streamable-http.ts`, `stdio.ts`) are thin shims over it. The API request shape is identical regardless of transport.
- **Alternatives rejected:**
  - Hosted-only orchestration with local going through a different shim — two attack surfaces, two parsers.
  - Direct DB access from the local transport — explicitly rejected by `SK-MCP-005`.

## Copies of GLOBAL decisions affecting this feature

### GLOBAL-001 — SDK is the only HTTP client

- **Decision:** Every nlqdb surface (`apps/web`, `cli/`, `packages/mcp`,
  `packages/elements`) consumes `@nlqdb/sdk`. No raw `fetch('/v1/...')`
  outside `packages/sdk/`.
- **Core value:** Simple, Bullet-proof
- **Why:** Surfaces drift when each owns their HTTP client — auth-header
  semantics, retry policy, error shape, idempotency handling end up with
  subtle differences. One client means one place to fix bugs and one
  place to add new endpoints. It is also the precondition for
  `GLOBAL-002` (behavior parity).
- **Consequence in code:** Lint/CI rejects `fetch()` calls referencing
  `/v1/` outside `packages/sdk/`. A new endpoint lands as an SDK method
  first; surfaces consume it after.
- **Alternatives rejected:**
  - Per-surface clients with shared types — types diverge subtly,
    especially around error envelopes and retry semantics.
  - Generated clients (OpenAPI / typed-fetch codegen) — generator quirks
    plus a runtime surface duplication; not worth the build-time cost.
- **Source:** docs/decisions.md#GLOBAL-001

### GLOBAL-002 — Behavior parity across surfaces

- **Decision:** Every surface (HTTP API, SDK, CLI, MCP, elements, web)
  presents the same auth modes, error shape, idempotency semantics, and
  rate-limit signaling. Surface-specific UX wrapping (CLI prompts vs.
  browser modals vs. MCP tool errors) is allowed; semantics are not.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** Users and agents move between surfaces (CLI in dev, MCP in
  their IDE, web for sharing). If a 429 means "back off 1 s" in CLI but
  "give up" in MCP, behavior is unpredictable. Parity is what makes the
  multi-surface story credible.
- **Consequence in code:** Every error code, every header
  (`Idempotency-Key`, `X-RateLimit-*`, `Authorization`), and every
  status-mapping rule is defined once in `packages/sdk/` and re-used.
- **Alternatives rejected:**
  - Surface-specific error shapes — each surface team optimizes locally
    and the surfaces drift.
  - "Best effort" parity — degrades to no parity inside a year.
- **Source:** docs/decisions.md#GLOBAL-002

### GLOBAL-008 — One Better Auth identity across all surfaces

- **Decision:** A user has exactly one identity, managed by Better Auth.
  CLI, MCP, web, and SDK all authenticate through that identity (via
  bearer / cookie / device-flow). No surface owns its own auth store.
- **Core value:** Seamless auth, Simple, Bullet-proof
- **Why:** Multi-surface products fragment when each surface owns its
  own identity model — a user signs in to web but the CLI doesn't know,
  or the MCP key isn't tied to the same human. One identity model means
  one revocation surface (`GLOBAL-018`), one rate-limit surface, one
  audit log.
- **Consequence in code:** `packages/auth-internal` is the only thing
  that talks to Better Auth. Every other surface consumes its
  primitives. CLI's device-flow auth and MCP's host-scoped keys both
  resolve to a single `user_id`.
- **Alternatives rejected:**
  - Per-surface identity systems — fragmented audit trails, fragmented
    revocation, no cross-surface session continuity.
  - Bring-your-own-IdP only — punts the problem to operators; bad
    default for the free tier.
- **Source:** docs/decisions.md#GLOBAL-008

### GLOBAL-010 — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch

- **Decision:** Long-lived credentials (CLI tokens, MCP host keys) live
  in the OS keychain (Keychain on macOS, libsecret on Linux,
  Credential Manager on Windows). The only env-var path is
  `NLQDB_API_KEY`, used in CI / containerized environments where a
  keychain is unavailable.
- **Core value:** Seamless auth, Bullet-proof
- **Why:** Keychain storage means credentials survive reboots, are
  encrypted at rest by the OS, and don't leak into shell history /
  ps output / env-dump screenshots. The single env-var fallback is
  the explicit, auditable escape hatch — it doesn't quietly become
  the default.
- **Consequence in code:** `cli/` and `packages/mcp` use a small
  keychain abstraction; tokens are written there on first sign-in.
  When the keychain is missing (CI, Docker), `NLQDB_API_KEY` is read
  with a one-line message that names the env-var explicitly. No
  config-file fallback, no `~/.nlqdb/credentials.json`.
- **Alternatives rejected:**
  - Plain config-file storage in `~/.nlqdb/` — leaks via cloud
    backups / dotfile syncs.
  - Required env vars — bad UX on a developer laptop.
- **Source:** docs/decisions.md#GLOBAL-010

### GLOBAL-017 — Two endpoints, two CLI verbs, one chat box — one way to do each thing

- **Decision:** The HTTP API exposes two primary endpoints (`/v1/ask`,
  `/v1/run`). The CLI exposes two primary verbs (`nlq ask`, `nlq run`).
  The web app exposes one chat box. There is exactly one way to
  perform each conceptual operation; no aliases, no shadow endpoints.
- **Core value:** Simple, Effortless UX
- **Why:** Surface area is the enemy of learnability. If a user can
  do X "via two endpoints" or "via three commands," they spend energy
  on which one to pick instead of on their goal. A small canonical
  surface keeps docs short and behavior consistent.
- **Consequence in code:** New conceptual operations require a
  decision: extend an existing endpoint/verb, or introduce a third
  one (which requires explicit justification). No aliases. The CLI
  may have helpers (`nlq init`, `nlq login`) — but the *operations
  on data* are the two verbs.
- **Alternatives rejected:**
  - REST resource explosion (`/v1/queries`, `/v1/runs`, `/v1/plans`)
    — bigger surface, more docs, more inconsistency.
  - Multiple aliased CLI verbs — every alias becomes a new way to
    misuse the tool.
- **Source:** docs/decisions.md#GLOBAL-017

## Open questions / known unknowns

- **Hosts beyond the initial six.** Detection currently targets Claude Desktop, Cursor, Zed, Windsurf, VS Code, and Continue. New hosts (e.g. a future Anthropic terminal, JetBrains MCP plugin) need a detector module each — no decision yet on the per-host detector contract.
- **Hosted-transport rate-limit tier vs. local-transport.** Whether the hosted Worker shares the API's per-key rate-limit budget or carries its own per-(host, device) tier is undecided; relates to `SK-RL-NNN` (rate-limit skill).
- **Promote-to-account UX.** DBs created via MCP are tagged `(mcp_host, device_id)` and promote-to-account is "one click" in the design — the click target and confirmation copy are not specified yet.
- **`NLQDB_API_KEY` precedence inside the local transport.** Design says it takes precedence over any config file; need explicit test coverage for the precedence chain (`env > host config > device key`) on the local transport.
- **Session token revocation latency.** `GLOBAL-018` requires "instant" revocation; the hosted MCP transport's edge-cache TTL for the revocation set is not yet pinned.
