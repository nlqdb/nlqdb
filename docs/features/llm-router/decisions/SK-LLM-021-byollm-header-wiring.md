# SK-LLM-021 — BYOLLM header wiring on `/v1/ask`: signed-in-only `x-nlq-byollm-key`, fail-loud, free-router fallthrough

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).
Builds on [`SK-LLM-019`](./SK-LLM-019-byollm-provider-factory.md) (provider
factory) + [`SK-LLM-020`](./SK-LLM-020-byollm-lane-selector.md) (pure lane
selector). Key-handling parent: [`SK-PREMIUM-008`](../../premium-tier/decisions/SK-PREMIUM-008-byollm.md).

- **Decision:** `apps/api` wires `SK-LLM-016` step 1 — the per-request
  `x-nlq-byollm-key` header — into the `/v1/ask` pipeline. A new
  `apps/api/src/ask/byollm.ts` owns two pure functions: `parseByollmHeader`
  (the `<provider>:<model>:<key>` wire format → `ByollmCredential`, splitting
  on the first two colons so a colon-bearing key survives) and
  `resolveAskRouter` (header credential → `buildByollmRouter` through the
  user's own key; otherwise the cached free router), returning the redacted
  `dispatchLaneAttributes` alongside. The handler enforces **signed-in only**
  (`principal.kind === "user"`; anon / `pk_live` / `sk_*` carrying the header
  get a one-sentence 400, never silent acceptance — a raw provider key must
  ride a first-party session, not a header an un-audited MCP host or embed
  could replay, per `SK-PREMIUM-008` point 8). Accepted providers are the AI
  Gateway compat-endpoint slugs `openai` / `anthropic` / `google-ai-studio`
  (verified 2026-05); an unknown slug fails loud at the edge rather than
  404-ing at the gateway. A BYOLLM key with AI Gateway unconfigured returns a
  one-sentence 503. `buildAskDeps` gains an optional `llm` override so the
  per-request router swap lands in one place.
- **Core value:** Free, Effortless UX, Honest latency, Bullet-proof
- **Why:** `SK-LLM-019`/`SK-LLM-020` shipped the provider + the pure
  precedence but explicitly deferred the apps/api wiring; this is that wiring
  for the lowest-risk credential source (a per-request header needs no
  migration, no KEK, no new endpoint). Keeping the wire format + the
  signed-in gate in one tested module — not inline in the 1k-line route
  handler — means the next lanes (account-stored, premium) extend
  `selectDispatchLane`'s inputs without touching the handler. The redacted
  `llm.dispatch_lane` / `llm.byollm_provider` attributes land on the existing
  `nlqdb.ask` span (no new span/metric — bounded cardinality per
  `performance.md §3.3`).
- **Consequence in code:** `apps/api/src/ask/byollm.ts` (+ unit tests);
  `apps/api/src/index.ts` `/v1/ask` handler parses + gates the header and sets
  the lane attributes; `apps/api/src/ask/build-deps.ts` `buildAskDeps(env, llm?)`.
  Error envelopes: `byollm_requires_session` / `invalid_byollm_key` (400),
  `byollm_unavailable` (503). The key value never enters a span/log.
- **Alternatives rejected:**
  - **Parse the header inline in the route handler** — buries the wire
    format + the signed-in gate in a 1k-line handler, untestable in isolation;
    rejected for the one-module seam.
  - **Three headers (`-provider` / `-model` / `-key`)** — more surface, and
    `SK-PREMIUM-008` blessed exactly one header name; the single
    `<provider>:<model>:<key>` value keeps "one way to do each thing".
  - **Accept any provider slug verbatim** — a typo'd slug 404s confusingly at
    the gateway; the allowlist fails loud at the edge (`GLOBAL-012`).
  - **Silent fallback to the free chain on a bad/anon key** — the dark
    pattern `GLOBAL-012` and `SK-PREMIUM-008` both forbid.
- **Deferred (tracked):** Account-stored keys (`api_keys.scope="byollm"`,
  KEK-decrypt) and the hosted-premium lane (`SK-LLM-017`, dark pre-§6) stay on
  the free router. `GLOBAL-003` surface parity (SDK / CLI / MCP / elements +
  the `/v1/keys/byollm` endpoints + `/app/keys` UI) and the OpenRouter-vs-compat
  discrepancy are tracked in [`premium-tier/FEATURE.md`](../../premium-tier/FEATURE.md)
  `## Open questions`.
