# SK-PIVOT-008 — The memory **write** verb is a dedicated server endpoint that builds the SQL itself, never `/v1/run`

- **Decision:** `nlqdb_remember` (E-02) writes through a dedicated
  `POST /v1/memory/remember` endpoint. The server — not the LLM, not the
  caller — builds the deterministic parameterised `INSERT … RETURNING`
  (`apps/api/src/memory/remember.ts` `buildRememberInsert`): every identifier
  is drawn from the fixed `AGENT_MEMORY_V1_COLUMNS` allow-list, every value is
  a bound `$n`. Rejected with `wrong_preset` (409) unless the target DB is an
  `agent_memory_v1` preset (the `db_agent_memory_v1_` id prefix). Entities
  upsert on the `(agent_id, kind, canonical_name)` UNIQUE. `agent_id`
  resolution + scoping is SK-PIVOT-009.
- **Core value:** Bullet-proof, Simple, Goal-first
- **Why:** Routing the write through `/v1/run` would re-open string-built SQL
  over arbitrary agent content and move SQL authorship to the caller — exactly
  the trust boundary the typed-plan pipeline keeps (`SK-PIVOT-006`). A
  server-built endpoint keeps it: the agent controls *data*, never *SQL*. The
  `wrong_preset` guard fails loud (GLOBAL-012). `buildMemoryExec` reuses the
  read path's `set_config('app.tenant_id', …)` transaction so RLS governs the
  INSERT's `WITH CHECK` too.
- **Consequence in code:** New `apps/api/src/memory/remember.ts` (builder +
  validator + orchestrator) + `buildMemoryExec` in `ask/build-deps.ts` + the
  route. SDK `client.remember()` (GLOBAL-003 parity, auto-keyed, `SK-SDK-006`)
  + the additive `nlqdb_remember` tool ship the same PR; `wrong_preset` joins
  the SDK `ApiErrorCode` union. CLI `nlq remember` (Go) is the tracked
  fast-follow. Idempotency has the same accept-the-header posture as `/v1/run`.
- **Alternatives rejected:** **Write via `/v1/run`** — re-opens string-SQL
  over agent content, breaks the boundary. · **Let the LLM compose the
  INSERT** — non-deterministic + a token cost for a mechanical write. ·
  **Generic `/v1/memory` with a `verb` field** — over-abstracts three fixed
  shapes; an explicit `kind` discriminant is simpler.
