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

import { useEffect, useId, useRef, useState } from "react";
import { CREATE_STARTERS, type CreateStarter } from "../data/create-starters";
import { type CreateError, type CreateResult, postAskCreate } from "../lib/api";
import { messageFor } from "../lib/create-errors";
import { makeDropoffFunnel } from "../lib/dropoff";
import { attachHandoff } from "../lib/handoff";
import { emit } from "../lib/logsnag";
import {
  appendHistory,
  clearDraft,
  loadDraft,
  makeDraftSaver,
  savePending,
} from "../lib/prompt-storage";
import { makeTtfvOnce } from "../lib/ttfv";
import { solveChallenge } from "../lib/turnstile";
import ErrorBoundary from "./ErrorBoundary";
import McpInstallView from "./McpInstallView";
import { groupByTable, SampleTable } from "./SampleTable";

interface CreateFormProps {
  apiBase: string;
}

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
  // SK-ONBOARD-005 — fire-once TTFV recorder, created per mount so a
  // resubmit or re-render can't double-count this landing.
  const ttfvOnce = useRef(makeTtfvOnce());
  // SK-ONBOARD-005 — the drop-off funnel (landing → 1st/2nd attempt),
  // one per mount so its fire-guards track this single landing.
  const dropoff = useRef(makeDropoffFunnel());

  // Rehydrate the draft on mount — the user may have refreshed
  // mid-typing, or come back from a sign-in redirect that didn't
  // replay (rare; happens if /sign-in fell back to manual click).
  useEffect(() => {
    const saved = loadDraft();
    if (saved) setGoal(saved);
    // SK-ONBOARD-005 — top of the drop-off funnel: this render IS the
    // landing. Fires once per mount (StrictMode double-invokes effects
    // in dev, but the recorder's guard collapses that to one event).
    const landing = dropoff.current.landing("create");
    if (landing) emit(landing.event, landing.props);
  }, []);

  function onGoalChange(next: string) {
    setGoal(next);
    draftSaver(next);
  }

  // A starter only fills the input — it never auto-submits, so the
  // SK-ANON-012 one-shot create call is never spent on a mis-click; the
  // user still reviews and presses "Create the DB". `home.starter_clicked`
  // is the GLOBAL-024 funnel signal for which first goal strangers pick.
  function onStarter(starter: CreateStarter) {
    onGoalChange(starter.goal);
    emit("home.starter_clicked", { starter: starter.id });
  }

  async function submit() {
    const trimmed = goal.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setNetworkError(null);
    // SK-ONBOARD-005 — drop-off funnel: record the attempt before the
    // network call, so a second submit is captured even when the
    // SK-ANON-012 one-shot cap redirects it to sign-in (ordinal 1 =
    // first_query.attempted, 2 = second_query.attempted, then silent).
    const attempt = dropoff.current.attempt("create");
    if (attempt) emit(attempt.event, attempt.props);
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
        // SK-ONBOARD-005 — TTFV (landing → first answer). See lib/ttfv.ts:
        // performance.now() here is ms since page load, the honest
        // landing→answer span. Emits at most once per landing.
        const ttfv = ttfvOnce.current("create");
        if (ttfv) emit(ttfv.event, ttfv.props);
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
        {!result && (
          <div className="createform__starters">
            <span className="createform__starters-label">Not sure? Start from —</span>
            <ul className="createform__starter-list">
              {CREATE_STARTERS.map((starter) => (
                <li key={starter.id}>
                  <button
                    type="button"
                    className="createform__starter"
                    onClick={() => onStarter(starter)}
                    disabled={loading}
                  >
                    {starter.goal}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
      {result.trace ? <CreateTraceView trace={result.trace} /> : null}
      <McpInstallView />
      <CreateSnippetView primaryTable={grouped[0]?.table} />
    </section>
  );
}

// SK-TRUST-002 / SK-WEB-005 — the create reply's collapsed-by-default
// trace pane. `sql` carries the compiled DDL that provisioned the
// schema (the create-path analogue of the chat trace's compiled SQL);
// FLOW-001 step 6 walks this affordance daily. Guarded at the call
// site so a stale API response without `trace` degrades to no pane
// rather than a render throw.
function CreateTraceView({ trace }: { trace: CreateResult["trace"] }) {
  return (
    <details className="createresult__trace">
      <summary className="createresult__trace-summary">trace</summary>
      <pre className="createresult__trace-sql">
        <code>{trace.sql}</code>
      </pre>
      <p className="createresult__trace-meta">
        plan=<code>{trace.plan_id}</code> model=<code>{trace.model}</code> confidence=
        {trace.confidence.toFixed(2)}
      </p>
    </details>
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
        href="/auth/sign-in/?return_to=/app/"
        onClick={() => emit("home.snippet_signin_cta_clicked", { surface: "create_result" })}
      >
        Sign in (free) to continue →
      </a>
    </section>
  );
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
