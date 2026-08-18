# SK-LLM-050 — No-invented-identity directive in the planner prompt (write-scoped)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md)'s `PLAN_DIRECTIVES`
block; the only **write-scoped** bullet in it. Pairs with
[`SK-TRUST-006`](../../trust-ux/decisions/SK-TRUST-006-zero-effect-writes.md)
and
[`SK-ASK-029`](../../ask-pipeline/decisions/SK-ASK-029-write-constraint-envelope.md),
which make the shapes it steers toward honest instead of silent.

- **Decision:** One bullet, placed before the dialect-strict bullet: for an
  `INSERT`/`UPDATE`/`DELETE`, never invent a value the goal did not supply — fill
  a foreign key / owner / identity column only from a value the goal states, and
  never by picking an arbitrary row (no `SELECT … LIMIT 1` without a predicate
  the goal states), by inventing a placeholder id (no all-zero UUID), or by
  matching a word from the goal against a column the goal does not name. When
  the goal does not identify the row, write only the columns it does supply.
- **Core value:** Bullet-proof, Engine quality
- **Why:** Production, 2026-08-17/18, three attempts at *"add an idea to build
  trust mcp directory rateme12345"* against a schema whose `ideas.user_id` is
  NOT NULL with an FK to `users`. The planner (a) filled `user_id` with
  `SELECT "id" FROM "users" LIMIT 1` — the row landed on a **seeded demo user**,
  the exact silent-wrong-write no guardrail can catch, since the statement is
  valid, the count is 1, and the diff is truthful; (b) invented
  `00000000-0000-0000-0000-000000000000`, hitting the FK; (c) matched the
  trailing token `rateme12345` against `email`/`name`, matching nothing. Only (a)
  is unrecoverable, and only a prompt rule prevents it — the other two now
  surface as `write_constraint` / `write_no_rows`. Hence the bullet's closing
  framing: *a write that fails or matches nothing is recoverable; a write aimed
  at the wrong row is not.*
- **Consequence in code:** one string in `PLAN_DIRECTIVES`
  (`packages/llm/src/prompts.ts`, ≈70 input tokens per `plan` call); `PLAN_SYSTEM`
  and provider wiring unchanged, and `buildPlanSystem(k ≤ 0)` still returns it
  byte-for-byte ([`SK-LLM-041`](./SK-LLM-041-similarity-retrieved-few-shot.md)).
  Pinned by `packages/llm/test/prompts.test.ts`.
- **Eval risk:** none by construction — BIRD and Spider are read-only
  (`SELECT`), so a write-scoped bullet cannot move either score. This is the
  bound [`SK-LLM-044`](./SK-LLM-044-entity-identification-projection-directive.md)
  lacked when it regressed BIRD: no read-path behaviour is touched.
- **Alternatives rejected:**
  - **Add a `clarify` channel to the plan JSON so the model can ask instead of
    writing.** The right long-term shape, but it widens the strict-JSON contract
    every read request also uses — a decode-adherence risk on the free models
    the headline KPI is measured on (`GLOBAL-026`). Revisit behind a
    quality-eval A/B; until then `write_no_rows` / `write_constraint` carry the
    clarification honestly.
  - **Inject the caller's authenticated identity into the write.** The hosted
    DB's `users` table is the *user's own data*, not nlqdb accounts — mapping one
    onto the other would write a fabricated ownership claim.
  - **Reject `LIMIT 1`-in-a-write in the SQL allowlist.** A legitimate write can
    use `LIMIT`; a syntactic ban punishes correct statements while the actual
    defect (an unstated predicate) stays expressible.
