// Production LLM router for `apps/api`. Provider chains per
// docs/architecture.md §7.1: strict-$0, cost-ordered failover.
// A provider with an absent API key auth-fails (401 → `auth_denied`
// park, SK-LLM-039) and the chain falls through to the next leg.
//
// AI Gateway (Cloudflare): when AI_GATEWAY_ACCOUNT_ID + AI_GATEWAY_ID
// are set, Groq / Gemini / Workers AI / OpenRouter route through
// Cloudflare's gateway — gives us caching, retries, fallback, and
// unified observability for free. Keys remain ours; the gateway proxies
// authenticated requests. Cerebras + Mistral stay direct so every chain
// keeps a non-gateway leg (SK-LLM-047).
// Docs: https://developers.cloudflare.com/ai-gateway/.

import { env } from "cloudflare:workers";
import {
  createCerebrasGlmProvider,
  createCerebrasProvider,
  createGeminiProvider,
  createGroqProvider,
  createLLMRouter,
  createMistralProvider,
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
  // Gateway auth token (`cf-aig-authorization`), only meaningful for the
  // gateway-routed providers below. Pass it alongside each gateway `baseUrl`
  // so an "Authenticated Gateway" doesn't 401 the whole chain (SK-LLM-046).
  // `undefined` when the token or the gateway is unconfigured ⇒ no header.
  const gwToken = env.AI_GATEWAY_TOKEN || undefined;
  const providers = [
    // SK-LLM-048 — GLM-4.7 (zai-glm-4.7) leads the planner tier, served on the
    // same Cerebras key as gpt-oss-120b (below). Dramatically stronger on
    // coding/reasoning benchmarks than gpt-oss-120b (SWE-bench Verified 73.8%
    // vs ~30%); a reasoning model, dispatched with reasoning_effort:"low".
    // Routed direct, like every Cerebras leg (load-bearing per SK-LLM-047).
    createCerebrasGlmProvider({ apiKey: env.CEREBRAS_API_KEY ?? "" }),
    // SK-LLM-023 — Cerebras gpt-oss-120b, now the retained planner fallback
    // (demoted below Gemini so an independent pool, not the same exhausted
    // Cerebras key, catches a GLM 429). Routed direct — load-bearing per
    // SK-LLM-047 (every chain needs a leg that survives a gateway fault);
    // the provider-agnostic plan cache (SK-LLM-010) is the real cache layer.
    createCerebrasProvider({ apiKey: env.CEREBRAS_API_KEY ?? "" }),
    createGroqProvider({ apiKey: env.GROQ_API_KEY ?? "", baseUrl: gw.groq, gatewayToken: gwToken }),
    createGeminiProvider({
      apiKey: env.GEMINI_API_KEY ?? "",
      baseUrl: gw.gemini,
      gatewayToken: gwToken,
    }),
    createWorkersAIProvider({
      apiToken: env.CF_AI_TOKEN ?? "",
      accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "",
      baseUrl: gw.workersAi,
      gatewayToken: gwToken,
    }),
    createOpenRouterProvider({
      apiKey: env.OPENROUTER_API_KEY ?? "",
      baseUrl: gw.openrouter,
      gatewayToken: gwToken,
    }),
    // SK-LLM-028 — Mistral is the planner-tier capacity backstop at the
    // chain tail. Routed direct — load-bearing per SK-LLM-047, like
    // Cerebras. Fires only when every head provider is out.
    createMistralProvider({ apiKey: env.MISTRAL_API_KEY ?? "" }),
  ];
  cached = createLLMRouter({
    providers,
    chains: {
      // SK-ASK-009 — merged routeAsk rides the cheap-tier chain (Groq
      // GPT OSS 20B first; the prompt is short and the budget is 1500 ms).
      // Cerebras + Mistral are the SK-LLM-047 direct (non-gateway) tail:
      // no chain may be gateway-only, or one AI-Gateway fault fails the op.
      route: ["groq", "gemini", "workers-ai", "openrouter", "cerebras", "mistral"],
      // SK-LLM-048 — GLM-4.7 (cerebras-glm) leads the planner tier; Gemini sits
      // second as the independent-pool failover for a GLM 429 (a same-key
      // gpt-oss retry would hit the same exhausted quota), with gpt-oss-120b
      // (cerebras) retained third. SK-LLM-028 keeps Mistral as the tail
      // capacity backstop for full-chain-exhaustion no_sql losses. The direct
      // cerebras-glm/cerebras/mistral legs double as the SK-LLM-047 tail.
      plan: ["cerebras-glm", "gemini", "cerebras", "groq", "workers-ai", "openrouter", "mistral"],
      // Direct (non-gateway) tail per SK-LLM-047.
      summarize: ["groq", "gemini", "workers-ai", "openrouter", "cerebras", "mistral"],
      // SK-LLM-012: schema_infer is its own operation but shares the
      // planner-tier provider chain — same ordering as `plan` so it
      // hits the JSON-strongest provider first.
      schema_infer: [
        "cerebras-glm",
        "gemini",
        "cerebras",
        "groq",
        "workers-ai",
        "openrouter",
        "mistral",
      ],
      // SK-DB-010: engine-classifier rides the cheap-tier chain; direct
      // (non-gateway) tail per SK-LLM-047.
      engine_classify: ["groq", "gemini", "workers-ai", "openrouter", "cerebras", "mistral"],
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
    // delivered ~3 s after start.
    //
    // SK-LLM-048 — head-start = ~p90 of the *head* model's latency so the
    // typical fast-path skips the hedge and only the slow tail is raced.
    // The head is now GLM-4.7 (cerebras-glm), a reasoning model measured live
    // at ~1.6 s median / ~2.5 s p90 on Cerebras — so the 800 ms head-start
    // tuned for Gemini-Flash would have fired the hedge on *every* call,
    // doubling the load on provider[1] (Gemini). 2000 ms restores the
    // "hedge only the slow tail" intent. Provisional pending the quality-eval
    // latency histogram at real traffic.
    hedge: {
      schema_infer: { afterMs: 2000 },
      plan: { afterMs: 2000 },
    },
  });
  return cached;
}
