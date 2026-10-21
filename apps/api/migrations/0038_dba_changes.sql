-- GLOBAL-041 Phase A step 11 — the change ledger: one row per DDL statement
-- the DBA committed on a hosted DB (insert widen, chat widen, key index), with
-- the statement that undoes it. KPIs 1–2 and `/app/dba` read from it; Phase B
-- proposals become rows of it, not a second table.

CREATE TABLE dba_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,      -- 'insert' | 'ask'
  kind TEXT NOT NULL,        -- 'create_table' | 'add_column' | 'create_index'
  table_name TEXT NOT NULL,
  ddl TEXT NOT NULL,
  inverse TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX dba_changes_database ON dba_changes (database_id, id);
