# SK-AUTH-006 — Authorization model is Owner / Member / Public — RBAC deferred to Phase 2

- **Decision:** Phase 1 has three roles: **Owner** (full), **Member** (read + query, no destructive ops or key creation), **Public** (anonymous, read-only via publishable key, rate-limited). Fine-grained RBAC ships in Phase 2 only if a paying customer asks twice.
- **Core value:** Simple, Goal-first, Free
- **Why:** Three roles cover every persona in `docs/runbook.md §10`; building an RBAC engine for hypothetical Phase-2 buyers locks code shape we don't yet understand. Two requests from paying customers is a clearer signal than "we'll need it eventually."
- **Consequence in code:** `authz.ts` is a switch on `role ∈ {owner, member, public}`. New roles require a `GLOBAL-NNN` (or feature-local SK-AUTH-NNN) decision and a customer-citation comment.
- **Alternatives rejected:** Full RBAC on day one — premature abstraction; locks data shape. Two roles (owner + public) — Members can't share access to a DB without giving away destructive ops.
- **Source:** docs/architecture.md §4.2
