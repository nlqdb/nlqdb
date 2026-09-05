# SK-LLM-054 — Qwen3.8-27B (`qwen/qwen3.8-27b`, Groq) leads the strict-$0 planner tier

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). **Replaces the
Qwen3.6-27B planner head from [`SK-LLM-053`](./SK-LLM-053-qwen3.6-27b-planner-head.md)**
— a within-family upgrade (3.6 → 3.8) on the same Groq key. Keeps the
gpt-oss-120b fallback from [`SK-LLM-023`](./SK-LLM-023-cerebras-planner-tier.md).

- **Trigger (the weekly free-model scan, 2026-08-29):** A newer Qwen release,
  **Qwen3.8-27B** (`qwen/qwen3.8-27b`, released 2026-08-14), is now live on our
  existing card-free Groq key — confirmed by a live `GET /api.groq.com/openai/v1/models`
  with our own `GROQ_API_KEY` (catalog now lists both `qwen/qwen3.6-27b` and
  `qwen/qwen3.8-27b`). SK-LLM-053 (2026-08-22) picked 3.6 because 3.8 was not yet
  on the Groq API when it was written; the weekly scan exists to catch exactly
  this kind of same-key roster refresh.
- **Decision:** **Qwen3.8-27B** (model id `qwen/qwen3.8-27b`) replaces 3.6 as the
  head of the planner tier (`plan` + `schema_infer`), served on the **same
  card-free Groq key** already used for gpt-oss (`GROQ_API_KEY`) via the same
  `groq-qwen` chain entry (`createGroqQwenProvider`). The planner order is
  unchanged: `[groq-qwen, gemini, cerebras, groq, workers-ai, openrouter,
  mistral]`. The change is a one-line swap of the `QWEN_PLANNER_MODEL` constant
  in `providers/groq.ts`; the prod router (`apps/api/src/llm-router.ts`) and the
  eval free lane (`tools/eval/src/lanes.ts`) both read that constant through
  `createGroqQwenProvider`, so "the eval measures what production ships" holds
  with no further wiring.
- **Core value:** Free, Bullet-proof
- **Why Qwen3.8-27B over 3.6:** A same-size dense 27B coder/reasoner, materially
  stronger than the 3.6 it replaces on the same benchmark suite —
  **benchlm.ai overall 72.5 vs 53.8 (+18.7)**, **SWE-bench Pro 61.7**,
  **LiveCodeBench v6 90.3**, **Terminal-Bench 2.1 73.0** (vendor + third-party
  ranking signal, 2026-08). Since the planner model is the dominant term in
  free-chain NL→SQL accuracy
  ([`SK-LLM-023`](./SK-LLM-023-cerebras-planner-tier.md) established this), a
  stronger working head is the single highest-leverage engine-quality lever
  under [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md). Crucially it
  needs **no new credential and no new billing surface**: it is on the same
  renewable **no-card** Groq free tier that already satisfies
  [`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md) —
  unlike NVIDIA NIM / Cohere (finite credit pools) or SambaNova (20 RPD),
  rejected in SK-LLM-023 / SK-LLM-048 / SK-LLM-053.
- **Live verification (2026-08-29, our key):** Dispatched **plain** (no
  `reasoning_effort`), Qwen3.8-27B returns clean JSON-only `content` in its
  default decoding mode with **no leaked reasoning trace**:
  - Simple prompt (top-3 highest-paid employees) →
    `{"sql": "SELECT name FROM employees ORDER BY salary DESC LIMIT 3"}` in
    **~0.6 s**.
  - Harder prompt (per-country 2025 revenue, `HAVING > 10000`, highest first) →
    a correct JOIN + date-range + `GROUP BY` + `HAVING` + `ORDER BY DESC` query
    in **~0.7 s**.
  Both sit comfortably inside the inherited
  [`SK-LLM-014`](./SK-LLM-014-hedged-request-race.md) 2000 ms hedge head-start,
  so the hedge still fires only on the slow tail. Under load the free tier
  returns a 429 (RPM/TPM) fast → clean failover to Gemini, same posture as 3.6.
- **Consequence in code:** One-line change to `QWEN_PLANNER_MODEL` in
  `providers/groq.ts` (the slug lives once, there) plus the load-bearing model
  comments in `groq.ts` / `llm-router.ts` / `lanes.ts` and the `groq.test.ts`
  slug assertions. No new `ProviderName`, no new secret, no chain-order change.
  An absent key stays harmless (`?? ""` → auth-fails → failover).
- **Measurement gate:** This changes the planner head — the single most
  engine-quality-sensitive component — so, per the
  the retired engine-quality tracker (history: `quality-score-verification-log.md`) ("measured, not assumed") and
  [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md)'s "degrades 0"
  rule, a confirming **BIRD-dev + Spider quality-eval dispatch** should run
  before/at merge to show non-regression. PR CI keeps LLM keys mocked
  ([`SK-QUAL-002`](../../quality-eval/decisions/SK-QUAL-002-weekly-cron.md)), so
  that measurement is the manual `quality-eval-bird-mini.yml` /
  `quality-eval-spider2-lite.yml` `workflow_dispatch`, not PR CI. **Risk is
  low and revert is one line:** unlike SK-LLM-053 (whose incumbent was 404-dead),
  the incumbent here (3.6) is working, but 3.8 is a same-size, same-family,
  same-key model that outscores it across the board and is live-verified to
  return correct SQL on the actual planner path; if the dispatch shows a
  regression, flip `QWEN_PLANNER_MODEL` back to `qwen/qwen3.6-27b`.
- **Alternatives rejected:**
  - **Add 3.8 as an extra leg above 3.6 (keep both)** — both are the same model
    family on the same Groq account; a Groq-Qwen 429 affects the account RPM, so
    a second Groq-Qwen leg adds little that Gemini (the designed independent-pool
    failover at slot 2) doesn't already cover, and it complicates the chain
    against P5. Swap in place instead.
  - **DeepSeek-V4-Pro (~80.6% SWE-bench Verified) / GLM-5.2 (MIT) / Kimi K3** —
    stronger still, but none is on a renewable no-card free tier we hold a key
    for (finite credit pools or self-host only) — the same `GLOBAL-013`
    sustainability bar that parked NVIDIA NIM. Parked as candidates.
  - **Qwen3-Coder-480B (`qwen/qwen3-coder:free`, OpenRouter)** — stronger, but
    OpenRouter's free tier is ~50 requests/day — too small for a production
    planner head (unchanged from SK-LLM-048 / SK-LLM-053).
