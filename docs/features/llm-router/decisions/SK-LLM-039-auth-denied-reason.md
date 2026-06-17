# SK-LLM-039 — Classify 401/403 as `auth_denied` and park the provider for a long cooldown

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Refines the
HTTP-status → `FailoverReason` mapping introduced by
[`SK-LLM-030`](./SK-LLM-030-rate-limit-aware-failover.md) (which split
429 → `rate_limited`) and reuses the circuit-breaker machinery from
[`SK-LLM-005`](./SK-LLM-005-circuit-breaker.md).

- **Decision:** `httpError` maps a 401/403 to a new `auth_denied`
  `FailoverReason` instead of the generic `http_4xx`. The router **opens
  the breaker on the first `auth_denied`** (no 3-strike wait) for a **long
  cooldown — `AUTH_DENIED_COOLDOWN_MS` = 30 min, not the default 60s** —
  so subsequent calls skip the denied provider instead of re-hitting it.
  The skip is recorded as `auth_denied` (not `circuit_open`) via a
  per-breaker `openReason`, so the dead provider stays legible in attempts,
  the `nlqdb.llm.failover.total{reason}` metric, and the chain-failure
  summary. The long cooldown still re-probes periodically, so a genuinely
  transient 403 (an abuse-flag lift, a gateway hiccup) self-heals; a
  permanent denial is re-probed at most ~twice an hour instead of once a
  minute.
- **Core value:** Honest latency, Bullet-proof, Fast.
- **Why:** A 401/403 is not a per-question fault — it is a persistent
  project/key denial (bad/missing key, Generative Language API not
  enabled, **a billing-linked project billed then suspended for
  non-payment**, or an abuse-flag) that fails *every* call
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
  provider — while `openReason` keeps the skip legible. The cooldown is
  **30 min, not the default 60s**, because the denial is human-gated (a
  console/billing/key fix, not a self-healing capacity blip) and an
  env-keyed provider's re-key arrives as a **deploy** — which spins up a
  fresh isolate with a fresh in-memory breaker anyway — so a 60s re-probe
  never observed a recovery; it just re-burned the round-trip (and the
  hedge slot) every minute. 30 min collapses a ~10-probe waste over a
  10-min isolate window down to one probe.
- **Consequence in code:** `packages/llm/src/providers/_shared.ts`
  `httpError` returns `auth_denied` for status ∈ {401, 403};
  `packages/llm/src/types.ts` adds the `auth_denied` variant;
  `packages/llm/src/router.ts` opens the breaker on `auth_denied`
  (`openReason: "auth_denied"` + `cooldownMsOverride: AUTH_DENIED_COOLDOWN_MS`
  on `BreakerState`) and surfaces `state.openReason ?? "circuit_open"` on
  the skip. The eval's
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
  so there is no accessible *free* model to switch to. **Root cause
  (confirmed 2026-06-17): the shared project had a Cloud Billing account
  linked, so it billed every call even on free models (`free_tier_requests`
  → 0) and was suspended when the bill went unpaid ⇒ the 403** — not an
  abuse-flag. The fix is a project with **no billing account** (it can then
  never be charged or suspended — it rate-limits at the free caps instead),
  never linking billing (off-policy under
  [`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md);
  paid Gemini is the separate §6-gated hosted-premium lane,
  [`SK-LLM-017`](./SK-LLM-017-hosted-premium-chain.md)). Resolved 2026-06-17
  by rotating to a billing-free key — `gemini-2.5-flash` now serves on the
  free tier (live-probed 200). (4)
  Leave it as `http_4xx` — rejected: the whole point is to tell a
  whole-session denial apart from a one-off bad request. (5) Park for the
  **default 60s cooldown** (the original SK-LLM-039 value) — rejected: a
  human-gated denial does not clear in 60s and an env re-key arrives as a
  deploy (fresh isolate), so the 60s re-probe never caught a recovery; it
  just re-burned the round-trip and hedge slot every minute. The 30-min
  `AUTH_DENIED_COOLDOWN_MS` keeps a periodic re-probe (transient 403s still
  heal) while cutting the waste ~10×.
