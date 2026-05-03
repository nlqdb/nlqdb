// Chat-turn orchestrator (Slice 10). Pure function, deps injected —
// same pattern as `/v1/ask`'s orchestrateAsk so unit tests stay
// stub-driven (memory: ask-orchestrator-pattern).
//
// Outcome shape: `Rejected` (preflight error → handler returns 4xx,
// nothing persisted) or `Persisted` (we engaged the orchestrator and
// have rows to store). The split closes a class of abuse where a
// client could fill the `chat_message` table by spamming POSTs with
// a bogus `dbId` — preflight errors short-circuit before any write.
//
// Persist-vs-reject policy:
//   - `rate_limited`     → reject (the user wasn't allowed to engage)
//   - `db_not_found`     → reject (typo'd or cross-tenant dbId)
//   - everything else    → persist (we *did* engage; history is
//                          useful even if the run failed)
//
// `rows` from the underlying ask are capped at MAX_PERSIST_ROWS for
// storage. `truncated: true` on the assistant row tells the renderer
// the original result was longer. Storing the full payload would
// scale chat history at O(rows × turns) — not viable on D1's free
// tier (PR #45 review, item P1).

import type { OrchestrateOutcome } from "../ask/orchestrate.ts";
import type { AskError, AskRequest, AskResult } from "../ask/types.ts";
import type { ChatStore } from "./store.ts";
import type { AssistantChatMessage, UserChatMessage } from "./types.ts";

export type PostChatRequest = {
  userId: string;
  goal: string;
  dbId: string;
};

export type PostChatPersisted = {
  ok: true;
  user: UserChatMessage;
  assistant: AssistantChatMessage;
};

export type PostChatRejected = {
  ok: false;
  // Mirrors AskError so the HTTP handler can route to its existing
  // `errorStatus()` mapper without a parallel switch.
  error: AskError;
};

export type PostChatOutcome = PostChatPersisted | PostChatRejected;

export type ChatDeps = {
  store: ChatStore;
  ask: (req: AskRequest) => Promise<OrchestrateOutcome>;
  now: () => number;
  newId: () => string;
};

// Cap per-row payload. Keeps D1 row size + history-replay JSON
// bounded; the UI already caps render at 50, so storing 50 means
// "replay shows everything the original render showed".
export const MAX_PERSIST_ROWS = 50;

// Errors that mean "we never engaged" — don't pollute chat history
// with these. Centralized here (not in the handler) so any future
// caller of postChatMessage gets the same semantics.
const REJECT_WITHOUT_PERSIST: ReadonlySet<AskError["status"]> = new Set([
  "rate_limited",
  "db_not_found",
]);

export async function postChatMessage(
  deps: ChatDeps,
  req: PostChatRequest,
): Promise<PostChatOutcome> {
  let outcome: OrchestrateOutcome;
  try {
    outcome = await deps.ask({
      userId: req.userId,
      goal: req.goal,
      dbId: req.dbId,
    });
  } catch (err) {
    // Defensive: orchestrateAsk wraps every failure mode in
    // OrchestrateOutcome by contract, but a future regression (or a
    // throw from a dep we didn't anticipate) shouldn't escape and
    // 500 the handler. The thrown error's message can contain
    // provider/Postgres internals (GLOBAL-012) so it is not echoed
    // to the client; the OTel span on this orchestrator captures
    // the root cause server-side.
    void err;
    outcome = { ok: false, error: { status: "llm_failed" } };
  }

  if (!outcome.ok && REJECT_WITHOUT_PERSIST.has(outcome.error.status)) {
    return { ok: false, error: outcome.error };
  }

  const userMsg: UserChatMessage = {
    id: deps.newId(),
    userId: req.userId,
    role: "user",
    dbId: req.dbId,
    goal: req.goal,
    createdAt: deps.now(),
  };
  await deps.store.append(userMsg);

  const assistantMsg: AssistantChatMessage = {
    id: deps.newId(),
    userId: req.userId,
    role: "assistant",
    dbId: req.dbId,
    createdAt: deps.now(),
    result: outcome.ok ? buildSuccess(outcome.result) : buildError(outcome.error),
  };
  await deps.store.append(assistantMsg);

  return { ok: true, user: userMsg, assistant: assistantMsg };
}

function buildSuccess(result: AskResult): AssistantChatMessage["result"] {
  const truncated = result.rows.length > MAX_PERSIST_ROWS;
  return {
    kind: "ok",
    sql: result.sql,
    rows: truncated ? result.rows.slice(0, MAX_PERSIST_ROWS) : result.rows,
    rowCount: result.rowCount,
    truncated,
    cached: result.cached,
    ...(result.summary !== undefined ? { summary: result.summary } : {}),
  };
}

function buildError(error: AskError): AssistantChatMessage["result"] {
  // No AskError variant carries a `message` field anymore — provider
  // and Postgres details stay server-side (GLOBAL-012). The status
  // alone is what the renderer narrows on.
  return { kind: "error", status: error.status };
}
