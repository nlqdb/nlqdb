# E-02 — Additive MCP tool `nlqdb_remember`

**Status:** ✅ shipped (2026-06-20, run 31 — `apps/api/src/memory/remember.ts` + `POST /v1/memory/remember` + SDK `remember()` + `nlqdb_remember` MCP tool; SK-PIVOT-008). Two follow-ons: the `tests/e2e/mcp` Neon-branch `remember → query` smoke (infra-gated) and CLI `nlq remember` (the CLI is Go).
**Sequence:** Engine 2 of 7 · **Risk:** med · **Runs:** 1 · **Prereqs:** E-01 ✅ · **Gate:** none

## Goal

The agent-facing tool for the memory write path. **Additive** — the existing
`nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe` keep their
contract (SK-MCP-002 unchanged); `nlqdb_remember` joins them as a
memory-shaped first-class verb that materialises directly into the E-01
schema.

## Why additive, not a rename (SK-PIVOT-006)

Renaming `nlqdb_query` to `nlqdb_recall` would break the stable tool
contract MCP hosts and existing agents are bound to (and contradict
SK-MCP-002). Additive lets:
- existing hosts/agents keep working unchanged;
- the memory shape become discoverable in the tool list at no compatibility
  cost;
- WS-04's copy on `nlqdb_query` stay accurate (it still does NL→SQL recall).

## Scorecard number it moves

`Pivot:` boolean "memory write tool live." Once shipped, every MCP-directory
listing and the `mcp.mdx` page can point at a real tool, not a framing
sentence.

## Read first

- `docs/features/mcp-server/FEATURE.md` — SK-MCP-002 (tool contract is
  stable; **adding** a tool is fine, renaming/removing is not)
- `packages/mcp/src/server.ts:73-127` — the three existing `registerTool`
  blocks (template + annotations + error handling)
- `apps/api/src/run/**` + the `/v1/ask` write path — the underlying API
  the new tool calls

## Tool contract

```ts
nlqdb_remember(args: {
  db_id: string;                  // the agent_memory_v1 DB
  kind: 'fact' | 'episode' | 'entity';
  payload: FactPayload | EpisodePayload | EntityPayload;
  // optional scoping; agent_id is injected server-side from the principal (E-03)
  end_user_id?: string;
  thread_id?: string;
  ttl_seconds?: number;           // E-04
  tags?: string[];
  idempotency_key?: string;       // GLOBAL-005
})
=> { id: bigint, kind, materialised_at, expires_at? }
```

Annotations: `{ destructiveHint: false }` (writes new rows; never deletes).
The compile layer rejects calls against non-memory-preset DBs with a
one-sentence `error.status: "wrong_preset"` (GLOBAL-012).

## Steps

1. New handler in `apps/api/src/ask/` (or `apps/api/src/memory/`) that takes
   a typed payload and emits a deterministic `INSERT … RETURNING id` against
   the E-01 schema. **Reuses the existing typed-plan pipeline** — LLM does
   NOT compose this SQL (the payload is structured; the compiler emits SQL
   directly). This preserves the trust boundary.
2. `packages/mcp/src/server.ts` — register `nlqdb_remember` next to the
   three existing tools. Title + description carry the memory framing
   (consistent with WS-04). Behaviour calls the new API endpoint via the
   shared `client`.
3. Idempotency-Key per GLOBAL-005. OTel span `nlqdb.memory.remember` per
   GLOBAL-014.
4. SDK parity per GLOBAL-003: `client.remember()` on `packages/sdk/` so
   `/v1/run` users and the CLI can call it via `nlq remember`.
5. Tests: MCP InMemoryTransport protocol test + a `tests/e2e/mcp` smoke
   that walks `remember → query` against a Neon branch.

## Done when

- [x] `nlqdb_remember` registered (server.ts), schema documented, deterministic (server builds the parameterised INSERT, SK-PIVOT-008).
- [x] SDK `remember()` shipped same PR (GLOBAL-003 parity, auto-keyed). ◐ CLI `nlq remember` is the tracked fast-follow (the CLI is Go, out of this TS slice).
- [x] OTel span (`nlqdb.memory.remember`) emitted; wrong-preset DBs rejected with the one-sentence error; pk_live (read-only) → forbidden. Idempotency-Key accepted with the same posture as `/v1/run` (SDK auto-keys; the general dedupe middleware is the idempotency feature's open work).
- [x] All three existing MCP tools unchanged (SK-MCP-002 honoured) — 33 → 36 MCP tests (3 added), all green.
- [x] `bun run typecheck && lint && test` green (API 840, MCP 36, SDK 52). ◐ The `tests/e2e/mcp` Neon-branch `remember → query` smoke is the deferred infra-gated follow-on.
- [x] Engine INDEX tracker + status ticked.

## Artifact

A 30-line "how to give your Claude/Cursor/VS Code agent memory in one MCP
config" gist → `distribution-queue.md`. **Deferred this run** to avoid
colliding with the in-flight WS-09 PR (#431), which is rewriting
`distribution-queue.md`; queue it once #431 merges.

## Rollback

`registerTool` is one call site; remove it + the new endpoint handler. No
existing tool or row format changed.
