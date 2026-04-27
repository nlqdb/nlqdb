// TEMPORARY (Slice 11 retires this file).
//
// New users have zero rows in the `databases` table, so every
// `/v1/chat/messages` send returns `db_not_found` and the chat is
// effectively useless until the anonymous-DB-creation flow lands.
// This shortcut routes `dbId="demo"` to the same canned fixtures
// `/v1/demo/ask` already serves — so the chat surface works
// end-to-end (turns persist, history replays, the renderer
// exercises both code paths) for anyone signed in.
//
// Trade-off: replies are canned (matched on goal substring), not
// real LLM/SQL. Useful for "see what the surface feels like";
// not for "explore your data". The empty-state copy in
// /app/index.astro tells users to use `dbId=demo` for this.
//
// Slice 11 deletes this file: composer collapses to one input,
// API auto-creates a per-user anonymous DB on first send, no
// magic dbId values needed.

import type { OrchestrateOutcome } from "../ask/orchestrate.ts";
import type { AskRequest } from "../ask/types.ts";
import { buildDemoResult } from "../demo.ts";

export const DEMO_DB_ID = "demo";

// Returns an `ask` dep that adapts buildDemoResult's shape to
// OrchestrateOutcome. Same `(req) => Promise<OrchestrateOutcome>`
// signature as the real `orchestrateAsk(askDeps, req)` curry, so
// chat/orchestrate.ts is unchanged.
export function askFnFromDemoFixtures(): (req: AskRequest) => Promise<OrchestrateOutcome> {
  return async (req) => {
    const fixture = buildDemoResult(req.goal);
    return {
      ok: true,
      result: {
        status: "ok",
        cached: fixture.cached,
        sql: fixture.sql,
        rows: fixture.rows,
        rowCount: fixture.rowCount,
        summary: fixture.summary,
      },
    };
  };
}
