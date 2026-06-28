// SK-FRONTIER-004 — the exclusion predicate. Even when
// `HAS_FRONTIER_API_KEYS` is `true`, the lane is disabled for any traffic
// that is NOT a genuine production end-user: CI, preview branches, and
// synthetic test agents generate the bulk of pre-PMF request volume, and
// letting any of them spend the metered founder keys would drain the
// budget on traffic with zero user value. This is the third gate (after
// the hardcoded constant + the KV pointer) and is the one that makes
// "enable in prod" safe even though preview shares the production build
// artifact.
//
// Pure — `apps/api` resolves each signal (from `env.ENVIRONMENT`, the
// Cloudflare Versions-preview marker, the resolved principal, and the e2e
// header) and this just applies the rule, so the exclusion can't drift
// between call sites.

export type FrontierEligibilityCtx = {
  // `env.ENVIRONMENT` — must be exactly `"production"` to be eligible.
  environment: string;
  // True for Cloudflare Workers Versions previews (the same build artifact
  // running on a non-prod URL).
  isPreview: boolean;
  // The resolved principal's kind (`anon | user | pk_live | sk_live |
  // sk_mcp`, plus any synthetic-walker marker). Test/synthetic kinds are
  // excluded — see `TEST_PRINCIPAL_KINDS`.
  principalKind: string;
  // The e2e marker (`x-nlqdb-e2e` header / e2e bearer) — true ⇒ an e2e
  // test flow, never eligible.
  e2e: boolean;
};

// Principal kinds that are test / synthetic and must never spend founder
// budget: the MCP-host / synthetic-walker key (`sk_mcp`, used by the
// stranger-test / opencheck walkers per the FEATURE.md), plus explicit
// `"e2e"` / `"test"` markers should a future principal resolver emit them.
// Real end-user kinds (`user`, `sk_live`, `pk_live`, `anon`) are absent, so
// they pass this check. `sk_mcp` is excluded because the synthetic walkers
// authenticate as it; if a genuine human MCP user must be distinguished
// from a walker later, split the kind rather than loosening this set.
export const TEST_PRINCIPAL_KINDS: ReadonlySet<string> = new Set(["sk_mcp", "e2e", "test"]);

// Returns true only for genuine production end-user traffic. Any of:
// non-production environment, a preview deploy, an e2e flow, or a
// test/synthetic principal ⇒ false (lane disabled).
export function isFrontierEligible(ctx: FrontierEligibilityCtx): boolean {
  if (ctx.environment !== "production") return false;
  if (ctx.isPreview) return false;
  if (ctx.e2e) return false;
  if (TEST_PRINCIPAL_KINDS.has(ctx.principalKind)) return false;
  return true;
}
