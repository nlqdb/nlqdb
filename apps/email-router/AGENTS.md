# Apps · Email Router — Agents Guide

Inbound mail for `nlqdb.com` + `nlqdb.ai`. Deployed as
`protect-email-domain-reputation` and bound to the Email Routing
catch-all rule on both zones.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the behavioral principles, the full path → feature map, and the
> project-wide tech stack. This file narrows that guide to
> `apps/email-router/`.

## Commands

```bash
bun run --filter '@nlqdb/email-router' test
bun run --filter '@nlqdb/email-router' build   # wrangler deploy --dry-run
```

## Local rules

- **Never lose a message.** Every path ends in a forward to a verified
  destination or a throw (temporary SMTP error → the sender retries).
  `setReject()` is a permanent failure — do not reintroduce it, and do
  not swallow a forward error, which drops the message silently.
- **Only verified destinations.** `forward()` accepts addresses verified
  under Email Routing → Destination Addresses. An `@nlqdb.com` address is
  never a valid target: it is unverified and loops back through our MX.
- **Authentication results are a label, not a gate.** Cloudflare already
  rejects mail that fails both SPF and DKIM at the MX edge, and it does
  not always stamp `Authentication-Results` on Worker-delivered mail, so
  a verdict computed here is only good enough to sort on.
- Renaming the Worker unbinds it from the routing rules and silently
  stops inbound mail.

## When you finish

1. Run the commands above and ensure they pass.
2. Re-walk the delivery path per [`README.md`](README.md) — a unit test
   cannot prove a real message reached the inbox.
3. Open a PR; root `AGENTS.md` §8 lists the pre-PR quality gates.
