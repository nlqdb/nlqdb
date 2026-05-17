# MCP e2e tests

Persona P2 — Agent Builder. Protocol-conformance tests for the `@nlqdb/mcp` server, exercised over the canonical `InMemoryTransport` from `@modelcontextprotocol/sdk`. Same shape `@modelcontextprotocol/inspector` exercises in its `--cli` mode, just in-process.

See [`SK-E2E-002`](../../../docs/features/e2e-coverage/FEATURE.md#sk-e2e-002--per-surface-native-runner-opencheck-is-the-web-runner-only) for why this surface uses the SDK's in-memory transport rather than spawning a stdio subprocess.

## Layout

```
tests/e2e/mcp/
├── package.json          # not in root workspaces — install locally
├── vitest.config.ts
├── tsconfig.json
├── p2_agent_tools.test.ts  # all three MCP tools end-to-end
└── README.md
```

## Run

```bash
cd tests/e2e/mcp
bun install
bun run test         # in-process — no external network
bun run typecheck
```

## Trigger via GitHub Actions

```bash
gh workflow run e2e-mcp.yml
```

## What's tested

Per [`tests/personas/P2-agent-builder/README.md`](../../personas/P2-agent-builder/README.md):

- `nlqdb_query` returns rows + an SQL trace (GLOBAL-023 trust-UX baseline).
- `nlqdb_list_databases` enumerates the agent's tenant.
- `nlqdb_describe` returns schema metadata.
- Tool errors are one-sentence + next-action (GLOBAL-012).
- The three tools are exactly the surface (SK-MCP-002 — no destructive verbs).

## When to add a test

Add per-persona tests in `pN_<journey>.test.ts`. Stub the `NlqClient` via the helper at the top of `p2_agent_tools.test.ts` — copy and narrow the methods your journey touches.

For full protocol-level conformance against a live MCP host (Claude Desktop, Cursor, etc.), use [`@modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector) manually — that's a higher-fidelity, lower-frequency check we deliberately don't automate yet.
