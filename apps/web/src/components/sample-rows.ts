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
