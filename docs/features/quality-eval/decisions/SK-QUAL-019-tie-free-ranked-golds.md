# SK-QUAL-019 — persona-bench ranked golds must be tie-free (no false-negative under sequence-strict scoring)

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Follow-on to
[`SK-QUAL-018`](./SK-QUAL-018-persona-bench.md) (the persona-bench fixture) that
hardens its golds against the sequence-strict half of the EX scorer
([`SK-QUAL-001`](./SK-QUAL-001-benchmark-canon.md) / `src/score.ts`).

- **Decision:** Every persona-bench gold whose SQL contains `ORDER BY` — and is
  therefore scored **sequence-strict** by `score.ts` (`rowsMatch(_, _, ordered)`
  with `ordered = hasOrderBy(goldSql)`) — must return a result whose **rank key
  has no ties**, so the ordering is a total order any correct prediction
  reproduces. The `agent_memory` `recalls` seed is sized to give the four
  recalled facts **distinct** recall counts (fact 1→4, 2→3, 6→2, 4→1), and a unit
  test (`persona-bench.test.ts`) asserts every `ORDER BY` gold's last-column rank
  key is duplicate-free, so a future seed/gold edit that reintroduces a tie fails
  CI.
- **Core value:** Engine quality (honest measurement), Bullet-proof.
- **Why:** `score.ts` compares result sets order-**insensitively** by default but
  sequence-**strict** whenever the gold has `ORDER BY` (a ranking is part of the
  answer). An unbroken tie in the rank key has implementation-defined row order,
  so a semantically-correct prediction that breaks the tie differently is
  false-mismatched. q8 ("the 5 most-recalled facts") had two facts tied at
  `recall_count = 2` (`PST`, `pro`): the gold's `GROUP BY f.id, f.object` ordered
  the tie by fact id, while the free chain's weak leg (`llama-3.3-70b`, which
  `GROUP BY object`) ordered it the other way — both correct, but
  `[email,4],[PST,3],[pro,2],...` vs `...[pro,2],[PST,2]...` fails the strict
  comparator. Measured (2026-06-23, local free-chain runs): q8 was a **stable**
  llama-leg miss (2/2 pre-fix runs) understating the weak chain's true EX; making
  the counts distinct made gold == prediction deterministically and flipped q8 to
  a **stable** match (2/2 post-fix runs). The headline full-chain EX (0.90) is
  unchanged in expectation — q8 lands on the gemini leg, which orders the tie like
  gold — but the false-negative re-surfaces on any leg that breaks the tie
  differently and **reshuffles with provider failover**, so the fix makes the
  number robust, not just higher. An audit of all four `ORDER BY` golds (q0, q8,
  q13, q18) found q8 the only tie-fragile one.
- **Consequence in code:** the `recalls` `INSERT` in `persona-bench.ts` adds two
  rows (recall ids 9, 10) so fact recall counts are distinct; the recalled-fact
  **set** is unchanged (`{1,2,4,6}`) so the "never recalled" gold and `q18`
  (recalls per agent) are unaffected. The new test runs every `ORDER BY` gold and
  asserts no duplicate value in the rank-key column. New ranked golds must make
  the rank key a total order in the seed (or omit `ORDER BY`).
- **Alternatives rejected:**
  - **Add a tiebreaker to the gold's `ORDER BY`** (e.g. `, f.object`) — doesn't
    help: the prediction carries no matching tiebreaker, so the tie still orders
    differently and still mismatches. Only tie-free **data** makes every correct
    query agree.
  - **Relax `score.ts` to be order-insensitive within rank-key ties** — the
    scorer doesn't know which columns the `ORDER BY` names, so a generic
    relaxation would also accept genuinely mis-ordered rankings, weakening EX and
    diverging from BIRD/Spider's comparator (`SK-QUAL-001`/`SK-QUAL-008`).
  - **Document q8 as a known-flaky gold** — leaves a structural false-negative
    that depresses any tie-breaking-differently leg and reshuffles with failover,
    a phantom the next agent re-chases as an "engine" miss (this run nearly added
    a prompt directive for it before the root cause surfaced).
