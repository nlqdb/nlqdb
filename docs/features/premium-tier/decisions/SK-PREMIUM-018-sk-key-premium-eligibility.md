# SK-PREMIUM-018 — Hosted-premium eligibility extends to `sk_live_` / `sk_mcp_`; `pk_live_` stays excluded

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Widens the
[`SK-PREMIUM-009`](./SK-PREMIUM-009-hosted-premium-meter.md) lane's principal
set and closes the "session-`user` only" parked gap in that feature's Open
questions.

- **Decision:** The `/v1/ask` hosted-premium lane is eligible for three
  principal kinds — session `user`, `sk_live_`, and `sk_mcp_` — instead of the
  session-only gate it shipped with. `pk_live_` is **excluded**, and `anon` has
  no account. A paying customer's SDK / CLI / MCP traffic (which carries an
  `sk_*` bearer, not a cookie) now reaches the same paid chain a browser session
  does. The kind gate is the single pure predicate
  `isPremiumEligiblePrincipalKind(principal.kind)`; the paid-status,
  configured-live, allowance, overflow, and per-key spend-cap checks are
  unchanged and still bound an eligible caller.
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** An `sk_*` key's `tenant_id` **is** the account user id
  (`SK-APIKEYS-001` / `principal.ts`), so the exact `customers JOIN user`
  paid-status lookup the session path runs resolves an `sk_*` caller with no new
  plumbing — leaving those callers on the free chain was an accident of the
  first slice metering only cookie sessions, not a decision. `pk_live_` is the
  one kind that must stay out: it is a browser-exposed publishable key
  (`SK-APIKEYS-003`), so a drive-by page embedding someone's `pk` could spend
  their premium allowance from the open internet — the wrong blast radius for a
  paid lane. Cost is already bounded for the admitted kinds by the per-key spend
  cap (`SK-PREMIUM-006`), so no new cost-control primitive is needed.
- **Consequence in code:** `isPremiumEligiblePrincipalKind` lives in
  `apps/api/src/billing/premium/index.ts` next to `resolvePremiumEligibility`;
  `/v1/ask` calls it in place of the inline `principal.kind === "user"` guard on
  the premium block. The `customers` lookup keys on `principal.id` (the tenant
  user id for `sk_*`) unchanged. `pk_live_` / `anon` return `false`, so the
  block stays a provable no-op for them. Account-stored BYOLLM (`accountCredential`)
  remains session-only this slice — an `sk_*` caller reaches premium unless it
  passes a per-request BYOLLM header (which `sk_*` may not — it's session-gated),
  so header/account BYOLLM precedence (`GLOBAL-026`) is preserved.
- **Alternatives rejected:**
  - **Admit `pk_live_` too** — a publishable key is meant to sit in shipped
    front-end code; premium routing on it turns any embed into an
    allowance-draining endpoint. Rejected on blast radius.
  - **Account-wide premium flag for `sk_*` callers** — collapses to the
    account-level toggle `SK-PREMIUM-001` refuses (a CI key silently billing
    frontier tokens). Eligibility stays keyed on the (account paid-status,
    principal kind, per-key cap) triple.
- **Source:** SK-PREMIUM-001 · SK-PREMIUM-006 · SK-PREMIUM-009 · SK-APIKEYS-001 ·
  SK-APIKEYS-003 · GLOBAL-026
