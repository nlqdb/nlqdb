# SK-LLM-036 — Workers AI: accept the object-shaped `result.response` a JSON-emitting model returns

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Repairs the
Workers AI leg ([`SK-LLM-003`](./SK-LLM-003-strict-zero-chain.md)'s non-US
backup, 4th in the planner chain) without touching any other provider.

- **Decision:** `workersAIChat` (`packages/llm/src/providers/workers-ai.ts`)
  accepts `result.response` of type **string or object**. A string passes
  through unchanged (prose ops, non-JSON outputs); an object is re-serialized
  with `JSON.stringify` so the shared `parseJsonResponse` sees the same wire
  shape every other leg returns. Only a missing/`null` `response` still fails
  with `reason: "parse"`.
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
  `quality-score-source-of-truth.md`), and Workers AI is an **independent
  10K-neurons/day pool** — reviving it is a pure capacity win targeting the
  chain-exhaustion `no_sql` bucket.
- **Consequence in code:** `WorkersAIResponse.result.response` widens to
  `string | Record<string, unknown>`; the string path is unchanged, the object
  path re-serializes. Tests pin both the object-accepted and the
  still-`parse`-on-missing behaviours. Effect measured combined on the next
  smoke dispatch (`SK-QUAL-002`).
- **Alternatives rejected:**
  - **Force a string with `response_format` (JSON mode).** Changes the request
    contract for all five ops through the shared `callChat` (summarize wants
    prose), and Workers AI documents JSON-mode output as best-effort — the
    response-shape tolerance is needed anyway. Larger surface, same outcome.
  - **Parse the object directly instead of re-serializing.** Would fork the
    response path per provider; re-serializing keeps `parseJsonResponse` the
    single JSON entry point for every leg (`SK-LLM-025`'s recovery included).
