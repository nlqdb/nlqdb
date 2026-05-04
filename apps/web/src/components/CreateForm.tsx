// Product-app anonymous-create form. Talks to `/v1/ask` with
// `Authorization: Bearer anon_<token>` (SK-ANON-001, SK-ANON-006);
// renders sample rows from the typed-plan response (SK-HDC-001).
//
// Distinct from the marketing hero (`Hero.tsx` → /v1/demo/ask)
// because SK-WEB-004 keeps fixture traffic off the create pipeline.
// This is the surface a window-shopper crosses into when they're
// committed to a real DB.
//
// Turnstile (SK-ANON-007) is stubbed via lib/turnstile.ts —
// `solveChallenge()` returns null today. When a 428 comes back, we
// retry once with whatever the stub returns (still null), so the
// API's fail-open posture in dev keeps the flow unblocked. When the
// real widget lands, the same retry seam picks it up unchanged.

import { useId, useState } from "react";
import { type CreateError, type CreateResult, postAskCreate } from "../lib/api";
import { solveChallenge } from "../lib/turnstile";

interface CreateFormProps {
  apiBase: string;
}

const MAX_ROWS_RENDERED = 5;

export default function CreateForm({ apiBase }: CreateFormProps) {
  const inputId = useId();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  async function submit() {
    const trimmed = goal.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let outcome = await postAskCreate(apiBase, trimmed);
      // 428 retry seam — solveChallenge() returns null today
      // (SK-ANON-007 widget lands with the same 428 contract).
      if (!outcome.ok && outcome.error.kind === "challenge_required") {
        const token = await solveChallenge();
        if (token) {
          outcome = await postAskCreate(apiBase, trimmed, { turnstileToken: token });
        }
      }
      if (outcome.ok) {
        setResult(outcome.result);
      } else {
        setError(messageFor(outcome.error));
      }
    } catch {
      setError("Couldn't reach the API — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="createform">
      <h1 className="createform__title">Spin up a database from a sentence.</h1>
      <p className="createform__lede">
        Anonymous — no sign-in. Your DB lives 72h; sign in to keep it.
      </p>

      <form
        className="createform__form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={loading}
      >
        <label className="createform__label" htmlFor={inputId}>
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
          className="createform__field"
          aria-label="What are you building?"
        />
        <button
          type="submit"
          className="btn btn--accent createform__submit"
          disabled={loading || goal.trim().length === 0}
        >
          {loading ? (
            <>
              <span className="createform__spinner" aria-hidden="true" />
              Creating…
            </>
          ) : (
            "Create the DB"
          )}
        </button>
        {error && (
          <p className="createform__error" role="alert">
            {error}
          </p>
        )}
      </form>

      {result && <CreateResultView result={result} />}
    </section>
  );
}

function CreateResultView({ result }: { result: CreateResult }) {
  return (
    <section className="createresult" aria-label="Created database">
      <p className="createresult__id">
        <span className="createresult__id-label">db</span>
        <code>{result.db}</code>
      </p>
      <p className="createresult__schema">
        Schema <code>{result.schemaName}</code> provisioned with{" "}
        {result.sampleRows.reduce((acc, t) => acc + t.rows.length, 0)} sample rows across{" "}
        {result.sampleRows.length} table{result.sampleRows.length === 1 ? "" : "s"}.
      </p>
      {result.sampleRows.map((tbl) => (
        <SampleTable key={tbl.table} table={tbl.table} rows={tbl.rows} />
      ))}
    </section>
  );
}

function SampleTable({
  table,
  rows,
}: {
  table: string;
  rows: { [key: string]: string | number | boolean | null }[];
}) {
  const firstRow = rows[0];
  if (!firstRow) {
    return (
      <div className="createresult__table-wrap">
        <h3 className="createresult__table-name">{table}</h3>
        <p className="createresult__empty">No sample rows.</p>
      </div>
    );
  }
  const columns = Object.keys(firstRow);
  const visible = rows.slice(0, MAX_ROWS_RENDERED);
  return (
    <div className="createresult__table-wrap">
      <h3 className="createresult__table-name">{table}</h3>
      <div className="createresult__tablewrap">
        <table className="createresult__table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
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

function formatCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "—";
  return String(value);
}

function messageFor(error: CreateError): string {
  switch (error.kind) {
    case "challenge_required":
      return "Quick check needed — refresh and try again in a moment.";
    case "rate_limited":
      return error.retryAfter
        ? `Slow down — try again in ${error.retryAfter}s.`
        : "Slow down — try again in a moment.";
    case "unauthorized":
      return "Couldn't authenticate — clear your browser storage and reload.";
    case "server_error":
      return "Couldn't create the DB — try again.";
  }
}
