// Production LLM router for `apps/api`. Provider chain per docs/architecture.md §7.1
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
      // SK-ASK-009 — merged routeAsk rides the cheap-tier chain (Groq
      // 8B first; the prompt is short and the budget is 1500 ms).
      route: ["groq", "gemini", "workers-ai", "openrouter"],
      plan: ["gemini", "groq", "workers-ai", "openrouter"],
      summarize: ["groq", "gemini", "workers-ai", "openrouter"],
      // SK-LLM-012: schema_infer is its own operation but shares the
      // planner-tier provider chain — same ordering as `plan` so it
      // hits the JSON-strongest provider first.
      schema_infer: ["gemini", "groq", "workers-ai", "openrouter"],
      // SK-DB-010: engine-classifier rides the cheap-tier chain.
      engine_classify: ["groq", "gemini", "workers-ai", "openrouter"],
    },
    // SK-LLM-014 — Hedged-request race on planner-tier ops, where
    // wall-clock tails are widest and we already pay 0 dollars per
    // call. After the head-start delay, fire provider[1] in parallel
    // with provider[0]; first valid response wins, loser aborts.
    //
    // ⚠️ FREE-TIER ONLY. Every chain in `chains:` above is a free-tier
    // chain (Groq / Gemini / Workers AI / OpenRouter free) — racing
    // them is pure latency win. **When the paid chain lands (SK-LLM-007
    // — retention-off Anthropic / OpenAI for Pro tenants), do NOT
    // copy this `hedge:` block into the paid router config**: every
    // paid call is real per-token money and the hedge would double
    // the bill on the slow tail. Per-op gating here makes that opt-in
    // explicit for each operation.
    //
    // Trigger case observed in prod (ray 9fb27d766d075270): Gemini
    // schema_infer hit the 8000 ms router timeout, fell through to
    // Groq which returned in 3306 ms — costing the anon /v1/ask
    // request 8 s of wall-clock for a result the hedge could have
    // delivered ~3 s after start. Head-start of 800 ms = ~p90 of
    // Gemini-Flash response time, so the typical fast-path skips the
    // hedge entirely and the slow-path saves the tail.
    hedge: {
      schema_infer: { afterMs: 800 },
      plan: { afterMs: 800 },
    },
  });
  return cached;
}
