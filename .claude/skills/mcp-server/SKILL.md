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
**Status:** implemented (Phase 2)
**Owners (code):** `packages/mcp/**`
**Cross-refs:** docs/architecture.md §3.4 (MCP server) · docs/architecture.md §14.4 (MCP happy path) · docs/architecture.md §3 (MCP server row) · docs/architecture.md §10 §5 (Phase 2 mcp slice)

## Touchpoints — read this skill before editing

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

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-001** — SDK is the only HTTP client.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-008** — One Better Auth identity across all surfaces.
- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.

## Open questions / known unknowns

- **Hosts beyond the initial six.** Detection currently targets Claude Desktop, Cursor, Zed, Windsurf, VS Code, and Continue. New hosts (e.g. a future Anthropic terminal, JetBrains MCP plugin) need a detector module each — no decision yet on the per-host detector contract.
- **Hosted-transport rate-limit tier vs. local-transport.** Whether the hosted Worker shares the API's per-key rate-limit budget or carries its own per-(host, device) tier is undecided; relates to `SK-RL-NNN` (rate-limit skill).
- **Promote-to-account UX.** DBs created via MCP are tagged `(mcp_host, device_id)` and promote-to-account is "one click" in the design — the click target and confirmation copy are not specified yet.
- **`NLQDB_API_KEY` precedence inside the local transport.** Design says it takes precedence over any config file; need explicit test coverage for the precedence chain (`env > host config > device key`) on the local transport.
- **Session token revocation latency.** `GLOBAL-018` requires "instant" revocation; the hosted MCP transport's edge-cache TTL for the revocation set is not yet pinned.

## Happy path walkthrough

### §14.4 MCP server (`@nlqdb/mcp`)

**Install** (one command, no arg; auto-detects what you have installed):

```bash
$ nlq mcp install
🔎 Scanning: Claude Desktop, Cursor, Zed, Windsurf, VS Code, Continue
✓ Found: Claude Desktop, Cursor

→ Opening browser to approve this device… (fallback code: AB12-CD34)
✓ Signed in as jordan@example.com.

✓ Claude Desktop  — wrote config; Claude Desktop is running, restart to activate? [Y/n] y
                    ↳ quit & relaunched. Self-check: ok.
✓ Cursor          — wrote config; hot-reloaded. Self-check: ok.

Done. Your MCP keys appear at nlqdb.com/settings/keys.
```

If only one host is installed, the prompt is skipped and the install is silent. If none are installed, the CLI prints one line pointing the user at `nlqdb.com/mcp` and exits.

**Power-user forms** (escape hatches, always available):

```bash
$ nlq mcp install claude       # explicit host; skips auto-detection
$ nlq mcp install --all        # install into every detected host, no prompt
$ nlq mcp install --dry-run    # print what would happen; touch nothing
$ NLQDB_API_KEY=sk_... nlq …   # CI / Docker / air-gapped — env-var override
```

**Usage from inside the host LLM** (the agent doesn't need to know about "databases"):

```
[Claude Desktop, after install]
User:  "Remember that I prefer metric units and I'm vegetarian."
Claude → calls tool: nlqdb_query("preferences", "remember: metric units, vegetarian")
       → tool returns: { ok, db: "preferences-93b" }
Claude:  "Got it. I'll remember."

[next session, hours later]
User:  "Plan me a Berlin food trip."
Claude → calls tool: nlqdb_query("preferences", "what do you remember about me?")
       → returns: "metric units, vegetarian"
Claude:  "Here's a vegetarian itinerary in km..."
```

The agent never called `nlqdb_create_database`. The DB materialized on first reference. The agent's prompt has one tool, not two.
