// DDL allow-list — defense-in-depth for the db.create path
// (docs/design.md §3.6.5, SK-HDC-006). Sibling of `sql-validate.ts`,
// which guards the read/write `/v1/ask` path; same primitives, two
// distinct files, **non-overlapping verb sets** so each one is
// trivially auditable. See `.claude/skills/hosted-db-create/SKILL.md`
// SK-HDC-006 for why duplication is the point — a reviewer asking
// "could the LLM ever execute DROP?" reads exactly one short file
// (`sql-validate.ts`); a reviewer asking "could the compiler emit
// pg_sleep?" reads exactly this one.
//
// What this validates: the byte-string output of
// `apps/api/src/db-create/compile-ddl.ts` — `CREATE SCHEMA`,
// `CREATE TABLE`, `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY …`,
// `CREATE INDEX`. Anything else is rejected: every destructive verb
// (DROP / TRUNCATE / GRANT / REVOKE), `pg_catalog` /
// `information_schema` references in any RangeVar or qualified
// FuncCall, and the side-effecting function set per
// `docs/research-receipts.md §10` (`pg_sleep`, `dblink_*`, `lo_*`,
// `pg_read_file`, `pg_ls_dir`, `COPY ... FROM PROGRAM`).
//
// Why libpg_query and not node-sql-parser:
//   `sql-validate.ts` (read/write) uses node-sql-parser because it's
//   smaller and the read/write verb set is simple. The DDL path needs
//   the actual Postgres parser because (a) DDL grammar varies between
//   PG-specific variants node-sql-parser doesn't fully cover (e.g.
//   `MATERIALIZED VIEW`), and (b) AST node names like `AlterTableCmd
//   .subtype === AT_AddConstraint` are PG-internal; matching on them
//   gives us a tight allow rule.
//
// This module is pure / synchronous. The provisioner
// (`apps/api/src/db-create/neon-provision.ts`, Worksheet C) executes
// the SQL after this validator says ok.

import {
  type AlterTableCmd,
  type AlterTableStmt,
  type AlterTableType,
  type Constraint,
  type ConstrType,
  type CopyStmt,
  type FuncCall,
  loadModule,
  type Node,
  parseSync,
  type RangeVar,
  type RawStmt,
} from "libpg-query";

// libpg_query is a WASM build; the module loader is async-only.
// Top-level await keeps the public API (parseSync) synchronous —
// any importer of this module just inherits the one-time init wait.
// Bundle-weight note (GLOBAL-013): this module is only on the create
// path. `/v1/ask` cold-start chunk pulls `sql-validate.ts`
// (node-sql-parser, read/write); it does NOT pull this file. Verified
// by the import graph at commit time.
await loadModule();

export type DdlValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: DdlValidationFailureReason;
      statement: string;
      details?: unknown;
    };

export type DdlValidationFailureReason =
  | "parse_failed"
  | "destructive_verb"
  | "system_schema_ref"
  | "side_effect_function";

const SIDE_EFFECT_FUNCTIONS = new Set([
  "pg_sleep",
  "pg_sleep_for",
  "pg_sleep_until",
  "lo_import",
  "lo_export",
  "lo_creat",
  "lo_create",
  "pg_read_file",
  "pg_read_binary_file",
  "pg_ls_dir",
  "pg_stat_file",
]);

function isDblink(name: string): boolean {
  return name === "dblink" || name.startsWith("dblink_");
}

type NodeKey = keyof Node;

// libpg_query wraps every node as `{ <NodeKind>: <body> }`. Pulls the
// single key out so the walk can dispatch on it without an explicit
// `if ("DropStmt" in node)` chain at every level.
function nodeKind(node: unknown): NodeKey | null {
  if (node === null || typeof node !== "object") return null;
  const keys = Object.keys(node);
  if (keys.length === 0) return null;
  return keys[0] as NodeKey;
}

type RejectHit = {
  reason: DdlValidationFailureReason;
  details?: unknown;
};

function checkAlterTable(stmt: AlterTableStmt): RejectHit | null {
  // ALTER TABLE is allowed iff every cmd in the stmt is AT_AddConstraint
  // (the FK-attach pass our compiler emits). Any other subtype (drop
  // column, drop constraint, set default, …) reverts to the destructive
  // bucket — the compiler doesn't emit them, so seeing one means a
  // regression.
  const allowedSubtype: AlterTableType = "AT_AddConstraint";
  const allowedContype: ConstrType = "CONSTR_FOREIGN";
  for (const cmd of stmt.cmds ?? []) {
    const inner = (cmd as { AlterTableCmd?: AlterTableCmd }).AlterTableCmd;
    if (!inner) continue;
    if (inner.subtype !== allowedSubtype) {
      return {
        reason: "destructive_verb",
        details: { altercmd_subtype: inner.subtype },
      };
    }
    // AT_AddConstraint allows non-FK constraints in principle (CHECK,
    // UNIQUE, PRIMARY KEY). Our compiler only emits CONSTR_FOREIGN —
    // narrow accordingly so a future bug emitting `ADD CHECK (1=0)`
    // can't slip through.
    const def = (inner.def as { Constraint?: Constraint } | undefined)?.Constraint;
    if (!def || def.contype !== allowedContype) {
      return {
        reason: "destructive_verb",
        details: { constraint_kind: def?.contype ?? null },
      };
    }
  }
  return null;
}

