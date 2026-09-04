# GLOBAL-004 — The logical schema is inferred and evolves in both directions; physical layout reshapes freely

- **Decision:** The *logical* schema (tables and fields a query references)
  is inferred from inserts and reads and evolves in **both directions** —
  add, drop, rename, retype — as usage changes. Every logical change is a
  versioned, previewed change that rewrites `schema_hash`. *Physical* layout
  (indexes, materialised views, pipes, clustering, engine placement) reshapes
  under the optimizer without ever bumping the hash. Each adapter maps its
  native introspection to the logical schema.
- **Core value:** Goal-first, Bullet-proof, Simple
- **Why:** The developer does no data modeling
  ([`GLOBAL-041`](./GLOBAL-041-autonomous-dba.md)), so the schema must
  follow the data — a field that vanished from every write and read is a
  fact about the app, not an error. Decoupling logical from physical lets the
  optimizer re-index, re-cluster or move a table between engines without
  invalidating cached plans — referenced fields still resolve.
- **Consequence in code:** `schema_hash` is computed over the observed
  logical schema (names + types) and rewritten in D1 on every logical
  change; plan-cache entries keyed on the old hash evict by miss
  (`GLOBAL-006`). Physical reshapes write to `meta` and the optimizer audit,
  never to the hash. A vanished field is a versioned narrowing event
  (`SK-SCHEMA-009`): dependent cached plans re-plan; it is a hard-stop only
  while an active read still references the field.
- **Alternatives rejected:**
  - Widen-only ("once observed, never removed") — forces `nlq new` on every
    real schema break, the modeling chore `GLOBAL-041` removes.
  - Bump `schema_hash` on physical reshape — every optimizer tick would
    invalidate the cache and defeat the analyser thesis.
  - Branch the cache per schema version — more keys, more plans; the
    rewritten hash *is* the version.
