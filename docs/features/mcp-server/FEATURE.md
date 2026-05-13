---
name: mcp-server
description: MCP server + `nlq mcp install` host detection (Claude Desktop, Cursor, etc.).
when-to-load:
  globs:
    - packages/mcp/**
  topics: [mcp, host-detection, claude-desktop, cursor]
---

# Feature: Mcp Server

**One-liner:** MCP server + `nlq mcp install` host detection (Claude Desktop, Cursor, etc.).
**Status:** planned (Phase 2) — design fully locked (`SK-MCP-001..010`). Slice 2 of `SK-MCP-010` (local-stdio package: tool contracts, dispatcher, transport) lands with this PR. `nlqdb_query` works today against `pk_live_*`; `nlqdb_list_databases` + `nlqdb_describe` return typed `auth_required` until slice 1 (`sk_*` keys in `api-keys/FEATURE.md`) ships. Slices 3 (hosted Worker) and 4 (`nlq mcp install`) live with their respective features.
**Owners (code):** `packages/mcp/**`
**Cross-refs:** docs/architecture.md §3.4 (MCP server) · docs/architecture.md §3 (MCP server row) · docs/phase-plan.md (Phase 2 mcp slice)

## Touchpoints — read this feature before editing

- `packages/mcp/**`

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

- **Decision:** The MCP server exposes exactly three tools: `nlqdb_query(db, q)`, `nlqdb_list_databases()`, `nlqdb_describe(db)`. There is **no public `nlqdb_create_database` tool** — `nlqdb_query` materializes the DB on first reference (per the goal-first inversion in `docs/architecture.md §0.1`).
- **Core value:** Simple, Goal-first, Effortless UX
- **Why:** Two tools (`create`, then `query`) doubles the prompt the agent has to learn and creates an "agent forgot to call create" failure mode. One tool that does the right thing is the goal-first design applied to MCP — the agent never had a goal that was "create a database". Implicit creation is also what makes the persona walkthrough (P2 / Jordan) work: the system prompt has one tool, not two.
- **Consequence in code:** `packages/mcp/src/tools.ts` registers exactly three tool handlers. `nlqdb_query` POSTs to `/v1/ask` which routes through the typed-plan create path on first reference (`docs/architecture.md §3.6.2`). PRs adding more tools require explicit justification against `GLOBAL-017` ("one way to do each thing").
- **Alternatives rejected:**
  - Expose `nlqdb_create_database` as a power-user tool — dilutes the agent's prompt, contradicts §0.1 inversion.
  - One mega-tool that takes an `op` parameter — harder for the host LLM to plan with, no real simplification.

### SK-MCP-003 — `nlq mcp install` no-arg auto-detects hosts; explicit `<host>` is power-user override

- **Decision:** The default `nlq mcp install` (no arg) scans known host configs for Claude Desktop, Cursor, Zed, Windsurf, VS Code, and Continue, and prints what it found. One host → silent install. Multiple → numbered prompt (or `--all`). None → prints install links and exits. Explicit forms (`nlq mcp install <host>`, `--dry-run`, `--all`) are the escape hatches.
- **Core value:** Effortless UX, Seamless auth, Goal-first
- **Why:** Asking the user to name their MCP host is friction we can remove — every host stores its config in a known location. Detection-first ("what you have, set up") matches the on-ramp inversion principle. The explicit override exists for users who want to bypass detection (CI, custom builds, hosts not yet supported).
- **Consequence in code:** `cli/src/mcp/install.ts` ships per-host detectors that read each host's config path and return a `{detected, configPath, hotReloads}` tuple. Detection is transparent — the CLI prints what it's about to touch (`docs/architecture.md §3.4`). The `--dry-run` flag is mandatory parity with explicit / no-arg modes.
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

### SK-MCP-008 — Per-host detector is one file behind `HostDetector { name, configPath, installed, hotReloadable, patch }`

- **Decision:** Each host is a module implementing `HostDetector { name; configPath(home, platform); installed(); hotReloadable; patch(config, entry) }`. New hosts = one file in `cli/internal/mcp/hosts/<host>.go` + one registry entry. Initial six: Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` macOS, `%APPDATA%\Claude\…` Windows, `~/.config/Claude/…` Linux), Cursor (`~/.cursor/mcp.json`), Windsurf (`~/.codeium/windsurf/mcp_config.json`), Zed (`~/.config/zed/settings.json` under `context_servers`), VS Code Continue (`~/.continue/config.json`), Cline (`~/.cline/mcp_settings.json`). Inserted entry shape: `{ "nlqdb": { "command": "npx", "args": ["@nlqdb/mcp"], "env": { "NLQDB_API_KEY": "sk_mcp_…" } } }` — host-specific JSON nesting (Zed `context_servers`, Cursor/Claude `mcpServers`, VS Code Continue `servers`) lives inside `patch()`.
- **Core value:** Effortless UX, Simple
- **Why:** Only the path, JSON shape, and hot-reload behaviour vary per host. Centralising those three facts behind one interface — and routing every install through the registry, not a host-name switch — keeps the list growing without re-architecting.
- **Consequence in code:** `cli/internal/mcp/registry.go` lists detectors in detection order. PRs that branch on host name outside `hosts/<host>.go` fail review. The `patch()` function is the only place that knows host-specific JSON nesting.
- **Alternatives rejected:**
  - Switch statement in `install.go` — every new host edits the same hot file; merge-conflict magnet.
  - Declarative manifest per host — can't express host-specific JSON-patch logic.
  - Detect by binary presence — misleading on Linux; the config file is the canonical "host is installed" signal anyway.

### SK-MCP-009 — Per-key rate-limit bucket; revocation propagates ≤ 1 s via D1 + 1 s isolate-local cache

- **Decision:** Every `sk_mcp_*` key is its own rate-limit bucket — `SK-MCP-004` already embeds `(mcp_host, device_id)`, so hosts have independent budgets. Revocation marks `revoked_at` in D1; hosted-MCP isolates keep a 1 s `Map<keyHash, { revoked }>` cache gating every tool call. Local-stdio resolves auth against the API on every call (no cache).
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** Tool calls are low-RPS (humans driving an agent), so per-call auth is affordable. 1 s absorbs burst-validation in multi-step agent flows without breaching `GLOBAL-018`'s "instant" — 1 s is the human-perceptible bound and the practical KV/D1 propagation floor.
- **Consequence in code:** `api-keys.ts` adds `revoked_at`; `lookupSkMcpKey()` filters `WHERE revoked_at IS NULL`. Hosted Worker wraps the lookup in `IsolateCache<KeyHash, …>` with `ttlMs: 1000`. Rate-limit middleware keys buckets as `rl:${keyHash}` — no `sk_mcp_*` vs `sk_live_*` special-casing.
- **Alternatives rejected:**
  - Shared per-user bucket across hosts — noisy host burns sibling-host budgets; no per-host revocation recourse.
  - 5 s TTL — too loose for "instant"; pushes past the human-perceptible bound.
  - Push-based revocation broadcast — fan-out cost on free tier; 1 s pull cache reaches the same SLO with one D1 read per miss.

### SK-MCP-010 — Implementation slicing: keys → stdio → hosted → install

- **Decision:** Four ordered slices, each independently reviewable. **Slice 1:** `sk_live_*` + `sk_mcp_*` minting / hashing / lookup in `apps/api/src/api-keys.ts` + `principal.ts` — lives in `api-keys/FEATURE.md`. **Slice 2:** `packages/mcp/` local-stdio transport — package scaffold, three tool contracts, dispatcher, `bin/nlqdb-mcp`, vitest tests. `nlqdb_query` works against `pk_live_*` today; `nlqdb_list_databases` / `nlqdb_describe` return typed `auth_required` until slice 1 ships. **Slice 3:** Hosted Worker at `mcp.nlqdb.com` — Streamable-HTTP transport, `workers-oauth-provider`, Durable-Object-backed sessions per the [Cloudflare MCP pattern](https://developers.cloudflare.com/agents/model-context-protocol/). **Slice 4:** `nlq mcp install` host detection (Go) — consumes the `SK-MCP-008` registry; lives in `cli/FEATURE.md` once that feature has source.
- **Core value:** Simple, Honest latency, Goal-first
- **Why:** Shipping `packages/mcp/` (slice 2) before keys (slice 1) is intentional: tool contracts and dispatch are stable regardless of auth backend, and `pk_live_*` covers the day-one agent shape (one memory DB per agent). Slice ordering is enforced by review, not code gates; the FEATURE.md is the source of truth.
- **Consequence in code:** Slice-2 `auth_required` responses follow the `SK-MCP-006` shape: `{ code: "auth_required", message: "…", action: "Wait for sk_mcp_* keys (Phase 2 slice 1) or use a pk_live_* key for nlqdb_query." }`. Reviewers reject sk-key minting logic inside `packages/mcp/` — it lives in `apps/api/` per `GLOBAL-021`.
- **Alternatives rejected:**
  - Bundle slice 1 + slice 2 — doubles PR size; couples auth-backend work with package wiring.
  - Drop the unsupported tools until slice 1 lands — leaves the tool surface ambiguous; typed `auth_required` is cleaner.
  - Hosted-only (skip stdio) — cuts off the offline / air-gapped segment (`SK-MCP-001`).

## Install paths

Four paths, all terminating at the same `/v1/ask` orchestration and the same three tools (`SK-MCP-002`, `SK-MCP-007`):

1. **Connector URL** (hosted, default) — paste `mcp.nlqdb.com` into the host's MCP-connector config; OAuth opens in the browser on first tool call. Zero local setup.
2. **`nlq mcp install`** (local stdio) — auto-detects installed hosts (`SK-MCP-003`), writes `sk_mcp_<host>_<device>_…` into each config.
3. **Website one-click** (`app.nlqdb.com/mcp`) — mints the key server-side, opens an `nlqdb://install?…` deep link the CLI handles.
4. **`NLQDB_API_KEY` env var** — `sk_…` precedence over any config; the CI / Docker / air-gapped escape hatch (`GLOBAL-015`).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-001** — SDK is the only HTTP client.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-008** — One Better Auth identity across all surfaces.
- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
- **GLOBAL-023** — Trust UX baseline.
  - *In this feature:* tools that mutate (writes / DDL) return `confirm_required` content with the diff body (per `SK-TRUST-001`). Audit each host (Claude Desktop, Cursor, Zed) for diff-rendering ergonomics — if a host hides the diff body, the surface fails the `SK-TRUST-001` contract on that host. See [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md) Open questions.

## Open questions / known unknowns

- **Promote-to-account UX (UI-only — server contract locked).** The server contract is `PATCH /v1/databases/:id { scope: "account" }` — flips the `(mcp_host, device_id)` tag to NULL on a DB row. Dashboard button placement, confirmation modal copy, and post-promote redirect target are product-owner calls. Resolve before slice 3 ships (hosted Worker surfaces the prompt).
- **MCP `confirm_required` host-rendering audit.** Some hosts render `confirm_required` as a single "Approve" button without the diff body — that breaks `SK-TRUST-001`. Audit (Claude Desktop, Cursor, Zed, Windsurf, VS Code Continue, Cline) runs against slice 2; offending hosts get a documented warning in `nlq mcp install` until they fix it. Cross-ref: [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md) Open questions.

Closed during 2026-05 doc revision: `engine` on list (`SK-MCP-002` + `SK-DB-010`); new-host contract (`SK-MCP-008`); hosted rate-limit tier (`SK-MCP-009`); `NLQDB_API_KEY` precedence `env > host config > device key` — covered by slice-2 tests; revocation latency (`SK-MCP-009`).

## Happy path walkthrough

**Install** (auto-detects what's present; one host → silent, multiple → numbered prompt, none → prints `nlqdb.com/mcp` link):

```bash
$ nlq mcp install
🔎 Scanning: Claude Desktop, Cursor, Zed, Windsurf, VS Code, Continue
✓ Found: Claude Desktop, Cursor
→ Opening browser to approve this device… (fallback code: AB12-CD34)
✓ Signed in as jordan@example.com.
✓ Claude Desktop  — wrote config; restart? [Y/n] y → relaunched. Self-check: ok.
✓ Cursor          — wrote config; hot-reloaded. Self-check: ok.
```

**Escape hatches:** `nlq mcp install <host>` (explicit), `--all`, `--dry-run`, `NLQDB_API_KEY=sk_…` (CI / air-gapped).

**Usage from inside the host LLM** — the agent never sees "create a database"; the DB materialises on first reference:

```
User:   "Remember I prefer metric and I'm vegetarian."
Claude → nlqdb_query("preferences", "remember: metric units, vegetarian")
       → { ok, db: "preferences-93b" }

[next session]
User:   "Plan me a Berlin food trip."
Claude → nlqdb_query("preferences", "what do you remember about me?")
       → "metric units, vegetarian"
```
