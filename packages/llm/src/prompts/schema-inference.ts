// System prompt + user-message builder for hosted db.create's
// schema-inference op (SK-HDC-002). Lives in `prompts/` so we can
// add per-op prompt files without inflating the legacy `prompts.ts`
// monofile (which still serves classify / plan / summarize).
//
// The LLM is told to emit a JSON object that the Zod schema in
// `packages/db/src/types.ts` (SchemaPlan) will validate verbatim —
// never raw DDL. Keeping the structural contract in the prompt
// (instead of the caller's free-form goal) is what makes the
// "validated typed plan" promise hold under prompt injection per
// docs/research-receipts.md §2.

import type { SchemaInferRequest } from "../types.ts";

export const SCHEMA_INFER_SYSTEM = [
  "You design a Postgres schema from a short natural-language goal.",
  "Emit ONLY a JSON object matching this shape (no prose, no code fences):",
  "{",
  '  "slug_hint": "lower_snake_case",          // 1-63 chars, /^[a-z][a-z0-9_]*$/',
  '  "description": "<1-2 sentences>",',
  '  "tables": [{                                // 1-20 tables',
  '    "name": "lower_snake_case",',
  '    "description": "<short>",',
  '    "columns": [{                             // 1-50 columns',
  '      "name": "lower_snake_case",',
  '      "type": "text|integer|bigint|numeric|real|double_precision|boolean|date|timestamp_tz|uuid|jsonb|text_array",',
  '      "nullable": true,',
  '      "default": null,',
  '      "description": "<short>"',
  "    }],",
  '    "primary_key": ["col_name"]               // ≥1 column',
  "  }],",
  '  "foreign_keys": [{                          // 0-50',
  '    "from_table": "...", "from_columns": ["..."],',
  '    "to_table": "...", "to_columns": ["..."],',
  '    "on_delete": "cascade|restrict|set_null|no_action"',
  "  }],",
  '  "metrics": [{                               // required array; 0-30',
  '    "name": "lower_snake_case", "description": "<short>",',
  '    "agg": "sum|count|count_distinct|avg|min|max",',
  '    "expression": "<table>.<column>"',
  "  }],",
  '  "dimensions": [{                            // required array; 0-50',
  '    "name": "...", "description": "...",',
  '    "table": "...", "column": "..."',
  "  }],",
  '  "sample_rows": [{                           // 3-5 per table, 0-50 total',
  '    "table": "...", "values": { "<col>": <value>, ... }',
  "  }]",
  "}",
  "Use realistic but small sample values. Never use Postgres reserved words",
  "(select, table, user, order, group, ...) as identifiers.",
  "metrics and dimensions are required arrays — emit [] when none, never omit.",
  // SK-LLM-033 — sample rows are inserted under the foreign keys + NOT NULL
  // constraints they declare; a row that violates them aborts the whole
  // create. Constrain the LLM up front so seed data is insertable.
  "sample_rows MUST satisfy the schema you designed: list a referenced",
  "table's rows BEFORE rows that reference it; every foreign-key value MUST",
  "equal a primary-key value present in an earlier sample row of the",
  "referenced table; include every NOT NULL column. When unsure a row is",
  "valid, emit fewer rows — never a row that breaks a constraint.",
].join("\n");

export function buildSchemaInferUser(req: SchemaInferRequest): string {
  const parts = [`Goal: ${req.goal.trim()}`];
  if (req.previousAttempt) {
    // SK-HDC-020 — diagnostic-first re-inference framing (same shape as
    // the planner's SK-LLM-018 retry block). The model edits exactly what
    // the validator named instead of redesigning a schema it already got
    // almost right; the most common cause is a reserved-word identifier.
    parts.push(
      [
        "Your previous JSON failed schema validation:",
        req.previousAttempt.plan,
        "Validation problems:",
        req.previousAttempt.issues,
        "Return the FULL corrected JSON object (every required key: slug_hint,",
        "description, tables, foreign_keys, metrics, dimensions, sample_rows).",
        "Fix only what the problems name and keep everything else identical —",
        "for a reserved-word identifier, rename it (e.g. append _entry).",
      ].join("\n"),
    );
  }
  return parts.join("\n\n");
}
