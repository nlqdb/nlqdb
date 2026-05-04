// Anonymous-create form. Talks to `/v1/ask` with
// `Authorization: Bearer anon_<token>` (SK-ANON-001 / SK-ANON-006 /
// SK-ANON-008); renders sample rows from the typed-plan response
// (SK-HDC-001). Same component now drives both the marketing hero
// and `/app/new` — `/v1/demo/ask` was retired in SK-WEB-008.
//
// Three persistence behaviours, all SK-ANON-011:
//   - Drafts (pre-submit typing) auto-save to localStorage on
//     keystroke (debounced) and rehydrate on mount.
//   - Successful prompts append to history (last 50).
//   - On `auth_required` (global anon cap tripped, SK-ANON-010), the
//     in-flight prompt is moved to the `pending` slot before the
//     redirect to /sign-in; the post-OAuth landing replays it.
//
// Turnstile (SK-ANON-007) is stubbed via lib/turnstile.ts —
// `solveChallenge()` returns null today. The 428 retry seam picks
// up the real widget when it ships.

import { useEffect, useId, useState } from "react";
import { type CreateError, type CreateResult, postAskCreate } from "../lib/api";
import {
  appendHistory,
  clearDraft,
  loadDraft,
  makeDraftSaver,
  savePending,
} from "../lib/prompt-storage";
import { solveChallenge } from "../lib/turnstile";

interface CreateFormProps {
  apiBase: string;
}

const MAX_ROWS_RENDERED = 5;

const draftSaver = makeDraftSaver();

export default function CreateForm({ apiBase }: CreateFormProps) {
  const inputId = useId();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  // Rehydrate the draft on mount — the user may have refreshed
  // mid-typing, or come back from a sign-in redirect that didn't
  // replay (rare; happens if /sign-in fell back to manual click).
  useEffect(() => {
    const saved = loadDraft();
    if (saved) setGoal(saved);
  }, []);

  function onGoalChange(next: string) {
    setGoal(next);
    draftSaver(next);
  }

  async function submit() {
    const trimmed = goal.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const submittedAt = new Date().toISOString();
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
      // SK-ANON-010 + SK-ANON-011: stash the prompt and redirect.
      // The user lands on /sign-in?return=<here>; post-OAuth, the
      // landing page reads `nlqdb_pending` and replays the call
      // against the now-authed cookie session.
      if (!outcome.ok && outcome.error.kind === "auth_required") {
        savePending({
          goal: trimmed,
          submittedAt,
          origin: typeof window !== "undefined" ? window.location.pathname : "/",
        });
        if (typeof window !== "undefined") {
          window.location.assign(outcome.error.signInUrl);
        }
        return;
      }
      if (outcome.ok) {
        appendHistory({
          goal: trimmed,
          submittedAt,
          status: "ok",
          outcome: outcome.result.db,
        });
        clearDraft();
        setGoal("");
        setResult(outcome.result);
      } else {
        appendHistory({
          goal: trimmed,
          submittedAt,
          status: "error",
          outcome: outcome.error.kind,
        });
        setError(messageFor(outcome.error));
      }
    } catch {
      appendHistory({ goal: trimmed, submittedAt, status: "error", outcome: "network" });
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
          onChange={(e) => onGoalChange(e.target.value)}
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
    case "auth_required":
      // Reached only if the redirect didn't fire (e.g. browser
      // blocked navigation). The pending prompt is already saved.
      return "Sign in to continue — your prompt is saved.";
    case "unauthorized":
      return "Couldn't authenticate — clear your browser storage and reload.";
    case "server_error":
      return "Couldn't create the DB — try again.";
  }
}
