// Pure grouping for create-path sample rows, shared by the marketing
// CreateForm result view and the in-chat `created` reply (SampleTable.tsx).
// Values are `unknown` so it accepts both the web fetch shape (`CreateRow`)
// and the SDK's `AskCreateResult.sampleRows` (`Record<string, unknown>`).
export type SampleRow = { table: string; values: Record<string, unknown> };

export function groupByTable(
  rows: SampleRow[],
): { table: string; rows: Record<string, unknown>[] }[] {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const list = groups.get(row.table) ?? [];
    list.push(row.values);
    groups.set(row.table, list);
  }
  return Array.from(groups, ([table, rows]) => ({ table, rows }));
}

// Render one group per *provisioned* table (the SchemaPlan's table list),
// joining in sample rows where the seed covered them. The create response's
// seed set is LLM-authored and may be partial or empty (SK-HDC-018/019), so
// deriving the table list from `sampleRows` alone silently drops unseeded
// tables — and a fully-unseeded create would show "0 tables" despite a
// committed schema. `tables` is the source of truth; fall back to grouping the
// rows only when it's absent (a response from before the field shipped).
export function groupProvisionedTables(
  tables: readonly string[] | undefined,
  rows: SampleRow[],
): { table: string; rows: Record<string, unknown>[] }[] {
  const seeded = groupByTable(rows);
  if (!tables || tables.length === 0) return seeded;
  const bySeed = new Map(seeded.map((g) => [g.table, g.rows]));
  return tables.map((table) => ({ table, rows: bySeed.get(table) ?? [] }));
}
