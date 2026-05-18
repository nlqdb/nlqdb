# SK-LLM-014 — Hedged-request race on free-tier chains for planner-tier ops

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md).

- **Decision:** `LLMRouterOptions.hedge: Partial<Record<LLMOperation, { afterMs: number }>>`
  opts an operation into a hedged race over the first two eligible
  providers (configured + breaker-closed). After `afterMs` head-start,
  fire provider[1] in parallel with provider[0]; first success wins,
  the loser is aborted via `AbortController` (sentinel `HEDGE_LOST`)
  and surfaces `FailoverReason: "hedge_lost"` — distinct from `timeout`
  so the breaker doesn't trip on the cancelled leg. **Free-tier chains
  only** (per-op opt-in so paid chains under SK-LLM-007 can stay
  sequential). Production wires `schema_infer` and `plan` at
  `afterMs: 800`.
- **Core value:** Honest latency, Fast, Free
- **Why:** Trace `285b805cee6e2688768d9ffcd75a86fe` (2026-05-13) —
  anon `/v1/ask kind=create` spent 8.0 s on a Gemini `schema_infer`
  timeout before falling over to Groq (3.3 s). With an 800 ms
  head-start hedge, Groq fires ~7 s earlier and returns in ~4.1 s
  wall-clock total; ~5 s saved on the bad case, unchanged on the
  happy case. Dean & Barroso "Tail at Scale" (CACM 2013) — trade
  ~1.05× provider RPS for the timeout-tail.
- **Consequence in code:** `packages/llm/src/router.ts` carries
  `raceHedgedPair()` wired from `dispatch()` when `opts.hedge?.[op]`
  is set. `FailoverReason` gains `"hedge_lost"`; `classifyError()`
  keys off `signal.reason === HEDGE_LOST`. `updateBreakerFromResult()`
  skips `hedge_lost` so repeated successful hedges don't trip the
  fallback. `nlqdb.llm.failover.total{reason: "hedge_lost"}` fires
  once per actual engagement (skipped when primary returns within
  the head-start).
- **Alternatives rejected:**
  - Always hedge — 1.5× RPS waste on the fast path.
  - Lower per-attempt timeout — keeps the same tail; loses safety
    margin for legitimately slow models.
  - Hedge on paid chains — doubles per-token bill on the slow tail.
  - Race all providers — combinatorial RPS waste; two-way is the
    right ratio for free providers.
