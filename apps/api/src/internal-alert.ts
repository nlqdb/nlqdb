// `alertRnd()` — best-effort internal error alert to the R&D inbox
// (SK-OBS-012). On an unexpected server error (the central `app.onError`
// 500) or client crash (the `/v1/errors/web` sink), email `rnd@nlqdb.com` a
// dense, redacted context dump for triage. Rides the shared `notify()` rail
// + `internalErrorAlertEmail` template.
//
// Two hard constraints shape this:
//
// 1. **Shared Resend quota (runbook §Resend: free tier, 3,000/month).** The
//    same pool magic-link sign-in draws from. An unbounded "email on every
//    error" would let an error storm drain the quota and break sign-in — a
//    fail-loud user-facing outage. So every alert passes a KV throttle:
//    per-signature dedup (one alert per unique error per `DEDUP_COOLDOWN`)
//    plus a hard `DAILY_CAP` backstop against a storm of *distinct* errors.
//    OTel + `wrangler tail` remain the complete record; email is only the
//    heads-up, so a capped day loses nothing but redundant pings.
//
// 2. **PII invariant (SK-WEB-001).** Error messages / stacks / URLs routinely
//    carry emails, tokens, API keys. Callers redact every field through
//    `redactPii` before handing it here, exactly as the `/v1/errors/web` span
//    attributes already do — the alert must not become a raw-PII side channel
//    through a third party (Resend) into an inbox.
//
// Never throws: a throttle-KV blip or send failure must not turn the error
// handler that called it into a second error.

import { internalErrorAlertEmail } from "@nlqdb/email";
import { type NotifyEnv, notify } from "./email-notify.ts";

const RND_EMAIL = "rnd@nlqdb.com";
// One alert per unique error signature per hour — a persistent bug pings once,
// not once per occurrence.
const DEDUP_COOLDOWN_SECONDS = 60 * 60;
// Hard ceiling on alert emails per UTC day, across all signatures. Backstop
// against a distinct-error storm draining the shared 3k/mo Resend quota;
// 20/day leaves the bulk of the pool for transactional (sign-in) mail.
const DAILY_CAP = 20;
const CAP_KEY_TTL_SECONDS = 60 * 60 * 26; // just over a day, so the counter self-expires

export type AlertEnv = NotifyEnv & { KV: KVNamespace };

export type AlertInput = {
  kind: "server" | "client";
  // Short one-line signature shown in the subject (already redacted + capped).
  summary: string;
  // Redacted key/value context rows, most useful first.
  fields: Array<[string, string]>;
  // Dedup key input — the stable shape of the error (method+path+name, or
  // surface+message), NOT anything high-cardinality like a timestamp or id.
  signature: string;
  // Wall-clock ISO date (YYYY-MM-DD) for the daily-cap key. Passed in so the
  // caller owns the one `Date` read (keeps this pure + unit-testable).
  utcDay: string;
};

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function alertRnd(env: AlertEnv, input: AlertInput): Promise<void> {
  try {
    const sig = await sha256Hex(input.signature);
    const dedupKey = `rnd-alert:sig:${sig}`;
    // Already alerted this signature within the cooldown → skip.
    if (await env.KV.get(dedupKey)) return;

    const capKey = `rnd-alert:count:${input.utcDay}`;
    const current = Number.parseInt((await env.KV.get(capKey)) ?? "0", 10);
    if (Number.isFinite(current) && current >= DAILY_CAP) return;

    // Reserve the slot before sending. KV is eventually consistent, so a
    // burst can overshoot the cap by a little — acceptable for a best-effort
    // heads-up, and far safer than sending first and capping after.
    await env.KV.put(dedupKey, "1", { expirationTtl: DEDUP_COOLDOWN_SECONDS });
    await env.KV.put(capKey, String((Number.isFinite(current) ? current : 0) + 1), {
      expirationTtl: CAP_KEY_TTL_SECONDS,
    });

    await notify(env, {
      to: RND_EMAIL,
      kind: `internal_error_${input.kind}`,
      message: internalErrorAlertEmail(input.kind, input.summary, input.fields),
      idempotencyKey: `rnd-alert:${sig}`,
    });
  } catch (err) {
    // The caller is already handling an error; a failure here must be silent.
    console.error("rnd alert failed", {
      reason: err instanceof Error ? err.name : "unknown",
    });
  }
}
