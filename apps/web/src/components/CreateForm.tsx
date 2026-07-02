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
//
// `CreateSnippetView` (SK-WEB-010) renders the embed snippet shape
// under the schema preview with `pk_live_REPLACE_ME` + a Sign-in CTA.
// The real key still inlines only via the chat's Copy snippet
// (SK-WEB-007) — the marketing-page anon key is gone after the create
// call consumes the SK-ANON-012 1-call cap.
//
// The post-create MCP install affordance (SK-WEB-016) is the shared
// `<McpInstallView>` (`./McpInstallView.tsx`), reused by the `/app`
// chat-window install popover so the two React venues can't drift.

import { useEffect, useId, useState } from "react";
import { type CreateError, type CreateResult, type CreateRow, postAskCreate } from "../lib/api";
import { messageFor } from "../lib/create-errors";
import { attachHandoff } from "../lib/handoff";
import { emit } from "../lib/logsnag";
import {
  appendHistory,
  clearDraft,
  loadDraft,
  makeDraftSaver,
  savePending,
} from "../lib/prompt-storage";
import { prettifyHeader } from "../lib/text";
import { solveChallenge } from "../lib/turnstile";
import ErrorBoundary from "./ErrorBoundary";
import McpInstallView from "./McpInstallView";

interface CreateFormProps {
  apiBase: string;
}

const MAX_ROWS_RENDERED = 5;

const draftSaver = makeDraftSaver();

export default function CreateForm(props: CreateFormProps) {
  // SK-WEB-001 — every island ships behind ErrorBoundary so a render
  // throw produces a visible fallback instead of an empty `<main>`.
  return (
    <ErrorBoundary surface="CreateForm">
      <CreateFormInner {...props} />
    </ErrorBoundary>
  );
}

function CreateFormInner({ apiBase }: CreateFormProps) {
  const inputId = useId();
  const errorId = useId();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  // Track the structured error, not the rendered string — the rate-limit
  // CTA branch reads `error.kind` rather than scraping the user-facing
  // copy. `networkError` is the `catch` branch (no `CreateError` shape).
  const [error, setError] = useState<CreateError | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
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
    setNetworkError(null);
    // Keep the previous result visible during submission. On the
    // SK-ANON-012 auth_required path the redirect fires and the page
    // navigates away anyway; clearing here would just flash an empty
    // form before the redirect. On a successful resubmit, setResult
    // below replaces it; on error the previous result stays visible
    // alongside the error banner — better than a blank form.
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
      // against the now-authed cookie session. `signInUrl` points at
      // the app origin, which may differ from this page's (marketing)
      // origin — attachHandoff carries the pending prompt, draft, and
      // anon token across in the URL fragment (SK-ANON-015) so the
      // app-origin localStorage can rehydrate them.
      if (!outcome.ok && outcome.error.kind === "auth_required") {
        savePending({
          goal: trimmed,
          submittedAt,
          origin: typeof window !== "undefined" ? window.location.pathname : "/",
        });
        if (typeof window !== "undefined") {
          window.location.assign(attachHandoff(withReplayFlag(outcome.error.signInUrl)));
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
        setError(outcome.error);
      }
    } catch {
      appendHistory({ goal: trimmed, submittedAt, status: "error", outcome: "network" });
      setNetworkError("Couldn't reach the API — try again.");
    } finally {
      setLoading(false);
    }
  }

  // One error string from either source — the structured CreateError copy or
  // the network catch — so the field association and the alert region have a
  // single thing to point at.
  const shownError = error ? messageFor(error) : networkError;

  return (
    <section className="createform">
      <h1 className="createform__title">Spin up a database from a sentence.</h1>
      <p className="createform__lede">
        Anonymous — no sign-in. Your DB lives 72h; sign in (always free) to keep it.
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
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? errorId : undefined}
        />
        <button
          type="submit"
          className="cta createform__submit"
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
        {shownError && (
          <div id={errorId} className="createform__error-wrap" role="alert">
            <p className="createform__error">{shownError}</p>
          </div>
        )}
      </form>

      {result && <CreateResultView result={result} />}
    </section>
  );
}

