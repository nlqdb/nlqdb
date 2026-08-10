// Durable import-draft storage for the shared pack runner (D-08 slice 1).
//
// The draft is the journey's whole memory. Its id is the ONLY thing that
// travels in a URL (`SK-PIVOT-021` resumable handoff) — source content,
// tokens and credentials never leave the server, so a refresh, a
// back/forward, a dropped connection, a sign-in round trip and a provider
// consent redirect all reopen the same phase by fetching this row.
//
// It lives in D1 (the control-plane DB, `GLOBAL-021`) beside `databases`
// and `grants`, not in the user's memory DB: it is product plumbing, not
// memory content, so it must survive the memory DB being deleted by the
// alpha cleanup (`SK-HDC-016`).
//
// `tenant_id` is NULL until sign-in. That is deliberate: a public-source
// preflight produces value before any account exists (`GLOBAL-007`), and
// `claim()` binds the draft to the first account that advances it.

import type { ImportPhase, MemoryRecord, SkipReason, SourceDescriptor } from "./types.ts";

/** What `inspecting` + `classifying` durably learned about the source. */
export type ScanCheckpoint = {
  itemsTotal: number;
  bytesTotal: number;
  eligible: number;
  /** Bounded sample the preview expands, newest-first insertion order. */
  skipped: { id: string; reason: SkipReason }[];
  /** Full histogram — always complete even when `skipped` is truncated. */
  skipReasons: Partial<Record<SkipReason, number>>;
};

export type Verification = {
  /** Planned rows per memory object, from the extraction plan. */
  planned: Record<string, number>;
  /** Rows actually present in the memory DB, read back after the writes. */
  written: Record<string, number>;
  /** Where `written` came from — a real read-back, or the save cursor alone. */
  writtenSource: "read_back" | "save_cursor";
  reconciled: boolean;
  /** One line per disagreement; empty when reconciled. */
  mismatches: string[];
  /** The pack's golden queries with their answers (`null` = not run). */
  golden: { query: string; answer: string | null }[];
};

export type ImportDraft = {
  id: string;
  /** NULL until the first authenticated advance claims it. */
  tenantId: string | null;
  packId: string;
  phase: ImportPhase;
  source: SourceDescriptor;
  /** The isolated `agent_memory_v1` DB this import writes to. */
  dbId: string | null;
  /** Records written so far — the resume cursor into `records`. */
  saveCursor: number;
  scan: ScanCheckpoint | null;
  records: MemoryRecord[] | null;
  verification: Verification | null;
  error: { phase: ImportPhase; reason: string } | null;
  createdAt: number;
  updatedAt: number;
};

export type DraftStore = {
  create(draft: ImportDraft): Promise<void>;
  get(id: string): Promise<ImportDraft | null>;
  save(draft: ImportDraft): Promise<void>;
  /** Atomically bind an unclaimed draft to a tenant. False = already claimed. */
  claim(id: string, tenantId: string): Promise<boolean>;
  remove(id: string): Promise<void>;
};

// Everything variable-length rides one JSON blob: no query ever filters on
// the inner fields, so a column per field would only invite drift between
// the row and the type.
type StateBlob = {
  source: SourceDescriptor;
  scan: ScanCheckpoint | null;
  records: MemoryRecord[] | null;
  verification: Verification | null;
  error: { phase: ImportPhase; reason: string } | null;
};

type DraftRow = {
  id: string;
  tenant_id: string | null;
  pack_id: string;
  phase: string;
  db_id: string | null;
  save_cursor: number;
  state_json: string;
  created_at: number;
  updated_at: number;
};

function toRow(draft: ImportDraft): DraftRow {
  const state: StateBlob = {
    source: draft.source,
    scan: draft.scan,
    records: draft.records,
    verification: draft.verification,
    error: draft.error,
  };
  return {
    id: draft.id,
    tenant_id: draft.tenantId,
    pack_id: draft.packId,
    phase: draft.phase,
    db_id: draft.dbId,
    save_cursor: draft.saveCursor,
    state_json: JSON.stringify(state),
    created_at: draft.createdAt,
    updated_at: draft.updatedAt,
  };
}

function toDraft(row: DraftRow): ImportDraft {
  const state = JSON.parse(row.state_json) as StateBlob;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    packId: row.pack_id,
    phase: row.phase as ImportPhase,
    source: state.source,
    dbId: row.db_id,
    saveCursor: row.save_cursor,
    scan: state.scan,
    records: state.records,
    verification: state.verification,
    error: state.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function makeD1DraftStore(d1: D1Database): DraftStore {
  return {
    async create(draft) {
      const r = toRow(draft);
      await d1
        .prepare(
          "INSERT INTO pack_imports (id, tenant_id, pack_id, phase, db_id, save_cursor, state_json, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          r.id,
          r.tenant_id,
          r.pack_id,
          r.phase,
          r.db_id,
          r.save_cursor,
          r.state_json,
          r.created_at,
          r.updated_at,
        )
        .run();
    },
    async get(id) {
      const row = await d1
        .prepare(
          "SELECT id, tenant_id, pack_id, phase, db_id, save_cursor, state_json, created_at, updated_at " +
            "FROM pack_imports WHERE id = ?",
        )
        .bind(id)
        .first<DraftRow>();
      return row ? toDraft(row) : null;
    },
    async save(draft) {
      const r = toRow(draft);
      await d1
        .prepare(
          "UPDATE pack_imports SET tenant_id = ?, phase = ?, db_id = ?, save_cursor = ?, state_json = ?, updated_at = ? WHERE id = ?",
        )
        .bind(r.tenant_id, r.phase, r.db_id, r.save_cursor, r.state_json, r.updated_at, r.id)
        .run();
    },
    async claim(id, tenantId) {
      // Conditional UPDATE wins-or-no-ops atomically, so two concurrent
      // sign-in returns cannot both claim the draft (same idiom as
      // `revokeGrantById`).
      const upd = await d1
        .prepare("UPDATE pack_imports SET tenant_id = ? WHERE id = ? AND tenant_id IS NULL")
        .bind(tenantId, id)
        .run();
      return upd.meta.changes === 1;
    },
    async remove(id) {
      await d1.prepare("DELETE FROM pack_imports WHERE id = ?").bind(id).run();
    },
  };
}

/** In-memory store for unit tests — the same contract, no D1 boot cost. */
export function makeMemoryDraftStore(): DraftStore & { size(): number } {
  const rows = new Map<string, DraftRow>();
  return {
    size: () => rows.size,
    async create(draft) {
      rows.set(draft.id, toRow(draft));
    },
    async get(id) {
      const row = rows.get(id);
      // Round-trip through the row shape so a unit test catches a field
      // that the D1 projection would have dropped.
      return row ? toDraft({ ...row }) : null;
    },
    async save(draft) {
      if (!rows.has(draft.id)) return;
      rows.set(draft.id, toRow(draft));
    },
    async claim(id, tenantId) {
      const row = rows.get(id);
      if (!row || row.tenant_id !== null) return false;
      rows.set(id, { ...row, tenant_id: tenantId });
      return true;
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}
