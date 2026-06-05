# SK-LLM-025 — Recover the JSON object from reasoning-model preamble leaks before failing the parse

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md).

- **Decision:** `parseJsonResponse` (the shared classify / plan / route
  response parser in `packages/llm/src/providers/_shared.ts`) gains a
  **balanced-object recovery fallback**: when strict `JSON.parse` of the
  fence-stripped body throws, extract the first brace-balanced `{…}`
  span (string-aware, so braces inside string literals don't unbalance
  the scan) and parse that instead. Only if the recovered span also
  fails does the call throw the existing `ProviderError(..., "parse")`.
- **Core value:** Bullet-proof, Free
- **Why:** The free chain's head is now a **reasoning** model —
  OpenAI `gpt-oss-120b` on Cerebras per
  [`SK-LLM-023`](./SK-LLM-023-cerebras-planner-tier.md). Reasoning
  models are reported to **leak reasoning / preamble text into the
  output even under `response_format`** (Groq + OpenAI `gpt-oss`
  reports, 2026-06), which contaminates the structured JSON the parser
  expects. A leaked preamble currently turns a perfectly good
  `{"sql": …}` into a `parse` failure → the router fails over (burning a
  hop of scarce free-tier quota) or, when the chain is exhausted, surfaces
  as `no_sql`. Recovering the embedded object converts those losses into
  matches on **every** provider leg and **every** dataset (BIRD + Spider).
- **Consequence in code:** `packages/llm/src/providers/_shared.ts` adds
  a private `firstBalancedObject(s)` scanner and one fallback branch in
  `parseJsonResponse`; `packages/llm/test/providers/_shared.test.ts`
  pins clean-JSON, fence-stripping, leading-preamble, trailing-prose,
  string-literal-brace, and no-JSON-present cases. **Strictly additive:**
  the fallback runs only after strict parse already threw, so the happy
  path (the overwhelming common case with `response_format` set) is
  byte-for-byte unchanged and can't regress.
  **Observability:** a recovery silently turns a former `parse` failure
  into a success, so the per-call recovery *rate* is not counted today.
  The aggregate effect is already visible on the weekly cron (the
  `no_sql` → `match` shift in the eval report), so the per-call counter
  is **parked** — decided shape when a leak-rate regression makes it
  worth wiring: a bounded `nlqdb.llm.json_recovered.total{op}` counter
  incremented at the router boundary (`router.ts`, the only layer that
  holds the meter — `_shared.ts` stays pure per `GLOBAL-021`).
- **Alternatives rejected:**
  - **`indexOf("{")` … `lastIndexOf("}")` slice** — simpler, but
    unbalanced: a trailing prose sentence containing a `}` (or a second
    JSON object) would capture the wrong span. The string-aware balanced
    scan is ~12 lines and correct.
  - **Disable the reasoning channel via a provider flag** — the leak is
    reported even with reasoning configured hidden, and the flag name /
    support varies per provider; a parser-side recovery is one place,
    provider-agnostic, and survives future chain-head swaps.
  - **Loop over every candidate `{` start until one parses** — more
    robust against a balanced-but-invalid first object, but the worst
    case of the single-attempt version is identical to today's behaviour
    (a `parse` throw), so the extra scan isn't worth the complexity
    (`CLAUDE.md` §P5). Revisit only if a measured leak pattern defeats
    the first-object heuristic.
  - **Bump the per-op response token budget instead** — preamble leak is
    a formatting failure, not a truncation; more tokens don't fix it.
