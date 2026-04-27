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
//     insert (fire-and-forget; never blocks the response)

import type { EventEmitter } from "@nlqdb/events";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const RATE_KEY_PREFIX = "wl:rate:";
const RATE_WINDOW_SECONDS = 60;
const RATE_MAX = 5;

export type WaitlistDeps = {
  db: D1Database;
  kv: KVNamespace;
  events: EventEmitter;
  // Per-request `Date.now()` injected for deterministic tests.
  now?: () => number;
};

export type WaitlistResult =
  | { status: 200; body: { received: true } }
  | { status: 400; body: { error: "invalid_email" } }
  | { status: 429; body: { error: "rate_limited" } }
  | { status: 500; body: { error: "internal" } };

export async function joinWaitlist(
  deps: WaitlistDeps,
  email: unknown,
  clientIp: string | null,
  source: string | null = null,
): Promise<WaitlistResult> {
  if (typeof email !== "string") return { status: 400, body: { error: "invalid_email" } };
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LEN || !EMAIL_PATTERN.test(trimmed)) {
    return { status: 400, body: { error: "invalid_email" } };
  }
  const normalized = trimmed.toLowerCase();

  // Per-IP throttle. Unknown IP (CF-Connecting-IP missing) collapses
  // to a single bucket — paranoid but bounded.
  const ipKey = `${RATE_KEY_PREFIX}${clientIp ?? "unknown"}`;
  const raw = await deps.kv.get(ipKey);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  if (count >= RATE_MAX) return { status: 429, body: { error: "rate_limited" } };
  await deps.kv.put(ipKey, String(count + 1), { expirationTtl: RATE_WINDOW_SECONDS });

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
    return { status: 500, body: { error: "internal" } };
  }

  // First insert → emit. Duplicate (`inserted === null`) is silent.
  if (inserted) {
    await deps.events.emit(
      { name: "user.waitlist_joined", emailHash: hash, source: source ?? "web" },
      { id: `user.waitlist_joined.${hash}` },
    );
  }

  return { status: 200, body: { received: true } };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
