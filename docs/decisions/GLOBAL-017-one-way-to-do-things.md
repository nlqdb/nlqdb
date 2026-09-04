# GLOBAL-017 — One way to do each thing

- **Decision:** `/v1/ask` is the single natural-language entry point
  (create, read, write, extend). Each control-plane resource — databases,
  keys, grants, optimizer proposals — has exactly one REST resource, and the
  CLI, MCP server and SDK expose exactly one verb / tool / method per
  operation. No aliases, no shadow endpoints. `/v1/run` stays the raw-SQL
  escape hatch ([`GLOBAL-015`](./GLOBAL-015-power-user-escape-hatch.md)).
- **Core value:** Simple, Effortless UX
- **Why:** Surface area is the enemy of learnability. If a user can do X
  "via two endpoints" or "via three commands," they spend energy on which
  one to pick instead of on their goal. A small canonical surface keeps docs
  short and behaviour consistent.
- **Consequence in code:** A new conceptual operation gets one home: extend
  `/v1/ask` when it is expressible in language, otherwise one new REST
  resource shipped to every surface in one PR (`GLOBAL-003`). The DBA
  surface follows this — proposals live at `/v1/dba/proposals` with
  `apply` / `undo`, `nlq dba …`, `nlqdb_dba_*` — one way each.
- **Alternatives rejected:**
  - Counting endpoints ("two endpoints, two verbs") — the count was a proxy
    for the rule and broke the first time a control-plane resource appeared.
  - Aliased CLI verbs — every alias is a new way to misuse the tool.
