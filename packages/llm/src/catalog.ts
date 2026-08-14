// SK-PREMIUM-013 (+ SK-PREMIUM-015) — the canonical model catalog. This is the
// SINGLE home for the user-facing model *strings* the picker renders. Per
// SK-PREMIUM-003 (as amended by SK-PREMIUM-013's "Both" resolution) model ids
// live only in `@nlqdb/llm` and never hardcoded in a surface — `apps/web` /
// `cli` / SDK / MCP receive this catalog over the wire (`GET /v1/models`).
//
// SK-PREMIUM-015 turns the frontier picker dynamic: `apps/api` serves the
// catalog built live from models.dev (`buildCatalogFromModelsDev`), so a
// provider shipping a new model shows up without a code change. The constant
// below is the bundled snapshot — the offline fallback served when the
// models.dev fetch fails or is cold (GLOBAL-013: no runtime hard-dependency on
// a third party). The snapshot's ids are real, current values verified against
// models.dev; refresh it occasionally so a cold-cache fallback isn't stale.
//
// Two knobs, per GLOBAL-026 + SK-PREMIUM-003 ("Both"):
//   • presets — the goal-first `auto | fast | best` knob, accepted as the
//     `model` param on `/v1/ask` and routed by `selectDispatchLane`
//     (SK-PREMIUM-014): `fast` pins the free chain, `best` demands a frontier
//     lane (BYOLLM today; hosted premium stays §6-dark) and fails loud when
//     none exists, `auto`/absent keeps the default precedence.
//   • providers — the "advanced" named picker, one row per frontier provider
//     (Claude / GPT / Gemini / Grok / OpenRouter). Each row carries a
//     searchable list of that provider's current models plus its flagship
//     default; every entry is a BYOLLM (bring-your-own-key) model dispatched
//     through the user's own key at 0% markup (GLOBAL-026). `free` is the
//     keyless strict-$0 built-in chain (SK-LLM-003).

export type ModelPreset = "auto" | "fast" | "best";

// Runtime mirror of `ModelPreset` for wire-input validation (the `model`
// param on `/v1/ask`); kept in lockstep with `MODEL_CATALOG.presets` by a
// unit test so the validator and the picker can't drift.
export const MODEL_PRESETS = ["auto", "fast", "best"] as const satisfies readonly ModelPreset[];

export function isModelPreset(value: unknown): value is ModelPreset {
  return typeof value === "string" && (MODEL_PRESETS as readonly string[]).includes(value);
}

export type CatalogPreset = {
  id: ModelPreset;
  label: string;
  description: string;
};

// One selectable model inside a provider row.
export type CatalogModelOption = {
  // Stable picker id, `<provider>:<model>` — the exact two parts the
  // account-store (`POST /v1/keys/byollm`) and the `x-nlq-byollm-key` header
  // lane split back out.
  id: string;
  // Display name as the provider names it (from models.dev `name`).
  label: string;
  // Raw upstream model id the user's key dispatches to (e.g. `claude-sonnet-5`,
  // or `openai/gpt-5.6` for an OpenRouter key).
  model: string;
};

// A frontier provider "row": a brand with its own searchable model list. Every
// model in the row is a BYOLLM entry — selecting one with no stored key opens
// the inline add-key flow.
export type CatalogProvider = {
  // AI Gateway upstream slug == the nlqdb BYOLLM provider slug the dispatch
  // lane needs: `anthropic` | `openai` | `google-ai-studio` | `grok` |
  // `openrouter`. Kept in sync with SUPPORTED_BYOLLM_PROVIDERS (asserted by a
  // test in apps/api).
  provider: string;
  // Brand label the row shows, e.g. "Claude", "GPT", "Gemini".
  label: string;
  // Human provider name for the key copy ("Bring your <keyLabel> key").
  keyLabel: string;
  // Placeholder for the key field, a gentle hint at the key's shape.
  keyPlaceholder: string;
  // The row's default selection — the current flagship (newest) model id.
  defaultModel: string;
  // Selectable models, newest first (the picker filters this list as you type).
  models: CatalogModelOption[];
};

export type ModelCatalog = {
  presets: CatalogPreset[];
  // The keyless built-in strict-$0 chain (SK-LLM-003) — the default row.
  free: { label: string; note: string };
  // BYOLLM provider rows (GLOBAL-026), in display order.
  providers: CatalogProvider[];
};

export const CATALOG_PRESETS: CatalogPreset[] = [
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
];

export const CATALOG_FREE = {
  label: "Free",
  note: "Built-in models — no key needed.",
} as const;

