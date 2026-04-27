// Template registry. Each template is a pure function (unknown) -> HTML
// string. Templates ESCAPE every value before interpolating, so an
// LLM that returns hostile data can't inject HTML — the safety
// property DESIGN §3.5 calls out lives here.
//
// Templates accept `unknown` rather than `Row[]` so callers don't have
// to validate first; each template internally filters non-row entries
// (null, primitives, arrays-as-rows) and returns an empty placeholder
// for non-arrays. Keeps the integration surface tiny.
//
// New templates: add a function below, register in `templates`, add a
// case to the `TemplateName` union.

export type Row = Record<string, unknown>;
export type TemplateName = "table" | "list" | "kv";
export type TemplateFn = (data: unknown) => string;

const ESCAPE_RE = /[&<>"']/g;
const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(ESCAPE_RE, (c) => ESCAPE_MAP[c] ?? c);
}

// Coerces any value to a display string. Objects/arrays JSON-serialize;
// circular references degrade to "[circular]" instead of throwing,
// because a real API response with cycles shouldn't blank the table.
export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "[circular]";
    }
  }
  return String(v);
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Filters out anything that isn't a plain object — null, undefined,
// primitives, arrays. Real APIs occasionally return mixed shapes, and
// blanking the rendered output on one bad row is worse than skipping it.
function sanitizeRows(data: unknown): Row[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isRow);
}

// Columns are the union of keys across all rows, ordered by first
// appearance. Set-based dedup keeps it O(n*k) regardless of column
// count (vs the naive `.includes` loop, which is O(n*k*c)).
function inferColumns(rows: Row[]): string[] {
  const seen = new Set<string>();
  const cols: string[] = [];
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        cols.push(k);
      }
    }
  }
  return cols;
}

export function tableTemplate(data: unknown): string {
  const rows = sanitizeRows(data);
  if (rows.length === 0) {
    return `<div class="nlq-empty">No rows.</div>`;
  }
  const columns = inferColumns(rows);
  const head = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(formatValue(row[c]))}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table class="nlq-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function listTemplate(data: unknown): string {
  const rows = sanitizeRows(data);
  if (rows.length === 0) {
    return `<div class="nlq-empty">No items.</div>`;
  }
  const items = rows
    .map((row) => {
      const keys = Object.keys(row);
      const primaryKey = keys[0];
      if (primaryKey === undefined) return "";
      const rest = keys.slice(1);
      const primaryHtml = escapeHtml(formatValue(row[primaryKey]));
      const restHtml = rest.length
        ? `<small>${rest
            .map((k) => `${escapeHtml(k)}: ${escapeHtml(formatValue(row[k]))}`)
            .join(" · ")}</small>`
        : "";
      return `<li>${primaryHtml}${restHtml}</li>`;
    })
    .join("");
  return `<ul class="nlq-list">${items}</ul>`;
}

export function kvTemplate(data: unknown): string {
  const rows = sanitizeRows(data);
  const row = rows[0];
  if (!row) {
    return `<div class="nlq-empty">No data.</div>`;
  }
  const items = Object.entries(row)
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(formatValue(v))}</dd>`)
    .join("");
  return `<dl class="nlq-kv">${items}</dl>`;
}

export const templates: Record<TemplateName, TemplateFn> = {
  table: tableTemplate,
  list: listTemplate,
  kv: kvTemplate,
};

// Falls back to `table` for unknown template names — a typo in HTML
// shouldn't blank the page, just degrade to the most general layout.
export function renderTemplate(name: string, data: unknown): string {
  const fn = templates[name as TemplateName] ?? templates.table;
  return fn(data);
}
