// First-server-error recovery email (SK-ASK-027). The first time a signed-in
// user hits a 5xx on POST /v1/ask, send one honest "that one's on us" note so
// a first failure doesn't read as silent abandonment. Fires once per account,
// ever — the `first_error_notified` table (not Resend's 24h dedup) is the
// source of truth, mirroring the premium-interest / pmf-survey dispatch-after-
// insert pattern (SK-IDEMP-005/006).
//
// Deliberately narrow (see the feature decision): server errors only (5xx —
// our fault), signed-in users only (the only principals with an email on
// file), best-effort (notify() swallows send failures). Client errors (4xx —
// rate-limits, bad input) never trigger it; anonymous users can't.

import { serverErrorEmail } from "@nlqdb/email";
import { type NotifyEnv, notify } from "./email-notify.ts";

export type FirstErrorDeps = {
  db: D1Database;
  env: NotifyEnv;
  // The `/app` URL the recovery email's "Try again" button links to.
  appUrl: string;
};

// Record the first server error for `userId` and, if it's the first, send the
// recovery email. Best-effort and safe to fire-and-forget (waitUntil): the
// dedup insert commits before the send, so a send failure can't re-arm the
// email on the next error. Never throws.
export async function notifyFirstServerError(
  deps: FirstErrorDeps,
  userId: string,
  email: string,
): Promise<void> {
  try {
    const row = await deps.db
      .prepare(
        "INSERT INTO first_error_notified (user_id) VALUES (?) " +
          "ON CONFLICT(user_id) DO NOTHING RETURNING 1 AS ok",
      )
      .bind(userId)
      .first<{ ok: number }>();
    if (row === null) return; // already emailed once — nothing to do
    await notify(deps.env, {
      to: email,
      kind: "server_error",
      message: serverErrorEmail(deps.appUrl),
      idempotencyKey: `first-error:${userId}`,
    });
  } catch (err) {
    // Best-effort: a D1 blip on the dedup insert must never surface into the
    // ask response (which already carries its own error to the user).
    console.error("first-error email failed", {
      reason: err instanceof Error ? err.name : "unknown",
    });
  }
}
