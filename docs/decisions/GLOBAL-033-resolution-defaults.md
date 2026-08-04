# GLOBAL-033 — Resolution defaults: close open questions from the values, don't escalate

- **Decision:** When an open question (a `## Open questions / known
  unknowns` bullet, or any undecided fork that surfaces mid-edit) is
  **decidable from the documented values** — the `architecture.md §0`
  core values, the [`GLOBAL-025`](./GLOBAL-025-north-star.md) north-star,
  the [`GLOBAL-026`](./GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
  LLM strategy, the `docs/guidelines.md` habits, or the `architecture.md §8`
  build/don't-build list — the agent **resolves it** using the default
  ladder below, records the resulting `SK-*` / `GLOBAL-*` (or rewrites the
  bullet as a parked-with-trigger line), and does **not** escalate to the
  founder. The founder is consulted only when **no codified decision** —
  this ladder, the `§0` values, any `GLOBAL-*`/`SK-*` — can decide the
  question: a genuine money / strategy / legal bet, and the escalating
  bullet must say what was checked and found non-deciding. Even then the
  agent applies the conservative default so work never blocks, and the ask
  is framed as **lock a decision** — the founder mints or amends the
  governing `GLOBAL-*`/`SK-*` from options the agent pre-drafted — never a
  one-off answer that leaves the next agent re-asking (founder-directed
  2026-08-04: "teach to fish, don't provide the fish"). Escalations
  surface **only** as 🔒 *decision-to-lock* bullets in
  [`blocked-by-human.md`](../blocked-by-human.md) — the single channel the
  founder reads — capped at **3** live 🔒 bullets; a fourth means merge or
  re-derive from the ladder first.

- **Core value:** Simple, Free, Goal-first

- **Why:** Pre-PMF, on a strict-$0 budget across many surfaces, **founder
  attention is the scarcest resource on the project.** Escalating a
  question the values already answer wastes it and stalls shipping; worse,
  a backlog of "needs the founder" bullets trains every agent to defer
  rather than decide. The values were written precisely so that decisions
  reproduce without the founder in the loop — an agent applying them is
  faster and no less correct than the founder re-deriving the same answer.
  This is the [`GLOBAL-025`](./GLOBAL-025-north-star.md) failure mode
  ("a multi-surface team drifts into shipping what's easy") applied to
  decision-making: the easy thing is to ask; the right thing is to decide
  from the compass.

- **Consequence in code & docs:** Every open-question resolution cites
  this GLOBAL plus the source value. `## Open questions` sections shrink
  to (a) genuinely-parked items rewritten as **"Parked until `<concrete
  trigger>`"** and (b) true founder bets. The default ladder:

  | Open-question class | Default resolution | Source value |
  |---|---|---|
  | Speculative scope / new surface / product mode | Defer until a paying or design-partner customer asks; never build speculatively. Park with a named trigger in `phase-plan.md`. | Simple (`§0`); `§8` not-building; `GLOBAL-025` |
  | Pin a number (TTL / threshold / cap / retention / cadence) | Mirror the proven incumbent (Stripe = 24h idempotency), make it env-tunable, choose the value that fails safe / bounds staleness. | guidelines habits 1–2; bullet-proof-by-design |
  | Security trade-off (fail-open/closed, validation layer, denylist) | Layered guardrails — never one control. Destructive or secret paths fail **closed**; non-destructive read paths bias to availability. | guidelines §7; research-receipts §1 (Replit) |
  | Surface-parity gap (capability on some surfaces, not all) | `GLOBAL-003`: ship to all surfaces in the same slice, or record the gap in the feature. Never widen the divergence. | `GLOBAL-003` |
  | Silent-drift risk (cardinality, naming, word-count, tool-name) | Add the cheap CI assertion / counter now. | bullet-proof ("make bad states unreachable, not caught") |
  | Wire-format / transport / "how to surface X" | Reuse what's already built (SSE for streaming, the existing event schema). One way to do each thing. | Simple (`§0`) |
  | UX micro-decision (modal? confirm? prompt copy?) | Zero modals; zero "are you sure" except destructive ops; goal-first; keyboard-first. | Effortless UX (`§0`) |
  | Cost vs scaffolding (absorb LLM cost? charge? add spend?) | Invest in scaffolding; keep the free chain free forever; never gate first value behind cost. | `GLOBAL-026`; Free (`§0`) |
  | Build vs adopt (write our own, or use a library?) | Adopt a small mature package unless it is one of the seven `§8` "build-our-own"; DIY only after the 10-minute research (habit 2). | guidelines habits 1–2; `§8` |
  | Genuinely deferred (needs traffic / a future slice / a pipeline that doesn't exist yet) | Keep parked, but rewrite the bullet as **"Parked until `<trigger>`"** so it is a decision-to-defer, not an unresolved question. | `P4` / `D1` |
  | **True founder bet** (money out the door, strategic positioning, legal/compliance — and no codified decision decides it) | **The only escalation class.** Apply the conservative default so work isn't blocked; queue a 🔒 decision-to-lock bullet in `blocked-by-human.md` (cite what was checked, pre-draft the options); the founder **locks** a `GLOBAL-*`/`SK-*` — never hands an unrecorded answer. | founder-directed 2026-08-04 |

  New open questions are triaged against this ladder **before** any
  escalation. A bullet that names no class and no trigger is itself a bug —
  either it resolves to a row above, or it is a founder bet stated as such.

- **Alternatives rejected:**
  - **Escalate every undecided fork (the prior status quo)** — burned the
    scarcest resource (founder attention) on questions the values already
    answered, and let open-question sections grow without bound.
  - **Resolve silently without recording the SK/GLOBAL** — violates `P1`
    / `P3`: a future reader can't tell a deliberate resolution from an
    oversight, and the next agent re-opens it.
  - **A soft heuristic in `guidelines.md` instead of a GLOBAL** — without
    `P1`'s "never contradict a documented decision silently" teeth, agents
    treat it as optional and keep escalating.
