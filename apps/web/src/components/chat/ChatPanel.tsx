// ChatPanel — the product chat island (SK-WEB-005). Renders the
// left rail, the message list (each reply = Answer + Data + Trace,
// SK-WEB-005), the composer, and the Cmd+K palette. All HTTP runs
// through @nlqdb/sdk (GLOBAL-001).
//
// Streaming: askStream invokes onTrace per pipeline step
// (`plan_pending` → `plan` → `rows` → `summary`). Per-step
// skeletons stay on screen until the matching event arrives.
//
// Destructive ops (SK-ONBOARD-004): when the API returns
// `requires_confirm: true` (or fires a `confirm_required` trace
// event) we render a DiffChip and gate the composer. The next
// Enter press / Approve click re-sends the SAME goal with
// `confirm: true` — the diff acts as a one-shot bypass of the
// confidence gate; we never silently re-fire without it.
//
// SK-ASK-009 / SK-HDC-011: the composer is no longer gated on a
// pinned `dbId`. Sends without an active DB go through `client.ask()`
// (non-streaming) — the API resolves the DB deterministically (0 →
// CREATE, 1 → auto-target) or via the cheap-tier LLM disambiguator
// on 2+ DBs. Confident picks come back with a `selected_db` echo
// rendered as a "picked X" attribution chip; below the confidence
// floor the API returns 409 `ambiguous_db` with `candidate_dbs` and
// we render an explicit picker. `kind=create` responses fold the
// new DB into the rail and re-pin it for the next send.

import type {
  Trace as ApiTrace,
  AskDiff,
  AskOk,
  CandidateDb,
  DatabaseSummary,
  SelectedDbEcho,
  TraceEvent,
} from "@nlqdb/sdk";
import { NlqdbApiError } from "@nlqdb/sdk";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getChatClient } from "../../lib/chat-client";
import { deriveSlug, displayName } from "../../lib/names";
import { clearPending, loadPending } from "../../lib/prompt-storage";
import ErrorBoundary from "../ErrorBoundary";
import { SampleTable } from "../SampleTable";
import { groupProvisionedTables } from "../sample-rows";
import Answer from "./Answer";
import CopySnippet from "./CopySnippet";
import { matchesValidMessageShape } from "./chat-validate";
import Data from "./Data";
import DiffChip from "./DiffChip";
import { messageFor } from "./error-message";
import FreeModelNudge from "./FreeModelNudge";
import { freeChainStruggled } from "./free-model-nudge-gate";
import LeftRail from "./LeftRail";
import ModelPicker, { BYOLLM_STATUS_EVENT } from "./ModelPicker";
import Palette, { type PaletteAction } from "./Palette";
import PmfSurveyCard from "./PmfSurveyCard";
import { settleInterruptedReply } from "./reply-settle";
import Trace, { type TraceStepName, type TraceStepRecord } from "./Trace";
import { displayTraceSteps } from "./trace-steps";

interface ChatPanelProps {
  apiBase: string;
}

type ReplyState =
  | { kind: "pending" }
  | { kind: "ok"; ok: AskOk }
  | { kind: "needs-confirm"; diff: AskDiff; pending: AskOk | null }
  // SK-HDC-001 + SK-ASK-009: kind=create response shape — surfaced
  // as a distinct reply state carrying the real sample rows so the user
  // sees what got created (display name + the actual seeded tables,
  // matching the marketing CreateForm) rather than an empty `AskOk`.
  // SK-TRUST-002: `trace` (always present) carries the compiled DDL +
  // confidence so the create reply's trace pane isn't empty — the
  // create-path analogue of `AskOk.trace`, matching CreateForm's
  // `CreateTraceView`.
  | {
      kind: "created";
      displayName: string;
      dbId: string;
      // Provisioned table names (schema source of truth). The count + one
      // preview per table derive from this, never from `sampleRows` — the
      // seed set is LLM-authored and may be partial or empty
      // (SK-HDC-018/019), which would otherwise drop unseeded tables and
      // render a fully-unseeded create as "0 tables".
      tables: string[];
      sampleRows: { table: string; values: Record<string, unknown> }[];
      trace: ApiTrace;
    }
  // SK-ASK-009: 2+ DBs and the disambiguator's confidence was below
  // the floor — render an explicit picker so the user can pin the
  // intended DB. Clicking a candidate re-sends with that dbId.
  | { kind: "ambiguous"; candidates: CandidateDb[]; reason: string }
  // SK-ASK-014: caller pinned a dbId but the classifier returned
  // kind=create. Surface a clarification chip ("Create a new database,
  // or query <pinned slug>?") so the user can choose; the previous
  // behaviour was a generic "That query was rejected" via the read/
  // write SQL allowlist's disallowed_verb path.
  | { kind: "clarify"; pinnedDb: { id: string; slug: string } | null }
  // `code` is the NlqdbApiError.code (when the failure came from the API) so
  // the free-model nudge can fire only on model-quality failures, not on
  // rate-limit / network / auth noise (SK-PREMIUM-004).
  | { kind: "error"; message: string; code?: string };

