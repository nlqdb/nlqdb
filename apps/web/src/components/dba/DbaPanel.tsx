// `/app/dba` (END_GOAL row 7): the change ledger — every schema change the
// DBA made or proposes on a database, newest first, each with the statement
// that undoes it. A proposal on an attached DB carries the web door's two
// verbs (`GLOBAL-043` item 5): Apply and Reject, one click each.

import { type DatabaseSummary, type DbaChange, NlqdbApiError } from "@nlqdb/sdk";
import { useEffect, useState } from "react";
import { appHref } from "../../lib/app-href";
import { getChatClient } from "../../lib/chat-client";
import ErrorBoundary from "../ErrorBoundary";
import { decide, describeChange, pickDb, type Verb, withStatus } from "./ledger";

interface DbaPanelProps {
  apiBase: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "no-dbs" }
  | { kind: "ready"; dbs: DatabaseSummary[]; db: DatabaseSummary; changes: DbaChange[] | null }
  | { kind: "error"; message: string };

export default function DbaPanel(props: DbaPanelProps) {
  // SK-WEB-001 — every island ships behind ErrorBoundary.
  return (
    <ErrorBoundary surface="DbaPanel">
      <DbaPanelInner {...props} />
    </ErrorBoundary>
  );
}

function DbaPanelInner({ apiBase }: DbaPanelProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [dbId, setDbId] = useState<string | null>(() =>
    new URLSearchParams(location.search).get("db"),
  );

  useEffect(() => {
    const client = getChatClient(apiBase);
    const ac = new AbortController();
    void (async () => {
      try {
        const { databases } = await client.listDatabases({ signal: ac.signal });
        const db = pickDb(databases, dbId);
        if (!db) return setState({ kind: "no-dbs" });
        setState({ kind: "ready", dbs: databases, db, changes: null });
        const { changes } = await client.listChanges(db.id, { signal: ac.signal });
        setState({ kind: "ready", dbs: databases, db, changes });
      } catch (err) {
        if (ac.signal.aborted) return;
        setState({ kind: "error", message: messageFor(err) });
      }
    })();
    return () => ac.abort();
  }, [apiBase, dbId]);

  function choose(id: string) {
    const url = new URL(location.href);
    url.searchParams.set("db", id);
    history.replaceState(null, "", url);
    // Show the picked DB as loading at once; the old DB's rows never sit under the new name.
    setState((s) =>
      s.kind === "ready" ? { ...s, db: s.dbs.find((d) => d.id === id) ?? s.db, changes: null } : s,
    );
    setDbId(id);
  }

  return (
    <section className="keys">
      <header className="keys__header">
        <div>
          <h1 className="keys__title">Schema changes</h1>
          <p className="keys__lede">
            Every change the DBA made or proposes on your database, newest first, each with the
            statement that undoes it. Apply a proposal and it is measured, then kept or reverted.
          </p>
        </div>
        {state.kind === "ready" && state.dbs.length > 1 && (
          <label className="dba__picker">
            Database
            <select value={state.db.id} onChange={(e) => choose(e.target.value)}>
              {state.dbs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <Body
        state={state}
        onDecided={(id, status) =>
          setState((s) =>
            s.kind === "ready" && s.changes
              ? { ...s, changes: withStatus(s.changes, id, status) }
              : s,
          )
        }
      />
    </section>
  );
}

function Body({
  state,
  onDecided,
}: {
  state: LoadState;
  onDecided: (id: number, status: DbaChange["status"]) => void;
}) {
  if (state.kind === "loading" || (state.kind === "ready" && state.changes === null)) {
    return <p className="keys__status">Loading schema changes…</p>;
  }
  if (state.kind === "error") {
    return (
      <p className="keys__status keys__status--error" role="alert">
        {state.message}
      </p>
    );
  }
  if (state.kind === "no-dbs") {
    return (
      <div className="keys__empty">
        <p>You don't have a database yet. Create one and its schema changes show up here.</p>
        <a href={appHref("/app/new/")}>Create a database</a>
      </div>
    );
  }
  const changes = state.changes ?? [];
  if (changes.length === 0) {
    return (
      <div className="keys__empty">
        <p>
          Nothing worth changing on {state.db.displayName} yet — watching. Workload proposals follow
          a day of traffic and show up here, each with its undo statement.
        </p>
      </div>
    );
  }
  return (
    <ol className="dba__list" aria-label={`Schema changes on ${state.db.displayName}`}>
      {changes.map((c) => (
        <li key={c.id} className="dba__row">
          <div className="dba__meta">
            <span>{describeChange(c)}</span>
            <time dateTime={new Date(c.createdAt * 1000).toISOString()}>
              {new Date(c.createdAt * 1000).toLocaleString()}
            </time>
          </div>
          <pre className="dba__sql">
            <code>{c.ddl}</code>
          </pre>
          <p className="dba__label">
            {c.status === "applied"
              ? "Undo"
              : c.status === "reverted"
                ? "Undo (verify ran it)"
                : "Undo, if applied"}
          </p>
          <pre className="dba__sql dba__sql--inverse">
            <code>{c.inverse}</code>
          </pre>
          {c.status === "proposed" && <Decide id={c.id} onDecided={onDecided} />}
        </li>
      ))}
    </ol>
  );
}

// Apply builds the index `CONCURRENTLY`; verify judges it after its window and
// reverts it if its query got slower. A reject keeps the reason given.
function Decide({
  id,
  onDecided,
}: {
  id: number;
  onDecided: (id: number, status: DbaChange["status"]) => void;
}) {
  const [busy, setBusy] = useState<Verb | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(verb: Verb) {
    setBusy(verb);
    setError(null);
    const out = await decide(getChatClient(), id, verb, reason);
    setBusy(null);
    if (out.ok) onDecided(id, out.status);
    else setError(out.message);
  }

  return (
    <div className="dba__decide">
      <button
        type="button"
        className="cta"
        disabled={busy !== null}
        onClick={() => void run("apply")}
      >
        {busy === "apply" ? "Building the index…" : "Apply"}
      </button>
      <input
        className="dba__reason"
        type="text"
        value={reason}
        maxLength={500}
        placeholder="Reason to reject (optional)"
        aria-label="Reason to reject (optional)"
        disabled={busy !== null}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        type="button"
        className="cta cta--ghost"
        disabled={busy !== null}
        onClick={() => void run("reject")}
      >
        {busy === "reject" ? "Rejecting…" : "Reject"}
      </button>
      {error && (
        <p className="keys__status keys__status--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof NlqdbApiError) {
    if (err.httpStatus === 401) return "Sign in again to view schema changes.";
    if (err.httpStatus === 404) return "That database isn't yours or no longer exists.";
  }
  return "Couldn't load schema changes. Refresh to try again.";
}
