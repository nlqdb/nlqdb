// Production LLM router for `apps/api`. Provider chain per docs/architecture.md §8.1
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

// Translate AI_GATEWAY_ACCOUNT_ID + AI_GATEWAY_ID into per-provider
// `baseUrl` overrides. Both must be set — partial config is a deploy
// bug: silently going direct (and skipping the gateway's caching,
// retries, observability) is exactly the kind of "works locally,
// breaks in prod" failure we don't want.
function aiGatewayBases(accountId?: string, gatewayId?: string): GatewayBases {
  const haveAccount = Boolean(accountId);
  const haveGateway = Boolean(gatewayId);
  if (haveAccount !== haveGateway) {
    // Loud-but-not-fatal: production may flip one secret first then
    // the other. console.warn surfaces in `wrangler tail` so the
    // misconfiguration shows up immediately on first request.
    console.warn(
      `[llm-router] AI Gateway partially configured: ` +
        `AI_GATEWAY_ACCOUNT_ID=${haveAccount ? "set" : "unset"}, ` +
        `AI_GATEWAY_ID=${haveGateway ? "set" : "unset"}. ` +
        `Both must be set to route via Cloudflare AI Gateway; falling back to direct provider URLs.`,
    );
  }
  if (!accountId || !gatewayId) return {};
  const base = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}`;
  return {
    // baseUrl semantics: each provider appends its own path suffix
    // (`/chat/completions`, `/{model}:generateContent`, `/{model}`).
    groq: `${base}/groq/openai/v1`,
    gemini: `${base}/google-ai-studio/v1beta/models`,
    openrouter: `${base}/openrouter/api/v1`,
    workersAi: `${base}/workers-ai`,
  };
}

export function getLLMRouter(): LLMRouter {
  if (cached) return cached;
  const gw = aiGatewayBases(env.AI_GATEWAY_ACCOUNT_ID, env.AI_GATEWAY_ID);
  const providers = [
    createGroqProvider({ apiKey: env.GROQ_API_KEY ?? "", baseUrl: gw.groq }),
    createGeminiProvider({ apiKey: env.GEMINI_API_KEY ?? "", baseUrl: gw.gemini }),
    createWorkersAIProvider({
      apiToken: env.CF_AI_TOKEN ?? "",
      accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "",
      baseUrl: gw.workersAi,
    }),
    createOpenRouterProvider({ apiKey: env.OPENROUTER_API_KEY ?? "", baseUrl: gw.openrouter }),
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
