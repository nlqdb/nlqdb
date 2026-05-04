// Prompt persistence — never lose a user's input (SK-ANON-011).
//
// Three buckets in localStorage, all per-device:
//
//   nlqdb_draft    — what the user is typing right now, pre-submit.
//                    Saved on every keystroke (debounced) so a tab
//                    crash, a refresh, or an OAuth round-trip doesn't
//                    lose the goal. Restored into the input on mount.
//
//   nlqdb_pending  — a submitted prompt that hit `auth_required` (or
//                    any redirect-style failure). The surface stashes
//                    it here, redirects to /sign-in, and the post-
//                    OAuth landing page replays it against `/v1/ask`
//                    with the now-authed cookie session. Cleared on
//                    successful replay.
//
//   nlqdb_history  — completed prompts + their outcomes (last N).
//                    Useful for "what did I just ask?" recall and as
//                    the seed for the chat-message migration when
//                    /v1/anon/adopt runs (Phase 1 exit gate).
//
// Per SK-ANON-011 the same guarantees apply to authed users —
// localStorage is the durable store regardless of auth shape. Server-
// side mirroring (cross-device prompt history) is a Phase 2+ concern.

const DRAFT_KEY = "nlqdb_draft";
const PENDING_KEY = "nlqdb_pending";
const HISTORY_KEY = "nlqdb_history";

const HISTORY_MAX_ENTRIES = 50;

export interface PendingPrompt {
  goal: string;
  /** ISO 8601 timestamp of the original submit attempt. */
  submittedAt: string;
  /** Where the user was when the redirect happened — used to land back. */
  origin: string;
}

export interface HistoryEntry {
  goal: string;
  submittedAt: string;
  status: "ok" | "error";
  /** dbId on success, error code on failure, undefined for in-flight. */
  outcome?: string;
}

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    // Some privacy modes throw on access; treat as unavailable.
    return window.localStorage;
  } catch {
    return null;
  }
}

// ─── Drafts ───────────────────────────────────────────────────────────

export function saveDraft(goal: string): void {
  const ls = safeStorage();
  if (!ls) return;
  if (goal.length === 0) {
    ls.removeItem(DRAFT_KEY);
    return;
  }
  ls.setItem(DRAFT_KEY, goal);
}

export function loadDraft(): string {
  const ls = safeStorage();
  if (!ls) return "";
  return ls.getItem(DRAFT_KEY) ?? "";
}

export function clearDraft(): void {
  const ls = safeStorage();
  if (!ls) return;
  ls.removeItem(DRAFT_KEY);
}

// Debounced save — wire to the input's onChange. The interval is
// short (250ms) because losing the last few keystrokes on a crash is
// worse than the trivial localStorage cost of frequent writes.
export function makeDraftSaver(intervalMs = 250): (goal: string) => void {
  let pending: ReturnType<typeof setTimeout> | null = null;
  let lastValue = "";
  return (goal: string) => {
    lastValue = goal;
    if (pending !== null) return;
    pending = setTimeout(() => {
      saveDraft(lastValue);
      pending = null;
    }, intervalMs);
  };
}

// ─── Pending (auth-redirect replay) ───────────────────────────────────

export function savePending(prompt: PendingPrompt): void {
  const ls = safeStorage();
  if (!ls) return;
  ls.setItem(PENDING_KEY, JSON.stringify(prompt));
}

export function loadPending(): PendingPrompt | null {
  const ls = safeStorage();
  if (!ls) return null;
  const raw = ls.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingPrompt;
    if (typeof parsed.goal !== "string" || parsed.goal.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPending(): void {
  const ls = safeStorage();
  if (!ls) return;
  ls.removeItem(PENDING_KEY);
}

// ─── History ──────────────────────────────────────────────────────────

export function appendHistory(entry: HistoryEntry): void {
  const ls = safeStorage();
  if (!ls) return;
  const current = loadHistory();
  current.unshift(entry);
  // Cap at HISTORY_MAX_ENTRIES, oldest evicted. localStorage is ~5 MB
  // total per origin; 50 entries × few-hundred-bytes is well under.
  while (current.length > HISTORY_MAX_ENTRIES) current.pop();
  ls.setItem(HISTORY_KEY, JSON.stringify(current));
}

export function loadHistory(): HistoryEntry[] {
  const ls = safeStorage();
  if (!ls) return [];
  const raw = ls.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}
