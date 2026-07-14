// SK-PREMIUM-015 — serve the model catalog live from models.dev, with the
// bundled `@nlqdb/llm` snapshot as the fallback. The mapping is pure and lives
// in `@nlqdb/llm` (`buildCatalogFromModelsDev`); this module owns the one new
// external call, so it carries its own OTel span (GLOBAL-014) and is edge-cached
// for a day (models.dev changes rarely) — we hit the origin at most ~once/day
// per PoP, and any failure degrades to the snapshot rather than a broken picker.

import {
  buildCatalogFromModelsDev,
  MODEL_CATALOG,
  MODELS_DEV_URL,
  type ModelCatalog,
  type ModelsDevApi,
} from "@nlqdb/llm";
import { SpanStatusCode, trace } from "@opentelemetry/api";

const FETCH_TIMEOUT_MS = 2_500;
const EDGE_CACHE_TTL_S = 86_400; // 1 day

// Fetch + map the models.dev catalog; fall back to the bundled snapshot on any
// error (timeout, non-200, bad JSON, or a mapping that yields nothing).
export async function loadModelCatalog(): Promise<ModelCatalog> {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.models.catalog", async (span) => {
    span.setAttribute("nlqdb.models.source", MODELS_DEV_URL);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(MODELS_DEV_URL, {
        signal: controller.signal,
        cf: { cacheEverything: true, cacheTtl: EDGE_CACHE_TTL_S },
      });
      if (!res.ok) throw new Error(`models.dev responded ${res.status}`);
      const catalog = buildCatalogFromModelsDev((await res.json()) as ModelsDevApi);
      span.setAttribute("nlqdb.models.outcome", "live");
      span.setAttribute("nlqdb.models.provider_count", catalog.providers.length);
      return catalog;
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      span.setAttribute("nlqdb.models.outcome", "fallback");
      return MODEL_CATALOG;
    } finally {
      clearTimeout(timer);
      span.end();
    }
  });
}
