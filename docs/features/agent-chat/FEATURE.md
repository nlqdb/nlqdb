---
name: agent-chat
description: The agent product (web + native mobile) where nlqdb is one MCP integration among many.
when-to-load:
  globs:
    - apps/web/src/pages/app/**
    - apps/web/src/components/chat/**
    - apps/api/src/agent/**
  topics: [agent, chat, mcp-host, mobile, integrations]
---

# Feature: Agent Chat

**One-liner:** A general agent (web + native mobile clients) that talks to
user-configured MCP servers; nlqdb is the built-in memory MCP, shown in the
same integrations list as GitHub, Exa, and anything the user adds.
**Status:** planned — **Proposed, awaiting founder sign-off.** No code until
signed.
**Owners (code):** `apps/api/src/agent/**` (backend agent), `apps/web/src/**`
(web client), `nlqdb-mobile` (separate Expo repo — native client).
**Cross-refs:** docs/architecture.md §0 (core values) · docs/phase-plan.md ·
GLOBAL-001, GLOBAL-025, GLOBAL-026 · features: mcp-integrations, anonymous-mode,
mcp-server, trust-ux, agent-memory-pivot.

## The layering (read this first)

- **nlqdb** is the memory database — *"talk to your memories"* — delivered
  **as an MCP**. Positioning unchanged. This feature does **not** reposition
  nlqdb.
- **The agent is a separate product.** It is not "nlqdb chat." It is a general
  agent with pluggable MCP integrations.
- **Inside the agent, nlqdb is one MCP integration** in the same list as
  GitHub / Exa / user-added servers. It is the first-party entry, but rendered
  as an MCP, not as "the app."
- The MCP-host mechanics (arbitrary servers, per-user secrets, guardrails) are
  owned by [`mcp-integrations`](../mcp-integrations/FEATURE.md); this feature
  owns the agent product and its clients.

## Touchpoints — read this feature before editing

- `apps/api/src/agent/**`
- `apps/web/src/pages/app/**`, `apps/web/src/components/chat/**`
- the `nlqdb-mobile` repo (native client)

## Decisions

### SK-AGENT-001 — The chat is an agent, nlqdb is an integration inside it

- **Decision:** The chat is a distinct agent product with a pluggable set of
  MCP integrations; nlqdb appears in that set as the built-in memory MCP, never
  as the app's identity.
- **Core value:** Simple, Goal-first.
- **Why:** "Talk to your memories" is the right, narrow positioning for the
  nlqdb MCP. It is too narrow for a chat the user wants to bring other context
  into. Separating the two keeps nlqdb's story intact while letting the agent
  grow arbitrary reach, and lets nlqdb be dogfooded through the same public MCP
  surface a stranger uses.
- **Consequence in code:** The agent has no privileged in-process path to
  nlqdb. It reaches nlqdb over the public MCP surface like any other
  integration. The UI renders nlqdb as a row in the integrations list, not as
  chrome. Reject any design that special-cases nlqdb as non-MCP.
- **Alternatives rejected:** "nlqdb chat" (couples nlqdb's narrow positioning
  to a general surface; blocks other context). Private in-process nlqdb call
  (breaks dogfood — the agent's traffic would not exercise the public MCP
  surface).
- **Source:** canonical here.

### SK-AGENT-002 — One agent, two clients (web + `nlqdb-mobile`)

- **Decision:** A single backend agent contract serves both the web client
  (`apps/web`) and a native mobile client in a **separate Expo repo**
  (`nlqdb-mobile`), released iOS + Android together.
- **Core value:** Simple, Effortless UX.
- **Why:** The agent's behaviour (orchestration, guardrails, integration set)
  must not fork per surface. Mobile can't live in the Workers monorepo
  (GLOBAL-013 bundle budget, Workers-only bundles), so it is its own repo that
  consumes `@nlqdb/sdk` and the agent API. The `pointer` Expo template
  (Expo 57 / RN 0.86 / TS 6, `node --test`, EAS) is the base.
- **Consequence in code:** Client-agnostic agent API. `nlqdb-mobile` carries
  its own `pointer`-style docs (`ARCHITECTURE.md`, `GUIDELINES.md`,
  `PRIVACY.md`); this `FEATURE.md` is the nlqdb-side contract it implements.
  No mobile-only branch in the agent backend.
- **Alternatives rejected:** Mobile inside the monorepo (violates GLOBAL-013).
  React Native from scratch (throws away the working `pointer` base).
- **Source:** canonical here.

### SK-AGENT-003 — Anonymous-first; upgrade via Better Auth to persist

- **Decision:** The agent works with no account (reusing
  [`anonymous-mode`](../anonymous-mode/FEATURE.md)); signing in via Better Auth
  persists threads and integrations across devices.
- **Core value:** Seamless auth, Effortless UX.
- **Why:** No login wall before first value is a core value. The anonymous
  wedge already exists on web; mobile adds the Better Auth handoff (Expo
  AuthSession opening the OAuth / magic-link flow, deep-linking back via an
  `nlqdb://` scheme). Better Auth, not Supabase — `pointer`'s Supabase auth is
  replaced.
- **Consequence in code:** Anonymous principal can run the agent with the
  built-in nlqdb MCP and public MCP servers; per-user integrations that carry
  secrets require an upgraded identity (see mcp-integrations SK-MCPI-003).
  Mobile deep-link scheme registered in `app.json`.
- **Alternatives rejected:** Login wall first (violates Seamless auth).
  Supabase auth from `pointer` (nlqdb has one identity system — Better Auth).
- **Source:** canonical here.

### SK-AGENT-004 — nlqdb answers keep the trust-UX contract

- **Decision:** When the agent's nlqdb MCP returns an answer, the chat shows
  the same trust surface the web app already ships — the SQL that ran, the
  confidence signal, the write-diff preview — ported to each client.
- **Core value:** Honest latency, Bullet-proof.
- **Why:** nlqdb's honesty guarantees (see [`trust-ux`](../trust-ux/FEATURE.md))
  don't stop being true because the caller is our own agent. A native surface
  that hides the SQL would be a regression against `GLOBAL-025` UX.
- **Consequence in code:** Answer cards render SQL + confidence + diff on both
  web and mobile. Reject a mobile answer view that drops them.
- **Alternatives rejected:** Chat-bubble-only answers (drops the trust surface
  that differentiates nlqdb).
- **Source:** canonical here · trust-ux is canonical for the contract itself.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (index in
[`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-001** — `@nlqdb/sdk` is the only HTTP client.
  - *In this feature:* both clients reach the nlqdb API through the SDK; the
    agent reaches nlqdb over MCP, never a bespoke fetch.
- **GLOBAL-013** — Cloudflare Workers free-tier / Workers-only bundles.
  - *In this feature:* forces `nlqdb-mobile` into a separate repo (SK-AGENT-002).
- **GLOBAL-025** — North-star: every PR moves ≥1 pillar, degrades 0.
  - *In this feature:* primary pillar is **onboarding + UX** (a native surface,
    zero-wall agent). Dogfood traffic (SK-AGENT-001) also advances the wedge.
- **GLOBAL-026** — LLM strategy (BYOLLM / hosted-premium).
  - *In this feature:* the agent's model selection inherits the router; no new
    model lane.

## Open questions / known unknowns

- Agent orchestration engine — reuse `/v1/ask` planning, or a dedicated
  agent loop? Decide in the mcp-integrations design (guardrails constrain it).
- Does the agent product get its own name / brand, or stay unbranded under
  nlqdb? **Founder-final (narrative/positioning).**
- Thread persistence model for anonymous → upgraded migration on mobile.
