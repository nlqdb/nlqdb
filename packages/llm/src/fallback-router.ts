// SK-PREMIUM-020 — handler-level lane fallback for the hosted-premium router.
//
// A paid user's `/v1/ask` runs its whole pipeline (route → plan → summarize) on
// the gateway-only premium lane (`buildPremiumRouter`, deliberately no in-router
// hedge/failover per SK-LLM-016). The free chain, by contrast, carries a direct
// (non-gateway) tail (SK-LLM-047), so it survives an AI-Gateway fault that takes
// the premium lane down. Left un-guarded, that asymmetry produces the absurd bug
// this fixes: a *paying* customer gets `llm_failed` on the very same gateway
// fault a *free* user sails through.
//
// `withFallbackRouter` wraps the premium router so that, when a premium op
// throws, the free chain answers instead. Distinctions that keep this honest:
//   • It is a LANE fallback, not an in-router provider failover — the premium
//     router itself stays fail-loud with no internal hedge (SK-LLM-016).
//   • It is never silent (GLOBAL-023): `onFallback` fires so the caller stamps
//     the span + response trace and logs the underlying error loudly.
//   • It is unmetered and never charged: the free leg never fires the premium
//     `onUsage` sink, so a fallback serve consumes no allowance slot and bills
//     nothing — exactly like a plan-cache hit (SK-PREMIUM-007).
//   • A caller-initiated cancel is re-thrown, not treated as a premium failure —
//     an aborted request must not silently re-run on the free chain.
//   • SK-LLM-051: an `auth_denied` is re-thrown too. This lane guards against a
//     gateway *fault*, not against rejected credentials — masking those would
//     hide a dead paid lane behind an answer that looks fine.

import type { LLMRouter } from "./router.ts";
import { AllProvidersFailedError } from "./router.ts";
import { type CallOpts, type LLMOperation, ProviderError } from "./types.ts";

// SK-LLM-051 — a *credential* denial is not the gateway fault this lane
// fallback exists for. Serving a paid user off the free chain because our
// premium credentials are rejected hides a billing-side outage behind a
// working-looking answer, and the user never learns their paid lane is dead.
// Fail loud instead: the response names `llm_failed × auth_denied × premium`.
function isAuthDenied(err: unknown): boolean {
  if (err instanceof ProviderError) return err.reason === "auth_denied";
  if (err instanceof AllProvidersFailedError) {
    return err.attempts.some((a) => a.reason === "auth_denied");
  }
  return false;
}

export function withFallbackRouter(
  primary: LLMRouter,
  fallback: LLMRouter,
  onFallback: (op: LLMOperation, err: unknown) => void,
): LLMRouter {
  function guard<Req, Res>(
    op: LLMOperation,
    prim: (req: Req, opts?: CallOpts) => Promise<Res>,
    fb: (req: Req, opts?: CallOpts) => Promise<Res>,
  ): (req: Req, opts?: CallOpts) => Promise<Res> {
    return async (req, opts) => {
      try {
        return await prim(req, opts);
      } catch (err) {
        // A caller-side cancel is not a premium failure — don't burn a second
        // (free) round-trip the caller no longer wants.
        if (opts?.signal?.aborted) throw err;
        if (isAuthDenied(err)) throw err;
        onFallback(op, err);
        return fb(req, opts);
      }
    };
  }
  return {
    route: guard("route", primary.route.bind(primary), fallback.route.bind(fallback)),
    plan: guard("plan", primary.plan.bind(primary), fallback.plan.bind(fallback)),
    summarize: guard(
      "summarize",
      primary.summarize.bind(primary),
      fallback.summarize.bind(fallback),
    ),
    schemaInfer: guard(
      "schema_infer",
      primary.schemaInfer.bind(primary),
      fallback.schemaInfer.bind(fallback),
    ),
    engineClassify: guard(
      "engine_classify",
      primary.engineClassify.bind(primary),
      fallback.engineClassify.bind(fallback),
    ),
  };
}
