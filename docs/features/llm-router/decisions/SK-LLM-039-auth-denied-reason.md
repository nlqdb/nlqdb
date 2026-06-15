# SK-LLM-039 — Classify 401/403 as `auth_denied` and park the provider for a cooldown

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Refines the
HTTP-status → `FailoverReason` mapping introduced by
[`SK-LLM-030`](./SK-LLM-030-rate-limit-aware-failover.md) (which split
429 → `rate_limited`) and reuses the circuit-breaker machinery from
[`SK-LLM-005`](./SK-LLM-005-circuit-breaker.md).

- **Decision:** `httpError` maps a 401/403 to a new `auth_denied`
  `FailoverReason` instead of the generic `http_4xx`. The router **opens
  the breaker on the first `auth_denied`** (standard cooldown, like a
  health failure but with no 3-strike wait), so subsequent calls skip the
  denied provider instead of re-hitting it. The skip is recorded as
  `auth_denied` (not `circuit_open`) via a per-breaker `openReason`, so the
  dead provider stays legible in attempts, the
  `nlqdb.llm.failover.total{reason}` metric, and the chain-failure summary.
  The cooldown auto-re-probes, so a re-keyed provider recovers without a
  deploy.
- **Core value:** Honest latency, Bullet-proof, Fast.
- **Why:** A 401/403 is not a per-question fault — it is a persistent
  project/key denial (bad/missing key, Generative Language API not
  enabled, billing unlinked, or an abuse-flag) that fails *every* call
  identically until a human fixes the key in the provider console. Two
  things follow. (1) **Legibility:** lumped under `http_4xx` it is
  invisible — the 2026-06-12 canonical run's Spider `gemini:http_4xx`
  losses read as ambiguous "client errors" (chased first as oversized
  DDL, then as generic 4xx); the distinct reason makes a dead provider
  legible in one token (`gemini:auth_denied`), the "count what you log"
  lesson from SK-QUAL-013. (2) **Latency:** a denied provider that is
  *not* parked costs a guaranteed-failed upstream round-trip on every
  call. A 2026-06-15 live probe showed the shared `GEMINI_API_KEY`
  project returns 403 `PERMISSION_DENIED` on the entire gemini-2.5 family
  (4/4 probes) and 429 `limit: 0` (zero free-tier allowance) on
  gemini-2.0-flash — Gemini answers *nothing* yet sits at chain **index 1**
  in every chain, and for the hedged `plan`/`schema_infer` ops it is the
  **hedge partner** (`provider[1]`, fired on the slow path), so on the
  exact slow tail hedging exists to cover, the hedge slot was being burned
  on a dead provider instead of the live one behind it (groq). Parking it
  on the first denial fixes both: one wasted round-trip per cooldown
  window instead of one per call, and the hedge slot rotates to a live
  provider — while `openReason` keeps the skip legible.
- **Consequence in code:** `packages/llm/src/providers/_shared.ts`
  `httpError` returns `auth_denied` for status ∈ {401, 403};
  `packages/llm/src/types.ts` adds the `auth_denied` variant;
  `packages/llm/src/router.ts` opens the breaker on `auth_denied`
  (`openReason: "auth_denied"` on `BreakerState`) and surfaces
  `state.openReason ?? "circuit_open"` on the skip. The eval's
  `no_sql_reasons` bucketing (`tools/eval/src/runner.ts`) lifts the tag
  generically, so a run still surfaces `gemini:auth_denied`; it is neither
  `rate_limited` nor `circuit_open`, so `isChainCapacityExhausted` still
  scores it as a genuine failure (never a budget-stop pause). The change
  is inert when a key works (a 200 never trips the breaker), so it is safe
  regardless of whether prod's runtime key matches the dead CI key.
- **Alternatives rejected:** (1) Keep `auth_denied` out of the breaker and
  re-hit on every call (the original SK-LLM-039 stance) — rejected: the
  "config bug should stay visible on every attempt" goal is fully met by
  surfacing `auth_denied` on the skip via `openReason`, *without* paying a
  guaranteed-failed round-trip (and a wasted hedge slot) per request. The
  original reasoning that "Gemini sits 3rd in the chain so the hot-path
  cost is near-zero" was wrong on both counts: it sits 2nd, and on hedged
  ops it is the hedge partner fired on the slow path. (2) Open the breaker
  but record the skip as `circuit_open` — rejected: masks a whole-session
  key denial as a generic outage, losing the one-token legibility this
  decision exists for. (3) Switch the Gemini default model from
  `gemini-2.5-flash` to an accessible one in code — rejected: the
  2026-06-15 re-probe shows gemini-2.0-flash also returns 429 `limit: 0`,
  so there is no accessible *free* model to switch to; the
  Google-console/billing fix is tracked in `docs/blocked-by-human.md`. (4)
  Leave it as `http_4xx` — rejected: the whole point is to tell a
  whole-session denial apart from a one-off bad request.
