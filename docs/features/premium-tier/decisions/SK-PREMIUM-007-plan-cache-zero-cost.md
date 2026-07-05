# SK-PREMIUM-007 — Plan cache stays product-funded; cap accounting starts at the LLM call site

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md).

- **Decision:** Plan-cache hits (per `SK-LLM-010` / `GLOBAL-006`) cost the customer **zero LLM tokens** even when premium is enabled — the plan-cache lookup short-circuits before any LLM call site. The metering hook is wired at the LLM router span boundary, not at the `/v1/ask` request boundary, so a cached plan that runs against a premium-enabled DB never appears on the LLM-tokens invoice line. The customer's per-DB queries-over-the-included-50k counter still ticks (Pro pricing line, `docs/architecture.md §6`); only the LLM-tokens add-on line is gated behind a real LLM call.
- **Core value:** Free, Honest latency, Bullet-proof
- **Why:** Charging for cached plans would invert the cost incentive — users would avoid asking the same useful question twice. The plan cache exists *because* repeat patterns are the cheap case; passing the savings through to the customer is the only honest framing. Wiring the meter at the router span boundary (instead of the request boundary) is the structural fix that makes the right thing the easy thing — the meter literally cannot fire without an LLM call to attach to. This is also a precondition for `SK-PREMIUM-006`'s cap accuracy: cap math in token-USD only counts real upstream calls.
- **Consequence in code:** The metering call site lives in `packages/llm/src/router.ts` inside the per-provider try/finally that already emits `gen_ai.*` attributes (`SK-LLM-006`); a cache-hit path in `apps/api/src/ask/` never enters that span. Tests assert that a second identical premium-enabled `/v1/ask` request emits no `nlqdb.premium.spend_usd_cents` increment. The customer-facing invoice line item shows `LLM tokens — Sonnet 4.6 (123,456 input / 45,678 output)`; cached plans are invisible on the invoice by construction.
- **Alternatives rejected:**
  - Charge a small "cache lookup" fee — re-introduces the "avoid repeating useful queries" disincentive; the cache-hit cost to us is sub-ms KV reads, not a profit center.
  - Bill cached plans at the original miss's price — same disincentive, plus accounting complexity (the original plan's price ages out as model prices change).
  - Bill at the request boundary, refund cache hits — accounting churn; the structural fix (meter at the call site) makes the refund unnecessary.
- **Source:** SK-LLM-010 (plan cache first) · GLOBAL-006 (content-addressed plans) · docs/architecture.md §6 (Premium models row)