function CreateResultView({ result }: { result: CreateResult }) {
  const grouped = groupByTable(result.sampleRows);
  return (
    <section className="createresult" aria-label="Created database">
      <p className="createresult__id">
        <span className="createresult__id-label">db</span>
        <code>{result.displayName}</code>
      </p>
      <p className="createresult__schema">
        Provisioned with {result.sampleRows.length} sample row
        {result.sampleRows.length === 1 ? "" : "s"} across {grouped.length} table
        {grouped.length === 1 ? "" : "s"}.
      </p>
      {grouped.map((tbl) => (
        <SampleTable key={tbl.table} table={tbl.table} rows={tbl.rows} />
      ))}
      <McpInstallView />
      <CreateSnippetView primaryTable={grouped[0]?.table} />
    </section>
  );
}

// SK-WEB-010 — Marketing-page Copy-snippet shows the embed shape but
// defers key inlining to the chat. The just-created anon DB has burned
// its 1-call SK-ANON-012 budget, so an inlined anon `pk_live_` would
// 401 on the element's first fetch. Sign-in adopts the DB
// (SK-ANON-003) and rotates the key to permanent (SK-WEB-007); the
// post-sign-in chat is then the one place where Copy-snippet inlines
// a working key.
function CreateSnippetView({ primaryTable }: { primaryTable: string | undefined }) {
  const goal = primaryTable ? `the 5 newest rows from ${primaryTable}` : "show me 5 rows";
  const snippet = `<script src="https://elements.nlqdb.com/v1.js" type="module"></script>

<nlq-data
  goal="${goal}"
  api-key="pk_live_REPLACE_ME"
  template="table"
></nlq-data>`;
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      // GLOBAL-024 demand-signal. Same event name + surface convention
      // as chat CopySnippet (surface="chat") and CodePanel (surface=
      // <snippet-slug>); "create_result" labels the marketing post-
      // create surface so the funnel pivot reads cleanly.
      emit("home.snippet_copied", { surface: "create_result" });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail under non-secure contexts or extension
      // policy; the user can still triple-click the <pre> to copy.
    }
  }

  return (
    <section className="createresult__snippet" aria-label="Embed snippet">
      <div className="createresult__snippet-head">
        <h3 className="createresult__snippet-title">Embed this DB</h3>
        <button
          type="button"
          className="btn createresult__snippet-copy"
          onClick={() => void onCopy()}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="createresult__snippet-code">
        <code>{snippet}</code>
      </pre>
      <p className="createresult__snippet-hint">
        Sign in (free) to keep this DB — your <code>pk_live_</code> key then appears in every chat
        reply's <strong>Copy snippet</strong> and on the <code>/app/keys</code> page. No card
        required.
      </p>
      <a
        className="btn btn--accent createresult__snippet-cta"
        href="/auth/sign-in?return_to=/app"
        onClick={() => emit("home.snippet_signin_cta_clicked", { surface: "create_result" })}
      >
        Sign in (free) to continue →
      </a>
    </section>
  );
}

function groupByTable(rows: CreateResult["sampleRows"]): { table: string; rows: CreateRow[] }[] {
  const groups = new Map<string, CreateRow[]>();
  for (const row of rows) {
    const list = groups.get(row.table) ?? [];
    list.push(row.values);
    groups.set(row.table, list);
  }
  return Array.from(groups, ([table, rows]) => ({ table, rows }));
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
                <th key={c}>{prettifyHeader(c)}</th>
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

// SK-ANON-011 / WS02-T3: mark that a pending prompt is expected after
// sign-in so the chat (/app) can acknowledge the rare case where it
// couldn't be recovered (privacy mode / cleared storage). The flag rides
// the URL; the prompt text never does. It lives on `return_to` —
// sign-in.astro folds that into the post-signin `next`, and post-signin
// preserves it on the final redirect — defaulting to /app, where the
// composer rehydrates the pending prompt.
function withReplayFlag(signInUrl: string): string {
  try {
    const url = new URL(signInUrl, window.location.origin);
    const returnTo = new URL(url.searchParams.get("return_to") ?? "/app", window.location.origin);
    returnTo.searchParams.set("replay", "1");
    url.searchParams.set("return_to", returnTo.pathname + returnTo.search);
    return url.toString();
  } catch {
    return signInUrl;
  }
}
