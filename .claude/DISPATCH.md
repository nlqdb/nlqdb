# Wave 2 — Cold-Agent Dispatch

This file contains copy-pasteable prompts for the parallel cold subagents
that populate the skill stubs landed in wave 1. Each prompt is **fully
self-contained** — a fresh agent with no prior context can act on it
correctly.

The dispatch model: **one agent per `SKILL.md`**. They never touch the
same file. Merges are trivial. If one agent fails (streaming timeout,
partial response), retry only that one — the others are unaffected.

## Section index (so you can dispatch by number)

| # | Skill | Status |
|---|---|---|
| 1 | `auth` | implemented |
| 2 | `api-keys` | implemented |
| 3 | `ask-pipeline` | implemented |
| 4 | `plan-cache` | implemented |
| 5 | `llm-router` | implemented |
| 6 | `sql-allowlist` | implemented |
| 7 | `db-adapter` | implemented |
| 8 | `schema-widening` | implemented |
| 9 | `idempotency` | implemented |
| 10 | `observability` | implemented |
| 11 | `stripe-billing` | implemented |
| 12 | `events-pipeline` | implemented |
| 13 | `rate-limit` | implemented |
| 14 | `cli` | implemented |
| 15 | `elements` | implemented |
| 16 | `sdk` | implemented |
| 17 | `mcp-server` | implemented |
| 18 | `web-app` | implemented |
| 19 | `anonymous-mode` | partial |
| 20 | `engine-migration` | planned, Phase 3 |
| 21 | `multi-engine-adapter` | planned, Phase 3 |

To dispatch cold agent N, copy the section starting at `## N. SKILL · …`
along with the **shared preamble** (just below) into a fresh agent.

---

## How to use this file

1. Pick a section below (e.g. `## 1. SKILL · auth`).
2. Open a fresh Claude Code session (or `Agent` subagent) on a clean
   working tree synced to the foundation PR's merge commit.
3. Paste the prompt as the first user message.
4. The agent will edit exactly one file, commit, and push.

If you launch them in parallel (recommended), give each its own branch
named `claude/wave2-skill-<feature>` so they don't fight over the
working tree.

## What every cold agent must follow (preamble for every prompt)

The same rules apply to every wave-2 agent. Each prompt below assumes
this preamble is read first:

```
You are a cold subagent populating ONE skill file in the nlqdb repo.

Mandatory pre-reads (in order):
  1. AGENTS.md (root)               — three behavioral principles
  2. docs/skill-conventions.md      — the SKILL.md template, ID rules,
                                      decision-block format, quality gates
  3. docs/decisions.md              — every GLOBAL-NNN block (you may
                                      need to copy some of these verbatim)
  4. The source ranges named in your prompt (sections of docs/design.md,
                                      docs/implementation.md, docs/plan.md,
                                      docs/runbook.md)

Do NOT touch any file other than your assigned SKILL.md unless your
prompt explicitly authorizes it.

Behavioral principles (from root AGENTS.md):
  P1. Never contradict a documented decision silently. If a source
      passage seems to disagree with a GLOBAL-NNN, surface it as an
      Open Question in the skill — do not "resolve" it on your own.
  P2. On any ambiguity, web-research current best practices first.
      Cite sources in commit message or Open Questions.
  P3. Decisions stay in sync. If you find a decision that affects
      multiple features, copy it verbatim into every relevant SKILL.md
      with a Source: line back to docs/decisions.md or the canonical
      SKILL.md (per skill-conventions.md §5). For wave-2, this means:
      if your skill is affected by GLOBAL-NNN listed in your prompt,
      copy the GLOBAL block into your skill verbatim.

Quality gates (run before commit):
  1. Every decision (GLOBAL or SK-*) has all five fields:
     Decision / Core value / Why / Consequence / Alternatives.
  2. Every decision cites at least one core value by name from
     docs/design.md §0 (Free, Open source, Simple, Effortless UX,
     Seamless auth, Fast, Creative, Goal-first, Bullet-proof,
     Honest latency).
  3. Every duplicated GLOBAL-NNN carries a Source: line:
       Source: docs/decisions.md#GLOBAL-NNN
  4. when-to-load.globs in the frontmatter point at real paths in
     the repo.
  5. The frontmatter description is one sentence Claude can use to
     decide when to load the skill.

Workflow:
  1. Create a branch: claude/wave2-skill-<feature>
  2. Edit ONLY .claude/skills/<feature>/SKILL.md
  3. Commit with message:
       skills(<feature>): populate decisions from docs/* (wave 2)

       Adds SK-<PREFIX>-NNN decisions extracted from <sources>.
       Copies GLOBAL-NNN blocks affecting this feature.

       https://claude.ai/code/session_<id>
  4. Push the branch.
  5. Do NOT open a PR — the foundation PR is already open and the
     wave-2 branches will be merged into it (or fast-forwarded onto
     main) by the human dispatcher.
```

