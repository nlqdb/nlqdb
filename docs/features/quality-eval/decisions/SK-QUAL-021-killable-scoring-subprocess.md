# SK-QUAL-021 — Scoring SQL executes in a killable subprocess; a runaway query is a scored timeout, never a hung run

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Siblings:
[`SK-QUAL-013`](./SK-QUAL-013-capacity-honest-budget-stop.md) (the capacity
stop this complements) · [`SK-QUAL-020`](./SK-QUAL-020-transport-collapse-guard.md).

- **Decision:** `score.ts` never executes gold/predicted SQL in-process. Every
  statement runs in a spawned child (`sql-exec-child.ts`, SQL via stdin, rows as
  tagged JSON) that the parent SIGKILLs at `timeoutMs` (+500 ms spawn grace). A
  killed predicted query scores `exec_error`, a killed gold scores `gold_error`
  — canonical BIRD `evaluation.py` does the same via `func_timeout` (timeouts
  count against EX).
- **Core value:** Bullet-proof
- **Why:** bun:sqlite's synchronous `.values()` is uninterruptible (no
  `sqlite3_interrupt`/progress-handler binding; `busy_timeout` only bounds lock
  waits), so one runaway predicted query — a cartesian join over BIRD's larger
  fixtures — froze the runner's whole event loop: no throttle, no capacity wait,
  no checkpoint append, no budget-stop. Four consecutive 2026-07-03 smoke
  windows ceiling-cancelled at 44 min with a byte-flat checkpoint because the
  deterministic resume order replayed the same poison pair every window — the
  run could never progress.
- **Alternatives rejected:**
  - In-process `Worker` + `terminate()` — Bun's worker termination of a
    synchronously-blocked thread is experimental with documented hangs
    (oven-sh/bun #8816, #13091); a kill that can itself hang re-creates the bug.
  - Row-iteration deadline checks — regains control only between yielded rows;
    an aggregate over a cartesian product yields nothing until done.
  - Statement rewriting (injected `LIMIT`) — changes the semantics being scored.
