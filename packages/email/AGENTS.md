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

## Don't

- Don't add a second Resend call site elsewhere — extend `EmailMessage`
  or add an exported helper here instead (GLOBAL-021).
- Don't pull the `resend` SDK — one `fetch` keeps the Workers bundle lean
  (GLOBAL-013).

## Commands

```bash
bun run --cwd packages/email test
bun run --cwd packages/email typecheck
```
