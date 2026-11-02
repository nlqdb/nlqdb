// The schema of an attached Cloudflare D1, for `databases.schema_text` /
// `schema_hash` (`GLOBAL-043` item 6, the D1 attach door). SQLite keeps each
// object's `CREATE` statement verbatim in `sqlite_master`, so the stored text
// is the app's own DDL — one request over `d1RestBatch`, D1 Read only.

import type { D1BatchFn } from "./d1/rest.ts";
import type { RenderedSchema } from "./render-byo-postgres.ts";
import { fingerprintSchema } from "./schema-fingerprint.ts";

// SQLite's own objects and D1's internal ones (`_cf_KV`, `_cf_METADATA`) are
// left out, as in `observeD1Catalog`.
const SCHEMA_SQL =
  "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY tbl_name, type = 'index', name";

export async function introspectD1Schema(batch: D1BatchFn): Promise<RenderedSchema> {
  const [rows = []] = await batch([SCHEMA_SQL]);
  const schemaText = rows.map((r) => `${String(r["sql"])};`).join("\n\n");
  return { schemaText, schemaHash: fingerprintSchema(schemaText) };
}
