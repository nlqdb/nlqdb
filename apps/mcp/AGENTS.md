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

- Auth-of-record is `apps/api/` — `apps/mcp/` holds OAuth state (KV) + per-session DO state but no D1. The DO forwards bearers to `apps/api/` via `@nlqdb/sdk` per `SK-MCP-005`/`SK-MCP-007` and surfaces upstream errors per `SK-MCP-006`.
- `OAuthProvider` from `@cloudflare/workers-oauth-provider` owns `/authorize`, `/token`, `/register`, `/.well-known/*`. `NlqdbMcpAgent.serve('/mcp')` puts every tool call through a Durable Object per `(user_id, mcp_host, device_id)` keyed off the OAuth grant.
- Three tools registered via `createServer()` from `@nlqdb/mcp` — never re-implement tool semantics here. New tools land in `packages/mcp/src/tools.ts` first.
- Slice ordering per `SK-MCP-010`: 3a (bearer scaffold, shipped) → 3b (this slice — OAuth + DO sessions per `SK-MCP-011..014`) → 3c (per-key rate-limit + auth-failure observability per `SK-MCP-009`).

## Deferred from slice-3a/3b self-review (carry into 3c)

Each item below is grep-discoverable via inline `TODO(slice 3c)` comments.

- **CORS `Access-Control-Allow-Origin: *` echo (RESOLVED in 3b).** Replaced with `cors-allowlist.ts` — the `OAuthProvider`'s registered-client `redirect_uri` origins drive the allow-list (`SK-MCP-011`). The legacy `preflight()` shim is gone.
- **Auth-failure observability gap (3c).** The `nlqdb.mcp.http.request` span never fires on `/mcp` requests rejected by `OAuthProvider`'s bearer gate (no access token, expired token, wrong scope). When rate-limit + observability hardening lands, wrap `OAuthProvider`'s `onError` callback or add a pre-gate counter so probe / misconfigured-key traffic is visible in OTel.
- **Slice 3b — `NlqdbMcpAgent.serve('/mcp')` type cast.** `apps/mcp/src/index.ts` casts the serve return value `as never` to bridge `OAuthProvider`'s `apiHandler` generics with `McpAgent.serve`'s untyped Env parameter. Both types are correct at runtime (the workers-oauth-provider tests use the same pattern); revisit when either package narrows its generics.

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
