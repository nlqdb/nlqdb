// Cross-origin prompt/identity handoff (SK-ANON-015).
//
// The marketing worker (`nlqdb.com`) and the merged app worker
// (`app.nlqdb.com`, SK-AUTH-016) share one Astro build but are
// different browser origins — localStorage does NOT cross. Without a
// handoff, `nlqdb_pending` / `nlqdb_draft` / `nlqdb_anon` written on
// the hero die at the sign-in redirect and the SK-ANON-011 "never
// lose a prompt" promise breaks exactly on the auth arc it exists for.
//
// The carrier is the URL *fragment* (`#nlq=<payload>`): fragments are
// never sent in HTTP requests, so the prompt and the anon bearer stay
// out of server logs, analytics, and Referer headers — the reasons
// SK-ANON-011 bans query-string transport. The receiving page imports
// the payload into its own localStorage and strips the fragment
// before anything else runs.

import { loadDraft, type PendingPrompt, saveDraft, savePending } from "./prompt-storage";

const FRAGMENT_PREFIX = "#nlq=";
const ANON_KEY = "nlqdb_anon";
// When the handoff carries a different anon token than the one already
// on this origin, the local one is parked here so sign-in can adopt
// BOTH devices' DBs (SK-ANON-005 spirit: adoption keeps all work).
export const ANON_PREV_KEY = "nlqdb_anon_prev";

export interface HandoffPayload {
  v: 1;
  anon?: string;
  pending?: PendingPrompt;
  draft?: string;
}

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function serializeHandoff(payload: HandoffPayload): string {
  return FRAGMENT_PREFIX + encodeURIComponent(JSON.stringify(payload));
}

export function parseHandoff(hash: string): HandoffPayload | null {
  if (!hash.startsWith(FRAGMENT_PREFIX)) return null;
  try {
    const raw = decodeURIComponent(hash.slice(FRAGMENT_PREFIX.length));
    const parsed = JSON.parse(raw) as HandoffPayload;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Snapshot this origin's prompt + identity state. Null when there is
// nothing worth carrying (no anon token, no pending, no draft).
export function buildHandoffPayload(): HandoffPayload | null {
  const ls = safeStorage();
  if (!ls) return null;
  const payload: HandoffPayload = { v: 1 };
  const anon = ls.getItem(ANON_KEY) ?? "";
  if (anon.startsWith("anon_")) payload.anon = anon;
  const rawPending = ls.getItem("nlqdb_pending");
  if (rawPending) {
    try {
      const pending = JSON.parse(rawPending) as PendingPrompt;
      if (typeof pending.goal === "string" && pending.goal.length > 0) payload.pending = pending;
    } catch {
      // corrupt slot — drop it from the handoff rather than fail the redirect
    }
  }
  const draft = loadDraft();
  if (draft) payload.draft = draft;
  if (!payload.anon && !payload.pending && !payload.draft) return null;
  return payload;
}

// Append the handoff fragment to a navigation target. A no-op when
// there is no state to carry. Same-origin targets are harmless — the
// import just rewrites identical values.
export function attachHandoff(url: string): string {
  const payload = buildHandoffPayload();
  if (!payload) return url;
  const base = url.split("#")[0] ?? url;
  return base + serializeHandoff(payload);
}

// Import a handoff fragment into this origin's localStorage, then
// strip it from the address bar. Must run before any code that reads
// `nlqdb_anon` or `nlqdb_pending` (adoption, session short-circuits).
export function importHandoffFromLocation(): void {
  if (typeof window === "undefined") return;
  const payload = parseHandoff(window.location.hash);
  if (!payload) return;
  const ls = safeStorage();
  if (ls) {
    if (payload.pending?.goal) savePending(payload.pending);
    if (payload.draft) saveDraft(payload.draft);
    if (payload.anon?.startsWith("anon_")) {
      const existing = ls.getItem(ANON_KEY) ?? "";
      if (existing.startsWith("anon_") && existing !== payload.anon) {
        ls.setItem(ANON_PREV_KEY, existing);
      }
      ls.setItem(ANON_KEY, payload.anon);
    }
  }
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url.toString());
}
