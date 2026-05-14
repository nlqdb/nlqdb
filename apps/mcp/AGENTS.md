# Apps · MCP Server — Agents Guide

Hosted MCP server at `mcp.nlqdb.com` — the "paste-a-URL" connector path
from `SK-MCP-001`. Thin protocol shim that terminates MCP Streamable-HTTP
and forwards every tool call to `apps/api/` via `@nlqdb/sdk`.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → feature map, and
> the project-wide tech stack. This file narrows that guide to
> `apps/mcp/`.

## Features relevant to this area

- [`mcp-server`](../../docs/features/mcp-server/FEATURE.md) — mandatory pre-read for changes that touch the feature.
- [`api-keys`](../../docs/features/api-keys/FEATURE.md) — mandatory pre-read for changes that touch bearer handling.
- [`observability`](../../docs/features/observability/FEATURE.md) — mandatory pre-read for changes that touch spans / metrics.

## Architecture posture

- Pure HTTP-API client. **No D1 / KV / R2 bindings on this Worker.** Auth-of-record is `apps/api/`; this Worker forwards bearers via `@nlqdb/sdk` and surfaces upstream errors per `SK-MCP-006`.
- Per-request `McpServer` + transport (SDK ≥ 1.26 stateless requirement). No shared instances across requests; no Durable Objects in slice 3a.
- Three tools registered via `createServer()` from `@nlqdb/mcp` (the transport-agnostic dispatcher) — never re-implement tool semantics here. New tools land in `packages/mcp/src/tools.ts` first.
- Slice ordering per `SK-MCP-010`: 3a (this scaffold + bearer auth) → 3b (`workers-oauth-provider` + `McpAgent` Durable Object sessions) → 3c (per-key rate-limit + 1 s isolate-cache revocation per `SK-MCP-009`).

## Deferred from slice-3a self-review (carry into 3b / 3c)

Each is anchored to an inline `TODO(slice 3b)` / `TODO(slice 3c)` comment in `src/index.ts`. Grep before opening either follow-on PR.

- **CORS `Access-Control-Allow-Origin: *` echo (3b).** `preflight()` echoes the request origin (or `*` fallback). Safe today — every request is bearer-authenticated, no cookies. When `workers-oauth-provider` adds credentialed flows on the authorize / callback routes, CORS-spec forbids `*` for credentialed requests. Replace with an allow-list keyed off the OAuth client registry.
- **Auth-failure observability gap (3c).** The `nlqdb.mcp.http.request` span starts *after* `requireBearer`, so probe traffic and misconfigured-key traffic never produce a span. When rate-limit + observability hardening lands, either add a pre-gate counter or start the span before the gate and tag failures via a span attribute.

## Commands

```bash
bun run --filter apps/mcp dev
bun run --filter apps/mcp typecheck
bun run --filter apps/mcp build      # wrangler deploy --dry-run
bun run --filter apps/mcp test
```

## Local rules

- Every change here must respect the `GLOBAL-NNN` decisions in
  [`docs/decisions.md`](../../docs/decisions.md). In particular: `GLOBAL-001`
  (only `@nlqdb/sdk` talks HTTP to `apps/api/`), `GLOBAL-013` (Workers Free
  bundle budget — every dep counts), `SK-MCP-005` (zero DB drivers in this
  app's lockfile — CI grep enforces).
- A new external call (DB / LLM / HTTP / queue) needs an OTel span
  (`GLOBAL-014`). Spans flow through `@nlqdb/mcp`'s existing
  `nlqdb.mcp.tool.invoke` tracer; new code paths add their own span only
  when they're outside that tracer's coverage.
- New MCP tools land in `packages/mcp/src/tools.ts` first (transport-agnostic),
  then are auto-picked up here via `createServer()`. PRs that register tools
  inline in this app fail review — duplicates the stdio surface and breaks
  `GLOBAL-002` behavior parity.
- If a request is ambiguous or an error is unfamiliar — web-research
  current best practices first (see root `AGENTS.md` §2 P2).
- A decision change (new or amended) updates every place that copies
  it, in the same PR (root `AGENTS.md` §2 P3).

## When you finish

1. Run the commands above and ensure they all pass.
2. If you added a decision, it has an ID, lives in the right place
   (`docs/decisions.md` or the relevant `FEATURE.md`), and any duplicate
   of an affected `GLOBAL-NNN` is updated.
3. Open a PR; the root `AGENTS.md` §8 lists the pre-PR quality gates.
