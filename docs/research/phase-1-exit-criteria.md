# Phase 1 exit criteria — research notes

> **Status:** research notes / starting hypotheses, not canonical decisions. The committed Phase 1 exit gate lives in [`../architecture.md` §10](../architecture.md#10-phase-plan). The items below were on the original plan.md / implementation.md exit gates and were dropped during the docs consolidation; they are kept here so the team can pull them back into the canonical gate as the launch date approaches and we have signal on which ones still apply.

The gate in `architecture.md §10` covers the *quantitative engineering* checks (p50 / p95 / Lighthouse / capacity / $0). The items below are the *qualitative product* checks — proof that the goal-first inversion is working, that real users got real value, and that we're capacity-safe at launch volume. They were dropped because they need more research to define cleanly: what counts as "a real side project," who the 5 target customers are, what the support-ticket triage rule is. Resolve before Phase 1 launch — don't ship without picking a stance.

## Qualitative criteria (carried over from `plan.md §1.7` and `implementation.md §4`)

### 1. Sean Ellis "must-have" benchmark

**Original wording.** *"Five paying customers who say 'I'd be sad if this went away'."*

**Why it mattered.** Sean Ellis's 40%-must-have threshold is the single best public signal of pre-PMF traction. Five "very disappointed" responses across the design-partner cohort is the smallest-N proxy that's still meaningful (`personas.md` §10 sets the design-partner cohort at 5–7 paying Hobby customers across P1/P2 personas).

**Open questions before this can graduate to the gate.**
- How is the question delivered — async survey link in the dashboard, or 1:1 founder call?
- What counts as a "paying customer" — Hobby ($10) only, or do anonymous-mode adopters who upgraded count?
- What's the failure response — extend Phase 1 by N weeks, or ship Phase 2 anyway and tighten in Phase 3?

### 2. "Zero support tickets about how do I create a table"

**Original wording.** *"Zero support tickets about 'how do I create a table.'"*

**Why it mattered.** The goal-first inversion (`architecture.md §0.1`) says no persona should ever ask the create-a-table question — they should be stating goals and the DB should materialize. A ticket using DB-shaped vocabulary ("table", "schema", "migration") is a leading indicator the on-ramp is leaking back into DB-first framing.

**Open questions.**
- What's the support channel that owns the count — Discord `#help`, GitHub issues, the in-product chat, or all three?
- What's the keyword set — just `create.*table`, or `create.*table|schema|migration|column|drop|alter`?
- What's the threshold — literal zero, or zero per design-partner per week?

### 3. "1 P1 solo-builder ships a real side-project using only `<nlq-data>` + chat"

**Original wording.** *"1 P1 solo-builder ships a real side-project using only `<nlq-data>` + chat."*

**Why it mattered.** The whole product thesis is that a solo builder can ship a working app with zero backend code. One real shipped project — public URL, real users (even N=1), Phase 1 features only — is the smallest-N proof. Maya from `personas.md` §10.2.1 is the canonical persona; this gate checks that the persona-vignette becomes a real user.

**Open questions.**
- "Real" cutoff — is "my partner uses it" real, or does it need a public URL?
- Is `<nlq-data>` alone sufficient, or must `<nlq-action>` also be in scope (Phase 2)?
- What happens if the design partner uses the connection-string escape hatch? Their project ships, but the goal-first promise is gated by whether they could have done it without escape.

### 4. "Free-tier LLM sustains 200 launch-day signups without exceeding any RPD"

**Original wording.** *"Free-tier LLM sustains 200 launch-day signups without exceeding any RPD."*

**Why it mattered.** The strict-$0 inference path (`architecture.md §7.1`) has hard daily ceilings — Groq Llama 3.1 8B at 14,400 RPD, Gemini 2.5 Flash at 500 RPD, Workers AI at 10,000 Neurons/day. The capacity calc says ~500 plan generations + ~14,400 classifications → ~2–4k user queries/day after the plan cache. Launch-day traffic spikes are the realistic overflow scenario; if 200 signups blow Gemini's 500 RPD because each signup runs schema inference once, we have a Day-1 outage.

**Open questions.**
- Where is the "RPD" boundary measured — at the LLM router (per provider), or at the surface (per signup)?
- What's the failure response — surface a "high demand, queued" message and slow-roll, or auto-route paid models for the first 24h?
- Does this gate move to "200 signups + 50% of design partners running their first query in the same hour" (the realistic worst case)?

### 5. "MCP server installed in ≥3 distinct client apps"

**Original wording (`plan.md §1.7`).** *"MCP server installed in ≥3 distinct client apps."* In the consolidated `architecture.md §10` this moved to the **Phase 2** exit gate.

**Why the move is reasonable.** MCP server is now a Phase 2 deliverable in the consolidated plan, so Phase 1 can't gate on it. But the Phase 2 gate already says *"MCP installed in 3+ distinct host apps; 1 agent product publicly uses nlqdb as memory"* — same intent.

**Open question.** Confirm with the founder whether this is a deliberate phase reassignment (it should be) or an oversight. If deliberate, no action — the architecture.md §10 Phase 2 gate covers it. If the original intent was to ship MCP in Phase 1, the Phase 1 exit gate needs the row added back and the Phase 2 deliverables reshuffled.

## Source

Carried forward from:
- Pre-consolidation `docs/plan.md §1.7` (deleted in PR #81 commit `fb6e8c9`).
- Pre-consolidation `docs/implementation.md §4` exit gate (same commit).
- The consolidated gate in `docs/architecture.md §10` Phase 1.

Update this file as you resolve open questions; promote rows into `architecture.md §10` once they're crisp. Don't let a vague gate ship the launch — per `D1` of `CLAUDE.md §2`, resolve before documenting.
