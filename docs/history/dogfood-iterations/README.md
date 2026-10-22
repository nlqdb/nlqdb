# Dogfood iterations — retrospectives

One file per iteration of the [`GLOBAL-042`](../../decisions/GLOBAL-042-dogfood-iteration-loop.md)
loop: `NNN-<slug>.md`, numbered from `001`, never renumbered, opened by
copying [`TEMPLATE.md`](./TEMPLATE.md) (the shared mechanics — quarantine,
token handling, code-location rules, retro fields, cleanup checklist — live
only there). Each retro states how it went, what went right, what went
wrong, the concrete numbers (`GLOBAL-043` KPIs A–C, manual steps, time), and the one change for the next iteration. The agent
that makes that change is the fixer in [`END_GOAL.md`](../../END_GOAL.md):
the four pillars and design for leverage, before any code. The retro
reconciles the leverage verdict against the diff. Written before cleanup;
cleanup before the next iteration starts.

| # | Iteration | Date | Outcome |
|---|-----------|------|---------|
| 001 | [rateme12 on nlqdb](001-rateme12.md) — clone `rateme12.nlqdb.com`, data last mile gated on nlqdb readiness | 2026-09-06 (brief) | retired 2026-10-22 (`GLOBAL-043`) — real writes n = 0 |
| 002 | [rateme12 attached](002-rateme12-attach.md) — nlqdb attaches to rateme12's live D1 | 2026-10-22 (brief) | open |
