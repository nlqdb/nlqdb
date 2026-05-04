// TEMPORARY — last surface still consuming the canned-fixture
// library. SK-WEB-008 retired the public `/v1/demo/ask` route; this
// shortcut routes `/v1/chat/messages` calls with `dbId="demo"`
// through the same `buildDemoResult` (`apps/api/src/demo.ts`) so
// the chat surface keeps rendering for new signed-in users who
// have zero rows in `databases`.
//
// Trade-off: replies are canned (matched on goal substring), not
// real LLM/SQL. Useful for "see what the surface feels like";
// not for "explore your data". The empty-state copy in
// /app/index.astro tells users to use `dbId=demo` for this.
//
// Retirement plan: when `/v1/chat/messages` migrates to real LLM
// against the user's auto-created anonymous DB on first send (the
// chat-surface analogue of SK-WEB-008), this file deletes — same
// directive, same architecture, different surface. Tracked as the
// follow-up to SK-WEB-008's "carousel is the only static-fixture
// surface" stance.

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
