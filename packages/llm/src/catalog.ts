// SK-PREMIUM-013 — the canonical model catalog. This is the SINGLE home
// for the user-facing model *strings* the picker renders. Per SK-PREMIUM-003
// (as amended by SK-PREMIUM-013's "Both" resolution) model ids live only in
// `@nlqdb/llm` and never hardcoded in a surface — `apps/web` / `cli` / SDK /
// MCP receive this catalog over the wire (`GET /v1/models`), so a provider's
// new model is a one-line edit here, not a customer-code change, and the
// "no model string in a surface file" test stays green.
//
// Two knobs, per GLOBAL-026 + SK-PREMIUM-003 ("Both"):
//   • presets — the goal-first `auto | fast | best` knob, accepted as the
//     `model` param on `/v1/ask` and routed by `selectDispatchLane`
//     (SK-PREMIUM-014): `fast` pins the free chain, `best` demands a
//     frontier lane (BYOLLM today; hosted premium stays §6-dark) and
//     fails loud when none exists, `auto`/absent keeps the default
//     precedence.
//   • models  — the "advanced" named picker. `free` is the strict-$0 chain;
//     each frontier entry is a BYOLLM (bring-your-own-key) model pinned to
//     an AI-Gateway compat provider. Selecting one with no stored key drives
//     the inline add-key flow (`needsKey: true`); the "subscribe" door
//     (hosted-premium credits) is surfaced by the picker as "coming soon".

export type ModelPreset = "auto" | "fast" | "best";

// Runtime mirror of `ModelPreset` for wire-input validation (the `model`
// param on `/v1/ask`); kept in lockstep with `MODEL_CATALOG.presets` by a
// unit test so the validator and the picker can't drift.
export const MODEL_PRESETS = ["auto", "fast", "best"] as const satisfies readonly ModelPreset[];

export function isModelPreset(value: unknown): value is ModelPreset {
  return typeof value === "string" && (MODEL_PRESETS as readonly string[]).includes(value);
}

// Which dispatch lane an entry resolves to (mirrors DispatchLane in
// byollm-dispatch.ts; `premium` entries are §6-dark today so none ship).
export type ModelLane = "free" | "byollm" | "premium";

export type CatalogPreset = {
  id: ModelPreset;
  label: string;
  description: string;
};

export type CatalogModel = {
  // Stable picker id. `free` for the built-in chain; `<provider>:<model>`
  // for a BYOLLM frontier entry — the exact two parts the account-store
  // (`POST /v1/keys/byollm`) and the `x-nlq-byollm-key` header lane need.
  id: string;
  label: string;
  lane: ModelLane;
  // Present for `lane: "byollm"`: the AI-Gateway compat provider slug and
  // the raw upstream model id the user's key dispatches to. Kept in sync
  // with SUPPORTED_BYOLLM_PROVIDERS (asserted by a test in apps/api).
  provider?: string;
  model?: string;
  // True when the entry needs the caller's own provider key. The picker
  // shows a gentle "bring your key" label and opens the inline key form
  // rather than switching immediately.
  needsKey: boolean;
  // One-line UX note the picker renders under the label.
  note?: string;
};

export type ModelCatalog = {
  presets: CatalogPreset[];
  models: CatalogModel[];
};

// The curated frontier set the picker offers. Model ids are the repo's own
// canonical, verified values: Anthropic per frontier/tiers.ts
// (ANTHROPIC_MODEL_DEFAULTS), OpenAI per the frontier-keys FEATURE.md
// P2-verification (2026-07-03), Gemini per architecture §8's model catalog.
// "A few frontier models we keep up to date" — bump ids here as providers
// ship; surfaces need no change.
export const MODEL_CATALOG: ModelCatalog = {
  presets: [
    {
      id: "auto",
      label: "Auto",
      description:
        "We pick — the free chain for most asks, a stronger model only when a question is hard.",
    },
    {
      id: "fast",
      label: "Fast",
      description: "Always the free built-in chain. Cheapest and quickest.",
    },
    {
      id: "best",
      label: "Best",
      description: "Always a frontier model. Needs your own key (BYOLLM) or a paid plan.",
    },
  ],
  models: [
    {
      id: "free",
      label: "Free",
      lane: "free",
      needsKey: false,
      note: "Built-in models — no key needed.",
    },
    {
      id: "anthropic:claude-opus-4-8",
      label: "Claude Opus 4.8",
      lane: "byollm",
      provider: "anthropic",
      model: "claude-opus-4-8",
      needsKey: true,
      note: "Bring your Anthropic key",
    },
    {
      id: "anthropic:claude-sonnet-4-6",
      label: "Claude Sonnet 4.6",
      lane: "byollm",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      needsKey: true,
      note: "Bring your Anthropic key",
    },
    {
      id: "openai:gpt-5.5",
      label: "GPT-5.5",
      lane: "byollm",
      provider: "openai",
      model: "gpt-5.5",
      needsKey: true,
      note: "Bring your OpenAI key",
    },
    {
      id: "google-ai-studio:gemini-2.5-pro",
      label: "Gemini 2.5 Pro",
      lane: "byollm",
      provider: "google-ai-studio",
      model: "gemini-2.5-pro",
      needsKey: true,
      note: "Bring your Google AI Studio key",
    },
  ],
};