function checkCopyStmt(stmt: CopyStmt): RejectHit | null {
  if (stmt.is_program === true) {
    return { reason: "side_effect_function", details: { copy_from_program: true } };
  }
  return null;
}

function checkRangeVar(rv: RangeVar): RejectHit | null {
  const schema = rv.schemaname?.toLowerCase();
  if (schema === "pg_catalog" || schema === "information_schema") {
    return { reason: "system_schema_ref", details: { schema: rv.schemaname } };
  }
  return null;
}

function checkFuncCall(fc: FuncCall): RejectHit | null {
  // Function name is a list of `String` nodes — `["pg_catalog", "pg_sleep"]`
  // or just `["pg_sleep"]`. We check both the unqualified tail (covers the
  // common case) and the qualified form (covers `SELECT pg_catalog.pg_sleep(1)`).
  const parts: string[] = [];
  for (const seg of fc.funcname ?? []) {
    const sval = (seg as { String?: { sval?: string } }).String?.sval;
    if (typeof sval === "string") parts.push(sval.toLowerCase());
  }
  if (parts.length === 0) return null;
  const tail = parts[parts.length - 1] ?? "";
  if (parts[0] === "pg_catalog" || parts[0] === "information_schema") {
    return { reason: "system_schema_ref", details: { funcname: parts.join(".") } };
  }
  if (SIDE_EFFECT_FUNCTIONS.has(tail) || isDblink(tail)) {
    return { reason: "side_effect_function", details: { funcname: tail } };
  }
  return null;
}

// The AST walk is the actual reject engine — every other helper feeds
// it. Three categories the walk hunts for:
//   1. destructive top-level / embedded verbs (Drop, Truncate, Grant,
//      Revoke, plus Alter unless it's AT_AddConstraint of a FK);
//   2. system schema references in any RangeVar (covers FROM
//      pg_catalog.x AND `WITH x AS (DELETE FROM information_schema.…)`
//      style hides);
//   3. side-effect function calls (pg_sleep, dblink, lo_import, …).
function walkNode(node: unknown): RejectHit | null {
  if (node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = walkNode(item);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const kind = nodeKind(obj);

  if (kind === "DropStmt") {
    return { reason: "destructive_verb", details: { stmt: "DropStmt" } };
  }
  if (kind === "TruncateStmt") {
    return { reason: "destructive_verb", details: { stmt: "TruncateStmt" } };
  }
  if (kind === "GrantStmt") {
    return { reason: "destructive_verb", details: { stmt: "GrantStmt" } };
  }
  if (kind === "GrantRoleStmt") {
    return { reason: "destructive_verb", details: { stmt: "GrantRoleStmt" } };
  }
  if (kind === "AlterTableStmt") {
    const hit = checkAlterTable(obj["AlterTableStmt"] as AlterTableStmt);
    if (hit) return hit;
  }
  if (kind === "CopyStmt") {
    const hit = checkCopyStmt(obj["CopyStmt"] as CopyStmt);
    if (hit) return hit;
  }
  if (kind === "RangeVar") {
    const hit = checkRangeVar(obj["RangeVar"] as RangeVar);
    if (hit) return hit;
  }
  if (kind === "FuncCall") {
    const hit = checkFuncCall(obj["FuncCall"] as FuncCall);
    if (hit) return hit;
  }

  // Recurse. Skip the `kind` key itself only after we've inspected it —
  // we still need to descend into its body to catch nested patterns
  // (`AlterTableCmd.def.Constraint` was already handled, but FK
  // refs to pg_catalog tables would live inside `Constraint.pktable`).
  for (const value of Object.values(obj)) {
    const hit = walkNode(value);
    if (hit) return hit;
  }
  return null;
}

export function validateCompiledDdl(statements: string[]): DdlValidationResult {
  for (const stmt of statements) {
    let parsed: { stmts?: RawStmt[] };
    try {
      parsed = parseSync(stmt) as { stmts?: RawStmt[] };
    } catch (err) {
      return {
        ok: false,
        reason: "parse_failed",
        statement: stmt,
        details: err instanceof Error ? err.message : String(err),
      };
    }
    const hit = walkNode(parsed.stmts ?? []);
    if (hit) {
      return {
        ok: false,
        reason: hit.reason,
        statement: stmt,
        details: hit.details,
      };
    }
  }
  return { ok: true };
}
