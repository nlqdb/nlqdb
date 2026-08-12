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

import {
  type FirstTouch,
  importFirstTouch,
  loadFirstTouch,
  sanitizeFirstTouch,
} from "./attribution";
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
// One cap for prompt text, enforced on BOTH sides of the hop by the single
// `normalize` below. A receiver-only cap silently dropped any >4096-char
// prompt and landed the visitor on an empty input — the exact loss
// SK-ANON-011 forbids.
const MAX_TEXT = 4096;

export interface HandoffPayload {
  v: 1;
  anon?: string;
  pending?: PendingPrompt;
  draft?: string;
  // SK-GTM-007 / SK-ANON-015 — the marketing-origin first touch, so a DB
  // minted on the app origin (signed-in chat create) is attributed to the
  // channel that actually brought the visitor, not the post-OAuth referrer.
  // Non-credential (unlike `anon`): a crafted value can only mis-attribute
  // the victim's own signup in our analytics, never fixate identity.
  src?: FirstTouch;
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

// The single place the payload shape and the `MAX_TEXT` cap are decided, so
// the sender (`buildHandoffPayload`) and the receiver (`parseHandoff`) can
// never drift apart. Field-wise: an invalid field is dropped, not fatal, so a
// valid prompt still survives a mangled token (and vice versa). Prompt text is
// never dropped for length (SK-ANON-011) — an oversize `draft` is truncated,
// and an oversize `pending` is demoted to `draft` so a truncated goal never
// occupies the queued-submission slot; it lands in the composer for review.
// Returns null when nothing valid remains.
function normalize(input: Record<string, unknown>): HandoffPayload | null {
  const payload: HandoffPayload = { v: 1 };
  const anon = asText(input["anon"], 133);
  if (anon && ANON_TOKEN_RE.test(anon)) payload.anon = anon;
  const pending =
    typeof input["pending"] === "object" && input["pending"] !== null
      ? (input["pending"] as Record<string, unknown>)
      : null;
  const goal = pending && typeof pending["goal"] === "string" ? pending["goal"] : "";
  if (pending && goal.length > 0 && goal.length <= MAX_TEXT) {
    payload.pending = { goal, submittedAt: asText(pending["submittedAt"], 64) ?? "" };
  }
  const draft = typeof input["draft"] === "string" ? input["draft"] : "";
  const text = (draft || (goal.length > MAX_TEXT ? goal : "")).slice(0, MAX_TEXT);
  if (text) payload.draft = text;
  const src = sanitizeFirstTouch(input["src"]);
  if (src) payload.src = src;
  if (!payload.anon && !payload.pending && !payload.draft && !payload.src) return null;
  return payload;
}

// Parse + validate a `#nlq=` fragment.
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
  return normalize(input);
}