// Presentation metadata for each frontier provider row, in display order. The
// `provider` slug is the AI Gateway upstream slug the BYOLLM lane dispatches
// through (`grok` for xAI, not `xai`; `google-ai-studio` for Gemini). Shared
// by the bundled snapshot below and the live models.dev mapper so the branding
// never drifts between them.
export type ProviderMeta = Omit<CatalogProvider, "defaultModel" | "models">;

export const PROVIDER_META: ProviderMeta[] = [
  { provider: "anthropic", label: "Claude", keyLabel: "Anthropic", keyPlaceholder: "sk-ant-…" },
  { provider: "openai", label: "GPT", keyLabel: "OpenAI", keyPlaceholder: "sk-…" },
  {
    provider: "google-ai-studio",
    label: "Gemini",
    keyLabel: "Google AI Studio",
    keyPlaceholder: "AIza…",
  },
  { provider: "grok", label: "Grok", keyLabel: "xAI", keyPlaceholder: "xai-…" },
  {
    provider: "openrouter",
    label: "OpenRouter",
    keyLabel: "OpenRouter",
    keyPlaceholder: "sk-or-…",
  },
];

// Bundled snapshot models per provider — the offline fallback. Real, current
// models.dev ids (verified 2026-07); the live path replaces these with the
// full, up-to-date list. Newest first; the first entry is the row default.
const SNAPSHOT_MODELS: Record<string, CatalogModelOption[]> = {
  anthropic: [
    { id: "anthropic:claude-sonnet-5", label: "Claude Sonnet 5", model: "claude-sonnet-5" },
    { id: "anthropic:claude-opus-4-8", label: "Claude Opus 4.8", model: "claude-opus-4-8" },
    { id: "anthropic:claude-fable-5", label: "Claude Fable 5", model: "claude-fable-5" },
    { id: "anthropic:claude-haiku-4-5", label: "Claude Haiku 4.5", model: "claude-haiku-4-5" },
  ],
  openai: [
    { id: "openai:gpt-5.6", label: "GPT-5.6", model: "gpt-5.6" },
    { id: "openai:gpt-5.5-pro", label: "GPT-5.5 Pro", model: "gpt-5.5-pro" },
    { id: "openai:gpt-5.5", label: "GPT-5.5", model: "gpt-5.5" },
    { id: "openai:gpt-5.4", label: "GPT-5.4", model: "gpt-5.4" },
  ],
  "google-ai-studio": [
    {
      id: "google-ai-studio:gemini-3.5-flash",
      label: "Gemini 3.5 Flash",
      model: "gemini-3.5-flash",
    },
    {
      id: "google-ai-studio:gemini-3.1-pro-preview",
      label: "Gemini 3.1 Pro Preview",
      model: "gemini-3.1-pro-preview",
    },
    {
      id: "google-ai-studio:gemini-3.1-flash-lite",
      label: "Gemini 3.1 Flash Lite",
      model: "gemini-3.1-flash-lite",
    },
  ],
  grok: [
    { id: "grok:grok-4.5", label: "Grok 4.5", model: "grok-4.5" },
    { id: "grok:grok-4.3", label: "Grok 4.3", model: "grok-4.3" },
  ],
  openrouter: [
    {
      id: "openrouter:anthropic/claude-sonnet-5",
      label: "Claude Sonnet 5",
      model: "anthropic/claude-sonnet-5",
    },
    { id: "openrouter:openai/gpt-5.6", label: "GPT-5.6", model: "openai/gpt-5.6" },
    { id: "openrouter:x-ai/grok-4.5", label: "Grok 4.5", model: "x-ai/grok-4.5" },
    {
      id: "openrouter:deepseek/deepseek-v4-flash",
      label: "DeepSeek V4 Flash",
      model: "deepseek/deepseek-v4-flash",
    },
  ],
};

// Assemble a provider row from its shared metadata + a model list (first entry
// is the flagship default). Reused by the snapshot here and the live mapper.
export function toCatalogProvider(
  meta: ProviderMeta,
  models: CatalogModelOption[],
): CatalogProvider {
  return {
    ...meta,
    defaultModel: models[0]?.model ?? "",
    models,
  };
}

// The bundled snapshot catalog — served by `GET /v1/models` only when the live
// models.dev fetch is unavailable (SK-PREMIUM-015 fallback).
export const MODEL_CATALOG: ModelCatalog = {
  presets: CATALOG_PRESETS,
  free: { label: CATALOG_FREE.label, note: CATALOG_FREE.note },
  providers: PROVIDER_META.map((meta) =>
    toCatalogProvider(meta, SNAPSHOT_MODELS[meta.provider] ?? []),
  ),
};
