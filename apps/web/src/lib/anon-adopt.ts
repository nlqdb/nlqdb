// Client-side anon-adoption fallback (SK-ANON-012 / SK-ANON-014 /
// SK-ANON-015). Shared by `sign-in.astro` (already-signed-in
// short-circuit) and `post-signin.astro` (defense-in-depth retry).
//
// Adopts every anon token this origin knows about: the active
// `nlqdb_anon` plus `nlqdb_anon_prev` — the token a cross-origin
// handoff displaced (SK-ANON-015) — so neither device identity's DBs
// are orphaned. Each POST is idempotent server-side (SK-ANON-003).
// Best-effort by design: the caller's redirect must never block on it.

import { ANON_PREV_KEY } from "./handoff";

const ANON_KEY = "nlqdb_anon";
const TIMEOUT_MS = 3000;

function readToken(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key) ?? "";
    return v.startsWith("anon_") ? v : null;
  } catch {
    return null;
  }
}

async function adoptOne(
  apiBase: string,
  anon: string,
): Promise<{ ok: boolean; dbId: string | null }> {
  // Bounded so a hung API never strands the user on a loading page.
  // 3 s matches the typical p99 budget for a D1 single-row update.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase}/api/auth/anon-adopt-now`, {
      method: "POST",
      credentials: "include",
      headers: { "x-anon-bearer": anon },
      signal: ac.signal,
    });
    if (!res.ok) return { ok: false, dbId: null };
    const body = (await res.json().catch(() => null)) as { dbId?: unknown } | null;
    return { ok: true, dbId: body && typeof body.dbId === "string" ? body.dbId : null };
  } catch {
    return { ok: false, dbId: null };
  } finally {
    clearTimeout(timer);
  }
}

// Returns the adopted dbId of the active token (falling back to the
// displaced one) so post-signin can pin it via `?db=<id>` (SK-ANON-014).
export async function adoptAnonNow(apiBase: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const current = readToken(ANON_KEY);
  const prev = readToken(ANON_PREV_KEY);
  let prevDbId: string | null = null;
  if (prev && prev !== current) {
    const res = await adoptOne(apiBase, prev);
    prevDbId = res.dbId;
    if (res.ok) {
      try {
        window.localStorage.removeItem(ANON_PREV_KEY);
      } catch {
        // storage unavailable — the retry stays idempotent
      }
    }
  }
  if (!current) return prevDbId;
  const res = await adoptOne(apiBase, current);
  return res.dbId ?? prevDbId;
}
