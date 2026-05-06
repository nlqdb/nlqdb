// Left rail — DB list + "New database" affordance. Reads from
// `GET /v1/databases` via the SDK; the create button opens a
// name input that posts to `POST /v1/databases`. Each entry shows
// a relative last-queried time so the user can land back on the
// DB they were just talking to.
//
// SK-ASK-009 / SK-HDC-011: the rail also exposes an "All databases"
// pseudo-item that clears the active selection — sends without a
// pinned dbId route through the LLM disambiguator instead. The chat
// composer is always enabled; the rail is now an *override*, not a
// gate.

import type { DatabaseSummary } from "@nlqdb/sdk";
import { useEffect, useRef, useState } from "react";
import { getChatClient } from "../../lib/chat-client";

interface LeftRailProps {
  apiBase: string;
  activeDbId: string | null;
  onSelect: (db: DatabaseSummary) => void;
  // SK-ASK-009: clears the active selection so the next send routes
  // through the deterministic-then-LLM resolver instead of pinning a
  // db. Surfaces both the explicit "All databases" affordance and
  // resets any URL `?db=` query param.
  onClearSelection: () => void;
  onCreated: (db: DatabaseSummary) => void;
  // Fires once the database list lands so the parent can resolve
  // a URL-supplied dbId to its full summary record (pkLive et al.)
  // without forcing a second list-databases round-trip.
  onLoaded?: (databases: DatabaseSummary[]) => void;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; databases: DatabaseSummary[] }
  | { kind: "error"; message: string };

export default function LeftRail({
  apiBase,
  activeDbId,
  onSelect,
  onClearSelection,
  onCreated,
  onLoaded,
}: LeftRailProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [creating, setCreating] = useState(false);

  // The onLoaded ref captures the latest callback without
  // re-firing the load effect each time the parent re-renders.
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    const client = getChatClient(apiBase);
    const ac = new AbortController();
    void (async () => {
      try {
        const { databases } = await client.listDatabases({ signal: ac.signal });
        setState({ kind: "ready", databases });
        onLoadedRef.current?.(databases);
      } catch (err) {
        if (ac.signal.aborted) return;
        setState({ kind: "error", message: messageFor(err) });
      }
    })();
    return () => ac.abort();
  }, [apiBase]);

  function handleCreated(db: DatabaseSummary) {
    setState((prev) =>
      prev.kind === "ready"
        ? { kind: "ready", databases: [db, ...prev.databases] }
        : { kind: "ready", databases: [db] },
    );
    setCreating(false);
    onCreated(db);
  }

  return (
    <aside className="left-rail" aria-label="Your databases">
      <header className="left-rail__header">
        <h2 className="left-rail__title">Databases</h2>
        <button
          type="button"
          className="left-rail__new"
          onClick={() => setCreating((prev) => !prev)}
          aria-expanded={creating}
        >
          {creating ? "Cancel" : "+ New"}
        </button>
      </header>

      {creating ? (
        <NewDbForm
          apiBase={apiBase}
          onCreated={handleCreated}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      {state.kind === "loading" ? <p className="left-rail__status">Loading…</p> : null}
      {state.kind === "error" ? (
        <p className="left-rail__status left-rail__status--error">{state.message}</p>
      ) : null}
      {state.kind === "ready" && state.databases.length === 0 && !creating ? (
        <p className="left-rail__status">No databases yet — create one.</p>
      ) : null}

      {state.kind === "ready" ? (
        <ul className="left-rail__list">
          {/* SK-ASK-009: "All databases" clears the active selection
              so the next send routes through the LLM disambiguator
              instead of pinning a db. Always rendered (even with 0
              dbs) so users can return here from a switched state. */}
          <li className="left-rail__item" data-active={activeDbId === null || undefined}>
            <button
              type="button"
              className="left-rail__item-button"
              onClick={onClearSelection}
              aria-pressed={activeDbId === null}
            >
              <span className="left-rail__item-slug">All databases</span>
              <span className="left-rail__item-time">auto-pick</span>
            </button>
          </li>
          {state.databases.map((db) => (
            <li
              key={db.id}
              className="left-rail__item"
              data-active={db.id === activeDbId || undefined}
            >
              <button type="button" className="left-rail__item-button" onClick={() => onSelect(db)}>
                <span className="left-rail__item-slug">{db.slug}</span>
                <span className="left-rail__item-time">
                  {formatRelative(db.lastQueriedAt ?? db.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

function NewDbForm({
  apiBase,
  onCreated,
  onCancel,
}: {
  apiBase: string;
  onCreated: (db: DatabaseSummary) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Imperative focus so the user can immediately type the new
  // DB's name when "+ New" opens the form. autoFocus would do
  // this declaratively but trips an a11y rule that doesn't know
  // this input only mounts in response to a deliberate click.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const client = getChatClient(apiBase);
      const result = await client.createDatabase(
        { name: trimmed },
        { idempotencyKey: `web-create-${trimmed}-${Date.now()}` },
      );
      onCreated({
        id: result.dbId,
        slug: result.slug,
        name: trimmed,
        pkLive: result.pkLive,
        lastQueriedAt: null,
        createdAt: Math.floor(Date.now() / 1000),
      });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="left-rail__new-form" onSubmit={submit}>
      <label className="left-rail__new-label">
        <span>Name</span>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="orders-tracker"
          spellCheck={false}
          disabled={submitting}
        />
      </label>
      {error ? <p className="left-rail__status left-rail__status--error">{error}</p> : null}
      <div className="left-rail__new-actions">
        <button
          type="submit"
          className="btn btn--accent"
          disabled={submitting || name.trim().length === 0}
        >
          {submitting ? "Creating…" : "Create"}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function formatRelative(epochSeconds: number | null): string {
  if (epochSeconds == null) return "new";
  const now = Date.now() / 1000;
  const delta = Math.max(0, now - epochSeconds);
  if (delta < 60) return "just now";
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}

function messageFor(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "unauthorized") return "Sign in to view your databases.";
    if (code === "rate_limited") return "Too many requests — wait a moment.";
    if (code === "network_error") return "Couldn't reach the API — try again.";
  }
  return "Couldn't load databases.";
}
