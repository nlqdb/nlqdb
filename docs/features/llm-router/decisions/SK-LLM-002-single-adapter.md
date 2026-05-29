# SK-LLM-002 — Single adapter: `(tier, prompt, options) → response` over a cost-ordered provider chain

- **Decision:** Every LLM call routes through one `packages/llm/` adapter (`createLLMRouter()`). The adapter takes a `tier` and a cost-ordered provider chain; the chain is "swappable via env var" (per `docs/architecture.md §7.1`). No application code calls a provider SDK directly.
- **Core value:** Simple, Bullet-proof, Free
- **Why:** Direct provider SDK calls in handler code lock the provider into the call site — every retry, fallback, span, prompt-cache decision must be re-implemented per call site. One adapter means one place to add a provider, one place to wire `gen_ai.*` semconv attributes, one place to enforce circuit-breaker behaviour. It is also the precondition for the `chains: { free, paid }` selector below (`SK-LLM-007`).
- **Consequence in code:** Handlers call `router.invoke({tier, prompt, ...})`. Provider implementations live in `packages/llm/src/providers/*.ts` and are added by name to the chain config. Direct imports of `@anthropic-ai/sdk` / `openai` / `@google/generative-ai` outside `packages/llm/` fail review.
- **Alternatives rejected:** Per-handler provider pick — every handler owns its own retry/fallback. Provider-router-per-tier (multiple routers) — three places to add a new provider.
