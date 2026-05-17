# Packages · MCP — Agents Guide

MCP server + nlq mcp install host detection (Claude Desktop, Cursor, Cline).

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → feature map, and
> the project-wide tech stack. This file narrows that guide to
> `packages/mcp/`.

## Features relevant to this area

- [`mcp-server`](../../docs/features/mcp-server/FEATURE.md) — mandatory pre-read for changes that touch the feature.
- [`sdk`](../../docs/features/sdk/FEATURE.md) — mandatory pre-read for changes that touch the feature.

## Commands

```bash
bun run --filter @nlqdb/mcp build
bun run --filter @nlqdb/mcp test
```

## Local rules

- Every change here must respect the `GLOBAL-NNN` decisions in
  [`docs/decisions.md`](../../docs/decisions.md).
- A new external call (DB / LLM / HTTP / queue) needs an OTel span
  (`GLOBAL-014`).
- If a request is ambiguous or an error is unfamiliar — web-research
  current best practices first (see root `AGENTS.md` §2 P2).
- A decision change (new or amended) updates every place that copies
  it, in the same PR (root `AGENTS.md` §2 P3).

## E2E coverage

MCP protocol-conformance tests live at [`tests/e2e/mcp/`](../../tests/e2e/mcp/) — `@modelcontextprotocol/sdk`'s `InMemoryTransport` pairs a Client with the nlqdb MCP server in-process and exercises all three tools (`nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe`). Persona mapping: [P2 — Agent Builder](../../tests/personas/P2-agent-builder/README.md).

After a change to the tool surface, the wire shape of any tool's `structuredContent`, or the `mapSdkError` mapping:

```bash
gh workflow run e2e.yml -f surface=mcp
```

Local run (hermetic):

```bash
cd tests/e2e/mcp && bun install && bun run test
```

A new persona-step assertion lands as a new `it(...)` block in [`tests/e2e/mcp/p2_agent_tools.test.ts`](../../tests/e2e/mcp/p2_agent_tools.test.ts), with stubs scoped per-test via the `stubClient` helper.

See [`docs/features/e2e-coverage/FEATURE.md`](../../docs/features/e2e-coverage/FEATURE.md).

## When you finish

1. Run the commands above and ensure they all pass.
2. If you added a decision, it has an ID, lives in the right place
   (`docs/decisions.md` or the relevant `FEATURE.md`), and any duplicate
   of an affected `GLOBAL-NNN` is updated.
3. Open a PR; the root `AGENTS.md` §8 lists the pre-PR quality gates.
