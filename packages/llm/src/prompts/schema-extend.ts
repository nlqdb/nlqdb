// System prompt + user-message builder for the widen-on-write extend op
// (GLOBAL-041 Phase A step 2, exec half — the create path's SK-HDC-002
// analogue for evolution). Lives in `prompts/` beside `schema-inference.ts`
// so each typed-plan op keeps its structural contract out of the caller's
// free-form goal (docs/research-receipts.md §2 — the "validated typed plan"
// promise under prompt injection).
//
// The LLM is told to emit a JSON object matching `WidenPlanSchema` in
// `packages/db/src/types.ts` verbatim — `{ create_tables[], add_columns[] }`,
// never raw DDL (GLOBAL-037 schema-only egress). It EXTENDS the observed
// schema to admit the write's fields; it never re-designs it. Widen-only
// (SK-SCHEMA-008): new columns are always NULLABLE and carry no DEFAULT — an
// already-populated table cannot take a NOT NULL / defaulted add, and a
// retype is a previewed proposal (SK-SCHEMA-009), not a silent widen.

import type { ExtendSchemaRequest } from "../types.ts";

export const SCHEMA_EXTEND_SYSTEM = [
  "You extend an EXISTING Postgres schema so a new write can land, without",
  "re-modeling it. The user's write references a table or field the schema",
  "does not yet have; emit the smallest schema change that admits it.",
  "Emit ONLY a JSON object matching this shape (no prose, no code fences):",
  "{",
  '  "create_tables": [{                          // 0-20 — tables the write',
  "    //                                            references that DO NOT exist yet",
  '    "name": "lower_snake_case",',
  '    "description": "<short>",',
  '    "columns": [{                             // 1-50 columns',
  '      "name": "lower_snake_case",',
  '      "type": "text|integer|bigint|numeric|real|double_precision|boolean|date|timestamp_tz|uuid|jsonb|text_array",',
  '      "nullable": true,',
  '      "description": "<short>"',
  "    }],",
  '    "primary_key": ["col_name"]               // ≥1 column',
  "  }],",
  '  "add_columns": [{                            // 0-50 — new columns on tables',
  "    //                                            that ALREADY exist",
  '    "table": "<existing table name>",',
  '    "column": {',
  '      "name": "lower_snake_case",',
  '      "type": "<one of the types above>",',
  '      "nullable": true,                       // MUST be true — never NOT NULL',
  '      "description": "<short>"',
  "    }",
  "  }]",
  "}",
  // The three widen-only invariants — mirror WidenPlanSchema's refinements,
  // AddColumnOpSchema, and compile-write-ddl.ts (one grammar across
  // parse → compile → allow-list).
  "Rules:",
  "- Every added column MUST be nullable and MUST NOT carry a DEFAULT — an",
  "  already-populated table cannot take a NOT NULL or defaulted add.",
  "- NEVER re-create a table that already exists, and NEVER re-add a column",
  "  that already exists. Only emit the tables/columns that are missing.",
  "- Infer each type from the value the write supplies (a money amount is",
  "  numeric, a count is integer, an id is uuid or text, a flag is boolean).",
  "- Emit at least one op. Never use a Postgres reserved word (select, table,",
  "  user, order, group, ...) as an identifier.",
].join("\n");

export function buildSchemaExtendUser(req: ExtendSchemaRequest): string {
  return [
    "Current schema (extend this — do not re-design it):",
    req.schema.trim(),
    "",
    `Write goal: ${req.goal.trim()}`,
  ].join("\n");
}
