# SK-LLM-005 — Circuit breaker: skip flapping provider after 3 consecutive failures, 60 s cooldown

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Sharded out
unchanged to keep that doc under the 20 KB cap per `CLAUDE.md` §2 D4 —
this body is verbatim, only the location moved.

- **Decision:** The router maintains per-provider failure state. After 3 consecutive failures the provider is skipped for the next 60 s (cooldown). After cooldown, the provider is retried on the next eligible call; success resets the counter.
- **Core value:** Bullet-proof, Honest latency, Fast
- **Why:** Without a circuit breaker, a provider that's down still costs us a connect-timeout per call before we fall through. With it, the second call after a known failure skips straight to the next provider — sub-100 ms switch (per `docs/architecture.md §7.1`). The 3-failure / 60-s threshold is calibrated against transient provider rate-limit blips that resolve quickly without taking the whole tier offline.
- **Consequence in code:** `createLLMRouter({circuitBreaker: {failureThreshold: 3, cooldownMs: 60_000}})`. Failure-counter state lives in the Worker instance (eventual cross-instance through KV is on the table but not required). A "skip" emits `nlqdb.llm.failover.total{from_provider, to_provider, reason: "circuit_open"}`.
- **Alternatives rejected:** No circuit breaker — every call to a downed provider pays the timeout. Aggressive (1-failure trip) — single transient failure flaps every provider at peak. Permanent open until manual reset — operators have to babysit.
