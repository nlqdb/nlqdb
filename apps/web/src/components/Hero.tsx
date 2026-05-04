// Marketing-hero goal input (SK-WEB-002, SK-WEB-003).
//
// One input, one button, no signup wall, no pricing dialog. On
// submit POSTs to `/v1/demo/ask` — canned-fixture demo endpoint
// (SK-WEB-004) — and renders the returned rows inline. Real
// anonymous creates against `/v1/ask` only happen from the product
// app (Worksheet 3); the marketing site uses fixtures so we don't
// burn Neon DDL budget on window-shoppers.
//
// Token storage and the Turnstile challenge hook live in
// `lib/anon.ts` and `lib/turnstile.ts`; neither is needed here
// because the demo endpoint takes no auth.

import { useId, useState } from "react";

type Row = Record<string, string | number | null>;

interface DemoResponse {
  kind: "ok";
  sql: string;
  rows: Row[];
  rowCount: number;
  truncated: boolean;
  cached: boolean;
  summary: string;
}

interface HeroProps {
  apiBase: string;
}

const MAX_ROWS_RENDERED = 5;

export default function Hero({ apiBase }: HeroProps) {
  const inputId = useId();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoResponse | null>(null);

  async function submit() {
    const trimmed = goal.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      // `/v1/demo/ask` reuses `parseGoalDbBody`, which still requires
      // `dbId` even though SK-WEB-004 describes the demo as a goal-
      // only fixture. Pass a sentinel until the parser is split — the
      // server ignores the value (`buildDemoResult` only reads goal).
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/v1/demo/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal: trimmed, dbId: "demo" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as DemoResponse;
      setResult(body);
    } catch {
      // GLOBAL-012 — one sentence, next action implied.
      setError("Couldn't reach the demo — try again.");
    } finally {
      setLoading(false);
    }
  }

  const firstRow = result?.rows[0];
  const columns = firstRow ? Object.keys(firstRow) : [];
  const visibleRows = result?.rows.slice(0, MAX_ROWS_RENDERED) ?? [];

  return (
    <section className="hero">
      <h1 className="hero__wordmark">nlqdb</h1>
      <p className="hero__lede">Natural-language databases.</p>
      <p className="hero__sub">
        Create one in a word. Talk to it in English. The schema, the engine, the indexes, the
        backups — all invisible. The escape hatch to raw SQL stays one click away, always.
      </p>

      <form
        className="heroinput"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={loading}
      >
        <label className="heroinput__label" htmlFor={inputId}>
          What are you building?
        </label>
        <input
          id={inputId}
          name="goal"
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="an orders tracker"
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
          className="heroinput__field"
          aria-label="What are you building?"
        />
        <button
          type="submit"
          className="btn btn--accent heroinput__submit"
          disabled={loading || goal.trim().length === 0}
        >
          {loading ? (
            <>
              <span className="heroinput__spinner" aria-hidden="true" />
              Asking…
            </>
          ) : (
            "Show me"
          )}
        </button>
        {error && (
          <p className="heroinput__error" role="alert">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section className="herodemo" aria-label="Demo result">
          <p className="herodemo__summary">{result.summary}</p>
          <div className="herodemo__tablewrap">
            <table className="herodemo__table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={columns.map((c) => formatCell(row[c])).join("​")}>
                    {columns.map((c) => (
                      <td key={c}>{formatCell(row[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > MAX_ROWS_RENDERED && (
            <p className="herodemo__more">+ {result.rows.length - MAX_ROWS_RENDERED} more rows</p>
          )}
        </section>
      )}
    </section>
  );
}

function formatCell(value: string | number | null | undefined): string {
  if (value == null) return "—";
  return String(value);
}
