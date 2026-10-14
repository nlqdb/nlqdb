# SK-LLM-036 — Workers AI: `json_object` mode on JSON ops; accept an object `result.response`

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Repairs the
Workers AI leg ([`SK-LLM-003`](./SK-LLM-003-strict-zero-chain.md)'s non-US
backup, 5th in the planner chain) without touching any other provider.

- **Decision:** `workersAIChat` (`packages/llm/src/providers/workers-ai.ts`)
  accepts `result.response` of type **string or object**. A string passes
  through unchanged (prose ops, non-JSON outputs); an object is re-serialized
  with `JSON.stringify` so the shared `parseJsonResponse` sees the same wire
  shape every other leg returns. Only a missing/`null` `response` still fails
  with `reason: "parse"`. A JSON op (`jsonMode`) also sends
  `response_format: {type: "json_object"}`; summarize (prose) does not.
- **Core value:** Engine quality, Free
- **Why:** The Workers AI REST endpoint returns `result.response` as a
  **pre-parsed JSON object** when `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
  (the `plan`/`schema_infer` model) emits valid JSON — verified live against
  `api.cloudflare.com` 2026-06-10 (the same probe shows
  `@cf/meta/llama-3.1-8b-instruct` and prose outputs still arrive as strings,
  and a bad token is a 401, i.e. `http_4xx`, not `parse`). The provider's
  strict `typeof text !== "string"` check therefore rejected exactly the
  *successful* plan calls: in the 2026-06-09 GHA BIRD smoke (run 27242832359)
  the leg failed with `workers-ai:parse` on effectively every chain-exhaustion
  row, so the chain ran as 5-of-6 even when Workers AI answered correctly. The
  free chain's binding constraint is per-minute capacity (verified §5 risk,
  the retired engine-quality tracker (history: `quality-score-verification-log.md`)), and Workers AI is an **independent
  10K-neurons/day pool** — reviving it is a pure capacity win targeting the
  chain-exhaustion `no_sql` bucket.
- **Consequence in code:** `WorkersAIResponse.result.response` widens to
  `string | Record<string, unknown>`; the string path is unchanged, the object
  path re-serializes. Tests pin both the object-accepted and the
  still-`parse`-on-missing behaviours. Effect measured combined on the next
  smoke dispatch (`SK-QUAL-002`).
- **Alternatives rejected:**
  - **No JSON mode (rejected 2026-10-14, reversing the 2026-06 call).** On
    the seven run-237/239 dogfood write goals (616–1997 chars), unconstrained
    output failed `parse` 6/14 even with no timeout: the model echoes the
    goal's quotes and drops the closing brace. `json_object` on the native
    `/ai/run` endpoint returned valid JSON on every call that finished
    (25/25; `json_schema` 21/21), at 10–16 ms per goal char
    (hence `plan`'s write budget, `packages/llm/src/router.ts`); route
    latency was unchanged. `jsonMode` is per call, so prose ops are untouched.
  - **Parse the object directly instead of re-serializing.** Would fork the
    response path per provider; re-serializing keeps `parseJsonResponse` the
    single JSON entry point for every leg (`SK-LLM-025`'s recovery included).
