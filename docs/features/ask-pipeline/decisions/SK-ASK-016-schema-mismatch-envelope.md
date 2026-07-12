# SK-ASK-016 — `schema_mismatch` envelope: pre-flight + 42P01 backstop, both Nonrecoverable, surface as 409

- **Decision:** When LLM-emitted SQL references a table not in the target DB, the orchestrator returns `{ status: "schema_mismatch", referencedTables, schemaTables }` as HTTP 409. Two paths converge: (A) pre-flight `extractTables(planSql)` vs. `db.schemaText` regex; (B) post-exec backstop — `42P01` caught in the exec callback, wrapped `Nonrecoverable` so SK-ASK-013's retry bails after one attempt. Pre-flight skipped when `schemaText` is null; the backstop covers those + regex misses.
- **Core value:** Bullet-proof, Honest latency, Effortless UX
- **Why:** The failure is deterministic — three retries replay the same wrong SQL, then 502 `db_unreachable` 600+ ms later (surface lies "couldn't reach the DB"). Pre-flight catches it in ~0.5 ms; 42P01 is defense in depth. The 409 lets the surface re-route rather than dead-end.
- **Consequence in code:** `checkSchemaTables` runs between plan emit and exec; the exec catch wraps 42P01 in `Nonrecoverable`; the `schema_mismatch` AskError maps to HTTP 409.
- **Alternatives rejected:** Retry plan with rejected table — LLM re-picks it. Auto-reroute to create — same misclassification. Treat 42P01 as recoverable — worse latency. `.code` only — Neon's HTTP shim drops it; keep the regex fallback.

