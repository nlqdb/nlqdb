// dbId disambiguator (SK-ASK-009 / SK-HDC-011). Cheap-tier LLM call
// that picks one of the tenant's existing DBs given a goal, with a
// confidence floor enforced by the route handler. Below the floor —
// or when the LLM returns `chosenId: null` — the handler falls back
// to a `409 candidate_dbs` response so the surface can render an
// explicit picker.
//
// The router emits the `llm.disambiguate` span (PERFORMANCE §4 row 4
// pattern); this module is a thin typing seam so the route handler
// stays readable. We deliberately do NOT pass tenant row data into
// the prompt — slugs + schema fingerprints are enough for the cheap
// tier to read the user's *intent* against existing DB names.

import type { DisambiguateCandidate, DisambiguateResponse, LLMRouter } from "@nlqdb/llm";

// SK-ASK-009: the route handler treats anything below this as
// "couldn't tell" and falls back to 409 candidate_dbs. 0.7 chosen as
// a starting point — calibrate against real data once telemetry lands.
export const DISAMBIGUATE_CONFIDENCE_FLOOR = 0.7;

export type DisambiguateDbInput = {
  goal: string;
  candidates: DisambiguateCandidate[];
};

// Validates the LLM's response against the candidate list before
// returning — a hallucinated id (one not in the input set) is
// downgraded to "no pick" so the caller falls back to 409. The
// confidence floor is the *handler's* business; we just hand back
// the parsed shape.
export async function disambiguateDb(
  llm: LLMRouter,
  input: DisambiguateDbInput,
): Promise<DisambiguateResponse> {
  const result = await llm.disambiguate({ goal: input.goal, candidates: input.candidates });
  if (result.chosenId === null) return result;
  const known = new Set(input.candidates.map((c) => c.id));
  if (!known.has(result.chosenId)) {
    return { chosenId: null, confidence: 0, reason: "llm_picked_unknown_id" };
  }
  return result;
}
