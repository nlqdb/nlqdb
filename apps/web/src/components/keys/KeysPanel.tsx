// API-key management dashboard (SK-APIKEYS-010 / SK-APIKEYS-011 /
// SK-APIKEYS-012). Lists every key the caller owns, mints fresh
// `sk_live_*` with a copy-once disclosure, and revokes via a confirm
// dialog. The page lives behind `requireSession` per
// `apps/api/src/index.ts`; this component assumes the auth guard in
// `keys.astro` already resolved a session.
//
// `sk_mcp_*` keys are intentionally not mintable here — the canonical
// path is the OAuth-callback mint via `POST /v1/oauth/mcp-callback`
// (SK-APIKEYS-009) driven by the host's MCP-connector flow, or
// `nlq mcp install` once Slice 4 lands. Listing + revoking sk_mcp keys
// from this page is supported.

import { type KeyRecord, NlqdbApiError } from "@nlqdb/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { getChatClient } from "../../lib/chat-client";
import { groupKeys, summarizeKey } from "./group";

interface KeysPanelProps {
  apiBase: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; keys: KeyRecord[] }
  | { kind: "error"; message: string };

export default function KeysPanel({ apiBase }: KeysPanelProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [mintOpen, setMintOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<KeyRecord | null>(null);

  function refresh(replace?: (prev: KeyRecord[]) => KeyRecord[]) {
    setState((prev) =>
      prev.kind === "ready" && replace ? { kind: "ready", keys: replace(prev.keys) } : prev,
    );
  }

  useEffect(() => {
    const client = getChatClient(apiBase);
    const ac = new AbortController();
    void (async () => {
      try {
        const { keys } = await client.listKeys({ signal: ac.signal });
        setState({ kind: "ready", keys });
      } catch (err) {
        if (ac.signal.aborted) return;
        setState({ kind: "error", message: messageFor(err) });
      }
    })();
    return () => ac.abort();
  }, [apiBase]);

  function handleMinted(record: KeyRecord) {
    refresh((keys) => [record, ...keys]);
  }

  function handleRevoked(keyId: string) {
    const now = Math.floor(Date.now() / 1000);
    refresh((keys) =>
      keys.map((k) => (k.id === keyId && k.revokedAt === null ? { ...k, revokedAt: now } : k)),
    );
    setConfirmRevoke(null);
  }

  return (
    <section className="keys">
      <header className="keys__header">
        <div>
          <h1 className="keys__title">API keys</h1>
          <p className="keys__lede">
            Long-lived credentials for the CLI, MCP hosts, and server-to-server calls. Plaintext is
            shown once at mint — revoke and re-mint to recover from a lost key.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => setMintOpen(true)}
          data-testid="keys-new"
        >
          New key
        </button>
      </header>

      {state.kind === "loading" ? (
        <p className="keys__status">Loading…</p>
      ) : state.kind === "error" ? (
        <p className="keys__status keys__status--error" role="alert">
          {state.message}
        </p>
      ) : (
        <KeysList
          keys={state.keys}
          onRevokeClick={setConfirmRevoke}
          onMintClick={() => setMintOpen(true)}
        />
      )}

      {mintOpen ? (
        <NewKeyDialog
          apiBase={apiBase}
          onCancel={() => setMintOpen(false)}
          onMinted={handleMinted}
        />
      ) : null}

      {confirmRevoke ? (
        <RevokeDialog
          apiBase={apiBase}
          target={confirmRevoke}
          onCancel={() => setConfirmRevoke(null)}
          onRevoked={handleRevoked}
        />
      ) : null}
    </section>
  );
}

function KeysList({
  keys,
  onRevokeClick,
  onMintClick,
}: {
  keys: KeyRecord[];
  onRevokeClick: (key: KeyRecord) => void;
  onMintClick: () => void;
}) {
  const { active, revoked } = useMemo(() => groupKeys(keys), [keys]);

  if (active.length === 0 && revoked.length === 0) {
    return (
      <div className="keys__empty">
        <p>No keys yet. Mint one to use with the CLI, MCP hosts, or server-to-server calls.</p>
        <button type="button" className="btn btn--accent" onClick={onMintClick}>
          New key
        </button>
      </div>
    );
  }

  return (
    <div className="keys__groups">
      <KeysGroup
        title="Active"
        keys={active}
        onRevokeClick={onRevokeClick}
        emptyMessage="No active keys — every key you mint shows here."
      />
      {revoked.length > 0 ? <KeysGroup title="Revoked" keys={revoked} /> : null}
    </div>
  );
}

