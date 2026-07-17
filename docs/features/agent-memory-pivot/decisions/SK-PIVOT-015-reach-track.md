# SK-PIVOT-015 — Reach is the pivot's third track: search-moment interception + coding-agent injection, driven by its own `/reach` loop

- **Decision:** The pivot gains a third worksheet track — **reach**
  (`worksheets/reach/INDEX.md`, R-01..R-08) — whose single goal is that
  when an agent-SaaS builder, **or the coding agent they build with
  (Claude Code / Cursor / Codex)**, looks for agent memory, the first
  actionable answer is nlqdb and acting on it is one free command (the
  per-host strings in `apps/web/src/lib/mcp-install.ts`). The track is
  driven by a dedicated recurring command
  ([`.claude/commands/reach.md`](../../../../.claude/commands/reach.md))
  fired every few hours by a Routine on hours offset from `/daily`'s, and
  its yield numbers live in the reach INDEX (never `docs/scorecard.md`,
  which stays `/daily`-owned).
- **Core value:** Goal-first, Creative, Honest
- **Why:** The buying decision happens at stage 0/1 ("my agent forgets
  things", "per-user memory") — where today's winning answers are DIY
  Postgres+pgvector guides and Mem0's pip install — not at stage 2
  ("analytical memory"), which nobody searches for. And increasingly the
  *searcher is a coding agent*: it reads MCP registries, `llms.txt`,
  READMEs, and in-repo rules/skills, and it can complete a one-command
  setup end-to-end without a human. Folding this into `/daily` starves it:
  `/daily` picks the worst scorecard number, which is rarely acquisition
  reach until reach is measured at all. A dedicated loop with its own
  measurement (the R-06 coding-agent walker) makes the campaign sustained
  and falsifiable.
- **Consequence in code:** `worksheets/reach/INDEX.md` (slices + hard
  rules + § Current numbers), `.claude/commands/reach.md` (the runnable
  loop), a Routine firing "run /reach prompt" 4×/day offset from
  `/daily`'s hours. Slices land on existing machinery only: `solve.ts`,
  `/blog`, `llms.txt`, docs site, `tools/stranger-test` conventions,
  `mcp-install.ts` as the single source of command strings.
- **Alternatives rejected:** **Fold into `/daily`'s lever list** — starved
  by worst-number selection (above). · **One mega "SEO project" PR** —
  unreviewable; violates the daily-run sizing rule the whole pivot is built
  on. · **Paid acquisition** — no budget, and the P2 audience converts on
  technical proof, not ads (`deepseek-moat-framing.md`). · **A separate
  feature doc** — reach is a pivot distribution concern; a fourth home
  would split the GLOBAL-036 record (P3).
