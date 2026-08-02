#!/usr/bin/env bun
// docs→memory sync — the dogfood workload's producer, run over nlqdb's own
// `docs/`. This entrypoint is **dry-run only** (offline, $0, no secret): it
// walks the corpus, runs the deterministic extractor, and reports what it
// *would* write. The authenticated, convergent write path is `D-02b` — fact
// rows are append-only, so a real sync must read-before-write per source.key,
// and which read verb (and whether the `sk_mcp_` scope permits it) is that
// slice's open design question. Keeping this run write-free keeps it honest
// and free.
//
//   bun src/sync.ts            # human summary of the extraction yield
//   bun src/sync.ts --json     # the full extraction, for D-02b to consume
//
// Docs: docs/features/agent-memory-pivot/worksheets/dogfood/D-02-resync-hook.md

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
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
    "Authenticated convergent sync is D-02b (read-before-write for append-only facts).",
  ];
  return lines.join("\n");
}

const ex = extractCorpus(corpusFiles());
if (process.argv.includes("--json")) {
  console.info(JSON.stringify(ex, null, 2));
} else {
  console.info(summarise(ex));
}
