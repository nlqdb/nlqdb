// Waitlist endpoint. Pure function; deps injected so unit tests can
// stub D1 + KV without spinning Miniflare.
//
// Behavior contract:
//   • returns 200 for any well-formed email — never reveals whether
//     the address is already on the list (privacy)
//   • per-IP throttle (5/min) defends the public endpoint without
//     a Better Auth session
//   • email stored alongside its SHA-256 hash; PK is the hash so
//     case-folded duplicates collapse atomically via ON CONFLICT
//   • emits a `user.waitlist_joined` product event on the first
//     insert. The route handler runs the emit through `ctx.waitUntil`
//     so the response isn't blocked on queue latency — `pendingEmit`
//     is the deferred promise the handler hands to the runtime.

import type { EventEmitter, ProductEvent } from "@nlqdb/events";
import { makeKvThrottle } from "./lib/kv-throttle.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const RATE_WINDOW_SECONDS = 60;
const RATE_MAX = 5;

export type WaitlistDeps = {
  db: D1Database;
  kv: KVNamespace;
  events: EventEmitter;
};

export type WaitlistResult =
  | {
      status: 200;
      body: { received: true };
      // Caller schedules via `ctx.waitUntil` so the 200 ships before
      // the queue producer resolves. Undefined on duplicate.
      pendingEmit?: Promise<unknown>;
    }
  | { status: 400; body: { error: { status: "invalid_email" } } }
  | { status: 429; body: { error: { status: "rate_limited" } } }
  | { status: 500; body: { error: { status: "internal" } } };

const throttleCache = new WeakMap<KVNamespace, ReturnType<typeof makeKvThrottle>>();
function getThrottle(kv: KVNamespace) {
  let t = throttleCache.get(kv);
  if (!t) {
    t = makeKvThrottle(kv, {
      prefix: "wl:rate:",
      max: RATE_MAX,
      windowSeconds: RATE_WINDOW_SECONDS,
    });
    throttleCache.set(kv, t);
  }
  return t;
}

export async function joinWaitlist(
  deps: WaitlistDeps,
  email: unknown,
  clientIp: string | null,
  source: string | null = null,
): Promise<WaitlistResult> {
  if (typeof email !== "string") {
    return { status: 400, body: { error: { status: "invalid_email" } } };
  }
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LEN || !EMAIL_PATTERN.test(trimmed)) {
    return { status: 400, body: { error: { status: "invalid_email" } } };
  }
  const normalized = trimmed.toLowerCase();

  // `clientIp === null` means the request reached us without a
  // `cf-connecting-ip` header. In production behind Cloudflare that
  // never happens (the edge sets it on every forwarded request), so
  // a null IP is either local dev / vitest or a routing change that
  // started stripping the header. We bucket all null-IP requests
  // under the literal string "unknown", which collapses every
  // anonymous hit into a single 5/min lane — degrades gracefully in
  // dev, and (more importantly) flags unambiguously in operator logs
  // if production ever starts hitting that bucket.
  if (!clientIp) {
    console.warn("waitlist: missing cf-connecting-ip; falling back to shared 'unknown' bucket");
  }
  const throttle = getThrottle(deps.kv);
  // Missing `cf-connecting-ip` (curl, non-CF preview) collapses every
  // such caller into the shared `unknown` bucket — intentional. The
  // 5/min cap then becomes a global ceiling on un-attributed traffic,
  // which is the conservative posture: rather than open-fail, abuse
  // from non-CF origins shares one rate budget across the planet.
  const allowed = await throttle.tryConsume(clientIp ?? "unknown");
  if (!allowed) return { status: 429, body: { error: { status: "rate_limited" } } };

  const hash = await sha256Hex(normalized);

  let inserted: { ok: number } | null;
  try {
    inserted = await deps.db
      .prepare(
        "INSERT INTO waitlist (email_hash, email, source) VALUES (?, ?, ?) " +
          "ON CONFLICT(email_hash) DO NOTHING RETURNING 1 AS ok",
      )
      .bind(hash, normalized, source)
      .first<{ ok: number }>();
  } catch {
    return { status: 500, body: { error: { status: "internal" } } };
  }

  // First insert → schedule emit (caller wraps in ctx.waitUntil so the
  // 200 ships before the queue resolves). Duplicate (`inserted === null`)
  // is silent — same UX as a fresh signup, no list-membership leak.
  if (!inserted) return { status: 200, body: { received: true } };

  const event: ProductEvent = {
    name: "user.waitlist_joined",
    emailHash: hash,
    source: source ?? "web",
  };
  // Default envelope id is `${name}.${emailHash}` for this event
  // (packages/events/src/index.ts:85-86) — same string we'd pass
  // explicitly. Let the producer SDK derive it.
  const pendingEmit = deps.events.emit(event);
  return { status: 200, body: { received: true }, pendingEmit };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
