# `@nlqdb/email-router`

Inbound mail for `nlqdb.com` and `nlqdb.ai`. Email Routing's catch-all
rule on both zones invokes this Worker's `email()` handler over SMTP;
it forwards to the founder's verified inbox.

Deployed name is `protect-email-domain-reputation`. Renaming it unbinds
the routing rules and silently stops inbound mail.

## What it does

| Recipient | Outcome |
| :--- | :--- |
| `dmarc@` (also `dmarc+tag@`) | Logged, not forwarded — aggregate reports only |
| anything else | Forwarded to the verified inbox, stamped with `X-Nlqdb-Auth-Verdict` and `X-Nlqdb-Original-To` |

A forward that fails is rethrown, which returns a temporary SMTP error
so the sending server retries. Nothing is permanently rejected, so no
inbound message is lost by a decision made here.

`X-Nlqdb-Auth-Verdict` is `pass`, `suspicious`, or `unknown` — a label
for Gmail-side filters, not a block.

## Why DMARC reports are not forwarded

`_dmarc.nlqdb.com` publishes `rua=mailto:dmarc@nlqdb.com`, so Google and
other reporters mail their aggregate XML to our own zone. Forwarding that
volume into Gmail trips its `4.7.28` bulk-mail rate limiter, and the
`421` response then fails the forward for **all** inbound mail until the
limit clears. Reading the reports from the Worker log instead keeps the
inbox path clear; point `rua` at a report processor if the XML itself
ever becomes worth parsing.

## Verifying a change

```bash
bun run --filter '@nlqdb/email-router' test
bun run --filter '@nlqdb/email-router' build
```

Then confirm real delivery, which the tests cannot:

1. `bunx wrangler tail protect-email-domain-reputation --format=pretty`
2. Send a message to `hello@nlqdb.com` and confirm the log line reads
   `"action":"forwarded"` and that it arrives in the inbox.
3. Check the routing outcome in Email Routing → Activity Log, or query
   `emailRoutingAdaptive` for `status`/`errorDetail`.
