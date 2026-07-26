# SK-PIVOT-007 — Memory schema `agent_memory_v1` is the canonical shape; evolve by version, never in place

- **Decision:** Agent memory has one canonical schema —
  `agent_memory_v1`'s four tables (`facts`, `episodes`, `entities`,
  `entity_facts`) — and it is part of the **public contract** once shipped.
  Schema evolution happens by promoting to `agent_memory_v2` with a
  documented compatibility note; no in-place column rename or table
  removal on an active memory preset.
- **Core value:** Bullet-proof, Simple
- **Why:** Once an agent's memory lives in `agent_memory_v1`, its `WHERE`
  predicates, MCP-host configs, and downstream analytics all assume the
  shape. An in-place rename is a silent breaking change for every
  integrator. The schema-widening rule (GLOBAL-004) already says logical
  schemas only widen — versioning the preset is the application of that
  rule to a *named* schema (rather than a user-inferred one). The
  ClickHouse migration rule (E-07) hashes on this version to pick a
  target.
- **Consequence in code:** `agent_memory_v1` DDL ships from a typed module
  whose `versionTag` flows into `schema_hash`. Adding a column (widening)
  is allowed; renaming or removing one requires `agent_memory_v2`. The
  agent-scope RLS (E-03, SK-PIVOT-009) is added on the preset path; the
  recall-fusion logic (E-05) and the workload-analyzer rule (E-07) key on
  the version. Tests pin the column set so a silent drift is rejected at
  PR time.
- **Alternatives rejected:** **No versioning — evolve in place** — silent
  breakage for every integrator on the next schema change. · **Per-tenant
  custom memory schemas** — defeats the "zero schema design" wedge; the
  preset *is* the value. · **Defer versioning to v2 time** — versioning is
  a contract; adding it later is harder than starting with it.
