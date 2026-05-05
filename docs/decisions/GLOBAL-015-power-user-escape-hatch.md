# GLOBAL-015 — Power users always have an escape hatch

- **Decision:** Every layer that turns natural language into something
  executable — `/v1/ask` → SQL, plan-cache → plan, db-adapter → query
  — exposes the underlying primitive directly. A power user can
  bypass the LLM and run raw SQL / Mongo / connection-string queries.
- **Core value:** Creative, Bullet-proof, Goal-first
- **Why:** Anyone who outgrows the conversational interface must not
  hit a wall. The product loses credibility (and users) if "the LLM
  decided" is the only path to the data. The escape hatch is also
  the thing that makes the LLM safe — humans can verify and fix.
- **Consequence in code:** `/v1/run` (raw query) sits next to
  `/v1/ask` (NL query). CLI's `nlq run` runs raw SQL. The plan
  surfaced from `/v1/ask` is editable and re-runnable. Connection
  strings are exposed for users on plans that can self-host the DB.
- **Alternatives rejected:**
  - LLM-only API — fine for demos, fatal for production users.
  - Hide raw access behind enterprise tier — blocks the OSS
    contributor path and contradicts `GLOBAL-019`.