---

## 1. SKILL · auth

**Branch:** `claude/wave2-skill-auth`
**File:** `.claude/skills/auth/SKILL.md`
**SK prefix:** `SK-AUTH-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-008`, `GLOBAL-009`, `GLOBAL-018`,
`GLOBAL-007` (anonymous-mode interaction).

**Source ranges (read fully before writing):**
- `docs/design.md` — search for "Better Auth", "session", "device flow",
  "magic-link", any auth-mode discussion.
- `docs/implementation.md` — every slice header that mentions auth.
- `docs/runbook.md` §5 (auth setup, secrets) and any "GitHub OAuth" section.
- `docs/plan.md` — phasing of auth features.

**Extract every decision** about: identity model, sign-in methods, session
storage, refresh policy, device-flow steps, key custody, GitHub/Google
OAuth choice, anonymous-mode handoff. Each becomes an `SK-AUTH-NNN`
block (or, if it's already in `decisions.md`, a copy of the relevant
`GLOBAL-NNN`).

---

## 2. SKILL · api-keys

**Branch:** `claude/wave2-skill-api-keys`
**File:** `.claude/skills/api-keys/SKILL.md`
**SK prefix:** `SK-APIKEYS-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-010`, `GLOBAL-018`, `GLOBAL-008`.

**Source ranges:**
- `docs/design.md` — "API keys", "host-scoped keys", "MCP".
- `docs/implementation.md` — api-keys slice.
- `docs/runbook.md` — key rotation / revocation procedures.

Extract decisions about: key format, scope (per-host vs per-user),
storage, rotation, revocation propagation, env-var fallback.

---

## 3. SKILL · ask-pipeline

**Branch:** `claude/wave2-skill-ask-pipeline`
**File:** `.claude/skills/ask-pipeline/SKILL.md`
**SK prefix:** `SK-ASK-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-005`, `GLOBAL-006`, `GLOBAL-011`,
`GLOBAL-014`, `GLOBAL-015`, `GLOBAL-017`.

**Source ranges:**
- `docs/design.md` §4 (the entire ask pipeline section).
- `docs/implementation.md` — every ask-related slice.
- `docs/performance.md` §3 (spans/metrics emitted by the pipeline).

Extract decisions about: the canonical step order (rate-limit → cache
→ router → allowlist → exec → summary), failure modes, partial
results, streaming semantics, anonymous-mode rate-limit tier.

---

## 4. SKILL · plan-cache

**Branch:** `claude/wave2-skill-plan-cache`
**File:** `.claude/skills/plan-cache/SKILL.md`
**SK prefix:** `SK-PLAN-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-006`, `GLOBAL-004` (interaction
with schema widening).

**Source ranges:**
- `docs/design.md` §4.3.
- `docs/implementation.md` — plan-cache slice.

Extract: storage backend, key construction, eviction policy (or its
absence), pinning, cache-warming, observability counters.

---

## 5. SKILL · llm-router

**Branch:** `claude/wave2-skill-llm-router`
**File:** `.claude/skills/llm-router/SKILL.md`
**SK prefix:** `SK-LLM-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-014` (spans on every LLM call),
`GLOBAL-013` (cost), `GLOBAL-016` (dependency choices for SDKs).

**Source ranges:**
- `docs/design.md` §5.
- `docs/implementation.md` — llm slice.
- `docs/llm-credits-plan.md` — full file.

Extract: model selection rules, fallback chain, prompt templates and
their version pinning, per-user credit accounting, cost ceilings.

---

## 6. SKILL · sql-allowlist

**Branch:** `claude/wave2-skill-sql-allowlist`
**File:** `.claude/skills/sql-allowlist/SKILL.md`
**SK prefix:** `SK-SQLAL-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-015` (escape hatch for power users —
note the interaction with allowlist).

**Source ranges:**
- `docs/design.md` §4.5.
- `docs/implementation.md` — sql-allowlist slice.
- `apps/api/src/ask/sql-validate.ts` (read the implementation; decisions
  the code embodies but the docs may not yet name).

