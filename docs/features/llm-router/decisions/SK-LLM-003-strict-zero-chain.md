# SK-LLM-003 — Day-1 strict-$0 chain: Gemini Flash → Groq → Workers-AI → OpenRouter free

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Sharded out
unchanged to keep that doc under the 20 KB cap per `CLAUDE.md` §2 D4 —
this body is verbatim, only the location moved.

- **Decision:** Until startup credits land, the `plan` tier chain is `[gemini_flash_free, groq_llama70b_free, openrouter_free]` (with `workers_ai` as a non-US backup). The `route` tier uses `groq_llama8b_free` with `workers_ai` as the geo backup. Embeddings use Workers AI bge-base-en-v1.5. The chain is configured via env var, not code.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Every provider in the chain has a no-card free tier (per `docs/architecture.md §7.1`): Gemini 500 RPD plan / 250k TPM, Groq 14,400 RPD on 8B / 1,000 RPD on 70B, Workers AI 10k Neurons/day, OpenRouter 50 RPD anon / 1,000 RPD after a one-time $10 deposit. Stacked, this gives ~500 plan generations + ~14,400 routings per day — comfortably above Phase 1's exit criteria after the plan cache (60–80% hit rate). Card-free is the activation guarantee in `GLOBAL-013`.
- **Consequence in code:** Day-1 deploy reads `LLM_CHAIN_PLAN`, `LLM_CHAIN_ROUTE`, `LLM_CHAIN_SUMMARIZE` env vars; defaults are the strict-$0 chain. All four free providers are implemented in `packages/llm/src/providers/`; rotating the chain is a redeploy, not a code change.
- **Alternatives rejected:** Single free provider — one outage kills the product. Wait for credits — punts launch by weeks; `docs/architecture.md §0` says we ship without spending money.
