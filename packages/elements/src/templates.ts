// Template registry. Each template is a pure function (Row[]) -> HTML
// string. Templates ESCAPE every value before interpolating, so an
// LLM that returns hostile data can't inject HTML — the safety
// property DESIGN §3.5 calls out lives here.
//
// New templates: add a function below, register in `templates`, add a
// case to the `TemplateName` union.

export type Row = Record<string, unknown>;
export type TemplateName = "table" | "list" | "kv";
export type TemplateFn = (data: Row[]) => string;

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Columns are the union of keys across all rows, ordered by first
// appearance. Stable + tolerant of sparse rows that arrive over time.
function inferColumns(data: Row[]): string[] {
  const cols: string[] = [];
  for (const row of data) {
    for (const k of Object.keys(row)) {
      if (!cols.includes(k)) cols.push(k);
    }
  }
  return cols;
}

export function tableTemplate(data: Row[]): string {
  if (!Array.isArray(data) || data.length === 0) {
    return `<div class="nlq-empty">No rows.</div>`;
  }
  const columns = inferColumns(data);
  const head = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = data
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(formatValue(row[c]))}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table class="nlq-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function listTemplate(data: Row[]): string {
  if (!Array.isArray(data) || data.length === 0) {
    return `<div class="nlq-empty">No items.</div>`;
  }
  const items = data
    .map((row) => {
      const keys = Object.keys(row);
      if (keys.length === 0) return "";
      const primaryKey = keys[0] as string;
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

export function kvTemplate(data: Row[]): string {
  if (!Array.isArray(data) || data.length === 0) {
    return `<div class="nlq-empty">No data.</div>`;
  }
  const row = data[0] as Row;
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
  const rows = Array.isArray(data) ? (data as Row[]) : [];
  const fn = templates[name as TemplateName] ?? templates.table;
  return fn(rows);
}
