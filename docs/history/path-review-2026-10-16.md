# Path review — 2026-10-16 (outside consultant, no repo access)

A tool-less consultant model was given a digest of `END_GOAL.md`, `GLOBAL-041`,
the rateme12 brief and the scorecard. It was asked to find faults in the path
to a product users love: clean, smooth, useful and cheap. Agents answered its
questions from the repo over three rounds. This file records its final
recommendations and what was done with each. Adopted items live in their
canonical homes (PR #1185); this is the record, not a decision source.

## Verdict

The direction is right: depth only, a deterministic write path, one dogfood
app. But the next steps built the cheapest half of a DBA (widen-on-write).
The parts that make it a DBA — keys, uniqueness, indexes, a visible record of
what it did — were left to Phase B. rateme12's hot reads were also planned on
the free LLM.

## Recommendations, ranked

| # | Fault | Correction | Done when | Outcome |
|---|---|---|---|---|
| 1 | SQL validator: `SHOW`/`EXPLAIN` skip the multi-statement check, so `SHOW x; RESET ROLE; SELECT * FROM other.t` can drop to the RLS-bypassing owner | Same one-statement rule on that path; tests for `SET`/`RESET ROLE` and cross-schema reads | tests green in CI | **Fixed**, #1185 (`SK-SQLAL-009`) |
| 2 | `insert()` has no key: re-imports duplicate rows, and a duplicate rolls back the whole 1 000-row batch | `insert({ key })`: unique index on first use and `ON CONFLICT DO UPDATE`; per-row `rejected[]` instead of batch rollback | import ×2 leaves row count unchanged; a vote flips without `runSql` | **Adopted**, `GLOBAL-041` step 11 |
| 3 | No record of schema changes: no KPI 2 instrument, no visible proof, and Phase B would add a second audit trail | One `dba_changes` table (origin, status, ddl, inverse, hash before/after) for every DDL; `/app/dba` v0 renders it | KPI 2 has a number; a builder sees "added `stars` from your insert" | **Adopted**, step 11 + `END_GOAL` row 4 |
| 4 | Reads spend the model: the SDK `ask()` makes 2 LLM calls (no JSON mode); every widen evicts every cached plan; `runSql` traffic is invisible to the optimizer | SDK sends `Accept: application/json` by default; additive widens keep unrelated plans; `/v1/run` + `/v1/insert` emit the analyser's query event; rateme12 hot reads pinned via `runSql(trace.sql)` | 0 LLM spans on search/server page; 0 re-plans after an unrelated widen | **Adopted**, steps 12–13 (amends `SK-SCHEMA-005` with the code) |
| 5 | `END_GOAL` promise "never a blocked write" vs `invalid_value` 409 on a cast failure | Widen the column to text in the transaction, or narrow the promise | `END_GOAL` and code agree | **Decided:** that row fails alone, a retype proposal is filed, and the write path never alters a column (`END_GOAL` edge states) |
| 6 | KPI 1's ≥ 200 floor is unreachable honestly (one app first-sees ~100 fields); KPI 3 wall p95 is cold-start noise on free Neon (scale-to-zero after 5 min, which also resets `pg_stat_statements`) | Count every rateme12 unseen-field insert, n reported; measure KPI 3 in DB time (`dbDurationMs`) plus sampled `EXPLAIN (ANALYZE, BUFFERS)` | scorecard shows honest n | **KPI 1 adopted** (`GLOBAL-041`); KPI 3 unit **open**, to decide when Phase B starts |
| 7 | No rubric for "inferred schema as good as or better than hand-made" | Fixed per-entity rubric before cutover | rubric exists | **Adopted**, rateme12 brief §7 |
| 8 | Step 11 used an LLM where rules suffice | Deterministic first: ISO-8601 → `timestamptz`, `*_id` → FK + index, low cardinality → enum; LLM names only | proposals with 0 LLM spans | **Adopted**, step 14 |
| 9 | R5 required CLI + MCP twins before journeys, though journeys need only the SDK | Twins become a tracked `GLOBAL-003` gap | first journey wired | **Adopted**, rateme12 R5 |
| 10 | Role per tenant caps at 500 Neon roles | Write the ceiling + a trigger; stop giving anon/synthetic tenants a role | role count flat under anon creates | **Partly:** ~480/499 roles were synthetic, so #1184's sweep + reaper fix today's cap. Shared anon role **rejected**: anon tenants could read each other. Ceiling GLOBAL **open** |
| 11 | Rename proposals break pinned SQL | Grace-window alias, or don't rename what's read | — | **Decided:** propose a rename only when no recorded fingerprint reads the old name (`GLOBAL-041` Phase B step 3) |
| 12 | Founder-only merges (~6 h median) delay prod-down/security fixes | Agent may merge allowlisted infra paths | — | **Not adopted:** auto-merge was rejected 2026-07-22; founder stays sole merger |

## Its next three steps

1. Close the validator hole and merge #1184 (role cap). Done-signal: tests
   green in CI, prod hosted create 200.
2. Live `insert()` walk on prod, plus `key`, per-row rejects and the
   `dba_changes` ledger. Done-signal: ≥ 95 % of first-seen fields land with
   0 `llm.*` spans; import ×2 leaves row count unchanged.
3. First rateme12 journey on pinned reads with query events flowing.
   Done-signal: journey E2E green on prod; 0 LLM spans on hot routes; search
   DB-time p95 recorded as KPI 3's baseline.

## Still open

- KPI 3's unit (DB time + buffers vs wall p95): decide at Phase B start.
- A GLOBAL recording the 500-account role ceiling and its trigger.
- `SET`/`RESET ROLE` behaviour of Neon's HTTP endpoint on multi-command
  strings: unverified; the integration test in #1185 pins the outcome.
