# SK-PIVOT-017 — The dogfood workload is a productized docs→memory skill: extract structured operational knowledge, one-way sync, markdown stays canonical

- **Decision:** Ship an nlqdb-branded skill (agent-artifacts family, beside
  `nlqdb-memory`) that instructs a coding agent to **extract a repo's
  structured operational knowledge** — decisions (IDs, statuses, dates,
  cross-references), open questions (ages), queues, ledgers/trackers — into
  an nlqdb memory DB via the public MCP surface, and keep it fresh with a
  **one-way re-sync hook** (CI on merge and/or session start). Markdown
  remains the canonical, git-reviewed source of truth; the nlqdb DB is the
  derived, queryable index. nlqdb's own `docs/` is the first corpus — it is
  simultaneously the SK-PIVOT-016 gate workload and the launch demo. v1
  explicitly does **not** ingest arbitrary prose.
- **Core value:** Goal-first, Honest, Simple
- **Why:** "Chat with your docs" is crowded vector-RAG territory and plays
  to recall, where the competition is fine. What no one extracts is the
  *relational* layer docs actually contain — and the queries that matter
  are analytical (nlqdb's differentiator): "which features have open
  questions older than 30 days", "which decisions reference GLOBAL-013",
  "what is blocked and since when". It also fixes memory products'
  cold-start: every demo starts empty; this one imports knowledge the user
  already owns, on their own repo, in minutes. The golden-query eval set
  already exists — it is the grep/hand-edit work agents do against
  `docs/` today.
- **Consequence in code:** The skill writes through
  `nlqdb_remember`/`nlqdb_query` only (public MCP; an `sk_mcp_*` key) —
  never a privileged path. Sync is one-way and idempotent: a re-run after a
  docs change converges; nlqdb never edits markdown. A golden-query set
  (≥ 10, including temporal) gates the workload in the memory eval suite
  (`SK-QUAL-023` family). Anything that makes the DB the source of truth
  over markdown is a separate founder decision (P1), not a v1 default.
- **Alternatives rejected:** **Generic "compact your docs into nlqdb" RAG
  ingestion** — undifferentiated, recall-shaped, and stale-sync-fragile. ·
  **nlqdb as the docs' source of truth** — loses git review, breaks the
  human-approval operating model. · **Ops-metrics-only dogfood (scorecard
  numbers on a cron)** — 6×/day synthetic load vs every-session organic
  load; docs queries exercise the wedge's actual claim.
