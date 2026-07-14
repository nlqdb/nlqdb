// SK-PREMIUM-015 — the models.dev source for the frontier picker. models.dev
// (https://models.dev, MIT, no API key) is an open, community-maintained
// database of AI-model specs; its `api.json` is keyed by provider and lists
// each model's id, display name, release date, and capability flags. We map
// the handful of providers our BYOLLM lane can dispatch (Claude / GPT / Gemini
// / Grok / OpenRouter) into the wire catalog, so a new frontier model appears
// in the picker without a code change.
//
// This module is pure + I/O-free: `buildCatalogFromModelsDev` takes an already
// fetched `api.json` object and returns a `ModelCatalog`. apps/api owns the
// fetch, the edge cache, the timeout, and the OTel span (GLOBAL-014), and falls
// back to the bundled `MODEL_CATALOG` snapshot when the fetch is unavailable.

import {
  CATALOG_FREE,
  CATALOG_PRESETS,
  type CatalogModelOption,
  type CatalogProvider,
  MODEL_CATALOG,
  type ModelCatalog,
  PROVIDER_META,
  toCatalogProvider,
} from "./catalog.ts";

export const MODELS_DEV_URL = "https://models.dev/api.json";

// The minimal slice of a models.dev model entry we read. models.dev carries
// far more (cost, context limits, knowledge cutoff, …); we only need identity +
// the two capability flags that decide whether a model belongs in the picker.
export type ModelsDevModel = {
  id?: string;
  name?: string;
  release_date?: string;
  tool_call?: boolean;
  open_weights?: boolean;
  modalities?: { input?: string[]; output?: string[] };
};

export type ModelsDevProvider = { models?: Record<string, ModelsDevModel> };
export type ModelsDevApi = Record<string, ModelsDevProvider>;

// How each catalog provider maps onto a models.dev provider id, plus how many
// models to surface. `sourceId` differs from our slug where the vendor and the
// AI Gateway disagree: models.dev calls xAI `xai` (we dispatch it as `grok`)
// and Gemini `google` (we dispatch it as `google-ai-studio`).
type ProviderSource = {
  provider: string; // our slug (matches PROVIDER_META)
  sourceId: string; // models.dev provider id
  cap: number; // max models to surface for this row
};

const PROVIDER_SOURCES: ProviderSource[] = [
  { provider: "anthropic", sourceId: "anthropic", cap: 12 },
  { provider: "openai", sourceId: "openai", cap: 12 },
  { provider: "google-ai-studio", sourceId: "google", cap: 12 },
  { provider: "grok", sourceId: "xai", cap: 8 },
  // OpenRouter is an aggregator — its value is breadth, so surface a larger
  // (searchable) set. Capped to keep the wire payload bounded.
  { provider: "openrouter", sourceId: "openrouter", cap: 100 },
];

// Model ids that are clearly not general chat/tool models. `tool_call` +
// text-output already exclude most (image/audio/embedding models), so this is a
// light extra guard for the few that slip through.
const EXCLUDE_ID =
  /realtime|whisper|tts|embed|moderation|transcrib|imagen|-image|ocr|rerank|guard/i;

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Map one models.dev provider's models into ranked catalog options: current,
// tool-capable, text-output models, newest first. OpenRouter keeps open-weights
// models (its whole point) but drops ids with a `:` variant suffix, which the
// `<provider>:<model>:<key>` header format can't round-trip; the direct labs
// drop open-weights models (those belong to the free chain, not a
// bring-your-frontier-key row).
function mapProviderModels(
  src: ProviderSource,
  provider: ModelsDevProvider | undefined,
): CatalogModelOption[] {
  const isOpenRouter = src.sourceId === "openrouter";
  return Object.values(provider?.models ?? {})
    .filter((m): m is ModelsDevModel & { id: string } => typeof m.id === "string" && m.id !== "")
    .filter((m) => m.tool_call === true)
    .filter((m) => m.modalities?.output?.includes("text") ?? false)
    .filter((m) => !EXCLUDE_ID.test(m.id))
    .filter((m) => (isOpenRouter ? !m.id.includes(":") : m.open_weights !== true))
    .sort((a, b) => compare(b.release_date ?? "", a.release_date ?? "") || compare(a.id, b.id))
    .slice(0, src.cap)
    .map((m) => ({ id: `${src.provider}:${m.id}`, label: m.name ?? m.id, model: m.id }));
}

// Build the wire catalog from a fetched models.dev `api.json`. Presets and the
// free row are static; each provider row is derived from the data, falling back
// to the bundled snapshot row for any provider models.dev didn't return (so the
// picker never shows an empty provider).
export function buildCatalogFromModelsDev(raw: ModelsDevApi): ModelCatalog {
  const bySlug = new Map(PROVIDER_SOURCES.map((s) => [s.provider, s]));
  const snapshotBySlug = new Map(MODEL_CATALOG.providers.map((p) => [p.provider, p]));

  const providers: CatalogProvider[] = PROVIDER_META.map((meta) => {
    const src = bySlug.get(meta.provider);
    const models = src ? mapProviderModels(src, raw[src.sourceId]) : [];
    if (models.length === 0) {
      // Nothing usable from models.dev for this row — keep the snapshot row.
      return snapshotBySlug.get(meta.provider) ?? toCatalogProvider(meta, []);
    }
    return toCatalogProvider(meta, models);
  });

  return {
    presets: CATALOG_PRESETS,
    free: { label: CATALOG_FREE.label, note: CATALOG_FREE.note },
    providers,
  };
}