// Snapshot this origin's prompt + identity state. Null when there is
// nothing worth carrying (no anon token, no pending, no draft).
export function buildHandoffPayload(): HandoffPayload | null {
  const ls = safeStorage();
  if (!ls) return null;
  let pending: unknown = null;
  try {
    pending = JSON.parse(ls.getItem("nlqdb_pending") ?? "null");
  } catch {
    // corrupt slot — drop it from the handoff rather than fail the redirect
  }
  return normalize({
    anon: ls.getItem(ANON_KEY),
    pending,
    draft: loadDraft(),
    src: loadFirstTouch() ?? undefined,
  });
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

// The only hosts that legitimately originate a handoff: the two marketing
// hosts the `nlqdb-web` worker serves (`web/src/worker.ts` MARKETING_HOSTS)
// and the merged app host (`api/wrangler.toml`). An explicit set, NOT a
// `*.nlqdb.com` suffix match: a wildcard hands the same trust to every
// present and future subdomain, so one dangling or taken-over host
// (`docs.`, `mcp.`, a stale CNAME) could fixate an attacker-known anon
// bearer on a victim at sign-in. `docs.`/`mcp.` hold no prompt state and
// never call `attachHandoff`, so nothing legitimate is lost, and a new
// subdomain fails closed — the correct default for a credential-bearing hop.
// Previews and `*.workers.dev` need no entry: there `/app/*` is served by the
// same worker as the marketing pages, so the hop is same-origin.
const TRUSTED_HANDOFF_HOSTS = new Set(["nlqdb.com", "www.nlqdb.com", "app.nlqdb.com"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

// The handoff is honored only when the navigation demonstrably came from our
// own surfaces. `Base.astro` pins `strict-origin-when-cross-origin`, so every
// legit hop carries at least its origin, and a referrer can't be forged upward
// — an attacker can only send their own origin or none. A stripped referrer
// (privacy extension) drops the payload; the SK-ANON-012 "couldn't recover
// your message" notice covers that rare legit loss.
function trustedReferrer(): boolean {
  const ref = typeof document === "undefined" ? "" : document.referrer;
  if (!ref) return false;
  try {
    const here = new URL(window.location.href);
    const from = new URL(ref);
    if (from.origin === here.origin) return true;
    // Two-origin local dev (`astro dev` on :4321 → `wrangler dev` on :8787)
    // needs a cross-port hop. Gated on *this* page also being local — a host
    // check, not a build flag, because the app origin in that flow serves the
    // production `dist/` bundle. In production `here.hostname` is
    // `app.nlqdb.com`, so no local process can hand us a bearer.
    if (LOCAL_HOSTS.has(here.hostname)) return LOCAL_HOSTS.has(from.hostname);
    // Production hops are https-only, so a plaintext referrer means either a
    // downgrade or a spoofable hop — never a real one.
    return from.protocol === "https:" && TRUSTED_HANDOFF_HOSTS.has(from.hostname);
  } catch {
    return false;
  }
}

// Import a handoff fragment into this origin's localStorage. Must run before
// any code that reads `nlqdb_anon` or `nlqdb_pending` (adoption, session
// short-circuits). The fragment is stripped first and unconditionally — before
// the writes, and whether or not the payload was accepted — so the bearer
// leaves the address bar and the history entry at the earliest possible moment,
// and a `setItem` that throws (quota) can never leave it behind.
export function importHandoffFromLocation(): void {
  if (typeof window === "undefined") return;
  if (!window.location.hash.startsWith(FRAGMENT_PREFIX)) return;
  const payload = trustedReferrer() ? parseHandoff(window.location.hash) : null;
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url.toString());
  // One funnel event per rejected arrival — crafted links and
  // referrer-stripped legit hops are otherwise invisible.
  if (!payload) {
    emit("handoff.rejected");
    return;
  }
  const ls = safeStorage();
  if (!ls) return;
  // `safeStorage()` only proves the object is reachable — `setItem` still
  // throws on a full quota or in Safari private mode. Swallow it: this runs at
  // the top of `app/new.astro`'s script, so an escaping throw would skip
  // `getOrMintAnonToken()` and leave the page with no identity at all.
  // The token goes first: it is the smallest value and the only unrecoverable
  // one (losing it orphans the DB the visitor already created), so a quota that
  // trips partway through must not spend its last bytes on a 4 KB prompt.
  try {
    if (payload.anon) {
      const existing = ls.getItem(ANON_KEY) ?? "";
      if (existing.startsWith("anon_") && existing !== payload.anon) {
        ls.setItem(ANON_PREV_KEY, existing);
      }
      ls.setItem(ANON_KEY, payload.anon);
    }
    if (payload.pending) savePending(payload.pending);
    if (payload.draft) saveDraft(payload.draft);
    // Attribution last: it is the only slot the visitor never loses work
    // over, so a quota that trips partway must not spend its last bytes
    // here instead of on the token or prompt above.
    if (payload.src) importFirstTouch(payload.src);
  } catch {
    // Same funnel meaning as above: an arrival whose payload didn't land.
    emit("handoff.rejected");
  }
}
