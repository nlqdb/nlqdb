# SK-STRIPE-006 — R2 archive of the raw signed payload, scheduled via `ctx.waitUntil`

Parent feature: [`stripe-billing/FEATURE.md`](../FEATURE.md).

- **Decision:** After a successful insert, the route schedules the raw request body to R2 at `stripe-events/<yyyy>/<mm>/<dd>/<event_id>.json` via `c.executionCtx.waitUntil(result.archive)`. The 200 response ships before the R2 put completes. R2 failures increment `nlqdb.webhook.stripe.archive_failures.total`, emit a `stripe_r2_archive_failed` warn log, and do not retry. R2 binding (`ASSETS`) is optional — when undefined (dev / tests) the archive step is skipped silently.
- **Core value:** Bullet-proof, Fast, Honest latency
- **Why:** The Stripe Dashboard's "Resend webhook" button is rate-limited and history-bounded; for forensics or schema changes against historical events we need the original signed bytes. R2 is essentially free for this volume. Putting the archive on the response path would couple webhook latency to R2 — `waitUntil` runs the put after the 200 ships, keeping the response budget intact while preserving the trail.
- **Consequence in code:** `processWebhook` returns the put promise on the result rather than awaiting it; the route handler in `index.ts` is responsible for `c.executionCtx.waitUntil(result.archive)`. R2 keys are date-partitioned for easy `glob-by-day` and future R2 lifecycle rules ("delete > 90 days"). The `stripe_events.payload_r2_key` column carries the key so `(event_id → archived bytes)` is queryable from D1 alone. **Cloudflare requires a payment method on file** to use R2 even at $0 usage (RUNBOOK §6); removing the payment method takes effect at the end of the billing period.
- **Alternatives rejected:**
  - Inline `await` of the R2 put before responding — adds R2 p95 latency to every webhook, breaks Stripe's 30s acknowledgement budget on slow days.
  - Archive only on dispatch failure — loses the audit trail for the 99% case where everything works and we later want to replay.
