// OTel attribute mapping for the ClickHouse-via-Tinybird adapter.
//
// `SK-MULTIENG-004` pins the canonical values per engine. ClickHouse
// has no canonical `db.system` value in the OTel semconv (v1.27+ stable
// ones are `postgresql`, `redis`, `mongodb`), so we emit `other_sql`.
// Required attributes for this engine are `db.namespace` (the Tinybird
// workspace), `db.operation.name` (`PIPE_CALL` for published pipes,
// otherwise the raw-SQL leading verb — e.g. `SELECT`), and
// `db.query.text` for raw-SQL plans only. Pipe calls intentionally
// omit `db.query.text` — the SQL lives server-side in the published
// Pipe, and the call payload is the parameter bag.
//
// Cardinality is bounded the same way `SK-DB-005` bounds the PG
// adapter: SQL leading verbs are a finite set, and `PIPE_CALL` is a
// single literal. Pipe names live on a separate attribute (see below)
// where the workspace's allowlist is the cardinality cap.

export const DB_SYSTEM = "db.system";
export const DB_NAMESPACE = "db.namespace";
export const DB_OPERATION_NAME = "db.operation.name";
export const DB_QUERY_TEXT = "db.query.text";

// Custom attribute — `db.tinybird.pipe` carries the resolved Pipe name
// when the operation is `PIPE_CALL`. Custom rather than canonical
// because no OTel semconv field maps cleanly onto "named server-side
// query template". Cardinality is bounded by the per-workspace Pipe
// allowlist passed at adapter construction (`SK-MULTIENG-004`).
export const DB_TINYBIRD_PIPE = "db.tinybird.pipe";

// Engine value per `SK-MULTIENG-004`. Tinybird speaks ClickHouse SQL,
// which is not in the OTel semconv canonical list — `other_sql` is the
// spec's explicit fallback for SQL engines without a canonical value.
export const DB_SYSTEM_VALUE = "other_sql";

// Operation name for a published-Pipe call. Distinguished from raw SQL
// because the SQL text lives on the server, so the verb is a property
// of the operation kind, not of the request payload.
export const OP_PIPE_CALL = "PIPE_CALL";

// Strip leading whitespace + line/block comments before tokenising.
// Mirrors the postgres adapter's `detectOperation` so the attribute is
// derived the same way for both engines (`SK-DB-005`).
export function detectSqlOperation(sql: string): string {
  const stripped = sql.replace(/^(?:\s+|--[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, "");
  const verbMatch = stripped.match(/^[A-Za-z]+/);
  if (!verbMatch) return "UNKNOWN";
  return verbMatch[0].toUpperCase();
}

export type TinybirdSpanAttrs = {
  workspace: string;
  operation: string;
  pipe?: string;
  queryText?: string;
};

// Build the request-time attribute bag for `db.query`. The adapter
// adds Tinybird-server-reported attributes (e.g. query_id) on the span
// after the response lands.
export function buildSpanAttributes(input: TinybirdSpanAttrs): Record<string, string> {
  const attrs: Record<string, string> = {
    [DB_SYSTEM]: DB_SYSTEM_VALUE,
    [DB_NAMESPACE]: input.workspace,
    [DB_OPERATION_NAME]: input.operation,
  };
  if (input.pipe) attrs[DB_TINYBIRD_PIPE] = input.pipe;
  if (input.queryText) attrs[DB_QUERY_TEXT] = input.queryText;
  return attrs;
}