type Reply = {
  id: string;
  goal: string;
  state: ReplyState;
  steps: TraceStepRecord[];
  startedAt: number;
  // SK-TRUST-002 — the full trace block, populated by the `plan`
  // streaming event. Drives the trace pane's plan_id/confidence/model
  // rendering. Null until the plan event lands.
  trace?: ApiTrace;
};

type Message =
  | { id: string; role: "user"; goal: string }
  | { id: string; role: "assistant"; reply: Reply };

const PIPELINE_STEPS: TraceStepName[] = ["cache_lookup", "plan", "validate", "exec", "summarize"];

const PAGE_SIZE = 20;
const HIST_MAX = 50;

function histKey(dbId: string) {
  return `nlq_hist_${dbId}`;
}

// Type-guard wrapper around `matchesValidMessageShape`. The structural
// check lives in `./chat-validate.ts` (no JSX) so the unit suite can
// import it without booting the React JSX runtime; this wrapper just
// re-asserts the type relationship for the call sites here.
function isValidMessage(m: unknown): m is Message {
  return matchesValidMessageShape(m);
}

function loadHistory(dbId: string): Message[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(histKey(dbId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidMessage).map((m): Message => {
      if (m.role === "user") return m;
      const settled = settleInterruptedReply(m.reply.state.kind, "Session ended.");
      return settled ? { ...m, reply: { ...m.reply, state: settled } } : m;
    });
  } catch {
    return [];
  }
}

function saveHistory(dbId: string, messages: Message[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    const compact = messages.slice(-HIST_MAX).map((m): Message => {
      if (m.role === "user") return m;
      const { reply } = m;
      if (reply.state.kind !== "ok") return { ...m, reply: { ...reply, steps: [] } };
      return {
        ...m,
        reply: {
          ...reply,
          steps: [],
          state: { kind: "ok", ok: { ...reply.state.ok, rows: [] } },
        },
      };
    });
    localStorage.setItem(histKey(dbId), JSON.stringify(compact));
  } catch {
    // localStorage full or unavailable — degrade silently
  }
}

export default function ChatPanel(props: ChatPanelProps) {
  // SK-WEB-001 — every island ships behind ErrorBoundary so a render
  // throw produces a visible fallback instead of an empty `<main>`.
  return (
    <ErrorBoundary surface="ChatPanel">
      <ChatPanelInner {...props} />
    </ErrorBoundary>
  );
}