function KeysGroup({
  title,
  keys,
  onRevokeClick,
  emptyMessage,
}: {
  title: string;
  keys: KeyRecord[];
  onRevokeClick?: (key: KeyRecord) => void;
  emptyMessage?: string;
}) {
  return (
    <section className="keys-group" aria-labelledby={`keys-group--${title.toLowerCase()}`}>
      <h2 className="keys-group__title" id={`keys-group--${title.toLowerCase()}`}>
        {title}
        <span className="keys-group__count">{keys.length}</span>
      </h2>
      {keys.length === 0 && emptyMessage ? (
        <p className="keys-group__empty">{emptyMessage}</p>
      ) : (
        <ul className="keys-list">
          {keys.map((k) => (
            <KeyRow key={k.id} record={k} onRevokeClick={onRevokeClick} />
          ))}
        </ul>
      )}
    </section>
  );
}

function KeyRow({
  record,
  onRevokeClick,
}: {
  record: KeyRecord;
  onRevokeClick?: (key: KeyRecord) => void;
}) {
  const summary = summarizeKey(record);
  return (
    <li className="keys-list__row" data-testid="key-row" data-key-id={record.id}>
      <div className="keys-list__main">
        <div className="keys-list__label-row">
          <span className={`keys-list__type keys-list__type--${record.keyType}`}>
            {summary.typeLabel}
          </span>
          <span className="keys-list__label">{summary.label}</span>
        </div>
        <code className="keys-list__last4">
          <span className="visually-hidden">Key ending in </span>…{record.last4}
        </code>
      </div>
      <div className="keys-list__meta">
        <span>Created {summary.createdAtLabel}</span>
        {summary.revokedAtLabel ? (
          <span className="keys-list__meta--revoked">Revoked {summary.revokedAtLabel}</span>
        ) : (
          <span>Last used {summary.lastUsedAtLabel}</span>
        )}
      </div>
      {onRevokeClick && record.revokedAt === null ? (
        <button
          type="button"
          className="keys-list__revoke"
          onClick={() => onRevokeClick(record)}
          data-testid="key-row-revoke"
          aria-label={`Revoke key ${summary.label}`}
        >
          Revoke
        </button>
      ) : null}
    </li>
  );
}

