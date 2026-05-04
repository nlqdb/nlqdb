# @nlqdb/llm

LLM router. Cost-ordered failover across the strict-$0 provider chain
defined in [`docs/architecture.md §7.1`](../../docs/architecture.md).

```ts
import {
  createLLMRouter,
  createGeminiProvider,
  createGroqProvider,
  createOpenRouterProvider,
  createWorkersAIProvider,
} from "@nlqdb/llm";

const router = createLLMRouter({
  providers: [
    createGroqProvider({ apiKey: env.GROQ_API_KEY }),
    createGeminiProvider({ apiKey: env.GEMINI_API_KEY }),
    createWorkersAIProvider({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CF_AI_TOKEN,
    }),
    createOpenRouterProvider({ apiKey: env.OPENROUTER_API_KEY }),
  ],
  chains: {
    classify:  ["groq", "workers-ai", "openrouter"],
    plan:      ["gemini", "groq", "openrouter"],
    summarize: ["groq", "openrouter"],
  },
});

const intent = await router.classify({ utterance: "show revenue last month" });
const plan   = await router.plan({ goal, schema, dialect: "postgres" });
const text   = await router.summarize({ goal, rows });
```

## Operations

Three operations land in this slice (PERFORMANCE §4 row 4 — Slice 4):

| Operation   | Input                                      | Output                       |
| :---------- | :----------------------------------------- | :--------------------------- |
| `classify`  | `{ utterance }`                            | `{ intent, confidence }`     |
| `plan`      | `{ goal, schema, dialect: "postgres" }`    | `{ sql }`                    |
| `summarize` | `{ goal, rows }`                           | `{ summary }`                |

`embed` lands later alongside the embeddings pipeline.

## Failover behaviour

Each call walks the chain for that operation. On the first success
the result returns. On any failure (HTTP 4xx/5xx, network, timeout,
parse error, or the chained provider being unregistered) the router
falls through to the next entry and increments
`nlqdb.llm.failover.total{from_provider, to_provider, reason}`.

If the entire chain fails, `AllProvidersFailedError` is thrown with
the per-provider reason history.

## Telemetry

| Span / Metric                  | Labels                                       |
| :----------------------------- | :------------------------------------------- |
| `llm.<operation>` span         | `llm.provider`, `llm.model`                  |
| `nlqdb.llm.calls.total`        | `provider`, `operation`, `status`            |
| `nlqdb.llm.duration_ms`        | `provider`, `operation`                      |
| `nlqdb.llm.failover.total`     | `from_provider`, `to_provider`, `reason`     |

Names + label keys pinned in
[PERFORMANCE §3.2](../../docs/performance.md#32-metric-names).

## Why an in-house router (no Vercel AI SDK / LangChain)

Per [`../../docs/guidelines.md`](../../docs/guidelines.md) §1: every provider's wire
format is a small fetch call (~50 lines), and we'd rather own the
~400-line router than carry a multi-megabyte SDK tree on the Workers
critical path. Each provider's HTTP shape is researched against the
official docs before implementation (GUIDELINES §2).

## Tests

```bash
bun run --cwd packages/llm test
```

Tests inject a fake `fetch` per provider — no live API keys required.
Per the Phase 0 slice plan in `docs/architecture.md §10`, every provider has a test for every operation.
