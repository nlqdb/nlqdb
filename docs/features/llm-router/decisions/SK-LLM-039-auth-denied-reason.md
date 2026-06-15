# SK-LLM-039 — Classify 401/403 as `auth_denied`, distinct from `http_4xx`

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Refines the
HTTP-status → `FailoverReason` mapping introduced by
[`SK-LLM-030`](./SK-LLM-030-rate-limit-aware-failover.md) (which split
429 → `rate_limited`). The circuit-breaker treatment is unchanged from
[`SK-LLM-005`](./SK-LLM-005-circuit-breaker.md).

- **Decision:** `httpError` maps a 401/403 to a new `auth_denied`
  `FailoverReason` instead of the generic `http_4xx`. The router keeps
  `auth_denied` out of the circuit breaker (exactly as the old
  401/403-via-`http_4xx` skip did), so failover behaviour is byte-for-byte
  unchanged; only the reason label surfaced in attempts, the
  `nlqdb.llm.failover.total{reason}` metric, and the chain-failure summary
  string changes.
- **Core value:** Honest latency, Bullet-proof, Fast.
- **Why:** A 401/403 is not a per-question fault — it is a persistent
  project/key denial (bad/missing key, Generative Language API not
  enabled, billing unlinked, or an abuse-flag) that fails *every* call
  identically until a human fixes the key in the provider console. Lumped
  under `http_4xx` it is invisible: the 2026-06-12 canonical run's Spider
  `gemini:http_4xx` losses read as ambiguous "client errors" (chased first
  as oversized DDL, then as generic 4xx). A live probe on 2026-06-15
  showed the shared `GEMINI_API_KEY` project returns 403
  `PERMISSION_DENIED` on the entire gemini-2.5 family (4/4 probes) while
  gemini-2.0 returns 429 (access granted, quota-throttled) — i.e. Gemini
  contributes *nothing* to every chain call. The distinct reason makes a
  dead provider legible in one token (`gemini:auth_denied`), exactly the
  "count what you log" lesson from the SK-QUAL-013 reason-bucketing work.
- **Consequence in code:** `packages/llm/src/providers/_shared.ts`
  `httpError` returns `auth_denied` for status ∈ {401, 403};
  `packages/llm/src/types.ts` adds the `auth_denied` variant;
  `packages/llm/src/router.ts` keys the breaker-skip off
  `reason === "auth_denied"` (the per-status `isAuthFailure` helper is
  removed). The eval's `no_sql_reasons` bucketing
  (`tools/eval/src/runner.ts`) lifts the tag generically, so the next run
  surfaces `gemini:auth_denied` with no eval-code change; it is neither
  `rate_limited` nor `circuit_open`, so `isChainCapacityExhausted` still
  scores it as a genuine failure (never a budget-stop pause).
- **Alternatives rejected:** (1) Open the breaker on `auth_denied` —
  rejected: a config bug should stay visible on every attempt, not be
  masked as a `circuit_open` outage (the original SK-LLM-005 reasoning),
  and Gemini sits 3rd in the chain so the per-request hot-path cost of
  re-hitting it is near-zero when the head providers are healthy. (2)
  Switch the Gemini default model from `gemini-2.5-flash` to an accessible
  one in code — rejected here: the production runtime key may differ from
  the shared CI key, so a blind model downgrade could regress a healthy
  prod chain; the key fix is a Google-console/billing action tracked in
  `docs/blocked-by-human.md`. (3) Leave it as `http_4xx` — rejected: the
  whole point is to tell a whole-session denial apart from a one-off bad
  request.
