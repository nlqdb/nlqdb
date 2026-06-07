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

User-facing install flow (connector URL, `nlq mcp install`, website
one-click, `NLQDB_API_KEY` env var) lives at
[`docs.nlqdb.com/mcp/`](https://docs.nlqdb.com/mcp/). The internal
contract — four paths terminate at the same `/v1/ask` orchestration and
the same three tools — is canonical in [`SK-MCP-002`](decisions/SK-MCP-002-three-tools.md)
+ [`SK-MCP-007`](decisions/SK-MCP-007-shared-orchestration.md). Host
auto-detection lives in [`SK-MCP-003`](decisions/SK-MCP-003-install-autodetect.md).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-001** — SDK is the only HTTP client.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-008** — One Better Auth identity across all surfaces.
- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
- **GLOBAL-023** — Trust UX baseline.
  - *In this feature:* tools that mutate (writes / DDL) return `confirm_required` with the diff body (per `SK-TRUST-001`). Audit each host (Claude Desktop, Cursor, Zed) for diff-rendering ergonomics — hosts that hide the diff fail `SK-TRUST-001` on that surface. See [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md) Open questions.
- **GLOBAL-027** — Pre-alpha gate.
  - *In this feature:* MCP tools call through the SDK, so a 403 `feature_gated` arrives as an `NlqdbApiError` and the MCP host renders the body verbatim (no MCP-specific code path needed). Design partners paste their invite into the host config's per-server `env` map: `{"NLQDB_INVITE_CODE": "<code>"}` for Claude Desktop / Cursor / VS Code. See [`pre-alpha-gate/FEATURE.md`](../pre-alpha-gate/FEATURE.md).
- **GLOBAL-032** — Top-5 user flows canonical.
  - *In this feature:* `mcp.nlqdb.com` is the surface FLOW-005 (P2 agent builder) walks — one of the canonical-five. The no-credential subset (RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, unauthenticated `initialize` + `tools/list` returning 401 with `WWW-Authenticate: Bearer realm=*, resource_metadata=*` whose URL matches the scoped discovery) is covered by `bash scripts/flow-005-walk.sh` ([`SK-STRG-005`](../stranger-test/decisions/SK-STRG-005-flow-005-walker.md)) running daily under `.github/workflows/acquisition-health.yml`. The credentialed subset (authenticated `tools/list`, `create_database`, `ask`, `run`) still needs an `sk_mcp_*` key and stays in the verification mirror. Changes to the discovery routes, the auth-wall response shape, or the protocol-version handshake must keep the walker green or surface a regression in the daily artifact within 24 h.

## Open questions / known unknowns

- **Promote-to-account UX — Parked until the dashboard DB-list slice** (`GLOBAL-033`, UX micro-decision → zero modals, reuse the existing pattern). Server contract is locked (`PATCH /v1/databases/:id { scope: "account" }`). Shape follows the `/app/keys` revoke affordance: an inline button on the DB row, single `PATCH`, optimistic in-place update — no modal, no redirect. Wired when the `/app` DB list ships, not on spec.
- **MCP `confirm_required` host-rendering audit.** Some hosts render `confirm_required` as a single "Approve" button without the diff body — breaks `SK-TRUST-001`. Audit Claude Desktop, Cursor, Zed, Windsurf, VS Code Continue, Cline; offending hosts get a warning in `nlq mcp install`. Cross-ref: [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md).
- **Anthropic Connectors Directory submission.** Now unblocked by `docs.nlqdb.com` (the directory requires a public docs URL — [submission docs](https://claude.com/docs/connectors/building/submission)). Remaining work: (a) add Origin-header validation to `apps/mcp/src/index.ts` — reject browser-origin requests whose `Origin` is not in an allow-list, the ~30 % rejection cause per the submission docs; (b) pick branded logo + favicon (SVG, 256 × 256 minimum) and host them at the marketing domain; (c) fill out the form at `https://clau.de/mcp-directory-submission`. Tool-annotation hints (`readOnlyHint` / `destructiveHint`) are already wired per `SK-MCP-002`.

## Happy path walkthrough

End-user flow (`nlq mcp install` output, in-LLM tool calls, preferences-DB
example) lives at [`docs.nlqdb.com/mcp/`](https://docs.nlqdb.com/mcp/).
The Jordan-the-Agent-Builder narrative is in
[`docs/research/personas.md` §P2](../../research/personas.md).
