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
import {
  type ConnectEngine,
  type ConnectSuccess,
  listPickProjects,
  oauthConnectErrorMessage,
  postConnect,
  type SupabaseProjectOption,
  selectPickProject,
} from "../lib/connect";
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

  // OAuth (Supabase) return states, read from the callback's redirect params:
  //   ?connected=<dbId>  single-project auto-connect succeeded
  //   ?error=<code>      denied / expired / no_projects / …
  //   ?pick=<pickId>     multi-project account → render the project picker
  const [connectedDbId, setConnectedDbId] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [pickId, setPickId] = useState<string | null>(null);
  const [pickProjects, setPickProjects] = useState<SupabaseProjectOption[] | null>(null);
  const [selecting, setSelecting] = useState(false);

  // Parse the OAuth callback params once on mount, then strip them from the URL
  // so a refresh doesn't replay a stale state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const err = params.get("error");
    const pick = params.get("pick");
    if (connected) setConnectedDbId(connected);
    else if (err) setOauthError(oauthConnectErrorMessage(err));
    else if (pick) {
      setPickId(pick);
      void listPickProjects(apiBase, pick).then((r) => {
        if (r.ok) setPickProjects(r.projects);
        else setOauthError(r.message);
      });
    }
    if (connected || err || pick) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [apiBase]);

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

  async function onPickProject(ref: string, projectName: string) {
    if (!pickId || selecting) return;
    setSelecting(true);
    setOauthError(null);
    const outcome = await selectPickProject(apiBase, pickId, ref, projectName);
    if (outcome.ok) {
      setResult(outcome.result);
      setPickId(null);
    } else {
      setOauthError(outcome.message);
    }
    setSelecting(false);
  }

  // Success (paste OR OAuth picker-select) — the schema-preview wow beat.
  if (result) {
    return (
      <section className="connect">
        <ConnectResultView result={result} />
      </section>
    );
  }

  // Single-project OAuth connect landed via redirect (no preview in the URL).
  if (connectedDbId) {
    return (
      <section className="connect">
        <ConnectedCard dbId={connectedDbId} />
      </section>
    );
  }

  // Multi-project account — choose which database to connect.
  if (pickId) {
    return (
      <section className="connect">
        <ProjectPicker
          projects={pickProjects}
          selecting={selecting}
          error={oauthError}
          onSelect={onPickProject}
        />
      </section>
    );
  }

  return (
    <section className="connect">
      <ProviderRow apiBase={apiBase} />
      {oauthError && (
        <div className="connect__error-wrap" role="alert">
          <p className="connect__error">{oauthError}</p>
        </div>
      )}

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

// Provider "Connect" button row (SK-WEB-030). Stage 1 (one live provider):
// the button leads, the paste form stays visible below. "Connect Supabase" is a
// plain top-level navigation to `/start` (which 302s to Supabase consent), so
// no secret is typed into nlqdb. Honest write-scope copy sits alongside.
function ProviderRow({ apiBase }: { apiBase: string }) {
  const startHref = `${apiBase.replace(/\/$/, "")}/v1/db/connect/oauth/supabase/start`;
  return (
    <div className="connect__providers">
      <a className="cta connect__provider" href={startHref}>
        Connect Supabase →
      </a>
      <p className="connect__provider-note">
        You approve on Supabase — no password typed here. Supabase will show a write scope (the one
        our app requests); we only ever run read-only queries against your data.
      </p>
    </div>
  );
}

// Single-project OAuth connect landed via the callback redirect (no schema
// preview in the URL) — a durable, honest completion with the forward CTA.
function ConnectedCard({ dbId }: { dbId: string }) {
  return (
    <section className="connect-result" aria-label="Connected database">
      <p className="connect-result__id">
        <span className="connect-result__id-label">connected</span>
        <code>{dbId}</code>
      </p>
      <p className="connect__hint">
        Your Supabase database is connected and stays read-only. Ask it anything in English.
      </p>
      <a className="cta connect-result__cta" href={`/app/?db=${encodeURIComponent(dbId)}`}>
        Question it now →
      </a>
    </section>
  );
}

// Multi-project picker — the account holds more than one project, so make the
// user choose (never silently default to the first, which could be production).
function ProjectPicker({
  projects,
  selecting,
  error,
  onSelect,
}: {
  projects: SupabaseProjectOption[] | null;
  selecting: boolean;
  error: string | null;
  onSelect: (ref: string, name: string) => void;
}) {
  return (
    <section aria-label="Choose a Supabase project">
      <header className="connect__head">
        <h1 className="connect__title">Choose a database.</h1>
        <p className="connect__lede">
          Your Supabase account has more than one project. Pick the one to connect — we read its
          schema and it stays read-only.
        </p>
      </header>
      {error && (
        <div className="connect__error-wrap" role="alert">
          <p className="connect__error">{error}</p>
        </div>
      )}
      {projects === null ? (
        <p className="connect__hint">Loading your projects…</p>
      ) : projects.length === 0 ? (
        <p className="connect__hint">
          No projects found.{" "}
          <a className="connect__hint-link" href="/app/connect">
            Start over
          </a>
          .
        </p>
      ) : (
        <ul className="connect__project-list">
          {projects.map((p) => (
            <li key={p.ref}>
              <button
                type="button"
                className="connect__project"
                disabled={selecting}
                onClick={() => onSelect(p.ref, p.name)}
              >
                <span className="connect__project-name">{p.name}</span>
                <span className="connect__project-meta">{p.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selecting && <p className="connect__hint">Reading your schema…</p>}
    </section>
  );
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

      <a className="cta connect-result__cta" href={`/app/?db=${encodeURIComponent(result.dbId)}`}>
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
