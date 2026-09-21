import { makeKvThrottle } from "./lib/kv-throttle.ts";
import { sha256Hex } from "./principal.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const SOURCES = new Set(["home", "app"]);

export type PivotInterestResult =
  | { status: 200 }
  | { status: 400; reason: "invalid_email" | "invalid_source" }
  | { status: 429 };

export async function recordPivotInterest(
  db: D1Database,
  kv: KVNamespace,
  input: { email: unknown; source: unknown; userId: string | null; clientIp: string | null },
): Promise<PivotInterestResult> {
  if (typeof input.email !== "string") return { status: 400, reason: "invalid_email" };
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH) {
    return { status: 400, reason: "invalid_email" };
  }
  if (typeof input.source !== "string" || !SOURCES.has(input.source)) {
    return { status: 400, reason: "invalid_source" };
  }

  const throttle = makeKvThrottle(kv, {
    prefix: "pivot-interest:rate:",
    max: 5,
    windowSeconds: 60,
  });
  if (!(await throttle.tryConsume(input.clientIp ?? "unknown"))) return { status: 429 };

  const emailHash = await sha256Hex(email, 64);
  await db
    .prepare(
      `INSERT INTO pivot_interest (email_hash, email, user_id, source)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email_hash) DO UPDATE SET
         user_id = COALESCE(pivot_interest.user_id, excluded.user_id)`,
    )
    .bind(emailHash, email, input.userId, input.source)
    .run();

  return { status: 200 };
}