Extract: which SQL constructs are allowed, how `WHERE` is enforced,
how parameters are extracted, how multi-statement queries are rejected.

---

## 7. SKILL · db-adapter

**Branch:** `claude/wave2-skill-db-adapter`
**File:** `.claude/skills/db-adapter/SKILL.md`
**SK prefix:** `SK-DB-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-004`, `GLOBAL-014`, `GLOBAL-015`.

**Source ranges:**
- `docs/design.md` §6.
- `docs/implementation.md` — db slice.
- `docs/runbook.md` §6.

Extract: the engine-agnostic interface contract, Phase 0 Postgres
specifics, connection pooling, transaction semantics.

---

## 8. SKILL · schema-widening

**Branch:** `claude/wave2-skill-schema-widening`
**File:** `.claude/skills/schema-widening/SKILL.md`
**SK prefix:** `SK-SCHEMA-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-004` (canonical here as the
defining GLOBAL), `GLOBAL-006`.

**Source ranges:**
- `docs/design.md` §6.2.
- `docs/implementation.md` — schema slice.

Extract: hash construction, what widening triggers, how vanished fields
are handled, replanning policy.

---

## 9. SKILL · idempotency

**Branch:** `claude/wave2-skill-idempotency`
**File:** `.claude/skills/idempotency/SKILL.md`
**SK prefix:** `SK-IDEMP-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-005` (canonical here).

**Source ranges:**
- `docs/design.md` §7.
- `docs/implementation.md` — idempotency middleware slice.

Extract: header name, dedupe-store backend + TTL, response storage
format, request-body hashing, what "byte-exact response" means.

---

## 10. SKILL · observability

**Branch:** `claude/wave2-skill-observability`
**File:** `.claude/skills/observability/SKILL.md`
**SK prefix:** `SK-OBS-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-014` (canonical here), `GLOBAL-011`.

**Source ranges:**
- `docs/performance.md` (entire file — §3 catalog is the heart of this skill).
- `docs/design.md` — any observability section.

Extract: span name conventions, attribute names, metric names, label
cardinality rules, where exporters write to, sampling.

---

## 11. SKILL · stripe-billing

**Branch:** `claude/wave2-skill-stripe-billing`
**File:** `.claude/skills/stripe-billing/SKILL.md`
**SK prefix:** `SK-STRIPE-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-005`, `GLOBAL-013`, `GLOBAL-014`.

**Source ranges:**
- `docs/design.md` — billing section.
- `docs/implementation.md` — stripe slice.
- `docs/runbook.md` — stripe section (webhook secrets, R2 archive).

Extract: webhook signature verification, idempotency on Stripe events,
subscription state machine, R2 archival format, dunning behaviour.

---

## 12. SKILL · events-pipeline