function ChatPanelInner({ apiBase }: ChatPanelProps) {
  const [activeDb, setActiveDb] = useState<DatabaseSummary | null>(null);
  const [activeDbId, setActiveDbId] = useState<string | null>(() => readDbIdFromUrl());
  // Chat-created DB to inject into the rail. LeftRail watches this and
  // prepends to its own list — the kind=create response originates in
  // ChatPanel, so without this prop the new DB only appears in the
  // sidebar after a full refresh.
  const [newlyCreatedDb, setNewlyCreatedDb] = useState<DatabaseSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [composer, setComposer] = useState("");
  // One-time, dismissible status line for rare recoverable states
  // (pending-prompt loss WS02-T3, stale `?db=` deep-link WS02-T5).
  const [notice, setNotice] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tracesOpen, setTracesOpen] = useState(false);
  const inFlightRef = useRef<AbortController | null>(null);
  const pendingDiffRef = useRef<{ replyId: string; goal: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const loadedForRef = useRef<string | null>(null);
  // Set when the mount rehydrated a pending prompt from the auth
  // redirect (SK-ANON-015) — the rail's onLoaded skips the newest-DB
  // auto-pin so the replayed goal lands on "All databases" and the
  // classifier routes it (create vs query) instead of forcing one DB.
  const replayArrivalRef = useRef(false);

  // Focus the composer once on mount so the user lands ready to
  // type. Imperative — `autoFocus` trips a11y rules that don't
  // know the page's whole purpose is the input below.
  //
  // SK-ANON-012 — if `nlqdb_pending` is set (from the 2nd anon
  // /v1/ask before the auth-redirect), pre-fill the composer with
  // it and clear the slot so a refresh doesn't re-fill. The user
  // reviews + submits; we no longer auto-replay through `/auth/post-signin`.
  useEffect(() => {
    const pending = loadPending();
    if (pending?.goal) {
      setComposer(pending.goal);
      clearPending();
      replayArrivalRef.current = true;
    } else if (readReplayExpected()) {
      // WS02-T3: the auth wall set `?replay=1` and promised "your prompt
      // is saved" (SK-ANON-012), but `nlqdb_pending` is gone (privacy
      // mode / cleared storage). Acknowledge the rare loss instead of
      // silently rendering an empty composer.
      setNotice("Couldn't recover your previous message — re-type it here.");
    }
    clearReplayFromUrl();
    composerRef.current?.focus();
  }, []);

  // Cmd+K / Cmd+/ global keybindings. Captured at the document
  // level so the user doesn't have to focus the panel first.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (e.key === "/") {
        e.preventDefault();
        setTracesOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-scroll new replies into view. Only scrolls within the
  // chat list, not the whole document. The biome exhaustive-deps
  // rule flags `messages` as unread inside the body — but we
  // genuinely DO want to re-run on every message change, which is
  // exactly what this dep encodes. Reading `.length` makes the
  // intent explicit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll-on-new-message is the intent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Load per-DB history from localStorage whenever the active DB changes
  // (including the initial URL-driven mount). Guard with loadedForRef so
  // switching back to an already-loaded DB doesn't clobber live messages.
  useEffect(() => {
    if (!activeDbId || loadedForRef.current === activeDbId) return;
    loadedForRef.current = activeDbId;
    setMessages(loadHistory(activeDbId));
    setVisibleCount(PAGE_SIZE);
  }, [activeDbId]);

  // Persist settled messages to localStorage after each completed exchange.
  // Rows are stripped before writing (saveHistory) to cap storage usage.
  useEffect(() => {
    if (!activeDbId || messages.length === 0) return;
    const hasInFlight = messages.some(
      (m) => m.role === "assistant" && m.reply.state.kind === "pending",
    );
    if (hasInFlight) return;
    saveHistory(activeDbId, messages);
  }, [messages, activeDbId]);

  const updateReply = useCallback((id: string, mut: (reply: Reply) => Reply) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.role === "assistant" && msg.reply.id === id ? { ...msg, reply: mut(msg.reply) } : msg,
      ),
    );
  }, []);

  // `applySelectedDb` is referenced inside `startSend`. It's defined
  // below as a plain function (not useCallback) because it captures
  // setState bindings that don't change across renders. The biome
  // exhaustive-deps rule flags it; adding it to deps would defeat
  // useCallback by re-creating startSend on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: applySelectedDb is render-stable; see comment above
  const startSend = useCallback(
    async (
      goal: string,
      opts: {
        confirm?: boolean;
        replyId?: string;
        dbIdOverride?: string;
        // SK-ASK-014: when the user accepts the clarify chip's
        // "Create new database" action, we re-send the same goal
        // without any pin so the API's classifier routes the
        // request through the create path. Overrides activeDbId
        // and dbIdOverride.
        forceNoPin?: boolean;
      } = {},
    ) => {
      // SK-ASK-009: send routes through `askStream` only when a
      // `dbId` is pinned (active rail item OR the candidate the user
      // just clicked). Without a pinned dbId we use `ask()` so the
      // API can return either AskOk (auto-targeted, 1-DB or LLM
      // pick), a kind=create envelope (0 DBs / classifier=create),
      // or a 409 ambiguous_db with candidate_dbs.
      const pinnedDbId = opts.forceNoPin ? null : (opts.dbIdOverride ?? activeDbId);

      const replyId = opts.replyId ?? cryptoRandomId();

      if (!opts.replyId) {
        const userMsg: Message = { id: cryptoRandomId(), role: "user", goal };
        const assistantMsg: Message = {
          id: cryptoRandomId(),
          role: "assistant",
          reply: {
            id: replyId,
            goal,
            state: { kind: "pending" },
            steps: PIPELINE_STEPS.map((name) => ({ name, status: "pending" })),
            startedAt: performance.now(),
          },
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
      } else {
        // Confirm retry — re-arm the same reply to "pending".
        updateReply(replyId, (reply) => ({
          ...reply,
          state: { kind: "pending" },
          startedAt: performance.now(),
          steps: PIPELINE_STEPS.map((name) => ({ name, status: "pending" })),
        }));
      }

      // Cancel any in-flight call so the previous reply doesn't
      // race the new one. SK-SDK-003 — every call honors the
      // shared AbortSignal.
      inFlightRef.current?.abort();
      const ac = new AbortController();
      inFlightRef.current = ac;

      const onTrace = (event: TraceEvent) =>
        updateReply(replyId, (reply) => applyTraceEvent(reply, event));

      const client = getChatClient(apiBase);

      try {
        if (pinnedDbId) {
          const result = await client.askStream(
            { goal, dbId: pinnedDbId, ...(opts.confirm ? { confirm: true } : {}) },
            { signal: ac.signal, onTrace },
          );
          if (result.requires_confirm && result.diff) {
            const diff = result.diff;
            pendingDiffRef.current = { replyId, goal };
            updateReply(replyId, (reply) => ({
              ...reply,
              state: { kind: "needs-confirm", diff, pending: result },
            }));
            return;
          }
          pendingDiffRef.current = null;
          if (result.selected_db) applySelectedDb(result.selected_db);
          updateReply(replyId, (reply) => ({
            ...reply,
            state: { kind: "ok", ok: result },
          }));
          return;
        }

        // No active dbId — `ask()` returns AskOk | AskCreateResult.
        // Aborts and protocol errors throw NlqdbApiError; the 409
        // ambiguous_db lands as `err.code === "ambiguous_db"` and is
        // narrowed below to the picker UI. The `"kind" in result`
        // check narrows to AskCreateResult (AskOk has `status` but
        // not `kind`); the else branch is AskOk.
        const result = await client.ask({ goal }, { signal: ac.signal });
        if ("kind" in result) {
          // SK-HDC-001: API created a new DB. Fold it into the rail,
          // re-pin it, and surface a "Created X" reply state so the
          // user sees what just happened.
          const dbSummary: DatabaseSummary = {
            id: result.db,
            slug: deriveSlug(result.db),
            displayName: result.displayName,
            schemaName: result.schemaName,
            engine: result.engine,
            pkLive: result.pkLive,
            lastQueriedAt: null,
            createdAt: Math.floor(Date.now() / 1000),
          };
          // Mark this dbId as already-loaded so the activeDbId effect
          // below short-circuits instead of replacing the in-flight
          // [user goal, "created" reply] pair with loadHistory(newDb)
          // = [] (no history exists yet for a brand-new dbId). The
          // save effect then persists this exchange to the new dbId's
          // localStorage slot on the next render.
          loadedForRef.current = result.db;
          setActiveDb(dbSummary);
          setActiveDbId(result.db);
          setNewlyCreatedDb(dbSummary);
          syncDbIdToUrl(result.db);
          updateReply(replyId, (reply) => ({
            ...reply,
            state: {
              kind: "created",
              displayName: result.displayName,
              dbId: result.db,
              // SDK types `plan` as `unknown`; narrow to the provisioned
              // table list the create response carries (schema source of
              // truth for the count + preview).
              tables: (result.plan as { tables?: string[] } | null)?.tables ?? [],
              sampleRows: result.sampleRows,
              trace: result.trace,
            },
          }));
          return;
        }
        // AskOk shape — auto-targeted (1-DB) or LLM-picked.
        if (result.selected_db) applySelectedDb(result.selected_db);
        if (result.requires_confirm && result.diff) {
          const diff = result.diff;
          pendingDiffRef.current = { replyId, goal };
          updateReply(replyId, (reply) => ({
            ...reply,
            state: { kind: "needs-confirm", diff, pending: result },
          }));
          return;
        }
        pendingDiffRef.current = null;
        updateReply(replyId, (reply) => ({
          ...reply,
          state: { kind: "ok", ok: result },
        }));
      } catch (err) {
        if (ac.signal.aborted) {
          // A newer send aborted this in-flight request (see the abort
          // above). Settle the superseded reply to a terminal state —
          // leaving it "pending" spins a skeleton forever above the newer
          // answer and blocks history persistence (the save effect skips
          // while any reply is pending; the session then only heals on a
          // full reload). GLOBAL-011 — never spinner-lie.
          updateReply(replyId, (reply) => {
            const settled = settleInterruptedReply(
              reply.state.kind,
              "Cancelled — replaced by a newer question.",
            );
            return settled ? { ...reply, state: settled } : reply;
          });
          return;
        }
        // SK-ASK-009: 409 ambiguous_db carries `candidate_dbs` —
        // surface as a picker chip rather than a generic error.
        if (err instanceof NlqdbApiError && err.code === "ambiguous_db") {
          const candidates = err.body?.candidate_dbs ?? [];
          const reason = err.body?.reason ?? "";
          updateReply(replyId, (reply) => ({
            ...reply,
            state: { kind: "ambiguous", candidates, reason },
          }));
          return;
        }
        // SK-ASK-014: 409 clarify_required carries `pinned_db` — the
        // user pinned a DB but the classifier returned kind=create.
        // Render a chip with two actions ("Create new database" /
        // "Cancel") rather than the generic rejection message.
        if (err instanceof NlqdbApiError && err.code === "clarify_required") {
          const pinned = err.body?.pinned_db ?? null;
          updateReply(replyId, (reply) => ({
            ...reply,
            state: { kind: "clarify", pinnedDb: pinned },
          }));
          return;
        }
        updateReply(replyId, (reply) => ({
          ...reply,
          state: {
            kind: "error",
            message: messageFor(err),
            code: err instanceof NlqdbApiError ? err.code : undefined,
          },
        }));
      }
    },
    [activeDbId, apiBase, updateReply],
  );

  // Sync the active DB highlight when an LLM pick lands. We also
  // pin `activeDbId` for the next send so users don't need to click
  // the rail to keep the same DB context — they can override by
  // clicking "All databases" if they want auto-pick again.
  function applySelectedDb(echo: SelectedDbEcho) {
    // The selected_db echo (`SK-ASK-009`) carries id/slug/confidence/
    // reason — no engine field, since the picker only needs the slug
    // to confirm the choice. We seed the activeDb placeholder with
    // postgres as the default; the rail's full DB list (which carries
    // the real engine column per `SK-DB-010`) overrides this when the
    // LeftRail load resolves.
    setActiveDb({
      id: echo.id,
      slug: echo.slug,
      displayName: displayName(echo.id),
      engine: "postgres",
      pkLive: null,
      lastQueriedAt: null,
      createdAt: Math.floor(Date.now() / 1000),
    });
    setActiveDbId(echo.id);
    syncDbIdToUrl(echo.id);
  }

  // SK-ASK-009: clicking a candidate from the ambiguous picker
  // re-sends the SAME goal with the chosen dbId pinned. The original
  // reply's state advances to "pending" and the streaming path takes
  // over — same UX as a normal send from that point on.
  function pickCandidate(replyId: string, goal: string, dbId: string) {
    void startSend(goal, { dbIdOverride: dbId, replyId });
  }

  // SK-ASK-014: clicking "Create new database" on the clarify chip
  // re-sends the SAME goal without any pinned dbId. The classifier
  // returns kind=create and the API takes the create path — folding
  // a fresh DB into the rail and re-pinning it for the next send.
  function acceptClarifyCreate(replyId: string, goal: string) {
    void startSend(goal, { replyId, forceNoPin: true });
  }

  function cancelClarify(replyId: string) {
    updateReply(replyId, (reply) => ({
      ...reply,
      state: { kind: "error", message: "Cancelled — try rephrasing." },
    }));
  }

  function approveDiff() {
    const pending = pendingDiffRef.current;
    if (!pending) return;
    pendingDiffRef.current = null;
    void startSend(pending.goal, { confirm: true, replyId: pending.replyId });
  }

  function cancelDiff() {
    const pending = pendingDiffRef.current;
    if (!pending) return;
    pendingDiffRef.current = null;
    updateReply(pending.replyId, (reply) => ({
      ...reply,
      state: { kind: "error", message: "Cancelled — nothing changed." },
    }));
  }

  function onComposerSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const trimmed = composer.trim();
    if (!trimmed) return;
    if (pendingDiffRef.current) {
      // Second Enter on a destructive plan IS the approval (SK-ONBOARD-004).
      // The composer's text is ignored — we re-send the original goal.
      approveDiff();
      return;
    }
    setComposer("");
    void startSend(trimmed);
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!pendingDiffRef.current) return;
    if (e.key === "Enter") {
      // Second Enter on a destructive plan IS the approval (SK-ONBOARD-004).
      e.preventDefault();
      approveDiff();
    } else if (e.key === "Escape") {
      // WS02-T5: Esc cancels the pending change — symmetric with the
      // "Press Enter to approve" affordance the DiffChip advertises. The
      // composer is the focused element while a diff is pending (its
      // placeholder switches to the approve prompt), so both keys land here.
      e.preventDefault();
      cancelDiff();
    }
  }

  function selectDb(db: DatabaseSummary) {
    setActiveDb(db);
    setActiveDbId(db.id);
    pendingDiffRef.current = null;
    // History loading and visibleCount reset happen in the activeDbId
    // effect above (per-db localStorage rehydrate).
    syncDbIdToUrl(db.id);
  }

  // SK-ASK-009: clear the active rail selection. Next send routes
  // through the deterministic-then-LLM resolver. We DO clear the
  // in-memory message list so the user gets a fresh "auto-pick"
  // thread; the per-db history in localStorage is preserved and
  // re-loaded if they pick that db again.
  function clearSelection() {
    setActiveDb(null);
    setActiveDbId(null);
    pendingDiffRef.current = null;
    loadedForRef.current = null;
    setMessages([]);
    setVisibleCount(PAGE_SIZE);
    syncDbIdToUrl(null);
  }

  // SK-HDC-016: when a deleted DB was the active selection, fall back
  // to the "All databases" auto-pick state and clear any persisted
  // history for the dead id so a future DB minted with the same suffix
  // (~1 in 16M) doesn't inherit stale messages.
  function handleDeleted(db: DatabaseSummary) {
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(histKey(db.id));
    } catch {
      // localStorage unavailable — degrade silently.
    }
    if (db.id === activeDbId) clearSelection();
  }

  // Browser back/forward — keep `?db=` in sync with the activeDb
  // state so the rail's highlight matches the URL.
  useEffect(() => {
    function onPopState() {
      setActiveDbId(readDbIdFromUrl());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      {
        id: "new-db",
        label: "New database",
        hint: "create a fresh schema",
        run: () => {
          if (typeof window !== "undefined") window.location.assign("/app/new/");
        },
      },
      {
        id: "copy-snippet",
        label: "Copy embed snippet",
        hint: "for the last reply",
        run: () => {
          const last = [...messages]
            .reverse()
            .find((m): m is Message & { role: "assistant" } => m.role === "assistant");
          if (!last) return;
          const pkLive = activeDb?.pkLive ?? null;
          const snippet = `<nlq-data goal="${last.reply.goal.replace(/"/g, "&quot;")}" api-key="${pkLive ?? "pk_live_"}"></nlq-data>`;
          void navigator.clipboard.writeText(snippet);
        },
      },
      {
        id: "keys",
        label: "API keys",
        hint: "Mint, list, revoke",
        run: () => {
          if (typeof window !== "undefined") window.location.assign("/app/keys/");
        },
      },
      {
        id: "sign-out",
        label: "Sign out",
        run: () => {
          if (typeof window !== "undefined") window.location.assign("/auth/sign-out/");
        },
      },
    ],
    [activeDb, messages],
  );

  // SK-ASK-009: composer is no longer gated on a pinned dbId — the
  // resolver handles 0/1/2+ DBs server-side. Pagination state (from
  // main) is computed from the full `messages` array.
  const visibleMessages = messages.slice(-visibleCount);
  const hasOlder = messages.length > visibleCount;

  // SK-PREMIUM-013 — the model that answered the most recent reply
  // (trace.model, SK-TRUST-002), shown in the picker as the honest
  // "which model am I on" signal. Null until a reply's plan event lands.
  const lastModel = useMemo<string | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role === "assistant" && m.reply.trace?.model) return m.reply.trace.model;
    }
    return null;
  }, [messages]);

  // SK-PREMIUM-004 — whether the user is on the free chain, learned from the
  // ModelPicker's BYOLLM status broadcast. Gates the free-model nudge below
  // struggled replies. Defaults to false (assume frontier) so a BYOLLM user
  // never sees the nudge during the brief status-load window; the picker
  // broadcasts the real value on mount.
  const [onFreeChain, setOnFreeChain] = useState(false);
  useEffect(() => {
    function onStatus(e: Event) {
      const detail = (e as CustomEvent<{ configured: boolean }>).detail;
      setOnFreeChain(!detail?.configured);
    }
    window.addEventListener(BYOLLM_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(BYOLLM_STATUS_EVENT, onStatus);
  }, []);

  return (
    <div className="chat-shell">
      <LeftRail
        apiBase={apiBase}
        activeDbId={activeDbId}
        addedDb={newlyCreatedDb}
        onSelect={selectDb}
        onClearSelection={clearSelection}
        onCreated={selectDb}
        onDeleted={handleDeleted}
        onLoaded={(databases) => {
          if (activeDbId) {
            const match = databases.find((db) => db.id === activeDbId);
            if (match) {
              setActiveDb(match);
              return;
            }
            // WS02-T5: the `?db=<id>` deep link points at a DB that's gone
            // (deleted, swept, or a stale share link). Drop the dead pin
            // and fall back to All-databases auto-pick rather than a header
            // that names a phantom DB whose every query 404s.
            setNotice("That database no longer exists — showing all databases.");
            clearSelection();
            return;
          }
          // No `?db=` in URL — auto-pin the most-recently-created DB so
          // a fresh load (e.g. post-signin from the hero) lands the user
          // inside the DB they just made instead of the "All databases"
          // pseudo-state. `listDatabasesForTenant` returns rows
          // ORDER BY created_at DESC, so `databases[0]` is the newest.
          // Leave the selection empty when the user has zero DBs — or
          // when a replayed prompt just rehydrated (SK-ANON-015): the
          // user's goal predates any pin, so "All databases" is the
          // honest scope and the classifier picks the route.
          if (replayArrivalRef.current) return;
          const newest = databases[0];
          if (newest) selectDb(newest);
        }}
      />

      <main className="chat-main">
        <header className="chat-main__header">
          <h1 className="chat-main__title">
            {activeDb?.displayName ?? (activeDbId ? displayName(activeDbId) : "All databases")}
          </h1>
          <div className="chat-main__meta">
            <ModelPicker apiBase={apiBase} lastModel={lastModel} />
            <span className="chat-main__hint">
              <kbd>Cmd</kbd>+<kbd>K</kbd> commands · <kbd>Cmd</kbd>+<kbd>/</kbd> trace
            </span>
          </div>
        </header>

        {notice ? (
          <div className="chat-notice" role="status">
            <p className="chat-notice__text">{notice}</p>
            <button
              type="button"
              className="chat-notice__dismiss"
              aria-label="Dismiss"
              onClick={() => setNotice(null)}
            >
              &times;
            </button>
          </div>
        ) : null}

        {/* SK-GTM-006 — renders nothing unless the server says this is an
            eligible return visit (≥2 successful answers, ≥24h old). */}
        <PmfSurveyCard apiBase={apiBase} />

        {/* data-ph-mask (SK-WEB-024): PostHog session replay masks all text
            in this subtree — the conversation renders user DB contents
            (query results, sample rows, the typed goal), which must never
            be recorded. Replay keeps layout + click targets, not values. */}
        <ol className="chat-list" aria-live="polite" data-ph-mask="true">
          {hasOlder && (
            <li className="chat-list__load-more">
              <button
                type="button"
                className="chat-list__load-more-btn"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Load earlier messages
              </button>
            </li>
          )}
          {visibleMessages.map((msg) =>
            msg.role === "user" ? (
              <li key={msg.id} className="chat-list__user">
                <span className="chat-list__user-label">you</span>
                <p>{msg.goal}</p>
              </li>
            ) : (
              <li key={msg.id} className="chat-list__assistant">
                <ReplyView
                  reply={msg.reply}
                  pkLive={activeDb?.pkLive ?? null}
                  tracesOpen={tracesOpen}
                  onFreeChain={onFreeChain}
                  onApprove={approveDiff}
                  onCancel={cancelDiff}
                  onPickCandidate={(dbId) => pickCandidate(msg.reply.id, msg.reply.goal, dbId)}
                  onClarifyCreate={() => acceptClarifyCreate(msg.reply.id, msg.reply.goal)}
                  onClarifyCancel={() => cancelClarify(msg.reply.id)}
                />
              </li>
            ),
          )}
          <div ref={messagesEndRef} />
        </ol>

        <form
          className="chat-composer"
          onSubmit={onComposerSubmit}
          aria-busy={!!pendingDiffRef.current}
        >
          <input
            ref={composerRef}
            type="text"
            className="chat-composer__input"
            placeholder={
              pendingDiffRef.current
                ? "Press Enter to approve the change above…"
                : activeDbId
                  ? "Ask about your data…"
                  : "Ask anything — I'll pick the right database…"
            }
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={onComposerKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn--accent chat-composer__send"
            disabled={!pendingDiffRef.current && composer.trim().length === 0}
          >
            {pendingDiffRef.current ? "Approve" : "Send"}
          </button>
        </form>
      </main>

      <Palette open={paletteOpen} actions={paletteActions} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

// SK-ASK-009: keep the URL `?db=` query param synced with the
// active selection so back/forward and reload land on the same
// state. Pass null to drop the param entirely.
function syncDbIdToUrl(dbId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (dbId) url.searchParams.set("db", dbId);
  else url.searchParams.delete("db");
  window.history.pushState(null, "", url.toString());
}

function ReplyView({
  reply,
  pkLive,
  tracesOpen,
  onFreeChain,
  onApprove,
  onCancel,
  onPickCandidate,
  onClarifyCreate,
  onClarifyCancel,
}: {
  reply: Reply;
  pkLive: string | null;
  tracesOpen: boolean;
  // SK-PREMIUM-004: user is on the free chain — enables the free-model nudge
  // when this reply is one the free model visibly struggled on.
  onFreeChain: boolean;
  onApprove: () => void;
  onCancel: () => void;
  // SK-ASK-009: invoked when the user clicks one of the
  // `candidate_dbs` on an `ambiguous` reply. Re-sends the same goal
  // pinned to the chosen dbId.
  onPickCandidate: (dbId: string) => void;
  // SK-ASK-014: clarify chip actions. `onClarifyCreate` re-sends the
  // goal without any pin so the API takes the create path;
  // `onClarifyCancel` dismisses the reply with a "rephrase" hint.
  onClarifyCreate: () => void;
  onClarifyCancel: () => void;
}) {
  const ok = reply.state.kind === "ok" ? reply.state.ok : null;
  const needsConfirm = reply.state.kind === "needs-confirm" ? reply.state.diff : null;
  const created = reply.state.kind === "created" ? reply.state : null;
  const ambiguous = reply.state.kind === "ambiguous" ? reply.state : null;
  const clarify = reply.state.kind === "clarify" ? reply.state : null;
  const error = reply.state.kind === "error" ? reply.state.message : null;
  const pending = reply.state.kind === "pending";

  // SK-TRUST-002 — the trace pane is always present. Prefer the live
  // streaming trace (`reply.trace`), then the settled reply's own trace:
  // `ok.trace` on a query/write, `created.trace` (the compiled DDL) on a
  // create. Optional chaining keeps a stale/partial persisted shape from
  // throwing and unmounting the island (SK-WEB-001).
  const trace = reply.trace ?? ok?.trace ?? created?.trace ?? null;
  const sql = trace?.sql ?? extractSqlFromSteps(reply.steps);
  const rows = ok?.rows ?? null;
  const rowCount = ok?.rowCount ?? null;
  const summary = ok?.summary;
  const selected = ok?.selected_db;

  return (
    <article className="chat-reply" data-state={reply.state.kind}>
      {/* SK-ASK-009: visible attribution chip when the API auto-
          picked a DB. Always shown alongside the answer so the user
          sees which DB was queried before reading the rows. */}
      {selected ? (
        <p className="chat-reply__selected-db" role="status">
          Picked database <code>{displayName(selected.id)}</code> ·{" "}
          <span className="chat-reply__selected-reason">
            {selected.reason || "matched your goal"}
          </span>{" "}
          ·{" "}
          <span className="chat-reply__selected-confidence">
            {Math.round(selected.confidence * 100)}% confident
          </span>
        </p>
      ) : null}
      {created
        ? (() => {
            const grouped = groupProvisionedTables(created.tables, created.sampleRows);
            const rowCount = created.sampleRows.length;
            return (
              <div className="chat-reply__created">
                <p className="chat-reply__created-line" role="status">
                  Created database <code>{created.displayName}</code> with {grouped.length} table
                  {grouped.length === 1 ? "" : "s"} and {rowCount} sample row
                  {rowCount === 1 ? "" : "s"}. Pinned to this conversation.
                </p>
                {grouped.map((tbl) => (
                  <SampleTable key={tbl.table} table={tbl.table} rows={tbl.rows} />
                ))}
              </div>
            );
          })()
        : null}
      {ambiguous ? (
        <div className="chat-reply__ambiguous">
          <p className="chat-reply__ambiguous-prompt">
            Which database did you mean?
            {ambiguous.reason ? (
              <span className="chat-reply__ambiguous-reason"> ({ambiguous.reason})</span>
            ) : null}
          </p>
          <ul className="chat-reply__candidates">
            {ambiguous.candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onPickCandidate(c.id)}
                  title={c.slug}
                >
                  {displayName(c.id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {clarify ? (
        <div className="chat-reply__clarify">
          <p className="chat-reply__clarify-prompt">
            Looks like you want to create something new.{" "}
            {clarify.pinnedDb ? (
              <>
                Spin up a fresh database, or rephrase to query{" "}
                <code>{displayName(clarify.pinnedDb.id)}</code>?
              </>
            ) : (
              <>Spin up a fresh database, or rephrase your request?</>
            )}
          </p>
          <ul className="chat-reply__clarify-actions">
            <li>
              <button type="button" className="btn btn--accent" onClick={onClarifyCreate}>
                Create new database
              </button>
            </li>
            <li>
              <button type="button" className="btn btn--ghost" onClick={onClarifyCancel}>
                Cancel
              </button>
            </li>
          </ul>
        </div>
      ) : null}
      <Answer summary={summary} pending={pending} />
      <Data rows={rows} rowCount={rowCount} pending={pending} />
      {needsConfirm ? (
        <DiffChip diff={needsConfirm} onApprove={onApprove} onCancel={onCancel} />
      ) : null}
      {error ? <p className="chat-reply__error">{error}</p> : null}
      {onFreeChain && freeChainStruggled(reply) ? <FreeModelNudge /> : null}
      {ok && rows && rows.length > 0 ? (
        <div className="chat-reply__actions">
          <CopySnippet goal={reply.goal} pkLive={pkLive} />
        </div>
      ) : null}
      <Trace
        steps={displayTraceSteps(reply.steps, reply.state.kind)}
        sql={sql}
        explain={null}
        defaultOpen={tracesOpen}
        meta={trace ? { plan_id: trace.plan_id, confidence: trace.confidence } : null}
      />
    </article>
  );
}

function applyTraceEvent(reply: Reply, event: TraceEvent): Reply {
  const next = { ...reply, steps: reply.steps.map((s) => ({ ...s })) };
  const now = performance.now();
  const elapsed = Math.round(now - reply.startedAt);

  function mark(name: TraceStepName, mut: (s: TraceStepRecord) => TraceStepRecord) {
    const idx = next.steps.findIndex((s) => s.name === name);
    if (idx === -1) {
      next.steps = [...next.steps, mut({ name, status: "pending" })];
      return;
    }
    const current = next.steps[idx];
    if (!current) return;
    next.steps = [...next.steps.slice(0, idx), mut(current), ...next.steps.slice(idx + 1)];
  }

  switch (event.type) {
    case "plan_pending":
      mark("cache_lookup", (s) => ({ ...s, status: "pending" }));
      mark("plan", (s) => ({ ...s, status: "pending" }));
      break;
    case "plan":
      mark("cache_lookup", (s) => ({
        ...s,
        status: "ok",
        latencyMs: elapsed,
        detail: event.trace.cache_hit ? "hit" : "miss",
      }));
      mark("plan", (s) => ({
        ...s,
        status: "ok",
        latencyMs: elapsed,
        // SK-TRUST-002 — model + confidence ride the trace; surface
        // them on the plan step so the user sees what answered them.
        model: event.trace.model,
        detail: event.trace.cache_hit ? "cached" : "fresh",
      }));
      mark("validate", (s) => ({ ...s, status: "ok", latencyMs: elapsed }));
      mark("exec", (s) => ({ ...s, status: "pending" }));
      // Stash the full trace on the reply so the Trace pane can
      // render plan_id + confidence + model alongside the SQL.
      next.trace = event.trace;
      break;
    case "rows":
      mark("exec", (s) => ({
        ...s,
        status: "ok",
        latencyMs: elapsed,
        detail: `${event.rowCount} rows`,
      }));
      mark("summarize", (s) => ({ ...s, status: "pending" }));
      break;
    case "summary":
      mark("summarize", (s) => ({ ...s, status: "ok", latencyMs: elapsed }));
      break;
    case "confirm_required":
      mark("confirm_required", (s) => ({
        ...s,
        status: "ok",
        latencyMs: elapsed,
        detail: `${event.diff.verb} ${event.diff.affectedRows} rows`,
      }));
      break;
    case "selected_db":
      // Trace timeline doesn't carry the selected_db pick — the
      // `applySelectedDb` side effect on the AskOk envelope drives
      // the rail highlight + URL sync. The chip rendered in
      // ReplyView is the user-visible signal. Fall through.
      break;
    case "error":
      next.steps = next.steps.map((s) =>
        s.status === "pending" ? { ...s, status: "error", detail: event.error.status } : s,
      );
      break;
    case "done":
      // Final marker; per-step events already filled in their
      // own latencies. Anything still pending here is a bug in
      // the API's event ordering.
      break;
  }
  return next;
}

function extractSqlFromSteps(_steps: TraceStepRecord[]): string | null {
  // SQL surfaces via `AskOk.trace.sql` (SK-TRUST-002) today; reserved
  // for a future where the trace events carry the SQL on a per-step
  // basis. Keeping the hook here so ReplyView doesn't have to know.
  return null;
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function readDbIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("db");
}

// WS02-T3: the auth wall threads `?replay=1` through sign-in so the chat
// knows a pending prompt was expected (the prompt text itself never
// rides the URL, per SK-ANON-011).
function readReplayExpected(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("replay") === "1";
}

function clearReplayFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("replay")) return;
  url.searchParams.delete("replay");
  window.history.replaceState(null, "", url.toString());
}
