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
  // `tables` crosses untyped boundaries (rehydrated localStorage history,
  // the SDK's `plan: unknown`), so a non-array can slip past the type — fall
  // back to grouping the rows rather than throwing on `.map`.
  if (!Array.isArray(tables) || tables.length === 0) return seeded;
  const bySeed = new Map(seeded.map((g) => [g.table, g.rows]));
  return tables.map((table) => ({ table, rows: bySeed.get(table) ?? [] }));
}

// React list key for one create-path sample row. The seeded set is
// LLM-authored with no unique id, and small lookup/enum/join tables can seed
// duplicate rows — so a key built from the cell values alone collides across
// identical rows. Prefixing the render position keeps duplicates distinct,
// matching the chat result table (Data.tsx), which SampleTable had diverged
// from (a bare value-join key → colliding React keys on duplicate rows).
export function sampleRowKey(index: number, cells: string[]): string {
  return `${index}:${cells.join("|")}`;
}
