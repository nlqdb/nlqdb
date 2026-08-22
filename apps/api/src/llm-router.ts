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
  createCerebrasProvider,
  createGeminiProvider,
  createGroqProvider,
  createGroqQwenProvider,
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
    // SK-LLM-053 — Qwen3.6-27B (qwen/qwen3.6-27b) leads the planner tier,
    // served on the same card-free Groq key as gpt-oss (below). A 27B dense
    // coder/reasoner at ~77% SWE-bench Verified — above the pulled GLM-4.7
    // (73.8%, now 404 on Cerebras) and far above gpt-oss-120b (~30%). Dispatched
    // plain (no reasoning_effort); it self-bounds reasoning and returns clean
    // JSON in default mode. Routed direct (like every non-gateway leg); Gemini
    // sits second as the independent-pool failover for a Groq-Qwen 429.
    createGroqQwenProvider({
      apiKey: env.GROQ_API_KEY ?? "",
      baseUrl: gw.groq,
      gatewayToken: gwToken,
    }),
    // SK-LLM-023 — Cerebras gpt-oss-120b, the retained planner fallback
    // (independent card-free pool from the Groq-Qwen head above). Routed
    // direct — load-bearing per SK-LLM-047 (every chain needs a leg that
    // survives a gateway fault); the provider-agnostic plan cache
    // (SK-LLM-010) is the real cache layer.
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
      // SK-LLM-053 — Qwen3.6-27B (groq-qwen) leads the planner tier; Gemini sits
      // second as the independent-pool failover for a Groq-Qwen 429, with
      // gpt-oss-120b (cerebras) retained third. `groq` (gpt-oss-120b) is a
      // distinct Groq model with its own per-model daily quota, so it does not
      // cannibalise the head's. SK-LLM-028 keeps Mistral as the tail capacity
      // backstop for full-chain-exhaustion no_sql losses. The direct
      // groq-qwen/cerebras/mistral legs double as the SK-LLM-047 tail.
      plan: ["groq-qwen", "gemini", "cerebras", "groq", "workers-ai", "openrouter", "mistral"],
      // Direct (non-gateway) tail per SK-LLM-047.
      summarize: ["groq", "gemini", "workers-ai", "openrouter", "cerebras", "mistral"],
      // SK-LLM-012: schema_infer is its own operation but shares the
      // planner-tier provider chain — same ordering as `plan` so it
      // hits the JSON-strongest provider first.
      schema_infer: [
        "groq-qwen",
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
    // SK-LLM-053 — head-start = ~p90 of the *head* model's latency so the
    // typical fast-path skips the hedge and only the slow tail is raced. The
    // head is now Qwen3.6-27B (groq-qwen), measured live at ~1.2 s on a small
    // planner prompt — inside the 2000 ms head-start inherited from the
    // GLM-4.7 head (SK-LLM-048), so the hedge still fires only on the slow
    // tail and rarely doubles provider[1] (Gemini) load. Provisional pending
    // the quality-eval latency histogram at real traffic.
    hedge: {
      schema_infer: { afterMs: 2000 },
      plan: { afterMs: 2000 },
    },
  });
  return cached;
}
