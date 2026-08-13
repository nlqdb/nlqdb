// `notify()` — the one best-effort transactional-email dispatcher. Every
// non-blocking product email (welcome, count-me-in confirmation, first
// server-error, the founder notifies) sends through here instead of hand-
// rolling the same MOCK_IDP sink → OTel span → try/catch → idempotency block
// at each call site.
//
// Best-effort contract: `notify()` NEVER throws. A Resend outage, timeout, or
// misconfig is caught, tagged on the span, logged, and swallowed — the signal
// that triggered the email is already persisted, so a failed greeting/receipt
// must not fail the request that produced it. (The magic-link email is the
// deliberate exception: it is fail-loud and stays on its own path in auth.ts,
// because a silent magic-link failure locks the user out.)
//
// MOCK_IDP=1 (SK-AUTH-018) sinks to KV instead of Resend, exactly like the
// magic-link preview path, so `GET /api/dev/inbox` can read sent mail back.
//
// One span per send: `nlqdb.email.send`, with `nlqdb.email.kind` naming the
// template and `nlqdb.email.outcome` = sent | sinked | error. This replaces
// the per-email ad-hoc spans (`nlqdb.auth.welcome_email`, …) with one
// filterable span for the whole email surface (GLOBAL-014).

import { DEFAULT_FROM, makeEmailSender, type RenderedEmail } from "@nlqdb/email";
import { trace } from "@opentelemetry/api";
import { sinkEmail } from "./auth/mock-email-sink.ts";

// Structural subset of Cloudflare.Env — only what a send needs. Keeps the
// helper unit-testable with a plain object.
export type NotifyEnv = {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  MOCK_IDP?: string;
  KV: KVNamespace;
};

export type NotifyInput = {
  to: string;
  // Names the template on the span (`nlqdb.email.kind`). Stable, low-cardinality.
  kind: string;
  message: RenderedEmail;
  // Resend 24h dedup key (GLOBAL-005). Collapses a double-fire of the seam.
  idempotencyKey?: string;
};

// Send best-effort. Resolves regardless of outcome; callers can fire-and-
// forget (e.g. via `ctx.waitUntil`) without a try/catch of their own.
export async function notify(env: NotifyEnv, input: NotifyInput): Promise<void> {
  const tracer = trace.getTracer("@nlqdb/api");
  await tracer.startActiveSpan("nlqdb.email.send", async (span) => {
    span.setAttribute("nlqdb.email.kind", input.kind);
    try {
      if (env.MOCK_IDP === "1") {
        await sinkEmail(env.KV, input.to, input.message.subject, input.message.text);
        span.setAttribute("nlqdb.email.outcome", "sinked");
        return;
      }
      const sendEmail = makeEmailSender({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM ?? DEFAULT_FROM,
      });
      await sendEmail({
        to: input.to,
        subject: input.message.subject,
        text: input.message.text,
        ...(input.message.html ? { html: input.message.html } : {}),
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      });
      span.setAttribute("nlqdb.email.outcome", "sent");
    } catch (err) {
      // Best-effort: record + log for triage, never surface to the caller.
      span.recordException(err as Error);
      span.setAttribute("nlqdb.email.outcome", "error");
      console.error("notify email failed", {
        kind: input.kind,
        reason: err instanceof Error ? err.name : "unknown",
      });
    } finally {
      span.end();
    }
  });
}
