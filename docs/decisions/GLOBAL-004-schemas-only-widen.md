# GLOBAL-004 — Logical schemas widen; physical layout reshapes freely

- **Decision:** The *logical* schema (fields a query references) is
  monotonically widened in `schema_hash` — once observed, never
  removed. Physical layout (tables, indexes, materialised views, engine
  choice) reshapes under the planner without bumping the hash. Each
  adapter maps its native introspection to the logical hash.
- **Core value:** Bullet-proof, Simple
- **Why:** Schema-mismatch branching explodes plan-cache keys; widening
  is monotonic and safe. Decoupling logical from physical lets the
  workload analyser re-cluster a table or migrate engines without
  invalidating cached plans — referenced fields still resolve.
- **Consequence in code:** `schema_hash` is computed over observed
  field names; engine-specific introspection produces engine-specific
  hashes; appends only. Plan-cache keys outlive both widening *and*
  physical reshape. A field disappearing is a hard-stop event, not a
  branch.
- **Alternatives rejected:**
  - Versioned schemas — more keys, more plans, more bugs.
  - Re-plan on any schema change — breaks `GLOBAL-006`.
  - Bump `schema_hash` on physical reshape — defeats the analyser thesis.
