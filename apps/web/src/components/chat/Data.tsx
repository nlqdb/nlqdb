// Data — the raw-result half of the three-part reply (SK-WEB-005).
// The shape inference here is the same heuristic the marketing
// `<nlq-data>` element uses (`packages/elements`): single row → kv,
// array of strings → list, otherwise table. Surfaces never
// paraphrase the data away — even when an Answer is present.

type Row = Record<string, unknown>;

interface DataProps {
  rows: Row[] | null;
  rowCount: number | null;
  pending: boolean;
}

const MAX_ROWS = 50;

export default function Data({ rows, rowCount, pending }: DataProps) {
  if (pending && !rows) {
    return (
      <div className="chat-data chat-data--skeleton" aria-busy="true">
        <div className="chat-data__skeleton-row" />
        <div className="chat-data__skeleton-row" />
        <div className="chat-data__skeleton-row" />
      </div>
    );
  }
  if (!rows) return null;
  if (rows.length === 0) {
    return <p className="chat-data chat-data--empty">No rows returned.</p>;
  }

  const shape = inferShape(rows);
  return (
    <div className="chat-data" data-shape={shape}>
      {shape === "kv" && rows[0] ? <KvBlock row={rows[0]} /> : null}
      {shape === "list" ? <ListBlock rows={rows} /> : null}
      {shape === "table" ? <TableBlock rows={rows} /> : null}
      {rowCount && rowCount > rows.length ? (
        <p className="chat-data__more">+ {rowCount - rows.length} more rows</p>
      ) : null}
    </div>
  );
}

function inferShape(rows: Row[]): "kv" | "list" | "table" {
  if (rows.length === 1) return "kv";
  const firstRow = rows[0];
  if (!firstRow) return "table";
  const cols = Object.keys(firstRow);
  if (cols.length === 1) return "list";
  return "table";
}

function KvBlock({ row }: { row: Row }) {
  const entries = Object.entries(row);
  return (
    <dl className="chat-data__kv">
      {entries.map(([key, value]) => (
        <div className="chat-data__kv-pair" key={key}>
          <dt>{key}</dt>
          <dd>{formatCell(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ListBlock({ rows }: { rows: Row[] }) {
  const visible = rows.slice(0, MAX_ROWS);
  return (
    <ul className="chat-data__list">
      {visible.map((row, idx) => {
        const value = Object.values(row)[0];
        // The data is an opaque LLM-generated result set with no
        // guaranteed unique key — fall back to "value@idx" so
        // duplicate values across positions still get distinct
        // keys without forcing the caller to invent one.
        const key = `${idx}:${formatCell(value)}`;
        return <li key={key}>{formatCell(value)}</li>;
      })}
    </ul>
  );
}

function TableBlock({ rows }: { rows: Row[] }) {
  const visible = rows.slice(0, MAX_ROWS);
  const firstRow = visible[0];
  if (!firstRow) return null;
  const columns = Object.keys(firstRow);
  return (
    <div className="chat-data__tablewrap">
      <table className="chat-data__table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, idx) => {
            // Same constraint as ListBlock — no stable id from the
            // LLM result set. Concatenating column values gives a
            // best-effort unique key per row.
            const key = `${idx}:${columns.map((c) => formatCell(row[c])).join("|")}`;
            return (
              <tr key={key}>
                {columns.map((c) => (
                  <td key={c}>{formatCell(row[c])}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
