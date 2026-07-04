// SK-WEB-019 — BYO-connect island for `/app/connect`. The product-side
// landing for Door B ("Question your ClickHouse", SK-WEB-018). Mounted
// behind the page's auth guard, so the cookie session is the principal.
//
// Secrets discipline (GLOBAL-031): the connection URL is a `type="password"`
// field with a show/hide toggle, and is NEVER written to localStorage —
// unlike CreateForm's draft autosave. There is no `useEffect` rehydrate and
// no `onChange` persist here, on purpose.
//
// States (GLOBAL-011 — honest, no spinner-lie): idle → submitting (the CTA
// reads "Reading your schema…", which is exactly what the backend does:
// validate → introspect → seal → register) → success (render the schema
// preview + a "Question it now →" CTA) / error (one sentence, GLOBAL-012).

import { useEffect, useId, useState } from "react";
import { type ConnectEngine, type ConnectSuccess, postConnect } from "../lib/connect";
import ErrorBoundary from "./ErrorBoundary";

interface ConnectFormProps {
  apiBase: string;
}

export default function ConnectForm(props: ConnectFormProps) {
  // SK-WEB-001 — every island ships behind ErrorBoundary.
  return (
    <ErrorBoundary surface="ConnectForm">
      <ConnectFormInner {...props} />
    </ErrorBoundary>
  );
}

function ConnectFormInner({ apiBase }: ConnectFormProps) {
  const engineId = useId();
  const urlId = useId();
  const nameId = useId();
  const errorId = useId();

  const [engine, setEngine] = useState<ConnectEngine>("clickhouse");
  const [connectionUrl, setConnectionUrl] = useState("");
  const [name, setName] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectSuccess | null>(null);

  // SK-WEB-019 — honor a `?engine=` deep link (from the LeftRail connect
  // chips) so Postgres / ClickHouse preselects; default ClickHouse (Door B).
  // Applied in an effect rather than a lazy initializer because the island
  // renders SSR-side (no `window` → the initializer would compute the
  // default and hydration reuses it, ignoring the URL); the effect runs
  // only on the client, after `window.location` exists.
  useEffect(() => {
    const fromUrl = readEngineFromUrl();
    if (fromUrl !== "clickhouse") setEngine(fromUrl);
  }, []);

  // Copy tracks the selected engine (deep-link `?engine=` or manual switch)
  // so a Postgres visitor never reads "ClickHouse" in the title/CTA.
  const engineLabel = engine === "postgres" ? "Postgres" : "ClickHouse";
  const placeholder =
    engine === "clickhouse"
      ? "https://user:pass@host:8443/?database=analytics"
      : "postgresql://user:pass@host:5432/analytics";

  async function submit() {
    const url = connectionUrl.trim();
    if (!url || loading) return;
    setLoading(true);
    setError(null);
    // Keep the previous result visible on a re-submit until the new one
    // lands; clear it only on success below.
    const outcome = await postConnect(apiBase, { engine, connectionUrl: url, name });
    if (outcome.ok) {
      setResult(outcome.result);
    } else {
      setError(outcome.message);
    }
    setLoading(false);
  }

  return (
    <section className="connect">
      <header className="connect__head">
        <h1 className="connect__title">Question your {engineLabel}.</h1>
        <p className="connect__lede">
          Paste a read connection string. nlqdb reads your schema, then you ask in English — the URL
          is sealed and never stored in your browser.
        </p>
      </header>

      <form
        className="connect__form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={loading}
      >
        <div className="connect__field">
          <label className="connect__label" htmlFor={engineId}>
            Engine
          </label>
          <select
            id={engineId}
            className="connect__select"
            value={engine}
            disabled={loading}
            onChange={(e) => setEngine(e.target.value as ConnectEngine)}
          >
            <option value="clickhouse">ClickHouse</option>
            <option value="postgres">Postgres</option>
          </select>
        </div>

        <div className="connect__field">
          <label className="connect__label" htmlFor={urlId}>
            Connection URL
          </label>
          <div className="connect__url-row">
            <input
              id={urlId}
              name="connection_url"
              // Secret field — masked by default, never autosaved.
              type={showUrl ? "text" : "password"}
              value={connectionUrl}
              onChange={(e) => setConnectionUrl(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
              className="connect__input"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <button
              type="button"
              className="cta cta--ghost connect__toggle"
              onClick={() => setShowUrl((v) => !v)}
              aria-pressed={showUrl}
              disabled={loading}
            >
              {showUrl ? "Hide" : "Show"}
            </button>
          </div>
          <p className="connect__hint">
            Sealed server-side and never written to your browser. Use a read-only credential.{" "}
            <a
              className="connect__hint-link"
              href="https://docs.nlqdb.com/security/"
              target="_blank"
              rel="noreferrer"
            >
              Read more
            </a>
          </p>
        </div>

        <div className="connect__field">
          <label className="connect__label" htmlFor={nameId}>
            Name <span className="connect__optional">(optional)</span>
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="analytics"
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
            className="connect__input"
          />
        </div>

        <button
          type="submit"
          className="cta connect__submit"
          disabled={loading || connectionUrl.trim().length === 0}
        >
          {loading ? "Reading your schema…" : `Connect your ${engineLabel} →`}
        </button>

        {error && (
          <div id={errorId} className="connect__error-wrap" role="alert">
            <p className="connect__error">{error}</p>
          </div>
        )}
      </form>

      {result && <ConnectResultView result={result} />}
    </section>
  );
}

// A `?engine=postgres` / `?engine=clickhouse` deep link preselects the
// engine; anything else falls back to the Door-B default (ClickHouse).
function readEngineFromUrl(): ConnectEngine {
  if (typeof window === "undefined") return "clickhouse";
  const value = new URLSearchParams(window.location.search).get("engine");
  return value === "postgres" ? "postgres" : "clickhouse";
}

function ConnectResultView({ result }: { result: ConnectSuccess }) {
  return (
    <section className="connect-result" aria-label="Connected database">
      <p className="connect-result__id">
        <span className="connect-result__id-label">connected</span>
        <code>{result.name}</code>
        <span className="connect-result__engine">{result.engine}</span>
      </p>

      <p className="connect-result__schema-label">Schema read from your database</p>
      <pre className="connect-result__schema">
        <code>{result.schemaPreview}</code>
      </pre>

      {result.pkLive && <PkLiveRow pkLive={result.pkLive} />}

      <a className="cta connect-result__cta" href={`/app?db=${encodeURIComponent(result.dbId)}`}>
        Question it now →
      </a>
    </section>
  );
}

// Surface the freshly-minted pk_live_ key with a copy affordance — mirrors
// how CreateResultView treats a key (selectable + one-click copy).
function PkLiveRow({ pkLive }: { pkLive: string }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(pkLive);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Non-secure context / locked-down extension — the key is still
      // selectable in the field for a manual copy.
    }
  }
  return (
    <div className="connect-result__key">
      <span className="connect-result__key-label">pk_live</span>
      <code className="connect-result__key-value">{pkLive}</code>
      <button
        type="button"
        className="cta cta--ghost connect-result__key-copy"
        onClick={() => void onCopy()}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
