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
**Status:** partial (Phase 2) — design locked (`SK-MCP-001..014`). **Slices 1, 2, 3a, 3b, 3c shipped** (hosted MCP server end-to-end with per-key rate-limit + auth-failure observability). Slice 4 (`nlq mcp install` host-detect) remains open — see [`cli/FEATURE.md`](../cli/FEATURE.md).
**Owners (code):** `packages/mcp/**`, `apps/mcp/**`
**Cross-refs:** docs/architecture.md §3.4 (MCP server) · docs/phase-plan.md (Phase 2 mcp slice)

## Touchpoints — read this feature before editing

- `packages/mcp/**`
- `apps/mcp/**`

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-MCP-NNN`. The list below is the index; open the linked file for the full five-field block.

- [**SK-MCP-001**](decisions/SK-MCP-001-two-transports.md) — Two transports: hosted (default) and local stdio (npm fallback).
- [**SK-MCP-002**](decisions/SK-MCP-002-three-tools.md) — Three tools: `nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe`; no public `nlqdb_create_database`.
- [**SK-MCP-003**](decisions/SK-MCP-003-install-autodetect.md) — `nlq mcp install` no-arg auto-detects hosts; explicit `<host>` is the power-user override.
- [**SK-MCP-004**](decisions/SK-MCP-004-per-host-keys.md) — Per-host scoped keys: `sk_mcp_<host>_<device>_…`.
- [**SK-MCP-005**](decisions/SK-MCP-005-zero-db-drivers.md) — Zero DB drivers in `@nlqdb/mcp`'s lockfile (CI-enforced).
- [**SK-MCP-006**](decisions/SK-MCP-006-recoverable-revocation.md) — Revocation surfaces a recoverable `401 key_revoked` with one-line CTA.
- [**SK-MCP-007**](decisions/SK-MCP-007-shared-orchestration.md) — Streamable-HTTP (hosted) and stdio (local) — same `/v1/ask` orchestration.
- [**SK-MCP-008**](decisions/SK-MCP-008-host-detector.md) — Per-host detector behind one `HostDetector` interface.
- [**SK-MCP-009**](decisions/SK-MCP-009-per-key-revocation.md) — Per-key rate-limit bucket; revocation propagates ≤ 1 s.
- [**SK-MCP-010**](decisions/SK-MCP-010-implementation-slicing.md) — Implementation slicing: keys → stdio → hosted → install.
- [**SK-MCP-011**](decisions/SK-MCP-011-dynamic-client-registration.md) — Dynamic client registration (RFC 7591) via `/register`.
- [**SK-MCP-012**](decisions/SK-MCP-012-single-scope.md) — Single `mcp` scope; tool-level capability lives in `apps/api/`'s validator.
- [**SK-MCP-013**](decisions/SK-MCP-013-callback-bridge.md) — Cross-Worker callback bridge mints `sk_mcp_*` server-side via one-shot KV code.
- [**SK-MCP-014**](decisions/SK-MCP-014-do-revalidation-cache.md) — `McpAgent` DO caches `sk_mcp_*` + revalidates every 1 s.

## Install paths

Four paths, all terminating at the same `/v1/ask` orchestration and the same three tools (`SK-MCP-002`, `SK-MCP-007`):

1. **Connector URL** (hosted, default) — paste `mcp.nlqdb.com` into the host's MCP-connector config; OAuth opens in the browser on first tool call. Zero local setup.
2. **`nlq mcp install`** (local stdio) — auto-detects installed hosts (`SK-MCP-003`), writes `sk_mcp_<host>_<device>_…` into each config.
3. **Website one-click** (`app.nlqdb.com/mcp`) — mints the key server-side, opens an `nlqdb://install?…` deep link the CLI handles.
4. **`NLQDB_API_KEY` env var** — `sk_…` precedence over any config; the CI / Docker / air-gapped escape hatch (`GLOBAL-015`).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-001** — SDK is the only HTTP client.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-008** — One Better Auth identity across all surfaces.
- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
- **GLOBAL-023** — Trust UX baseline.
  - *In this feature:* tools that mutate (writes / DDL) return `confirm_required` with the diff body (per `SK-TRUST-001`). Audit each host (Claude Desktop, Cursor, Zed) for diff-rendering ergonomics — hosts that hide the diff fail `SK-TRUST-001` on that surface. See [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md) Open questions.

## Open questions / known unknowns

- **Promote-to-account UX (UI-only — server contract locked).** Server contract is `PATCH /v1/databases/:id { scope: "account" }`. Dashboard button placement + post-promote redirect are product-owner calls.
- **MCP `confirm_required` host-rendering audit.** Some hosts render `confirm_required` as a single "Approve" button without the diff body — breaks `SK-TRUST-001`. Audit Claude Desktop, Cursor, Zed, Windsurf, VS Code Continue, Cline; offending hosts get a warning in `nlq mcp install`. Cross-ref: [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md).

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
