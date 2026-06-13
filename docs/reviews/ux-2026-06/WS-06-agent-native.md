# WS-06 — Agent-native surfaces (the "AI does the integrating" worksheet)

**Premise:** Within nlqdb's market window, the entity that discovers,
evaluates, and integrates nlqdb is increasingly an AI agent acting for a
human. The product is already architecturally agent-first (goal-first
create, MCP surface, structured errors, strict `--json`). These tasks
close the gap in the *documentation supply chain* an agent consumes.

**Scope (remaining):** `tools/stranger-test/`.
**Pre-reads:** `docs/features/stranger-test/FEATURE.md`.
**Default KPI:** Onboarding (agent-mediated acquisition).

> **T1–T5 shipped** (llms.txt `## Integrate`, docs SDK + framework pages,
> docs-site `/llms.txt`, error-code reference + drift guard, MCP Origin
> validation + logo). Deleted from this worksheet on completion. Only the
> decision-gated T6 remains.

---

## WS06-T6 (P2) [decision needed] — Cold-agent stranger test

- **Context:** `tools/stranger-test/` + `docs/features/stranger-test/`
  exist for human-shaped cold-start walks. The agent-era equivalent: a
  scripted run where a coding agent is given ONLY `https://nlqdb.com/llms.txt`
  and must reach a first successful query (via MCP or CLI), with every
  friction point logged. That metric ("agent time-to-first-query, no
  human help") is the purest measure of WS06-T1..T4 and arguably a
  GLOBAL-025 onboarding KPI candidate.
- **Task:** Do not build unprompted — it's new eval scope with LLM cost.
  Propose it to the user, citing `stranger-test/FEATURE.md`; if accepted,
  spec it as an SK in that feature first (P4-D1), then implement.

## Out of scope, deliberately

- New MCP tools/prompts/resources beyond the three tools — SK-MCP-002 is
  explicit; raise a P1 with the user before touching.
- Auto-generated per-page OG images, semantic-layer exposure, ingress
  OTel — tracked elsewhere (`comparison-pages` parked items,
  `docs/future/semantic-layer.md`, `byo-otel`).
