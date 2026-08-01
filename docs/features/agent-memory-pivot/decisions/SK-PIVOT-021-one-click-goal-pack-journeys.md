# SK-PIVOT-021 — Every goal pack ships as a one-click product journey on one shared runner

- **Decision:** A goal pack is complete only when its recipe can be run through
  a world-class product journey, not merely installed as a skill. Every pack
  uses one shared pack runner: one primary CTA; intent-preserving sign-in and
  source-authorization redirects that resume automatically; the least
  permission necessary at the moment it is necessary; honest progress in
  source items and memory writes; persistent, inspectable results; and
  proportionate reset/delete. Pack-specific additions remain the
  `SK-PIVOT-018` recipe, seed entities and golden queries—never a bespoke
  endpoint, schema, or app.
- **Core value:** Effortless UX, Goal-first, Seamless auth, Honest latency,
  Bullet-proof
- **Why:** A prompt artifact proves that nlqdb can support a workload, but it
  leaves setup, credentials, resumability, progress and recovery to the user.
  That is not a useful product experience and will not activate a non-expert.
  The shared runner turns each pack into immediate value while preserving the
  architectural advantage of `SK-PIVOT-018`: the next pack is authored as
  declarative judgment, not rebuilt as another vertical SaaS. “One click”
  means one nlqdb action; unavoidable identity or provider-consent actions are
  allowed, but no nlqdb handoff may lose state or ask the user to repeat input.
- **Consequence in code:** A pack definition supplies its source adapter,
  extraction categories, skip rules, memory mapping, golden queries and result
  examples to one runner. The runner owns the state machine and resumable URL:
  inspect source → show useful preflight → authenticate only before persistence
  → authorize a private source only when anonymous/read-only access cannot
  work → provision an isolated memory DB → extract/write/verify → show durable
  proof and cleanup. Progress reports real totals and named phases; it never
  invents percentages. Every pack adds a persona E2E journey covering auth
  return, permission denial, interruption/resume, partial failure, completion
  and cleanup, plus a production-shaped owner walkthrough before leaving
  alpha. A reviewer rejects a pack whose only user experience is “install this
  skill,” whose redirects discard state, or whose progress is an indefinite
  spinner.
- **Alternatives rejected:** **Skill-only packs** — expert-accessible but
  outsource the entire onboarding journey. · **A bespoke app per pack** —
  repeats auth, source, progress and cleanup mechanics and recreates the
  per-vertical explosion `SK-PIVOT-018` rejects. · **Require every account and
  source connection up front** — violates `GLOBAL-007`, requests unnecessary
  access for public sources, and delays the first useful evidence. · **Fake
  one-click by hiding work behind a spinner** — fast-looking but untrustworthy
  and unrecoverable.
