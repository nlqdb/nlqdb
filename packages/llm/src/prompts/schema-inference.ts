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
].join("\n");

export function buildSchemaInferUser(req: SchemaInferRequest): string {
  return `Goal: ${req.goal.trim()}`;
}
