import { formatCell, prettifyHeader } from "../lib/text";

// Shared sample-row rendering for the create path. Used by both the
// marketing CreateForm result view and the in-chat `created` reply so a
// stranger sees the same real sample data at their first "did it work?"
// moment on either surface (SK-HDC-001 create path; GLOBAL-020 "returns
// rows"). Styling is the global `createresult__*` chrome (styles/global.css).
// Grouping helpers live in `./sample-rows` — consumers import them from there.

const MAX_ROWS_RENDERED = 5;

export function SampleTable({ table, rows }: { table: string; rows: Record<string, unknown>[] }) {
  const firstRow = rows[0];
  if (!firstRow) {
    return (
      <div className="createresult__table-wrap">
        <h3 className="createresult__table-name">{prettifyHeader(table)}</h3>
        <p className="createresult__empty">No sample rows.</p>
      </div>
    );
  }
  const columns = Object.keys(firstRow);
  const visible = rows.slice(0, MAX_ROWS_RENDERED);
  return (
    <div className="createresult__table-wrap">
      <h3 className="createresult__table-name">{prettifyHeader(table)}</h3>
      <div className="createresult__tablewrap">
        <table className="createresult__table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col">
                  {prettifyHeader(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={columns.map((c) => formatCell(row[c])).join("​")}>
                {columns.map((c) => (
                  <td key={c}>{formatCell(row[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ROWS_RENDERED && (
        <p className="createresult__more">+ {rows.length - MAX_ROWS_RENDERED} more rows</p>
      )}
    </div>
  );
}
