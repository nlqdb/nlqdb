# SK-ASK-027 — First server-error (5xx) on `/v1/ask` sends one best-effort recovery email, signed-in users only

- **Decision:** The first time a **signed-in** user's `POST /v1/ask`
  returns a **5xx** (server error — our fault; `llm_failed` 502 is the
  common one), the API sends one apologetic "that one's on us — try
  again" recovery email. It fires from a single post-handler Hono
  middleware on `/v1/ask` (`apps/api/src/index.ts`) that inspects
  `c.res.status >= 500` after `next()`; the send itself lives in
  `notifyFirstServerError` (`apps/api/src/first-error-email.ts`) and goes
  through the shared best-effort `notify()` dispatcher + the
  `serverErrorEmail` template ([`GLOBAL-021`](../../../decisions/GLOBAL-021-external-system-ownership.md)
  email owner). Dedup is a new `first_error_notified(user_id PK)` table
  (`migrations/0030_first_error_notified.sql`): `INSERT … ON CONFLICT DO
  NOTHING RETURNING 1` — the same dispatch-after-insert primitive as
  `premium_interest` / `pmf_survey`
  ([`SK-IDEMP-005`](../../idempotency/FEATURE.md)/`006`) — so a user is
  emailed **at most once ever**, however many errors they later hit. A
  Resend `idempotencyKey` of `first-error:${userId}` collapses any
  double-fire ([`GLOBAL-005`](../../../decisions/GLOBAL-005-idempotency-key.md)).
  Fired fire-and-forget via `waitUntil`, so it never delays the ask
  response, and swallowed on failure (the ask response already carries
  its own error to the user).
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** A first server error with no acknowledgement reads as silent
  abandonment — the exact "verified, one failed ask, gone" pattern that
  motivated the welcome email ([`SK-AUTH-021`](../../auth/decisions/SK-AUTH-021-welcome-email-on-signup.md)),
  now for the failure path. **Deliberately narrow**, because the
  discovery gate found the error surfaces are mostly anonymous:
  - **5xx only.** Server errors are our fault; an apology + retry nudge is
    honest. Client errors (4xx — rate-limits, bad input, `clarify`) are
    the user's own action and already surface actionable in-app copy
    ([`error-message.ts`](../../../../apps/web/src/components/chat/error-message.ts)),
    so emailing on them would read as spammy surveillance.
  - **Signed-in only.** Only a `user` principal carries a stable account
    id + an email on file. The chat `/v1/ask`, anon-create, and
    `/v1/errors/web` surfaces are deliberately anonymous + PII-redacted
    (`credentials: "omit"`), so anon / `pk_live` / `sk_*` principals have
    no address and never get a row.
  - **Once ever.** First-time-only bounds the volume to a single email per
    account, so even a transient provider blip that later succeeds can't
    turn into noise.
- **Consequence in code:** New `first_error_notified` table +
  `notifyFirstServerError` + the one `app.use("/v1/ask", …)` post-handler
  seam. The seam is a single point covering every 5xx exit of the route
  (no per-return-site instrumentation). It is telemetry-grade, never
  load-bearing: a reviewer rejects any version that `await`s the send on
  the ask response path or lets it throw. New outbound email types attach
  to the shared `notify()` rail (`packages/email` templates), never a
  fresh Resend fetch (`GLOBAL-021`). Thrown (as opposed to returned) 500s
  propagate to the central `app.onError` and are **not** emailed — an
  accepted boundary: the meaningful, returned 5xx (`llm_failed`) is
  covered, and the seam stays a single clean middleware.
- **Alternatives rejected:**
  - Email on any 4xx **or** 5xx — floods frustrated users about their own
    rate-limits / bad input; the anonymous majority can't be reached
    anyway, so the marginal 4xx coverage is low-value and high-annoyance.
  - Instrument each 5xx return site individually — the parallel-copy
    anti-pattern; one post-handler middleware is the single seam.
  - Route through the `demand-signal` emitter — that bus is scoped to
    `clarify` / `rate_limited` shapes (`SK-EVENTS-010`), not 5xx, and its
    anon principals are per-IP (not emailable).
  - No email; improve in-app recovery only — the in-app error copy already
    exists; the gap is the *silent-abandonment* signal for a signed-in
    user who leaves, which only an out-of-band touch closes.
