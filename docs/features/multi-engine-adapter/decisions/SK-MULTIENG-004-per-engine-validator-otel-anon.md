# SK-MULTIENG-004 — Per-engine validator path, OTel attributes, and anon-mode posture

Parent feature: [`multi-engine-adapter/FEATURE.md`](../FEATURE.md).

- **Decision:** Each adapter ships a sibling validator and OTel attribute mapping. Anon-mode ([`GLOBAL-007`](../../../decisions/GLOBAL-007-no-login-wall.md)) is opt-in per engine.
  - **Validators:** PG read/write = `node-sql-parser` (`sql-validate.ts`; the DDL sibling `sql-validate-ddl.ts` is the `libpg_query` one — `SK-HDC-006`). Tinybird/ClickHouse = Pipe-name + table-name allowlist + dialect parse for raw-SQL escape hatch (`sqlglot`-equivalent) — CH read/write reuses the PG `sql-validate.ts` as-is today (`byo-connect/FEATURE.md` Open question (a)). Redis (when shipped) = command allowlist (verbs are a finite set). Mongo (if ever) = `mongodb-js/stage-validator`. Each adapter's validator lives at `packages/db/src/<engine>/validator.ts`.
  - **OTel:** every span = `db.query`. Canonical `db.system` per engine — `postgresql`, `redis`, `mongodb` (stable in semconv v1.27+); ClickHouse lacks a canonical value, emit `other_sql`. Required attributes per engine: PG = `db.namespace, db.operation.name, db.query.text`; Redis = `db.operation.name`; Mongo = `db.collection.name, db.operation.name, db.namespace` (no `db.query.text` — privacy convention).
  - **Anon-mode:** PG path keeps schema-per-anon. Tinybird launches **sign-in-only** — the global anon rate-limit (`anon-global-cap.ts`) gates anon traffic away from non-PG engines until per-prefix isolation is hardened. Adding anon-mode on an engine = a follow-up SK block, not part of the adapter-launch slice.
- **Core value:** Bullet-proof, Honest latency
- **Why:** OSS validators exist where they exist; hand-rolling allowlists is bounded only for engines with finite verb sets. Per-engine OTel attributes are a [`GLOBAL-014`](../../../decisions/GLOBAL-014-otel-on-external-calls.md) parity requirement; canonical `db.system` values are in the spec for the engines that have them. Anon-mode parity is engine-by-engine work; gating Tinybird sign-in-only at launch keeps the multi-tenant prefix isolation off the critical path.
- **Consequence in code:** New adapter PR template = `<engine>/{adapter,validator,otel-attrs}.ts` + an entry in the engine-fit table (`SK-MULTIENG-002`) + a one-line classifier-prompt edit (`packages/llm/src/prompts.ts`). Anon-mode wiring on a new engine is its own follow-up PR. The `other_sql` `db.system` constant lives in `packages/db/src/clickhouse-tinybird/otel-attrs.ts` and is reused by the connect-time introspection reader (`SK-MULTIENG-007`).
- **Alternatives rejected:**
  - Universal validator — engines have incommensurable grammars; one parser cannot cover them.
  - Lift OTel up out of the adapter — caller doesn't have the engine-native operation; cardinality risk.
  - Block all anon traffic on first non-PG engine — overkill; the global cap already deflects abuse.
