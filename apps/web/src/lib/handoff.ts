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
//
// The fragment is attacker-writable (anyone can mail a `#nlq=` link),
// so the import is gated twice: the payload must be shape-valid
// (string fields, length caps, the `anon_` token format we mint), and
// the navigation must come from a trusted referrer. Without the gate
// a crafted link could fixate an attacker-known anon token into the
// victim's account at sign-in (login-CSRF-style) — adoption would
// attach the attacker's DB, pin it via `?db=`, and the token holder
// would know exactly which DB the victim types into next.

import { emit } from "./logsnag";
import { loadDraft, type PendingPrompt, saveDraft, savePending } from "./prompt-storage";

const FRAGMENT_PREFIX = "#nlq=";
const ANON_KEY = "nlqdb_anon";
// When the handoff carries a different anon token than the one already
// on this origin, the local one is parked here so sign-in can adopt
// BOTH devices' DBs (SK-ANON-005 spirit: adoption keeps all work).
export const ANON_PREV_KEY = "nlqdb_anon_prev";

// The web mint is `anon_<uuid>` (`lib/anon.ts`); allow the charset a
// little slack but pin prefix + length so a crafted fragment can't
// smuggle arbitrary strings into the bearer slot.
const ANON_TOKEN_RE = /^anon_[A-Za-z0-9-]{16,128}$/;
const MAX_TEXT = 4096;

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

function asText(v: unknown, max: number): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
}

// Parse + validate a `#nlq=` fragment. Field-wise: an invalid field is
// dropped, not fatal, so a valid prompt still survives a mangled token
// (and vice versa). Returns null when nothing valid remains.
export function parseHandoff(hash: string): HandoffPayload | null {
  if (!hash.startsWith(FRAGMENT_PREFIX)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(decodeURIComponent(hash.slice(FRAGMENT_PREFIX.length)));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const input = raw as Record<string, unknown>;
  if (input["v"] !== 1) return null;
  const payload: HandoffPayload = { v: 1 };
  const anon = asText(input["anon"], 133);
  if (anon && ANON_TOKEN_RE.test(anon)) payload.anon = anon;
  const pending =
    typeof input["pending"] === "object" && input["pending"] !== null
      ? (input["pending"] as Record<string, unknown>)
      : null;
  const goal = pending ? asText(pending["goal"], MAX_TEXT) : null;
  if (pending && goal) {
    const origin = asText(pending["origin"], 2048);
    payload.pending = {
      goal,
      submittedAt: asText(pending["submittedAt"], 64) ?? "",
      // `origin` is a same-origin landing path, never a full URL.
      origin: origin?.startsWith("/") ? origin : "/",
    };
  }
  const draft = asText(input["draft"], MAX_TEXT);
  if (draft) payload.draft = draft;
  if (!payload.anon && !payload.pending && !payload.draft) return null;
  return payload;
}

// Snapshot this origin's prompt + identity state. Null when there is
// nothing worth carrying (no anon token, no pending, no draft).
export function buildHandoffPayload(): HandoffPayload | null {
  const ls = safeStorage();
  if (!ls) return null;
  const payload: HandoffPayload = { v: 1 };
  const anon = ls.getItem(ANON_KEY) ?? "";
  if (ANON_TOKEN_RE.test(anon)) payload.anon = anon;
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

// The handoff is honored only when the navigation demonstrably came
// from our own surfaces: same origin, a `nlqdb.com` host, or localhost
// dev. `Base.astro` pins `strict-origin-when-cross-origin`, so every
// legit hop carries at least its origin, and a referrer can't be
// forged upward — an attacker can only send their own origin or none.
// A stripped referrer (privacy extension) drops the payload; the
// SK-ANON-012 "couldn't recover your message" notice covers that rare
// legit loss.
function trustedReferrer(): boolean {
  const ref = typeof document === "undefined" ? "" : document.referrer;
  if (!ref) return false;
  try {
    const from = new URL(ref);
    if (from.origin === new URL(window.location.href).origin) return true;
    if (from.hostname === "localhost" || from.hostname === "127.0.0.1") return true;
    return from.hostname === "nlqdb.com" || from.hostname.endsWith(".nlqdb.com");
  } catch {
    return false;
  }
}

// Import a handoff fragment into this origin's localStorage, then
// strip it from the address bar. Must run before any code that reads
// `nlqdb_anon` or `nlqdb_pending` (adoption, session short-circuits).
// The fragment is stripped even when the payload is rejected, so the
// bearer never lingers in the address bar or the history entry.
export function importHandoffFromLocation(): void {
  if (typeof window === "undefined") return;
  if (!window.location.hash.startsWith(FRAGMENT_PREFIX)) return;
  const payload = trustedReferrer() ? parseHandoff(window.location.hash) : null;
  // One funnel event per rejected arrival — crafted links and
  // referrer-stripped legit hops are otherwise invisible.
  if (!payload) emit("handoff.rejected");
  const ls = payload ? safeStorage() : null;
  if (payload && ls) {
    if (payload.pending) savePending(payload.pending);
    if (payload.draft) saveDraft(payload.draft);
    if (payload.anon) {
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
