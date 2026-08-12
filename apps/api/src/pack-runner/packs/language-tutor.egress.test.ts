// INV-EKP-037 egress guard — EK-04 box 5 (`SK-EKP-007`, hardened 2026-08-07).
//
// The invariant: a buyer's knowledge-DB *query* path sends schema tokens only
// — zero expert row values — to the model. The interview (authoring) path is
// the ONLY path an expert's cell values reach an LLM, and only on the
// expert's OWN tenant; a cross-tenant buyer query reuses the unmodified
// `GLOBAL-037` schema-only egress. This is the technical floor under
// `SK-EKP-001`'s "not allowed" trust claim (EK-03) — the copy may never
// exceed it.
//
// The test wires the two real halves together and asserts the seam holds:
//   - the language-tutor pack's authored cell values (a tutor's knowledge,
//     the paid product `SK-EKP-008` protects), and
//   - the exact planner egress a buyer's `/v1/ask` plan hop emits —
//     `buildPlanSystem` (system) + `buildPlanUser` (user); see
//     `packages/llm/src/providers/_chat-provider.ts` `plan()` — built over
//     the real `agent_memory_v1` DDL a knowledge DB carries in `schemaText`.
//
// The plan hop is the ONLY LLM hop a knowledge-DB query reaches: the
// summarize hop is skipped for `agent_memory_v1` DBs (`orchestrate.ts`
// `skipSummary = ... || isAgentMemoryV1Db(db.id)`, EK-09 box 2 / GLOBAL-037
// lane 2), so no returned rows transit narration either. Proving the plan
// egress is schema-only therefore proves the whole query path is. A
// regression that samples rows into the plan prompt fails here.

import { buildPlanSystem, buildPlanUser } from "@nlqdb/llm";
import { describe, expect, it } from "vitest";
import { agentMemoryV1Ddl } from "../../db-create/presets/agent-memory-v1.ts";
import type { MemoryRecord, SourceDescriptor, SourceItem } from "../types.ts";
import { type InterviewExchange, languageTutorPack } from "./language-tutor.ts";

// A tutor's completed interview session — the distinctive knowledge a buyer
// would pay to query: a named student, the rule they slip on, and the
// tutor's own pricing heuristic. Every episode/fact `content` and entity
// `canonical_name` below is an expert row value a query must never leak.
const EXCHANGES: InterviewExchange[] = [
  {
    id: "ex-1",
    role: "lesson",
    episode: "Alex Rivera kept using the indicative where the subjunctive was required.",
    extractions: [
      { object: "entity", kind: "student", name: "Alex Rivera" },
      { object: "entity", kind: "grammar_rule", name: "subjunctive" },
      {
        object: "fact",
        kind: "mistake",
        content: "indicative used where the subjunctive was required",
        tags: ["subjunctive"],
      },
    ],
  },
  {
    id: "ex-2",
    role: "lesson",
    episode: "We discussed how I set the price for exam-prep intensives.",
    extractions: [
      {
        object: "fact",
        kind: "pricing_heuristic",
        content: "charge a premium for exam-prep intensive lessons",
        tags: ["pricing"],
      },
    ],
  },
];

const SOURCE: SourceDescriptor = {
  kind: "interview-session",
  ref: "interview session s-egress",
  pin: "s-egress",
  meta: { sessionId: "s-egress" },
};

function item(exchange: InterviewExchange): SourceItem {
  const text = JSON.stringify(exchange);
  return { id: exchange.id, bytes: text.length, text };
}

// The paid product: an expert's authored free-text — episode narrations,
// fact contents, and entity names. The guard targets these, not incidental
// generic vocabulary (a `pricing` tag), because a buyer's own question can
// legitimately echo a generic word; only authored content is a value a query
// could carry *by leaking a row*.
function authoredValues(records: MemoryRecord[]): string[] {
  const out: string[] = [];
  for (const r of records) {
    if (r.object === "episode" || r.object === "fact") out.push(r.payload.content);
    else out.push(r.payload.canonical_name);
  }
  return out.filter((s) => s.trim().length > 0);
}

describe("INV-EKP-037 — the knowledge-DB query egress is schema-only", () => {
  // A knowledge DB is an `agent_memory_v1` hosted DB; this DDL is what its
  // `schemaText` carries and the only DB context the plan hop ever sees.
  const schema = agentMemoryV1Ddl("db_agent_memory_v1_expert").join("\n");
  const rows = authoredValues(languageTutorPack.extract(EXCHANGES.map(item), SOURCE));

  it("carries the tutor's real authored rows, so the guard is not vacuous", () => {
    expect(rows).toContain("Alex Rivera");
    expect(rows).toContain("charge a premium for exam-prep intensive lessons");
    expect(rows).toContain("indicative used where the subjunctive was required");
    expect(rows).toContain("subjunctive");
  });

  it.each([
    "List the tutor's pricing heuristics.",
    "Which grammar rules has the student most often slipped on?",
  ])("sends zero expert row values to the model for the buyer query: %s", (goal) => {
    // The exact two messages the plan hop emits. `retrieveExemplars` defaults
    // to 0 in production, so `buildPlanSystem` returns the static PLAN_SYSTEM
    // byte-for-byte (SK-LLM-041 half (b) / SK-LLM-024).
    const egress = [
      buildPlanSystem(goal, schema, 0),
      buildPlanUser({ goal, schema, dialect: "postgres" }),
    ].join("\n");

    for (const value of rows) expect(egress).not.toContain(value);

    // Positive control: the full schema DDL and the buyer's own goal DO
    // transit — the only tokens GLOBAL-037 permits. Proves the egress is real
    // (not empty) and that a row value's absence is a genuine boundary, not a
    // builder that dropped everything.
    expect(egress).toContain(schema);
    expect(egress).toContain(goal);
  });
});
