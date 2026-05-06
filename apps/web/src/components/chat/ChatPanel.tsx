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

import type { AskDiff, AskOk, DatabaseSummary, TraceEvent } from "@nlqdb/sdk";
import { NlqdbApiError } from "@nlqdb/sdk";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getChatClient } from "../../lib/chat-client";
import Answer from "./Answer";
import CopySnippet from "./CopySnippet";
import Data from "./Data";
import DiffChip from "./DiffChip";
import LeftRail from "./LeftRail";
import Palette, { type PaletteAction } from "./Palette";
import Trace, { type TraceStepName, type TraceStepRecord } from "./Trace";

interface ChatPanelProps {
  apiBase: string;
}

type ReplyState =
  | { kind: "pending" }
  | { kind: "ok"; ok: AskOk }
  | { kind: "needs-confirm"; diff: AskDiff; pending: AskOk | null }
  | { kind: "error"; message: string };

type Reply = {
  id: string;
  goal: string;
  state: ReplyState;
  steps: TraceStepRecord[];
  startedAt: number;
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

function loadHistory(dbId: string): Message[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(histKey(dbId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    return parsed.map((m): Message => {
      if (m.role === "user") return m;
      const { state } = m.reply;
      if (state.kind === "pending" || state.kind === "needs-confirm") {
        return { ...m, reply: { ...m.reply, state: { kind: "error", message: "Session ended." } } };
      }
      return m;
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

export default function ChatPanel({ apiBase }: ChatPanelProps) {
  const [activeDb, setActiveDb] = useState<DatabaseSummary | null>(null);
  const [activeDbId, setActiveDbId] = useState<string | null>(() => readDbIdFromUrl());
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [composer, setComposer] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tracesOpen, setTracesOpen] = useState(false);
  const inFlightRef = useRef<AbortController | null>(null);
  const pendingDiffRef = useRef<{ replyId: string; goal: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const loadedForRef = useRef<string | null>(null);

  // Focus the composer once on mount so the user lands ready to
  // type. Imperative — `autoFocus` trips a11y rules that don't
  // know the page's whole purpose is the input below.
  useEffect(() => {
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: setMessages/setVisibleCount are stable
  useEffect(() => {
    if (!activeDbId || loadedForRef.current === activeDbId) return;
    loadedForRef.current = activeDbId;
    setMessages(loadHistory(activeDbId));
    setVisibleCount(PAGE_SIZE);
  }, [activeDbId]);

  // Persist settled messages to localStorage after each completed exchange.
  // Rows are stripped before writing (saveHistory) to cap storage usage.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — save on any message change
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

  const startSend = useCallback(
    async (goal: string, opts: { confirm?: boolean; replyId?: string } = {}) => {
      if (!activeDbId) return;
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

      try {
        const client = getChatClient(apiBase);
        const result = await client.askStream(
          { goal, dbId: activeDbId, ...(opts.confirm ? { confirm: true } : {}) },
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
        updateReply(replyId, (reply) => ({
          ...reply,
          state: { kind: "ok", ok: result },
        }));
      } catch (err) {
        if (ac.signal.aborted) return;
        updateReply(replyId, (reply) => ({
          ...reply,
          state: { kind: "error", message: messageFor(err) },
        }));
      }
    },
    [activeDbId, apiBase, updateReply],
  );

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
    if (e.key === "Enter" && pendingDiffRef.current) {
      e.preventDefault();
      approveDiff();
    }
  }

  function selectDb(db: DatabaseSummary) {
    setActiveDb(db);
    setActiveDbId(db.id);
    pendingDiffRef.current = null;
    // History loading and visibleCount reset happen in the activeDbId effect above.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("db", db.id);
      window.history.pushState(null, "", url.toString());
    }
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
          if (typeof window !== "undefined") window.location.assign("/app/new");
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
        id: "settings",
        label: "Settings",
        hint: "API keys, billing",
        run: () => {
          if (typeof window !== "undefined") window.location.assign("/app/settings");
        },
      },
      {
        id: "sign-out",
        label: "Sign out",
        run: () => {
          if (typeof window !== "undefined") window.location.assign("/auth/sign-out");
        },
      },
    ],
    [activeDb, messages],
  );

  const composerDisabled = !activeDbId;
  const visibleMessages = messages.slice(-visibleCount);
  const hasOlder = messages.length > visibleCount;

  return (
    <div className="chat-shell">
      <LeftRail
        apiBase={apiBase}
        activeDbId={activeDbId}
        onSelect={selectDb}
        onCreated={selectDb}
        onLoaded={(databases) => {
          if (!activeDbId) return;
          const match = databases.find((db) => db.id === activeDbId);
          if (match) setActiveDb(match);
        }}
      />

      <main className="chat-main">
        <header className="chat-main__header">
          <h1 className="chat-main__title">{activeDb?.slug ?? activeDbId ?? "Pick a database"}</h1>
          <span className="chat-main__hint">
            <kbd>Cmd</kbd>+<kbd>K</kbd> commands · <kbd>Cmd</kbd>+<kbd>/</kbd> trace
          </span>
        </header>

        <ol className="chat-list" aria-live="polite">
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
                  onApprove={approveDiff}
                  onCancel={cancelDiff}
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
              composerDisabled
                ? "Pick a database to start"
                : pendingDiffRef.current
                  ? "Press Enter to approve the change above…"
                  : "Ask about your data…"
            }
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={onComposerKeyDown}
            disabled={composerDisabled}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn--accent chat-composer__send"
            disabled={composerDisabled || (!pendingDiffRef.current && composer.trim().length === 0)}
          >
            {pendingDiffRef.current ? "Approve" : "Send"}
          </button>
        </form>
      </main>

      <Palette open={paletteOpen} actions={paletteActions} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function ReplyView({
  reply,
  pkLive,
  tracesOpen,
  onApprove,
  onCancel,
}: {
  reply: Reply;
  pkLive: string | null;
  tracesOpen: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const ok = reply.state.kind === "ok" ? reply.state.ok : null;
  const needsConfirm = reply.state.kind === "needs-confirm" ? reply.state.diff : null;
  const error = reply.state.kind === "error" ? reply.state.message : null;
  const pending = reply.state.kind === "pending";

  const sql = ok?.sql ?? extractSqlFromSteps(reply.steps);
  const rows = ok?.rows ?? null;
  const rowCount = ok?.rowCount ?? null;
  const summary = ok?.summary;

  return (
    <article className="chat-reply" data-state={reply.state.kind}>
      <Answer summary={summary} pending={pending} />
      <Data rows={rows} rowCount={rowCount} pending={pending} />
      {needsConfirm ? (
        <DiffChip diff={needsConfirm} onApprove={onApprove} onCancel={onCancel} />
      ) : null}
      {error ? <p className="chat-reply__error">{error}</p> : null}
      {ok && rows && rows.length > 0 ? (
        <div className="chat-reply__actions">
          <CopySnippet goal={reply.goal} pkLive={pkLive} />
        </div>
      ) : null}
      <Trace steps={reply.steps} sql={sql} explain={null} defaultOpen={tracesOpen} />
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
        detail: event.cached ? "hit" : "miss",
      }));
      mark("plan", (s) => ({
        ...s,
        status: "ok",
        latencyMs: elapsed,
        detail: event.cached ? "cached" : "fresh",
      }));
      mark("validate", (s) => ({ ...s, status: "ok", latencyMs: elapsed }));
      mark("exec", (s) => ({ ...s, status: "pending" }));
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
  // SQL surfaces via the buffered `AskOk.sql` field today; reserved
  // for a future where the trace events carry the SQL on a per-step
  // basis. Keeping the hook here so ReplyView doesn't have to know.
  return null;
}

function messageFor(err: unknown): string {
  if (err instanceof NlqdbApiError) {
    switch (err.code) {
      case "rate_limited":
        return "Slow down — try again in a moment.";
      case "unauthorized":
        return "Sign in expired — sign in again to continue.";
      case "sql_rejected":
        return "That query was rejected — try rephrasing.";
      case "db_unreachable":
      case "db_misconfigured":
        return "Couldn't reach the database — try again.";
      case "llm_failed":
        return "Couldn't generate a plan — try rephrasing.";
      case "aborted":
        return "Cancelled.";
      case "network_error":
        return "Couldn't reach the API — check your connection.";
    }
  }
  return "Something went wrong — try again.";
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
