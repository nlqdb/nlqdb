# UX review 2026-06 — worksheets for cold agents

Full-surface UX/DX review (home page, sub pages, app, SDK + wrappers, MCP,
CLI) performed 2026-06-12. Every finding was verified against source with
file:line references before being written down here.

**These are ephemeral task lists, not decision records.** Decision bodies
live only in their canonical homes (CLAUDE.md P3). When you finish a task,
delete it from the worksheet; delete the worksheet when empty; delete this
directory when all worksheets are gone.

## How to use a worksheet (cold agent)

1. Pick ONE worksheet. Read its **Pre-reads** fully before touching code
   (CLAUDE.md §5 path map applies on top).
2. Work top-down by severity. One worksheet ≈ one PR; split only if the
   diff grows unwieldy.
3. Tasks tagged **[decision needed]** must be raised with the user first
   (CLAUDE.md P1/P4-D1). Never implement them silently.
4. Re-verify each file:line before editing — the codebase moves fast.
5. Before the PR: run the CLAUDE.md §8 gates
   (`bun run typecheck && bun run lint && bun run test`) and name the
   [GLOBAL-025](../../decisions/GLOBAL-025-north-star.md) KPI the PR
   advances in the body (each worksheet header names the default).

## Severity rubric

- **P1** — breaks trust, blocks a user/agent path, or violates a GLOBAL.
- **P2** — real friction; fix is small and local.
- **P3** — polish; batch several into one commit.

## Worksheets

| File | Surface | Default KPI (GLOBAL-025) |
|---|---|---|
| [WS-06-agent-native.md](WS-06-agent-native.md) | Cross-surface: agents as primary users | Onboarding |

## Cross-cutting theme (read once, applies everywhere)

In 2026 the "developer" reading nlqdb's surfaces is increasingly an AI
agent. An agent has exactly four documentation surfaces, and each must be
treated as canonical product copy, not an afterthought:

1. **MCP tool/param descriptions** — the agent's only manual at call time.
2. **SDK JSDoc + exported types** — what coding agents read before writing
   integration code.
3. **`llms.txt` + docs site** — what agents fetch when asked "integrate nlqdb".
4. **Error envelopes** (`code` + one-sentence action, GLOBAL-012) — how
   agents self-recover without a human.

The review found the product architecture already agent-friendly
(goal-first, one-call DB create, structured errors, strict `--json`); the
gaps are almost all in these four documentation surfaces. The marketing,
app, SDK, MCP, and CLI worksheets (WS-01/02/03/04/05) have shipped and were
deleted on completion; **WS-06** remains and fixes the third surface — the
`llms.txt` + docs site.

## What the review found is strong — do not regress

- Goal-first hero, one input, no signup wall (SK-WEB-002, GLOBAL-007/020).
- Runnable code above the fold for all 8 integration paths (SK-WEB-003).
- Always-on trace pane + destructive-op diff confirm (GLOBAL-011/023,
  SK-TRUST-001).
- Anonymous-first everywhere: web (SK-ANON-003), CLI (SK-CLI-005).
- One-sentence actionable errors across surfaces (GLOBAL-012).
- Zero-dep SDK with retry + idempotency + discriminated auth (SK-SDK-001/008).
- Minimal 3-tool MCP surface with diff-confirm flow (SK-MCP-002).
- CLI: no TTY-sniffing output, explicit `--json`, keychain secrets
  (SK-CLI-004/009).
