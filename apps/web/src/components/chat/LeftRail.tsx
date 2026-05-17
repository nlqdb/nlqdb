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

import { type DatabaseSummary, NlqdbApiError } from "@nlqdb/sdk";
import { useEffect, useRef, useState } from "react";
import { getChatClient } from "../../lib/chat-client";
import { displayName } from "../../lib/names";

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
  // SK-HDC-001: chat-create flow (`kind=create` from /v1/ask) creates
  // a DB outside this rail's own form. ChatPanel pushes the new DB
  // through this prop so the sidebar stays in sync without a
  // listDatabases refetch. Deduped by id.
  addedDb?: DatabaseSummary | null;
  // SK-HDC-016: invoked once the typed-name-confirmed DELETE round-trip
  // resolves. Parent clears `activeDbId`/history if the deleted DB was
  // the active one.
  onDeleted?: (db: DatabaseSummary) => void;
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
  addedDb,
  onDeleted,
}: LeftRailProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DatabaseSummary | null>(null);

  function handleDeleted(db: DatabaseSummary) {
    setState((prev) =>
      prev.kind !== "ready"
        ? prev
        : { kind: "ready", databases: prev.databases.filter((d) => d.id !== db.id) },
    );
    setConfirmDelete(null);
    onDeleted?.(db);
  }

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
    setState((prev) => prependDb(prev, db));
    setCreating(false);
    onCreated(db);
  }

  // Watch the parent's chat-create injection. The kind=create response
  // lands in ChatPanel, which surfaces the new DB through `addedDb`
  // (latest one wins). We prepend on every prop change; the dedup in
  // `prependDb` makes that a no-op once the entry exists, including
  // when the initial listDatabases fetch resolves with the same row.
  useEffect(() => {
    if (!addedDb) return;
    setState((prev) => prependDb(prev, addedDb));
  }, [addedDb]);

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
              <button
                type="button"
                className="left-rail__item-button"
                onClick={() => onSelect(db)}
                title={db.slug}
              >
                <span className="left-rail__item-slug">{db.displayName}</span>
                <span className="left-rail__item-time">
                  {formatRelative(db.lastQueriedAt ?? db.createdAt)}
                </span>
              </button>
              <button
                type="button"
                className="left-rail__item-delete"
                onClick={() => setConfirmDelete(db)}
                aria-label={`Delete ${db.displayName}`}
                data-testid={`delete-db-${db.slug}`}
                title="Delete database"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {confirmDelete ? (
        <DeleteDbDialog
          apiBase={apiBase}
          db={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onDeleted={handleDeleted}
        />
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
        // The user-typed name is the most accurate human-readable
        // form here — fall back to `displayName(dbId)` only when the
        // form was submitted goal-only. Mirrors the API's default
        // for goal-only creates.
        displayName: trimmed || displayName(result.dbId),
        name: trimmed,
        engine: result.engine,
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

// SK-HDC-016 — typed-name confirmation dialog. The user must type the
// exact displayName before the Delete button enables; this is the only
// gate between "click ×" and an irreversible drop. The displayName is
// rendered next to the input with a copy button so a long disambiguated
// name (`orders tracker (2)`) is one click + one paste away.
//
// Focus rules:
//   - Focus enters the input on mount.
//   - Tab cycles between the four focusable elements inside the dialog
//     (Copy, input, Delete, Cancel) — we trap explicitly so a stray
//     Tab past Cancel doesn't escape to the page underneath, which
//     would let the user click a rail × of *another* DB while the
//     dialog is still open.
//   - Escape (when not submitting) closes the dialog.
//   - On close, focus returns to the element that opened the dialog
//     (the rail's `×` button) so keyboard users keep their place.
function DeleteDbDialog({
  apiBase,
  db,
  onCancel,
  onDeleted,
}: {
  apiBase: string;
  db: DatabaseSummary;
  onCancel: () => void;
  onDeleted: (db: DatabaseSummary) => void;
}) {
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  // Capture once at mount so a re-render of the parent (e.g. after a
  // listDatabases refetch) doesn't change which element we return to.
  const triggerRef = useRef<HTMLElement | null>(null);
  if (triggerRef.current === null && typeof document !== "undefined") {
    triggerRef.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    inputRef.current?.focus();
    // Restore focus on unmount — covers Cancel, Escape, and success
    // paths uniformly without each path having to remember.
    const trigger = triggerRef.current;
    return () => {
      // On the success path the rail row containing the trigger × is
      // removed from the DOM by `handleDeleted` BEFORE this cleanup
      // runs; `.focus()` on a detached node is a silent no-op and
      // focus would fall to <body>. Fall back to the rail's "+ New"
      // button so keyboard users keep an anchor inside the rail.
      if (trigger && document.body.contains(trigger)) {
        trigger.focus();
      } else if (typeof document !== "undefined") {
        document.querySelector<HTMLElement>(".left-rail__new")?.focus();
      }
    };
  }, []);

  // Escape + Tab focus-trap. Captured at the document level rather
  // than on the input so Escape works regardless of focus (e.g. after
  // clicking the copy button); the Tab handler walks the dialog's
  // focusable descendants to wrap forward/backward.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (!submitting) onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      // Include `a[href]`, `select`, `textarea` so the trap stays
      // correct if any of those gets added to the dialog later.
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'input,select,textarea,button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  const matches = typed === db.displayName;

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!matches || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const client = getChatClient(apiBase);
      await client.deleteDatabase(db.id, {
        idempotencyKey: `web-delete-${db.id}-${Date.now()}`,
      });
      onDeleted(db);
    } catch (err) {
      setError(messageForDelete(err));
      setSubmitting(false);
    }
  }

  async function copyName() {
    try {
      await navigator.clipboard.writeText(db.displayName);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard rejection (insecure context, permission denial) is
      // recoverable — the name is right there on screen.
    }
  }

  return (
    <div
      className="delete-db-dialog__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-db-dialog__title"
      aria-describedby="delete-db-dialog__body"
      data-testid="delete-db-dialog"
    >
      <form className="delete-db-dialog" onSubmit={submit} ref={dialogRef}>
        <h2 className="delete-db-dialog__title" id="delete-db-dialog__title">
          Delete database
        </h2>
        <p className="delete-db-dialog__body" id="delete-db-dialog__body">
          This cannot be reverted. It permanently drops the schema, every table inside it, and any
          per-DB API keys. The data is not recoverable.
        </p>
        <label className="delete-db-dialog__label">
          <span className="delete-db-dialog__label-text">Type the database name to confirm:</span>
          <span className="delete-db-dialog__name-row">
            <code className="delete-db-dialog__name" data-testid="delete-db-dialog-name">
              {db.displayName}
            </code>
            <button
              type="button"
              className="delete-db-dialog__copy"
              onClick={copyName}
              // aria-label fully overrides the button text for AT, so
              // it must reflect the post-click state too — otherwise SR
              // users hear nothing when the visible label flips from
              // "Copy" to "Copied".
              aria-label={copied ? "Database name copied to clipboard" : "Copy database name"}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            disabled={submitting}
            // Intentionally no placeholder: rendering the exact text
            // the user must type would undercut the typed-name gate.
            // The name lives in the `<code>` block above with a Copy
            // button next to it.
            data-testid="delete-db-dialog-input"
          />
        </label>
        {error ? (
          <p
            className="delete-db-dialog__status delete-db-dialog__status--error"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
        ) : null}
        <div className="delete-db-dialog__actions">
          <button
            type="submit"
            className="btn btn--danger"
            disabled={!matches || submitting}
            data-testid="delete-db-dialog-confirm"
          >
            {submitting ? "Deleting…" : "Delete"}
          </button>
          <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// Context-specific copy for the delete flow. `messageFor` (defined
// below in this same file) has a load-context fallback
// ("Couldn't load databases.") — surfacing that on a delete error
// would mislead the user about which operation failed.
function messageForDelete(err: unknown): string {
  if (err instanceof NlqdbApiError) {
    if (err.code === "db_not_found") {
      // Race: another tab / surface already deleted this DB. The rail
      // entry is stale; closing the dialog after this lands.
      return "This database is already gone — close to refresh.";
    }
    if (err.code === "unauthorized") {
      return "Your session expired. Sign in again to delete this database.";
    }
    if (err.code === "rate_limited") {
      return "Too many requests just now — try again in a moment.";
    }
    if (err.code === "network_error" || err.code === "aborted") {
      return "Network error reaching nlqdb — try again.";
    }
  }
  return "Couldn't delete this database — try again.";
}

function prependDb(prev: LoadState, db: DatabaseSummary): LoadState {
  if (prev.kind !== "ready") return { kind: "ready", databases: [db] };
  if (prev.databases.some((d) => d.id === db.id)) return prev;
  return { kind: "ready", databases: [db, ...prev.databases] };
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
