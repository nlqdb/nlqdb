// Minimal RFC 4180 CSV parser + per-column type inference — feeds the
// Spider 2.0-lite multi-CSV scorer (SK-QUAL-008). Gold CSVs are produced
// by pandas `to_csv()`, so we mirror just the dialect pandas emits:
// double-quoted fields, doubled-quote escape, optional BOM, CRLF/LF rows.
// We don't depend on a CSV library — the harness runs in Bun and the
// gold-side shape is narrow enough that a 60-LOC hand-rolled parser is
// easier to audit than a 500 KB dependency.

const BOM = 0xfeff;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  if (text.charCodeAt(0) === BOM) i = 1;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        // Doubled quote inside a quoted field = literal quote (RFC 4180).
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
      } else {
        field += c;
        i++;
      }
    } else if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === ",") {
      cur.push(field);
      field = "";
      i++;
    } else if (c === "\n" || c === "\r") {
      cur.push(field);
      field = "";
      rows.push(cur);
      cur = [];
      if (c === "\r" && text[i + 1] === "\n") i += 2;
      else i++;
    } else {
      field += c ?? "";
      i++;
    }
  }
  if (field.length > 0 || cur.length > 0 || inQuotes) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

// Pandas `read_csv` defaults: per-column numeric inference when every
// non-empty cell parses as a finite number; otherwise the column stays
// a string. Empty cells become `null` (pandas NaN) regardless.
export type GoldCell = number | string | null;
export type GoldTable = {
  columns: string[];
  // Column-major: `cells[c][r]` is row `r` of column `c`. Matches the
  // `compare_pandas_table` Python source which transposes before the loop.
  cells: GoldCell[][];
};

export function csvToGoldTable(text: string): GoldTable {
  const rows = parseCsv(text);
  if (rows.length === 0) return { columns: [], cells: [] };
  const header = rows[0] ?? [];
  const dataRows = rows.slice(1);
  // pandas `to_csv()` writes a single trailing newline after the last row;
  // drop one trailing `[""]` artifact, never more — successive empty rows
  // belong to the data and should surface as null cells.
  if (dataRows.length > 0) {
    const last = dataRows[dataRows.length - 1];
    if (last && last.length === 1 && last[0] === "") dataRows.pop();
  }
  const cells: GoldCell[][] = [];
  for (let c = 0; c < header.length; c++) {
    const raw = dataRows.map((r) => r[c] ?? "");
    let allNumeric = raw.length > 0;
    for (const s of raw) {
      if (s === "") continue;
      const n = Number(s);
      if (!Number.isFinite(n)) {
        allNumeric = false;
        break;
      }
    }
    cells.push(
      allNumeric
        ? raw.map((s) => (s === "" ? null : Number(s)))
        : raw.map((s) => (s === "" ? null : s)),
    );
  }
  return { columns: header, cells };
}
