# Packages · Email — Agents Guide

`@nlqdb/email` — the GLOBAL-021 canonical owner of the Resend email
boundary. `makeEmailSender(cfg)` returns an `EmailSender`; every product
email (Better Auth magic-link in `apps/api`, billing dunning in
`apps/events-worker`) goes through it. No other file constructs a Resend
request.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the behavioral principles, the path → feature map, and the tech
> stack. This file narrows that guide to `packages/email/`.

## Owns

- The Resend HTTP wire surface (URL, auth header, body shape, timeout,
  optional `Idempotency-Key`) — GLOBAL-021 owner row points here.
- Error hygiene: the thrown `Error` carries only the HTTP status, never
  Resend's response body (which echoes recipient + from-address).
- **The email content rail** (`render.ts` + `templates.ts`): one branded
  HTML/text shell (`renderEmail`, one `escapeHtml`) and the declarative
  template catalog (`welcomeEmail`, `magicLinkEmail`,
  `premiumInterestConfirmEmail`, `serverErrorEmail`, `dunningEmail`).

## Adding a transactional email (the rail)

Adding an email is **one template + one call**, never a new HTML builder
or a new Resend fetch:

1. Add a builder to `templates.ts` returning `renderEmail({ subject,
   heading, body, cta?, rawLink?, footer? })` — the shell escapes every
   field and renders both text + HTML.
2. Send it. Best-effort side-effect emails (welcome, confirmations,
   recovery, founder notifies) go through **`notify()` in
   `apps/api/src/email-notify.ts`** — it owns the MOCK_IDP sink, the one
   `nlqdb.email.send` OTel span (`kind` + `outcome` attrs), the try/catch
   swallow, and the idempotency key. Fire it via `waitUntil` so it never
   blocks the request. The magic-link email is the one **fail-loud**
   exception — it keeps its own `makeEmailSender` send in `auth.ts` because
   a silent failure locks the user out.

## Don't

- Don't add a second Resend call site elsewhere, and don't hand-roll a
  `render*Html` string builder or a local `escapeHtml` — add a
  `templates.ts` entry and send through `notify()` (GLOBAL-021).
- Don't pull the `resend` SDK — one `fetch` keeps the Workers bundle lean
  (GLOBAL-013).

## Commands

```bash
bun run --cwd packages/email test
bun run --cwd packages/email typecheck
```
