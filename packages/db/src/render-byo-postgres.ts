// BYO Postgres connect-time schema rendering — the next primitive in the BYO
// connect-path family after the introspection reader (`SK-DB-014`,
// `introspect-postgres.ts`). It turns the faithful read-model that reader
// produces into the two stored fields `/v1/ask` needs: `schema_text` (the
// schema description the planner reads) and `schema_hash` (the plan-cache
// content-address, `GLOBAL-006`). It ships ahead of its `registerByoDb` caller,
// the same primitive-ahead-of-callers rhythm the rest of the family followed.
//
// Why render to DDL text rather than invent a new shape: the hosted create path
// stores `schema_text` as the compiled `CREATE TABLE` DDL (`orchestrate.ts`
// step 5, `compile-ddl.ts`), and the planner prompt is tuned on that shape. A
// BYO database the planner has never authored should look the same in the
// prompt as one it did — same table-cards, same column-and-type lines — so the
// engine-quality work transfers unchanged. We render the user's *introspected*
// types verbatim (`integer`, `character varying(255)`, `text[]`) rather than
// the create path's closed enum: this schema already exists, so faithfulness to
// what is really there beats normalising it.
//
// Two honesty constraints separate this from `compile-ddl.ts`:
//   • Foreign keys are rendered without a constraint name. The read-model drops
//     the name on assembly (`introspect-postgres.ts`), and synthesising one
//     would put an identifier in the prompt that does not exist in the user's
//     database. `ADD FOREIGN KEY (...) REFERENCES ...` is valid, faithful, and
//     carries the only thing the planner needs from a FK — the relationship.
//   • No `ON DELETE`, no `CREATE INDEX`, no auto-`IDENTITY`: introspection does
//     not read referential actions or indexes, and we never write to a BYO
//     database, so the schema text states what is there and nothing more.
//
// The output is deterministic — the read-model is already sorted
// (`introspect-postgres.ts` `assemble`) — so the same schema always renders the
// same text and therefore the same hash. Pure + zero-dep, owned by
// `packages/db` per `GLOBAL-021`.

import type { IntrospectedSchema, IntrospectedTable } from "./introspect-postgres.ts";
import { fingerprintSchema } from "./schema-fingerprint.ts";

export type RenderedSchema = {
  // The DDL-shaped schema description stored in `databases.schema_text` and fed
  // to the planner — `CREATE TABLE` cards followed by `ALTER TABLE … ADD
  // FOREIGN KEY` lines, joined by blank lines so each statement stays legible.
  schemaText: string;
  // `fingerprintSchema(schemaText)` — the plan-cache content-address.
  schemaHash: string;
};

// Double-quote an identifier, escaping any embedded quote the PG-correct way.
// Matches `compile-ddl.ts` so a hosted and a BYO card quote identically.
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function qualified(schema: string, name: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(name)}`;
}

function renderTable(table: IntrospectedTable, schema: string): string {
  const lines = table.columns.map((col) => {
    // `col.type` is the verbatim `format_type` rendering — already valid SQL.
    const notNull = col.nullable ? "" : " NOT NULL";
    return `  ${quoteIdent(col.name)} ${col.type}${notNull}`;
  });
  if (table.primaryKey.length > 0) {
    lines.push(`  PRIMARY KEY (${table.primaryKey.map(quoteIdent).join(", ")})`);
  }
  return `CREATE TABLE ${qualified(schema, table.name)} (\n${lines.join(",\n")}\n);`;
}

// Render an introspected BYO Postgres schema into `{ schemaText, schemaHash }`.
// Pure: the same read-model always yields the same result.
export function renderByoPostgresSchema(schema: IntrospectedSchema): RenderedSchema {
  // Tables first, then foreign keys — the emission order `compile-ddl.ts` uses,
  // so a forward reference (a FK to a table declared later) never reads oddly.
  const statements = schema.tables.map((t) => renderTable(t, schema.schema));
  for (const fk of schema.foreignKeys) {
    const fromCols = fk.fromColumns.map(quoteIdent).join(", ");
    const toCols = fk.toColumns.map(quoteIdent).join(", ");
    statements.push(
      `ALTER TABLE ${qualified(schema.schema, fk.fromTable)} ` +
        `ADD FOREIGN KEY (${fromCols}) ` +
        `REFERENCES ${qualified(schema.schema, fk.toTable)} (${toCols});`,
    );
  }
  const schemaText = statements.join("\n\n");
  return { schemaText, schemaHash: fingerprintSchema(schemaText) };
}
