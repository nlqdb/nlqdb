# SK-PREMIUM-016 — "Count me in" sends the user a confirmation email on first click, keeping the promise the UI already makes

- **Decision:** On the first `POST /v1/premium/interest` for an account
  (the model-picker's "Count me in" subscribe door,
  [`SK-PREMIUM-013`](SK-PREMIUM-013-model-catalog-and-picker.md)), the
  API now sends the **user** a confirmation email —
  *"You're on the hosted-premium list"* — in addition to the existing
  founder notification. Both go through the shared best-effort `notify()`
  dispatcher + the `premiumInterestConfirmEmail` template
  ([`GLOBAL-021`](../../../decisions/GLOBAL-021-external-system-ownership.md)
  email owner), fired fire-and-forget via `waitUntil` so the click
  response stays instant. The confirmation only sends when the session
  carries an address (`session.user.email` may be null); dedup rides the
  existing `premium_interest` first-insert gate (one confirmation per
  account, `SK-IDEMP-005`/`006`), with a Resend `idempotencyKey` of
  `premium-interest-confirm:${userId}` ([`GLOBAL-005`](../../../decisions/GLOBAL-005-idempotency-key.md)).
- **Core value:** Effortless UX, Bullet-proof
- **Why:** The model-picker success state already tells the user
  *"You're counted — we'll email you when the paid plan ships"*
  ([`ModelPicker.tsx`](../../../../apps/web/src/components/chat/ModelPicker.tsx)),
  but no email was ever sent — a broken promise sitting in production
  ([`P6`](../../../../CLAUDE.md) — durable, honest proof of the action). The
  interest signal was already persisted and the founder was already
  notified; the account's email was already stored in the
  `premium_interest` row. Closing the loop is one template + one
  best-effort call, not new state.
- **Consequence in code:** The `firstTime` branch of the
  `/v1/premium/interest` handler (`apps/api/src/index.ts`) fires two
  `notify()` sends (founder + user-confirm); the founder notify moved onto
  the same rail (was an inline `makeEmailSender`). Both are telemetry-grade
  — a reviewer rejects any version that `await`s them on the click path or
  lets them throw. New outbound email types attach to the `notify()` rail
  (`packages/email` templates), never a fresh Resend fetch (`GLOBAL-021`).
- **Alternatives rejected:**
  - Change the UI copy to stop promising an email — cheaper, but drops a
    genuine relationship touch with a warm lead who just raised their hand.
  - A delayed / drip "it shipped" sequence — the promised *future* send is
    real, but belongs with the hosted-premium launch (`SK-PREMIUM-009`,
    §6-gated), not this immediate acknowledgement; revisit when the meter
    ships. This decision covers only the instant confirmation.
  - Block the click response on the sends — a Resend hiccup would then slow
    or fail a one-click signal that is already safely persisted in D1.
