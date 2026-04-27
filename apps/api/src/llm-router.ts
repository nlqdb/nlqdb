// Production LLM router for `apps/api`. Provider chain per DESIGN §8.1
// strict-$0: Groq → Gemini → Workers AI → OpenRouter, cost-ordered
// failover. Providers without API keys fail through `not_configured`.
//
// AI Gateway (Cloudflare): when AI_GATEWAY_ACCOUNT_ID + AI_GATEWAY_ID
// are set, every provider call is routed through Cloudflare's gateway
// — gives us caching, retries, fallback, and unified observability for
// free. Keys remain ours; the gateway proxies authenticated requests.
// Docs: https://developers.cloudflare.com/ai-gateway/.

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

type GatewayBases = {
  groq?: string;
  gemini?: string;
  openrouter?: string;
  workersAi?: string;
};

function aiGatewayBases(accountId?: string, gatewayId?: string): GatewayBases {
  if (!accountId || !gatewayId) return {};
  const base = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}`;
  return {
    groq: `${base}/groq/openai/v1/chat/completions`,
    gemini: `${base}/google-ai-studio/v1beta/models`,
    openrouter: `${base}/openrouter/v1/chat/completions`,
    workersAi: `${base}/workers-ai`,
  };
}

export function getLLMRouter(): LLMRouter {
  if (cached) return cached;
  const gw = aiGatewayBases(env.AI_GATEWAY_ACCOUNT_ID, env.AI_GATEWAY_ID);
  const providers = [
    createGroqProvider({ apiKey: env.GROQ_API_KEY ?? "", endpoint: gw.groq }),
    createGeminiProvider({ apiKey: env.GEMINI_API_KEY ?? "", baseUrl: gw.gemini }),
    createWorkersAIProvider({
      apiToken: env.CF_AI_TOKEN ?? "",
      accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "",
      baseUrl: gw.workersAi,
    }),
    createOpenRouterProvider({ apiKey: env.OPENROUTER_API_KEY ?? "", endpoint: gw.openrouter }),
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
