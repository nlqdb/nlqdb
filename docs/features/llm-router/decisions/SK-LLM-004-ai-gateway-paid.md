# SK-LLM-004 — Cloudflare AI Gateway sits in front of every paid provider

- **Decision:** Every paid-provider call routes through Cloudflare AI Gateway URLs (`gateway.ai.cloudflare.com/v1/{acc}/{gw}/{provider}/...`). The gateway provides identical-prompt caching (sub-100 ms hits), per-provider quotas, and a single observability surface across providers.
- **Core value:** Free, Fast, Honest latency
- **Why:** AI Gateway's prompt cache lands sub-100 ms responses on identical prompts (huge win for the same-question-twice pattern). It also gives us one log surface across Anthropic / OpenAI / Gemini, which is the only realistic way to compare provider quality at runtime (see `nlqdb.plan.quality_score` in `docs/features/llm-router/FEATURE.md`). The gateway costs nothing on the Free plan.
- **Consequence in code:** Provider implementations accept a `baseUrl` / `endpoint` override; production config sets it to the gateway URL. `AI_GATEWAY_ACCOUNT_ID` + `AI_GATEWAY_ID` are env-driven. Free providers (Groq, Gemini Flash on its free key, Workers AI) hit their direct endpoints; paid providers go through the gateway.
- **Alternatives rejected:** Direct provider SDKs — loses the prompt cache and the unified log surface. Self-built proxy — re-implements what the gateway does for $0.