**Branch:** `claude/wave2-skill-events-pipeline`
**File:** `.claude/skills/events-pipeline/SKILL.md`
**SK prefix:** `SK-EVENTS-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-005` (events are mutations
from the producer's perspective), `GLOBAL-014`.

**Source ranges:**
- `docs/design.md` — events section.
- `docs/implementation.md` — events slice.
- `docs/runbook.md` — events-worker setup.

Extract: queue choice, message shape, sink contract, retry/DLQ
behaviour, fire-and-forget guarantee.

---

## 13. SKILL · rate-limit

**Branch:** `claude/wave2-skill-rate-limit`
**File:** `.claude/skills/rate-limit/SKILL.md`
**SK prefix:** `SK-RL-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-002` (X-RateLimit-* parity),
`GLOBAL-007` (anonymous tier).

**Source ranges:**
- `docs/design.md` — rate-limit section.
- `docs/implementation.md` — rate-limit slice.

Extract: tiers (anonymous / free / paid), window/algorithm, headers
returned, behaviour at the boundary.

---

## 14. SKILL · cli

**Branch:** `claude/wave2-skill-cli`
**File:** `.claude/skills/cli/SKILL.md`
**SK prefix:** `SK-CLI-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-001`, `GLOBAL-002`, `GLOBAL-010`,
`GLOBAL-011`, `GLOBAL-012`, `GLOBAL-017`, `GLOBAL-020`.

**Source ranges:**
- `docs/design.md` — cli section.
- `docs/surfaces.md` — full file.
- `docs/implementation.md` — cli slice.

Extract: verb surface (must include `ask`, `run`, `login`, `mcp install`,
`init`), TTY trace rendering, exit codes, env-var contract.

---

## 15. SKILL · elements

**Branch:** `claude/wave2-skill-elements`
**File:** `.claude/skills/elements/SKILL.md`
**SK prefix:** `SK-ELEM-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-001`, `GLOBAL-002`, `GLOBAL-013`.

**Source ranges:**
- `docs/design.md` — elements section.
- `docs/surfaces.md`.
- `packages/elements/README.md`.

Extract: web-component name(s), attribute contract, theming approach,
SSR posture, framework-free guarantee.

---

## 16. SKILL · sdk

**Branch:** `claude/wave2-skill-sdk`
**File:** `.claude/skills/sdk/SKILL.md`
**SK prefix:** `SK-SDK-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-001` (canonical here as the
defining GLOBAL), `GLOBAL-002`, `GLOBAL-005`, `GLOBAL-009`,
`GLOBAL-012`, `GLOBAL-014`.

**Source ranges:**
- `docs/design.md` — sdk section.
- `docs/surfaces.md`.
- `packages/sdk/README.md`.

Extract: cookie vs bearer auth selection, fetch-wrapper API, typed
errors, retry+refresh logic, telemetry hooks, bundle-size budget.

---

## 17. SKILL · mcp-server

**Branch:** `claude/wave2-skill-mcp-server`
**File:** `.claude/skills/mcp-server/SKILL.md`
**SK prefix:** `SK-MCP-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-001`, `GLOBAL-002`, `GLOBAL-008`,
`GLOBAL-010`, `GLOBAL-017`.

**Source ranges:**
- `docs/design.md` — mcp section.
- `docs/surfaces.md`.
- `docs/implementation.md` — mcp slice.

Extract: tool definitions, host detection algorithm, install JSON
shape per host, auth handoff to packages/auth-internal.

---

## 18. SKILL · web-app

**Branch:** `claude/wave2-skill-web-app`
**File:** `.claude/skills/web-app/SKILL.md`
**SK prefix:** `SK-WEB-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-007`, `GLOBAL-011`, `GLOBAL-012`,
`GLOBAL-020`.

**Source ranges:**
- `docs/design.md` — web app section.
- `docs/personas.md` — full file.
- `docs/implementation.md` — web slices.

Extract: onboarding flow, anonymous-mode default, demo dataset choice,
trace rendering, error-banner pattern.

---

## 19. SKILL · anonymous-mode

**Branch:** `claude/wave2-skill-anonymous-mode`
**File:** `.claude/skills/anonymous-mode/SKILL.md`
**SK prefix:** `SK-ANON-NNN`
**GLOBALs to copy verbatim:** `GLOBAL-007` (canonical here), `GLOBAL-020`.

**Source ranges:**
- `docs/design.md` — anonymous-mode section.
- `docs/personas.md` — first-touch persona arcs.
- `docs/implementation.md` — partial implementation status.

Extract: device-id generation/storage, anonymous rate-limit tier,
identity-attach handshake on first sign-in, cross-surface device
continuity.

---

## 20. SKILL · engine-migration (planned, Phase 3)

**Branch:** `claude/wave2-skill-engine-migration`
**File:** `.claude/skills/engine-migration/SKILL.md`
**SK prefix:** `SK-MIGRATE-NNN`

**Source ranges:**
- `docs/plan.md` — Phase 3 section.
- `docs/design.md` — multi-engine discussion.

Stub only — no decisions are firm yet. Populate the *Open questions*
section with everything that needs answering before Phase 3 starts.

---

## 21. SKILL · multi-engine-adapter (planned, Phase 3)

**Branch:** `claude/wave2-skill-multi-engine-adapter`
**File:** `.claude/skills/multi-engine-adapter/SKILL.md`
**SK prefix:** `SK-MULTIENG-NNN`

**Source ranges:**
- `docs/plan.md` — Phase 3 section.
- `docs/design.md` — multi-engine discussion.

Stub only — populate *Open questions* with the per-engine decisions
that need to be made (Mongo, Redis, ClickHouse).

---

## Wave 3 — sequential, runs after wave 2

After every wave-2 branch is merged, **one** sequential agent (or human)
runs the lean pass: replace decision blocks in `docs/design.md`,
`docs/implementation.md`, `docs/plan.md`, `docs/runbook.md` with skill
breadcrumbs:

```
> Decision recorded: see .claude/skills/<feature>/SKILL.md#SK-<PREFIX>-NNN
```

This must be sequential because it depends on every SK-ID being final.
Prompt for the wave-3 agent will live in this file once wave 2 is done.
