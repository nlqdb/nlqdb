# SK-LLM-009 — Prompt caching on every provider that supports it (~80% input reduction)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Sharded out
unchanged to keep that doc under the 20 KB cap per `CLAUDE.md` §2 D4 —
this body is verbatim, only the location moved.

- **Decision:** Every paid-provider call uses the provider's prompt-caching feature (Anthropic prompt caching, OpenAI cached tokens, Gemini context caching, AI Gateway response cache). System prompts and few-shot examples are written once per chain so the cache hits.
- **Core value:** Free, Fast, Honest latency
- **Why:** System-prompt + schema-context tokens dominate input cost on the plan tier. Provider prompt caching (paired with AI Gateway response caching) cuts ~80% of input cost on repeated patterns (per `docs/architecture.md §7` cost-control rule 3). Without it, we burn credit on the same system prompt thousands of times a day.
- **Consequence in code:** Every `tier=plan` call passes `cache_control: ephemeral` markers (Anthropic) or equivalent (`extra_headers: { "x-cache-namespace": ... }`) into the request. The system-prompt is constructed from a single immutable template (per `SK-LLM-010`); changes to the template invalidate the cache, which is the intended behaviour.
- **Alternatives rejected:** Skip prompt caching — pays full input price on every call; budget runs out in days. Custom in-Worker caching of prompts only — re-implements provider features at the wrong layer.
