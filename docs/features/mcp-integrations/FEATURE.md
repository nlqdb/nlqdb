---
name: mcp-integrations
description: The agent as an MCP host — per-user arbitrary MCP servers, secret-pointers, and the agentic guardrail spine.
when-to-load:
  globs:
    - apps/api/src/agent/mcp-host/**
    - apps/api/src/integrations/**
  topics: [mcp-host, integrations, guardrails, prompt-injection, secrets]
---

# Feature: MCP Integrations

**One-liner:** The agent connects **outbound** to user-configured MCP servers
(GitHub, Exa, any URL); nlqdb is the first entry in that list. Owns the
MCP-host mechanics, per-user secret handling, and the agentic guardrail spine.
**Status:** planned — **founder-signed 2026-08-19; build may begin** (public
launch still gated on the guardrail spine, SK-MCPI-007).
**Owners (code):** `apps/api/src/agent/mcp-host/**`,
`apps/api/src/integrations/**`.
**Cross-refs:** docs/architecture.md §0 · ~/.claude security skill
(agentic guardrails, secrets-pointer) · GLOBAL-005, GLOBAL-014, GLOBAL-025 ·
features: agent-chat, mcp-server, byo-connect, anonymous-mode.

## Role flip (read this first)

Today nlqdb is an MCP **server** — agents connect *into* it
([`mcp-server`](../mcp-server/FEATURE.md)). This feature makes the agent
([`agent-chat`](../agent-chat/FEATURE.md)) an MCP **client/host** — it connects
*out* to the user's servers. nlqdb is simply the first-party entry in that
outbound list; it carries no privileges the other integrations lack.

## Touchpoints — read this feature before editing

- `apps/api/src/agent/mcp-host/**`
- `apps/api/src/integrations/**`

## Decisions

### SK-MCPI-001 — The agent is an MCP host; integrations are a flat list

- **Decision:** The agent maintains a per-user set of MCP server connections
  and exposes their tools to the model; nlqdb is one entry, rendered and
  governed identically to user-added servers.
- **Core value:** Simple, Open source.
- **Why:** A uniform host model means one code path for tool discovery,
  calling, and guarding — no special case for nlqdb, no per-vendor adapters.
  It also means the agent exercises nlqdb's public MCP surface exactly as a
  stranger would (dogfood).
- **Consequence in code:** One `McpHost` that speaks the MCP client protocol to
  N servers. Tool namespacing per integration. Reject any nlqdb-specific
  shortcut around the host.
- **Alternatives rejected:** Hard-wired per-vendor integrations (doesn't scale
  to "any"). nlqdb via in-process call (breaks the uniform model and dogfood).
- **Source:** canonical here.

### SK-MCPI-002 — Arbitrary MCP URL from day one

- **Decision:** Users add any MCP server by URL + supplied auth; there is no
  curated-catalog gate. Presets (GitHub, Exa) are convenience shortcuts over
  the same "add a server" primitive.
- **Core value:** Effortless UX, Open source.
- **Why:** The value is reach. A curated catalog would cap it and turn every
  new server into product work. Presets ride on the generic path, they don't
  replace it.
- **Consequence in code:** The add-integration form accepts URL + auth; presets
  prefill it. Every server is **untrusted** (see SK-MCPI-005) — the generic
  path is the only path, so guardrails can't be bypassed via a "trusted preset".
- **Alternatives rejected:** Curated-presets-only v1 (caps reach, defers the
  guardrail work we need anyway). Allowlist of hosts (arbitrary URL is the
  point).
- **Source:** canonical here.

### SK-MCPI-003 — Per-user isolation; secret-carrying integrations require identity

- **Decision:** Integrations are scoped to the principal and enforced by RLS;
  one user's servers and secrets are never visible to another. Adding an
  integration that stores a secret requires an upgraded (non-anonymous)
  identity.
- **Core value:** Bullet-proof, Seamless auth.
- **Why:** Per-user credentials are sensitive; fail-closed isolation is
  non-negotiable (security skill). Anonymous principals can use public /
  no-auth MCP servers, but must not park secrets on an ephemeral identity.
- **Consequence in code:** `integrations` rows carry `principal_id`; every read
  is RLS-gated, default-deny. Secret-bearing add is refused for anonymous
  principals with a one-line upgrade CTA.
- **Alternatives rejected:** Global integration registry (cross-tenant leak).
  Secrets on anonymous identity (loss + abuse risk).
- **Source:** canonical here.

### SK-MCPI-004 — Secrets stored as pointers, dereferenced at the boundary

- **Decision:** We persist a **pointer** to each integration's secret (vault
  path / key id), never the secret value, and dereference it just-in-time at
  the trust boundary when calling the server. Fail-closed on fetch failure.
- **Core value:** Bullet-proof.
- **Why:** The secrets-pointer pattern (security skill): a plaintext secret in
  the app DB or in agent/session history is a breach waiting to happen. The
  pointer is safe to store and log; the value lives only in the leaf call.
- **Consequence in code:** No integration secret in application tables, agent
  state, or logs — only the pointer. A missing secret fails the tool call
  loudly, never silently degrades to an unauthenticated call.
- **Alternatives rejected:** Encrypted-at-rest value in the app DB (still
  decryptable in-process; larger blast radius). Secret in agent context
  (leaks into model input / traces).
- **Source:** canonical here.

### SK-MCPI-005 — Guardrail spine: scan tool output before the model reads it

- **Decision:** Every MCP tool result is treated as untrusted and scanned for
  prompt-injection **before** it enters the model's context. The agent is
  tool-driven; it never ingests external content as instructions.
- **Core value:** Bullet-proof.
- **Why:** With arbitrary servers, a tool result (an Exa page, a GitHub issue,
  a response from an unknown URL) is attacker-controllable. The security skill's
  agentic rule is explicit: outputs are scanned before the agent reads them.
  This is the load-bearing work of the whole feature.
- **Consequence in code:** Tool results pass through an injection scanner /
  sanitizer on the way into context; a flagged result is quarantined and
  surfaced to the user, not fed to the model. OWASP Agentic Top-10 mapped in
  the design.
- **Alternatives rejected:** Trust tool output (direct prompt-injection route).
  Post-hoc output filtering only (too late — the injection already ran).
- **Source:** canonical here · security skill is canonical for the pattern.

### SK-MCPI-006 — Human-in-the-loop on side-effectful tool calls

- **Decision:** Tool calls with external side effects (write / send / delete /
  purchase) require explicit user confirmation in the chat before execution;
  read-only calls run without a prompt.
- **Core value:** Effortless UX, Bullet-proof.
- **Why:** "Zero 'are you sure' except for destructive actions" is a core
  value. An agent wiring arbitrary tools must not take irreversible action on
  the user's accounts autonomously.
- **Consequence in code:** The host classifies each tool call read vs
  side-effectful (declared capability where available, conservative default of
  side-effectful when unknown) and gates the latter on a confirm affordance.
- **Alternatives rejected:** Auto-run everything (irreversible-action risk).
  Confirm everything (violates Effortless UX on reads).
- **Source:** canonical here.

### SK-MCPI-007 — Guardrails gate public launch; internal builds may run ahead

- **Decision:** The public launch of the integration feature is gated on
  SK-MCPI-004..006 being in place. Internal / dev builds may run arbitrary MCP
  behind a flag before the guardrails land, for iteration only.
- **Core value:** Bullet-proof, Honest latency.
- **Why:** Shipping arbitrary MCP execution to the public without the guardrail
  spine is the exact anti-pattern the security skill forbids. But blocking all
  iteration on it would stall the parallel track.
- **Consequence in code:** One feature flag at the integrations boundary
  (integrated with the existing flag system — no scattered per-integration
  flags). Public exposure asserts the guardrail path is on.
- **Alternatives rejected:** Public ship before guardrails (unsafe).
  No iteration path (stalls Track B).
- **Source:** canonical here.

## GLOBALs governing this feature

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
  - *In this feature:* add / remove / update integration are mutations and
    carry the key.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* every outbound MCP tool call is a span (integration id,
    tool name, read-vs-side-effect, injection-scan verdict, latency).
- **GLOBAL-025** — North-star: move ≥1 pillar, degrade 0.
  - *In this feature:* pillar is **UX** (reach) with a hard **security** floor;
    engine-quality and onboarding must not regress.

## Open questions / known unknowns

- Injection-scanner implementation — reuse an existing model-based scanner vs a
  dedicated classifier? Cost + latency budget TBD in design.
- MCP client transport support matrix (streamable-HTTP, stdio, SSE) for
  user-supplied servers.
- Side-effect classification when a server declares no capability metadata —
  how conservative, and how surfaced to the user.
- Rate-limiting outbound tool calls per user / per integration.
