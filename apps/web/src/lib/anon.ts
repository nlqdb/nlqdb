// Anonymous-mode token storage for the web (SK-ANON-001).
//
// On first call the helper mints `anon_<uuid>` and writes it to
// `localStorage["nlqdb_anon"]`; subsequent calls reuse the same value.
// The API treats the resulting `Authorization: Bearer anon_…` as a
// per-device anonymous identity, later adopted into a real user via
// `POST /v1/anon/adopt` on sign-in (SK-ANON-003).
//
// Every surface that talks to `/v1/ask` reads this token — the
// marketing hero, `/app/new`, and any first-party `<nlq-data>`
// embed — since SK-WEB-008 unified them on the real-LLM flow. The
// companion prompt-persistence slots (`nlqdb_draft`, `nlqdb_pending`,
// `nlqdb_history`, per SK-ANON-011) live in `lib/prompt-storage.ts`
// under the same localStorage primitive.

const STORAGE_KEY = "nlqdb_anon";
const PREFIX = "anon_";

// Privacy-mode fallback (SK-ANON-011). Some contexts throw on *any*
// localStorage touch (Chrome "block all cookies", Firefox DOM storage
// disabled, sandboxed iframes) or on write (over quota). Its companion
// slots in `lib/prompt-storage.ts` already "fall back to in-memory state
// without throwing" per SK-ANON-011; the token slot must too — every
// `/v1/ask` call needs a *stable* handle for the current session, so a
// blocked read/write can't be allowed to throw and kill the create path
// with a misleading "Couldn't reach the API" (the API is reachable —
// storage isn't). The in-memory token can't survive a reload, which is no
// worse than the clear-on-reload orphan documented below, and strictly
// better than the create path dying.
let memoryToken: string | null = null;

export function getOrMintAnonToken(): string {
  // SSR / pre-hydration guard. Astro statically renders pages on the
  // server where `window` is undefined; callers that hit this path
  // should defer to a `useEffect` or `client:only` island.
  if (typeof window === "undefined") {
    throw new Error("getOrMintAnonToken must run in the browser");
  }

  // This token is the *only* handle to the anonymous DB; there is no
  // server-side recovery. Clearing localStorage before signing in mints a
  // fresh token and orphans the old DB — adopting on sign-in is the only
  // durable rescue. By design (privacy + simplicity); don't add a recovery
  // path without a decision.
  const existing = readStored();
  if (existing?.startsWith(PREFIX)) {
    return existing;
  }
  if (memoryToken) return memoryToken;

  const token = `${PREFIX}${window.crypto.randomUUID()}`;
  if (!persist(token)) {
    memoryToken = token;
  }
  return token;
}

// localStorage access itself throws in some privacy modes — treat as
// unavailable rather than letting the throw kill the create path.
function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Returns false when the value couldn't be persisted (storage blocked or
// over quota); the caller keeps the token in memory instead.
function persist(token: string): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
    return true;
  } catch {
    return false;
  }
}
