// Row-truncation math for the chat Data block (SK-WEB-005 — "the data is
// the proof", so a dropped row must never be silent).
//
// The block renders at most MAX_ROWS. The "+N more rows" footer must count
// rows beyond what is *rendered*, not beyond the returned array — otherwise
// a complete uncapped result (where `rowCount === rows.length`, the shape
// `/v1/ask` actually returns) makes `rowCount > rows.length` false and rows
// 51+ vanish with no indicator. This mirrors the correct SampleTable.tsx
// comparison (against the rendered cap), which the chat block had diverged
// from.

export const MAX_ROWS = 50;

// Rows hidden below the fold: the true total (server `rowCount` when
// present, else the returned length) minus what we actually render. `Math.max`
// against the returned length keeps an inconsistent low `rowCount` from
// masking real dropped rows; the outer `Math.max(0, …)` clamps to a
// non-negative count so the footer renders only when something is hidden.
export function hiddenRowCount(returnedLength: number, rowCount: number | null): number {
  const total = Math.max(rowCount ?? 0, returnedLength);
  const rendered = Math.min(returnedLength, MAX_ROWS);
  return Math.max(0, total - rendered);
}

// SK-ASK-028 — whether the empty-result notice ("No rows returned.") is
// honest. A committed write returns no rows but a non-zero AFFECTED-row
// count, and empty-read copy right after the user approved the write reads
// as "it didn't happen" (the founder-reported moment). The Answer block
// carries the factual write narration instead.
export function showsEmptyNotice(returnedLength: number, rowCount: number | null): boolean {
  if (returnedLength > 0) return false;
  return !(rowCount !== null && rowCount > 0);
}
