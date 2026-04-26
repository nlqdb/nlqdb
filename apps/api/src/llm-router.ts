// Production LLM router instance for `apps/api`. Wires the four-
// provider strict-$0 chain from DESIGN §8.1: Groq → Gemini → Workers
// AI → OpenRouter, cost-ordered failover. Providers whose API key is
// unset at boot are still constructed but their first call resolves
// to `not_configured` failover (Slice 4 contract); the router skips
// them automatically.
//
// Workers AI is wired via the binding pattern (`CF_AI_TOKEN` +
// `CLOUDFLARE_ACCOUNT_ID`) — no separate service binding needed for
// the HTTP API path. Adding the proper `[ai]` binding can wait until
// we want the cheaper internal route.

import { env } from "cloudflare:workers";
import {
  createGeminiProvider,
  createGroqProvider,
  createLLMRouter,
  createOpenRouterProvider,
  createWorkersAIProvider,
  type LLMRouter,
} from "@nlqdb/llm";

let cached: LLMRouter | undefined;

export function getLLMRouter(): LLMRouter {
  if (cached) return cached;
  const providers = [
    createGroqProvider({ apiKey: env.GROQ_API_KEY ?? "" }),
    createGeminiProvider({ apiKey: env.GEMINI_API_KEY ?? "" }),
    createWorkersAIProvider({
      apiToken: env.CF_AI_TOKEN ?? "",
      accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "",
    }),
    createOpenRouterProvider({ apiKey: env.OPENROUTER_API_KEY ?? "" }),
  ];
  cached = createLLMRouter({
    providers,
    chains: {
      classify: ["groq", "gemini", "workers-ai", "openrouter"],
      plan: ["gemini", "groq", "workers-ai", "openrouter"],
      summarize: ["groq", "gemini", "workers-ai", "openrouter"],
    },
  });
  return cached;
}
