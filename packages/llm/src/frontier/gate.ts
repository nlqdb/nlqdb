// SK-FRONTIER-001 — the outermost hard gate for the founder-funded
// frontier lane. While this constant is `false` the lane is unreachable:
// `selectFrontierLane()` returns `null` on its very first line, BEFORE it
// reads any founder key, env var, or KV pointer — so no founder key can
// be touched, in any environment, by any caller.
//
// This is deliberately a hardcoded module constant, NOT an env var or a
// feature-flag service: enabling the lane is a one-line, code-review-
// visible diff that shows up in a PR, and it is deploy-uniform (the same
// build artifact behaves identically on prod and every preview). An
// env-only switch can be set by accident on a preview or a misconfigured
// deploy and silently burn the metered founder budget; a feature-flag
// service is a network read + dependency for what should be a compile-time
// constant (GLOBAL-013). The constant is the first of three gates
// (constant → KV pointer → eligibility predicate); the inner two only ever
// run when this one is already `true`.
//
// SHIPPED VALUE MUST STAY `false`. Flipping it to `true` is the final,
// founder-only step of the frontier-keys feature (see
// docs/features/frontier-keys/FEATURE.md progress tracker).
export const HAS_FRONTIER_API_KEYS = false;
