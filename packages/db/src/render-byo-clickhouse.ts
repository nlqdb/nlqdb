// BYO ClickHouse connect-time schema rendering — the ClickHouse parallel of
// `render-byo-postgres.ts` (`SK-DB-015`), not a generalisation of it. It turns
// the faithful read-model `introspect-clickhouse.ts` produces into the two
// stored fields `/v1/ask` needs: `schema_text` (the schema the planner reads)
// and `schema_hash` (the plan-cache content-address, `GLOBAL-006`). It ships
// ahead of its `registerByoDb` caller, the same primitive-ahead-of-callers
// rhythm the rest of the BYO connect-path family followed.
//
// Why render to `CREATE TABLE` text: a BYO database the planner has never
// authored should look in the prompt the same as a hosted one — same
// table-cards, same column-and-type lines — so the engine-quality work
// transfers unchanged. We render the introspected ClickHouse types verbatim
// (`UInt64`, `Nullable(String)`, `LowCardinality(String)`) rather than a closed
// enum: the schema already exists, so faithfulness beats normalisation.
//
// Two ClickHouse-specific honesty constraints separate this from the Postgres
// render:
//   • No foreign keys. ClickHouse has none, and the read-model carries no FK
//     field — so there is nothing to emit, unlike the Postgres `ALTER TABLE …
//     ADD FOREIGN KEY` lines.
//   • The primary key is an *expression*, not a column list. `system.tables`
//     reports it verbatim (`toYYYYMM(event_date), user_id`) and a ClickHouse
//     key need not be column-ordered, so we render it as a trailing
//     `-- PRIMARY KEY (<expr>)` comment rather than a `PRIMARY KEY (...)` clause
//     that would misrepresent it as an ordered column list.
//
// The output is deterministic — the read-model is already sorted
// (`introspect-clickhouse.ts` `assemble`) and we sort tables by name again here
// for belt-and-braces — so the same schema always renders the same text and
// therefore the same hash. Pure + zero-dep, owned by `packages/db` per
// `GLOBAL-021`.

import type {
  IntrospectedClickhouseSchema,
  IntrospectedClickhouseTable,
} from "./introspect-clickhouse.ts";
import type { RenderedSchema } from "./render-byo-postgres.ts";
import { fingerprintSchema } from "./schema-fingerprint.ts";

// Double-quote an identifier, escaping any embedded quote (ClickHouse uses the
// same `"`-doubling rule as Postgres for double-quoted identifiers).
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function qualified(database: string, name: string): string {
  return `${quoteIdent(database)}.${quoteIdent(name)}`;
}

function renderTable(table: IntrospectedClickhouseTable, database: string): string {
  // Columns in introspected position order — `system.columns` was ordered by
  // `position`, so the read-model already carries the declaration order.
  const lines = table.columns.map((col) => `  ${quoteIdent(col.name)} ${col.type}`);
  const body = `CREATE TABLE ${qualified(database, table.name)} (\n${lines.join(",\n")}\n)`;
  // The PK is an expression, not a column list — render it as a trailing
  // comment so the planner sees it without us inventing an ordered column list.
  if (table.primaryKey.length > 0) {
    return `${body}\n-- PRIMARY KEY (${table.primaryKey})`;
  }
  return body;
}

// Render an introspected BYO ClickHouse schema into `{ schemaText, schemaHash }`.
// Pure: the same read-model always yields the same result.
export function renderByoClickhouseSchema(schema: IntrospectedClickhouseSchema): RenderedSchema {
  const tables = [...schema.tables].sort((a, b) => a.name.localeCompare(b.name));
  const schemaText = tables.map((t) => renderTable(t, schema.database)).join("\n\n");
  return { schemaText, schemaHash: fingerprintSchema(schemaText) };
}
