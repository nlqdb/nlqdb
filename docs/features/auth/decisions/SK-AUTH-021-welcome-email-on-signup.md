# SK-AUTH-021 — Welcome email fires from the Better Auth `user.create` hook, best-effort

- **Decision:** The first time a `user` row is created (any sign-in
  method), `databaseHooks.user.create.after` in `apps/api/src/auth.ts`
  sends one welcome email via the shared `sendEmail`
  (`makeEmailSender`, the [`GLOBAL-021`](../../../decisions/GLOBAL-021-external-system-ownership.md)
  Resend owner) — subject "Welcome to nlqdb", a single primary link to
  `${webOrigin}/app`, rendered from the `welcomeEmail` template on the
  shared `renderEmail` shell. The send goes through the best-effort
  `notify()` dispatcher (`apps/api/src/email-notify.ts`), which owns the
  MOCK_IDP sink, the OTel span (`nlqdb.email.send`, `kind=welcome` +
  `outcome` attributes), and the try/catch swallow, so a Resend outage or
  timeout can never fail a signup — the hook always resolves. It runs in the one-time `user.create` hook (not on
  any query path), so [`SK-ONBOARD-001`](../../onboarding/FEATURE.md)'s
  "nothing blocks the first query" still holds; the send's latency is
  bounded by the shared 8 s Resend timeout and lands only on the
  once-per-user signup redirect. It honors `MOCK_IDP=1`
  ([`SK-AUTH-018`](SK-AUTH-018-mock-idp-mock-stripe-preview-flags.md)):
  previews sink the mail to KV instead of hitting Resend. A Resend
  `idempotencyKey` of `welcome:${user.id}` collapses any double-fire
  ([`GLOBAL-005`](../../../decisions/GLOBAL-005-idempotency.md)).
- **Core value:** Effortless UX, Seamless auth, Bullet-proof
- **Why:** Until now the product sent exactly two emails ever — the
  magic-link and the billing dunning reminder — so a stranger who
  verified their address but stalled before value received no
  acknowledgement at all. The first real stranger signup (2026-08-12)
  did exactly this: verified, one failed ask, gone. The `user.create`
  hook (not the `hooks.after` sign-in middleware) is the correct seam —
  it fires once per person on first signup, not on every subsequent
  sign-in, so returning users aren't re-greeted.
- **Consequence in code:** Welcome is telemetry-grade, never
  load-bearing: reviewers reject any version that `await`s the send on
  the signup path or lets it throw. New outbound email types add a
  `templates.ts` builder and send through the shared `notify()` rail
  (`packages/email` / `apps/api/src/email-notify.ts`), never a fresh
  Resend fetch (`GLOBAL-021`). The `user.create.after` hook is the canonical
  first-signup side-effect seam; a second first-signup side effect
  reuses it rather than adding another `hooks.after` path-match.
- **Alternatives rejected:**
  - Send from the `hooks.after` sign-in middleware — fires on every
    sign-in, so it needs a "first time?" guard the `user.create` hook
    gives for free.
  - A delayed / drip welcome via a queue — more surface (queue, timer,
    dedup) than a one-shot greeting warrants; revisit if a multi-step
    activation sequence is ever designed.
  - Block signup until the welcome sends — a Resend hiccup would then
    fail sign-in, the exact failure `sendMagicLink` already guards
    against; welcome is strictly less important than the magic link.