// SK-APIKEYS-002 / SK-APIKEYS-012 — copy-once modal. Plaintext is
// rendered exactly once on the mint response; this dialog is the
// surface that hands it to the user. Closing the dialog drops the
// value from component state; the user cannot reopen it.
function NewKeyDialog({
  apiBase,
  onCancel,
  onMinted,
}: {
  apiBase: string;
  onCancel: () => void;
  onMinted: (record: KeyRecord) => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<{ id: string; key: string; last4: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  if (triggerRef.current === null && typeof document !== "undefined") {
    triggerRef.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    inputRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      if (trigger && document.body.contains(trigger)) trigger.focus();
    };
  }, []);

  // Once the key is minted, autofocus the Close button so a screen-
  // reader user lands on the action that completes the disclosure
  // rather than re-reading the plaintext.
  useEffect(() => {
    if (minted) closeBtnRef.current?.focus();
  }, [minted]);

  // Focus trap + Escape — same shape as `DeleteDbDialog` in
  // `LeftRail.tsx`. Escape closes the dialog unless we're mid-mint
  // (don't strand a pending POST) or post-mint (Esc-after-mint would
  // discard the plaintext before the user copied it).
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (!submitting && !minted) onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'input,select,textarea,button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
        ),
      );
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
  }, [onCancel, submitting, minted]);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (submitting || minted) return;
    const trimmed = name.trim();
    if (trimmed.length > 80) {
      setError("Name must be 80 characters or fewer.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const client = getChatClient(apiBase);
      // The trimmed name is optional on `sk_live` mint. An empty
      // string omits the field rather than minting an unnamed key
      // with `""` — keeps the server-side default (`name = null`)
      // and lets the user fix typos by minting again.
      const out = await client.mintKey({
        type: "sk_live",
        ...(trimmed ? { name: trimmed } : {}),
      });
      setMinted({ id: out.id, key: out.key, last4: out.last4 });
      const now = Math.floor(Date.now() / 1000);
      onMinted({
        id: out.id,
        keyType: out.type,
        last4: out.last4,
        name: out.name ?? null,
        dbId: null,
        mcpHost: out.host ?? null,
        deviceId: out.device ?? null,
        lastUsedAt: null,
        createdAt: now,
        revokedAt: null,
      });
    } catch (err) {
      setError(messageForMint(err));
      setSubmitting(false);
    }
  }

  async function copyKey() {
    if (!minted) return;
    try {
      await navigator.clipboard.writeText(minted.key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denial or insecure context — fall through
      // with `setCopied(false)` so the user picks up the plaintext
      // manually from the still-displayed code block.
    }
  }

  return (
    <div
      className="keys-dialog__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keys-dialog__title"
      data-testid="keys-mint-dialog"
    >
      <div className="keys-dialog" ref={dialogRef}>
        <h2 className="keys-dialog__title" id="keys-dialog__title">
          {minted ? "Copy your new key" : "Mint a new key"}
        </h2>
        {minted ? (
          <>
            <p className="keys-dialog__body">
              This is the only time the plaintext will appear. Copy it now into your secret store —
              closing this dialog discards it permanently.
            </p>
            <div className="keys-dialog__plaintext-row">
              <code className="keys-dialog__plaintext" data-testid="keys-mint-plaintext">
                {minted.key}
              </code>
              <button
                type="button"
                className="btn"
                onClick={copyKey}
                aria-label={copied ? "Key copied to clipboard" : "Copy key to clipboard"}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="keys-dialog__hint">
              Ends in <code>{minted.last4}</code>. If you lose it, mint a fresh one and revoke this
              row — there is no path to retrieve it later.
            </p>
            <div className="keys-dialog__actions">
              <button
                ref={closeBtnRef}
                type="button"
                className="btn btn--accent"
                onClick={onCancel}
                data-testid="keys-mint-close"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="keys-dialog__body">
              <code>sk_live_*</code> keys are account-scoped. Pair them with{" "}
              <code>NLQDB_API_KEY</code> for the CLI in CI, or use directly from server-side code.
            </p>
            <label className="keys-dialog__label">
              <span className="keys-dialog__label-text">Label (optional)</span>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                maxLength={80}
                placeholder="e.g. ci-deploy, modal-prod"
                disabled={submitting}
                data-testid="keys-mint-name"
              />
            </label>
            {error ? (
              <p className="keys-dialog__status keys-dialog__status--error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="keys-dialog__actions">
              <button
                type="submit"
                className="btn btn--accent"
                disabled={submitting}
                data-testid="keys-mint-submit"
              >
                {submitting ? "Minting…" : "Mint"}
              </button>
              <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// SK-APIKEYS-011 — hard-revoke. No typed-name gate here (we use one
// for `db.delete` per SK-HDC-016 because data loss is irreversible);
// revocation is recoverable by minting a fresh key, so a single
// explicit confirmation suffices. The dialog still blocks the page
// so a finger-slip on the rail button doesn't burn a key.
function RevokeDialog({
  apiBase,
  target,
  onCancel,
  onRevoked,
}: {
  apiBase: string;
  target: KeyRecord;
  onCancel: () => void;
  onRevoked: (keyId: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  if (triggerRef.current === null && typeof document !== "undefined") {
    triggerRef.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    confirmRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      if (trigger && document.body.contains(trigger)) trigger.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (!submitting) onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
        ),
      );
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

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const client = getChatClient(apiBase);
      await client.revokeKey(target.id, {
        idempotencyKey: `web-revoke-${target.id}-${Date.now()}`,
      });
      onRevoked(target.id);
    } catch (err) {
      setError(messageForRevoke(err));
      setSubmitting(false);
    }
  }

  const summary = summarizeKey(target);
  return (
    <div
      className="keys-dialog__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keys-revoke-dialog__title"
      data-testid="keys-revoke-dialog"
    >
      <div className="keys-dialog" ref={dialogRef}>
        <h2
          className="keys-dialog__title keys-dialog__title--danger"
          id="keys-revoke-dialog__title"
        >
          Revoke this key?
        </h2>
        <p className="keys-dialog__body">
          Revocation is immediate. MCP hosts holding this key disconnect within ~1 second; CI jobs
          and server-side callers fail on their next request.
        </p>
        <dl className="keys-dialog__target">
          <div>
            <dt>Key</dt>
            <dd>
              <span className="keys-list__type">{summary.typeLabel}</span>{" "}
              <code>…{target.last4}</code>
            </dd>
          </div>
          <div>
            <dt>Label</dt>
            <dd>{summary.label}</dd>
          </div>
        </dl>
        {error ? (
          <p className="keys-dialog__status keys-dialog__status--error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="keys-dialog__actions">
          <button
            ref={confirmRef}
            type="button"
            className="btn btn--danger"
            onClick={submit}
            disabled={submitting}
            data-testid="keys-revoke-confirm"
          >
            {submitting ? "Revoking…" : "Revoke"}
          </button>
          <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof NlqdbApiError) {
    if (err.httpStatus === 401) return "Sign in again to view your keys.";
    return "Couldn't load keys. Refresh to try again.";
  }
  return "Couldn't load keys. Refresh to try again.";
}

function messageForMint(err: unknown): string {
  if (err instanceof NlqdbApiError) {
    if (err.code === "name_too_long") return "Name must be 80 characters or fewer.";
    if (err.httpStatus === 401) return "Sign in again to mint a key.";
    return "Couldn't mint the key. Try again.";
  }
  return "Couldn't mint the key. Try again.";
}

function messageForRevoke(err: unknown): string {
  if (err instanceof NlqdbApiError) {
    if (err.code === "key_not_found") return "Key already gone — close to refresh the list.";
    if (err.httpStatus === 401) return "Sign in again to revoke a key.";
    return "Couldn't revoke the key. Try again.";
  }
  return "Couldn't revoke the key. Try again.";
}
