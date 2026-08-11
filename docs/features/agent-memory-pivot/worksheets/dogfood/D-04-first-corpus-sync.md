# D-04 — First real sync of nlqdb's own `docs/` corpus + the gate-progress readout

**Status:** 🟡 **Run 1 done 2026-08-11** — prod memory DB provisioned + docs corpus seeded + first analytical workload run through the public MCP surface (see **Run log** below). Run 2 (the repeatable readout) + sustained volume to criterion 1's ≥100 remain.
**Sequence:** Dogfood 4 of 7 · **Risk:** med · **Runs:** ~2 · **Prereqs:** D-01 ✅, D-02 ⬜, ~~E-03 merged → `MEMORY_PRESET=1` in prod~~ ✅ (#851, #835) · **Gate:** none — the founder-sequenced chain completed 2026-07-29

## Goal

nlqdb's own `docs/` corpus lives in a real, prod, `agent_memory_v1` memory DB,
written and read through the public MCP surface by nlqdb's own operating agents
— and the gate's first three criteria become **measured numbers** instead of
"unstartable". This is the slice that turns the launch from a bet into a
report.

## SK-PIVOT-016 criteria it moves

**Criteria 1, 2 and 3** — all three, and they are the three that no other slice
can touch:

1. ≥ 100 real `/v1/ask` calls through the public MCP surface from the ops
   workload (today: **0**).
2. First-10-queries success ≥ 95 % **on that workload** — scorecard row #4's
   instrument, finally with `N > 0` (today: `N = 0`, so not measurable).
3. Zero silent data loss / wrong-answer-accepted incidents.

## The prereq chain — state as verified 2026-08-01

**E-03 merged (#851) → `MEMORY_PRESET=1` shipped (#835, 2026-07-29) → E-03's
backfill line landed** ("no backfill — and none needed retroactively: the flag
reached prod *after* the scoping slice, so no unscoped prod memory DB ever
existed", [`E-03`](../engine/E-03-memory-scoping.md) *Consequence in code*).
All three boxes the first sync run must check are checked.

[`D-02`](D-02-resync-hook.md) is 🟢 code-complete and its `NLQDB_API_KEY`
repo secret was set by the founder 2026-08-04
(`history/founder-actions-log.md` Era 5). **One product change remains**,
found by a live prod test 2026-08-09: the repo-secret key authenticates
(`GET /v1/databases` → 200) but `POST /v1/databases { preset }` returns
**401** — the create verb was cookie-session-only, while `remember`/`query`
already accept user-scoped keys. Per
[`SK-PIVOT-010`](../../decisions/SK-PIVOT-010-authed-onramp.md) **as amended
2026-08-09** (founder-directed: provisioning is product-automated, never a
human queue item), the opening lever is extending preset create to
user-scoped principals (`sk_live_`/`sk_mcp_`; `anon` + `pk_live` stay
rejected) — one run. Then run 1 below proceeds unchanged: the agent
provisions the memory DB with the key and sets the `NLQDB_MEMORY_DB` repo
variable. **No founder action anywhere in this chain.**

## Run log — run 1 (2026-08-11)

The API change shipped run 175 (`SK-HDC-021`, #965) turned out to be the last
blocker: preset create now accepts `sk_mcp_` keys, and the production API is
reachable from the `/daily` container over `https://app.nlqdb.com/v1/*` (the
SDK's own default base — `api.nlqdb.com` is a proxy-denied alias in this
environment, never the SDK/MCP path). So run 1 executed end-to-end, autonomously,
`$0` (free tier DB + free LLM chain), no founder action.

**1. Provisioned** — `POST /v1/databases {"preset":"agent_memory_v1"}` with a
self-minted `sk_mcp_` key + an `Idempotency-Key` → **201**, `db_agent_memory_v1_3a8a72`
(engine postgres). **First live end-to-end proof of `SK-HDC-021`** — no prior run
had exercised the create-boundary against prod with a real key.

**2. Seeded** (the docs→memory workload, D-01's producer / D-02's convergent
`tools/docs-memory` extractor over live `docs/`): **22 writes, 0 failures** via
`/v1/memory/remember` — **9 entities** (7 `feature`, 2 `queue_item`) + **13 facts**
(11 `open_question`, 2 `blocked`). Verified in prod via `/v1/run` counts:
`facts=13`, `entities=9`.

**3. Analytical workload through the public MCP surface** — 12 natural-language
questions run through the **real published `@nlqdb/mcp` stdio server**
(`nlqdb_query` → `/v1/ask`, `sk_mcp_` key, free chain: `gpt-oss-120b` /
`gemini-2.5-flash`), no privileged path:

- **first-10 success: 10/10 = 100 %** (criterion 2's bar is ≥ 95 %).
- **12 / 12 asks answered** (criterion 1's real count: **0 → 12**).
- The NL→SQL was correct on 11 of 12 (`GROUP BY kind`, `COUNT`, `DISTINCT`,
  `WHERE kind='open_question'` when asked with the exact token, etc.).

**The one that broke — verbatim, the launch post's whole point.** Query #8,
*"how many open questions are there across all features"*, compiled
`SELECT COUNT(*) FROM "facts" WHERE kind = 'question' AND (expires_at IS NULL OR expires_at > NOW())`
→ **0 rows**. The true answer is **11** (the facts store `kind='open_question'`,
not `'question'`). The ask returned `status: ok, confidence: 1` — a **silent
wrong answer**: the planner, given DDL-only schema, guessed the low-cardinality
categorical value and missed. This is the exact
[`E-09`](../engine/E-09-schema-value-linking.md) schema-value-linking gap —
⛔ blocked by [`GLOBAL-037`](../../../../decisions/GLOBAL-037-schema-only-llm-egress.md)
— manifesting live, and it is a **criterion-3 (wrong-answer-accepted) incident**:
criterion 2's counter scores #8 as "ok" (valid SQL, executed, returned a row),
which is precisely why criterion 3 is a *separate* judgement over the workload's
real answers — the instrument cannot see semantic error. Criterion 3 therefore
has evidence **against** it and cannot go green until E-09's GLOBAL-037-compliant
re-scope lands (declare the categorical domains as DDL `ENUM`/`CHECK` so the value
set is legitimate schema egress).

**Criteria readout after run 1:**

| # | Criterion | Before | After run 1 |
|---|-----------|--------|-------------|
| 1 | ≥ 100 real public-MCP asks from the ops workload | 0 (unstartable) | **12** (real, measured — grows via sustained use; < 100) |
| 2 | First-10 success ≥ 95 % on that workload | N = 0 (not measurable) | **100 % (10/10)** → meets the bar (SK-GTM-008 renders it green live from the D1 `first10` counters) |
| 3 | Zero silent wrong-answer-accepted incidents | unstartable | **1 incident found** (query #8) — NOT green; E-09/GLOBAL-037-blocked |

**Remaining before D-04 is fully done:**
- **Set the `NLQDB_MEMORY_DB` repo variable to `db_agent_memory_v1_3a8a72`** to
  light up [`D-02`](D-02-resync-hook.md)'s `memory-sync.yml` sustained hook (one
  `gh variable set`; the GitHub variable-write API is not exposed in the `/daily`
  container's tooling, so it lands from a run/host that has it — it is a public
  config value, not a secret, so **not** a `blocked-by-human` founder item per
  rule 4 / GLOBAL-033).
- **Run 2** — the repeatable gate-progress readout so `/daily` step 1 restates
  criteria 1–3 without re-running the workload.

## Read first

- [`SK-PIVOT-016`](../../decisions/SK-PIVOT-016-dogfood-launch-gate.md) — the
  five criteria and the **public-surfaces-only** rule a reviewer enforces
- [`SK-PIVOT-017`](../../decisions/SK-PIVOT-017-docs-to-memory-skill.md) — "nlqdb's
  own `docs/` is the first corpus — simultaneously the gate workload and the
  launch demo"
- [`E-03`](../engine/E-03-memory-scoping.md) + [`E-06`](../engine/E-06-agents-createform-preset.md)
  — the chain above, in the engine track's own words
- `docs/features/onboarding/FEATURE.md` (`SK-ONBOARD-007`) — how
  first-10-queries success is actually computed, so criterion 2 is read off the
  existing instrument and not re-derived by hand
- `apps/api/src/memory/remember.ts` + `expire.ts` — the write verb and the TTL
  sweep this corpus becomes the first real subject of

## Steps

1. **Run 1 — provision + first sync.** Verify the chain (E-03 merged, #835
   merged, E-03's backfill line present). Create the memory DB through the
   **authed** create surface with `{ preset: "agent_memory_v1" }`
   (`SK-PIVOT-010` — never the anon path). Mint an `sk_mcp_*` MCP key exactly as a
   stranger would, configure `npx -y @nlqdb/mcp`, run D-01's skill against
   `docs/`. Set the new DB's id as the `NLQDB_MEMORY_DB` repo variable so
   [`D-02`](D-02-resync-hook.md)'s `memory-sync.yml` goes live (a variable, not
   a secret — agent-settable). Record: rows written per table, asks issued,
   wall-clock, and every failure verbatim — the failures are the launch post's
   whole value ("here's what broke").
2. **Run 2 — the gate-progress readout.** Ship a repeatable way to read
   criteria 1–3 off this workload, so `/daily` step 1 can restate `n/5` each run
   without archaeology (SK-PIVOT-016 requires that restatement). Criterion 1 =
   the workload's `/v1/ask` count; criterion 2 = row #4's instrument scoped to
   this DB; criterion 3 = a stated incident definition plus what was checked.
   Write the numbers into [`INDEX.md`](INDEX.md)'s gate table.

## Done when

- [x] Chain verified in writing before any row is written: E-03 merged, #835
      merged, `SK-HDC-021` (#965) preset-create-boundary merged; create returned
      201 before any write.
- [x] A prod `agent_memory_v1` DB holds the extracted `docs/` corpus
      (`db_agent_memory_v1_3a8a72`), created through the **authed** surface with a
      self-minted `sk_mcp_*` key. Corpus **writes** went through the D-02
      convergent sync's keyed `/v1/memory/remember` (product code, founder-blessed
      2026-08-10 — the same endpoint `nlqdb_remember` wraps); the **read/ask**
      workload went through `nlqdb_query` over the published `@nlqdb/mcp` stdio
      server. No privileged endpoint, internal binding, or platform DB touched.
- [x] Rows-per-table, asks issued, and the one wrong answer **verbatim** recorded
      in the Run log above.
- [x] Criterion 1 readout prints a number: **12** (< 100 — grows via sustained use).
- [x] Criterion 2 measured on the workload: **100 % (10/10)** — the SK-ONBOARD-006
      `first10_ok/first10_asks` instrument, scoped to this DB by tenant.
- [x] Criterion 3 incident recorded: query #8 (`kind='question'` vs stored
      `open_question` → 0 rows, true 11) is a silent wrong-answer-accepted incident
      (E-09/GLOBAL-037-blocked). Definition: an ask returning `status: ok` whose
      answer is semantically wrong.
- [x] [`INDEX.md`](INDEX.md)'s gate table + this run's scorecard carry the three
      numbers and agree.
- [ ] INDEX tracker fully ticked — held: D-04 is 🟡 run-1-done, not complete
      (`NLQDB_MEMORY_DB` var + run-2 readout remain).

## Artifact

**The launch post's raw material** — "we ran our own company's ops on our own
memory through the public MCP endpoint; here's what broke." Named as the launch
demo in `blocked-by-human.md` bullet #1 and in `research/launch-kit.md` §3.1's
fact sheet. Draft it into `research/distribution-queue.md` even if the run's
numbers are unflattering; unflattering is the point (`SK-PIVOT-019`'s
concede-columns logic applies here too).

## Rollback

Drop the memory DB. Markdown is canonical and untouched (SK-PIVOT-017's
one-way rule), so nothing is lost but the index — which D-02's hook rebuilds.
If `MEMORY_PRESET` is unflipped, the preset path 400s and this corpus becomes
unreachable rather than corrupt; that is the intended failure mode.
