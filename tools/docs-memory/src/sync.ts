#!/usr/bin/env bun
// docs→memory sync — the dogfood workload's producer, run over nlqdb's own
// `docs/`. Two modes, both $0 and no-LLM:
//
//   bun src/sync.ts            # dry-run: report the extraction yield offline
//   bun src/sync.ts --json     # dry-run, machine-readable
//   bun src/sync.ts --apply    # D-02b: convergent write through the public API
//
// `--apply` is the authenticated, convergent write path (D-02b). Fact rows are
// append-only, so it **reads before writing**: it SELECTs the current index
// (`/v1/run`, the read verb decided in `converge.ts`), diffs by
// `source.key → source.digest`, and writes only what changed
// (`/v1/memory/remember`). A re-run over an unchanged corpus writes 0 facts —
// the idempotency `converge.test.ts` proves offline. It runs only when the
// env below is present (the CI `memory-sync.yml` supplies it); otherwise it
// prints a reason and exits 0, never red, so the workflow is committed-but-dark
// until the `NLQDB_API_KEY` secret lands (blocked-by-human queue #2).
//
// Docs: docs/archive/prior-bet/agent-memory-pivot-worksheets/dogfood/D-02-resync-hook.md

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { existingFromRows, FACTS_READ_SQL, planWrites, type WritePlan } from "./converge.ts";
import { type Extraction, extractCorpus } from "./extract.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DOCS = resolve(REPO_ROOT, "docs");

function corpusFiles(): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];

  const blocked = resolve(DOCS, "blocked-by-human.md");
  try {
    files.push({ path: "docs/blocked-by-human.md", content: readFileSync(blocked, "utf8") });
  } catch {
    // absent in a shallow checkout — the extractor simply yields no queue rows
  }

  const featuresDir = resolve(DOCS, "features");
  for (const entry of readdirSync(featuresDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = `docs/features/${entry.name}/FEATURE.md`;
    try {
      files.push({
        path,
        content: readFileSync(resolve(featuresDir, entry.name, "FEATURE.md"), "utf8"),
      });
    } catch {
      // a feature dir without a FEATURE.md — skip
    }
  }
  return files;
}

function countByKind(items: { kind: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) out[it.kind] = (out[it.kind] ?? 0) + 1;
  return out;
}

function summarise(ex: Extraction): string {
  const facts = countByKind(ex.facts);
  const entities = countByKind(ex.entities);
  const lines = [
    "docs→memory extraction (dry-run, offline — writes nothing)",
    "",
    `entities: ${ex.entities.length}  ${JSON.stringify(entities)}`,
    `facts:    ${ex.facts.length}  ${JSON.stringify(facts)}`,
    "",
    "Sample facts:",
    ...ex.facts.slice(0, 5).map((f) => `  - [${f.kind}] ${f.content}  (key ${f.source.key})`),
    "",
    "Convergent write is `--apply` (D-02b); set NLQDB_API_KEY + NLQDB_MEMORY_DB.",
  ];
  return lines.join("\n");
}

// ─── --apply: convergent authenticated write (D-02b) ─────────────────────────

type ApplyEnv = { apiBase: string; apiKey: string; db: string };

/** Read the env the apply path needs, or the reason it must skip (green). */
function applyEnv(): { ok: true; env: ApplyEnv } | { ok: false; reason: string } {
  const apiKey = process.env["NLQDB_API_KEY"]?.trim();
  const db = process.env["NLQDB_MEMORY_DB"]?.trim();
  const apiBase = (process.env["NLQDB_API_BASE"]?.trim() || "https://api.nlqdb.com").replace(
    /\/$/,
    "",
  );
  if (!apiKey) return { ok: false, reason: "NLQDB_API_KEY not set (blocked-by-human queue #2)" };
  if (!db) return { ok: false, reason: "NLQDB_MEMORY_DB not set (the ops memory DB — D-04)" };
  return { ok: true, env: { apiBase, apiKey, db } };
}

async function api(env: ApplyEnv, path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${env.apiBase}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function readExistingFacts(env: ApplyEnv) {
  const json = await api(env, "/v1/run", { db: env.db, sql: FACTS_READ_SQL });
  const rows = (json["rows"] as Array<Record<string, unknown>>) ?? [];
  return existingFromRows(rows);
}

async function apply(ex: Extraction): Promise<void> {
  const gate = applyEnv();
  if (!gate.ok) {
    console.info(`docs→memory --apply skipped: ${gate.reason}. Nothing written (exit 0).`);
    return;
  }
  const env = gate.env;
  const existing = await readExistingFacts(env);
  const plan: WritePlan = planWrites(existing, ex);

  // Entities upsert on (agent, kind, name), so re-sending is never a new row.
  for (const entity of plan.entities) {
    await api(env, "/v1/memory/remember", { db: env.db, kind: "entity", payload: entity });
  }
  // Facts are append-only, so only the diffed set is written (convergence).
  for (const f of plan.factsToWrite) {
    await api(env, "/v1/memory/remember", {
      db: env.db,
      kind: "fact",
      payload: { content: f.content, kind: f.kind, tags: f.tags, source: f.source },
    });
  }

  const calls = plan.entities.length + plan.factsToWrite.length;
  console.info(
    [
      "docs→memory --apply (convergent, read-before-write):",
      `  existing facts read: ${existing.size}`,
      `  entities upserted:   ${plan.entities.length}`,
      `  facts written:       ${plan.factsToWrite.length}`,
      `  facts unchanged:     ${plan.factsUnchanged.length} (skipped)`,
      `  /v1/memory/remember calls: ${calls}`,
    ].join("\n"),
  );
}

// ─── entrypoint ──────────────────────────────────────────────────────────────

const ex = extractCorpus(corpusFiles());
if (process.argv.includes("--apply")) {
  await apply(ex);
} else if (process.argv.includes("--json")) {
  console.info(JSON.stringify(ex, null, 2));
} else {
  console.info(summarise(ex));
}
