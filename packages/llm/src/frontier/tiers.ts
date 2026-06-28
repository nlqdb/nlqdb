// SK-FRONTIER-002 — the ordered tier ladder for the founder-funded
// frontier lane. Six tiers, in quality order: Anthropic [opus, sonnet,
// haiku] then OpenAI [tier-1, tier-2, tier-3]. Each tier is backed by its
// OWN founder key with a small per-tier token budget; dispatch spends the
// highest-quality model first (Opus) and degrades to Sonnet / Haiku /
// OpenAI only as budgets / quotas run out, maximizing answer value per
// founder dollar before the lane falls through to the free chain.
//
// Model ids, key env-var values, and budgets are all INJECTED via `env`
// (see `FrontierEnv`) — this package holds no secret and reads no global
// env. A tier whose key is unset is skipped (it never appears in the
// returned ladder), so the founder can enable tiers incrementally just by
// populating the corresponding `FRONTIER_*_KEY_*` value.

export type FrontierProvider = "anthropic" | "openai";

export type FrontierTier = {
  // Stable ladder id (e.g. `anthropic-1`) — also the value stored in the
  // KV `frontier:active_tier` pointer (SK-FRONTIER-003).
  id: string;
  provider: FrontierProvider;
  // Upstream model id as the provider names it (e.g. `claude-opus-4-8`).
  model: string;
  // The name of the env var that holds this tier's founder key. The key
  // VALUE never lives in this package; `apps/api` reads `env[keyEnv]` at
  // dispatch time. Carried so the selector / router builder can fetch the
  // right secret without this module ever seeing it.
  keyEnv: string;
  // Small per-tier token budget (SK-FRONTIER-002). The KV-backed counter
  // (SK-FRONTIER-003) gates the tier against this; 0 ⇒ unset (caller
  // applies its own default / treats as no explicit cap).
  budgetTokens: number;
};

// Injected env slice. Only the keys the ladder reads; populated by
// `apps/api` from its Worker env. All optional — an unset model falls back
// to the documented default (Anthropic) or a placeholder (OpenAI, pending
// P2 verification); an unset key skips the tier; an unset budget is 0.
export type FrontierEnv = {
  FRONTIER_ANTHROPIC_KEY_1?: string;
  FRONTIER_ANTHROPIC_KEY_2?: string;
  FRONTIER_ANTHROPIC_KEY_3?: string;
  FRONTIER_OPENAI_KEY_1?: string;
  FRONTIER_OPENAI_KEY_2?: string;
  FRONTIER_OPENAI_KEY_3?: string;
  FRONTIER_ANTHROPIC_MODEL_1?: string;
  FRONTIER_ANTHROPIC_MODEL_2?: string;
  FRONTIER_ANTHROPIC_MODEL_3?: string;
  FRONTIER_OPENAI_MODEL_1?: string;
  FRONTIER_OPENAI_MODEL_2?: string;
  FRONTIER_OPENAI_MODEL_3?: string;
  FRONTIER_TIER_BUDGET_ANTHROPIC_1?: string;
  FRONTIER_TIER_BUDGET_ANTHROPIC_2?: string;
  FRONTIER_TIER_BUDGET_ANTHROPIC_3?: string;
  FRONTIER_TIER_BUDGET_OPENAI_1?: string;
  FRONTIER_TIER_BUDGET_OPENAI_2?: string;
  FRONTIER_TIER_BUDGET_OPENAI_3?: string;
};

// Anthropic model defaults when the env override is unset. Opus → Sonnet →
// Haiku, the quality ladder the founder asked for. Verified ids as of the
// FEATURE.md Open question.
const ANTHROPIC_MODEL_DEFAULTS = [
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
] as const;

// TODO(P2): verify current OpenAI model IDs before enabling the lane
// (docs/features/frontier-keys/FEATURE.md Open question). Defaulted to
// empty placeholders on purpose so a stale guessed id can't ship silently
// — the founder must set FRONTIER_OPENAI_MODEL_1..3 explicitly.
const OPENAI_MODEL_DEFAULTS = ["", "", ""] as const;

function parseBudget(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Build the ordered ladder from injected env. Anthropic tiers first
// (highest quality), then OpenAI; within each provider, tier 1 → 2 → 3. A
// tier whose key env is unset/blank is omitted from the result entirely.
export function frontierTiers(env: FrontierEnv): FrontierTier[] {
  const specs: Array<{
    id: string;
    provider: FrontierProvider;
    key: string | undefined;
    model: string;
    budget: string | undefined;
  }> = [
    {
      id: "anthropic-1",
      provider: "anthropic",
      key: env.FRONTIER_ANTHROPIC_KEY_1,
      model: env.FRONTIER_ANTHROPIC_MODEL_1 ?? ANTHROPIC_MODEL_DEFAULTS[0],
      budget: env.FRONTIER_TIER_BUDGET_ANTHROPIC_1,
    },
    {
      id: "anthropic-2",
      provider: "anthropic",
      key: env.FRONTIER_ANTHROPIC_KEY_2,
      model: env.FRONTIER_ANTHROPIC_MODEL_2 ?? ANTHROPIC_MODEL_DEFAULTS[1],
      budget: env.FRONTIER_TIER_BUDGET_ANTHROPIC_2,
    },
    {
      id: "anthropic-3",
      provider: "anthropic",
      key: env.FRONTIER_ANTHROPIC_KEY_3,
      model: env.FRONTIER_ANTHROPIC_MODEL_3 ?? ANTHROPIC_MODEL_DEFAULTS[2],
      budget: env.FRONTIER_TIER_BUDGET_ANTHROPIC_3,
    },
    {
      id: "openai-1",
      provider: "openai",
      key: env.FRONTIER_OPENAI_KEY_1,
      model: env.FRONTIER_OPENAI_MODEL_1 ?? OPENAI_MODEL_DEFAULTS[0],
      budget: env.FRONTIER_TIER_BUDGET_OPENAI_1,
    },
    {
      id: "openai-2",
      provider: "openai",
      key: env.FRONTIER_OPENAI_KEY_2,
      model: env.FRONTIER_OPENAI_MODEL_2 ?? OPENAI_MODEL_DEFAULTS[1],
      budget: env.FRONTIER_TIER_BUDGET_OPENAI_2,
    },
    {
      id: "openai-3",
      provider: "openai",
      key: env.FRONTIER_OPENAI_KEY_3,
      model: env.FRONTIER_OPENAI_MODEL_3 ?? OPENAI_MODEL_DEFAULTS[2],
      budget: env.FRONTIER_TIER_BUDGET_OPENAI_3,
    },
  ];

  const keyEnvByTier: Record<string, keyof FrontierEnv> = {
    "anthropic-1": "FRONTIER_ANTHROPIC_KEY_1",
    "anthropic-2": "FRONTIER_ANTHROPIC_KEY_2",
    "anthropic-3": "FRONTIER_ANTHROPIC_KEY_3",
    "openai-1": "FRONTIER_OPENAI_KEY_1",
    "openai-2": "FRONTIER_OPENAI_KEY_2",
    "openai-3": "FRONTIER_OPENAI_KEY_3",
  };

  return specs
    .filter((s) => !!s.key && s.key.trim() !== "")
    .map((s) => ({
      id: s.id,
      provider: s.provider,
      model: s.model,
      keyEnv: keyEnvByTier[s.id] as string,
      budgetTokens: parseBudget(s.budget),
    }));
}
