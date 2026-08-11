// Production wiring for the pack runner (D-08 slice 1). Kept out of the
// route bodies so the state machine's dependency surface is one readable
// object, and out of `runner.ts` so the state machine stays unit-testable
// with no env, no D1 and no network.

import { trace } from "@opentelemetry/api";
import { buildAskDeps, buildMemoryExec } from "../ask/build-deps.ts";
import { resolveDb } from "../db-registry.ts";
import { orchestrateRemember, type RememberArgs } from "../memory/remember.ts";
import { makeD1DraftStore } from "./draft-store.ts";
import { languageTutorPack } from "./packs/language-tutor.ts";
import { repoOpsPack } from "./packs/repo-ops.ts";
import type { RunnerDeps } from "./runner.ts";
import type { PackAdapter, SourceLimits } from "./types.ts";

/** The pack registry. Adding a pack is one entry here plus its adapter. */
export const PACKS: Record<string, PackAdapter> = {
  [repoOpsPack.id]: repoOpsPack,
  [languageTutorPack.id]: languageTutorPack,
};

// Caps chosen against the Workers free tier: the whole expanded archive is
// held in memory once, so `maxTotalBytes` is the real constraint, and a
// source over it fails loud with `source_too_large` rather than being
// silently truncated into a misleading preview.
export const SOURCE_LIMITS: SourceLimits = {
  maxItems: 20_000,
  maxItemBytes: 512 * 1024,
  maxTotalBytes: 24 * 1024 * 1024,
};

/**
 * `agent_id` the import's rows are written under. Per-pack, so pack #2's
 * memory is scoped apart from pack #1's in the same DB, and it matches the
 * `SK-QUAL-023` corpus (`agent_id = 'repo-ops'`) the golden queries assume.
 * The `SK-PIVOT-009` policy's baked tenant arm keeps the account principal
 * sighted across every agent, so this narrows and never hides.
 */
export function packAgentId(packId: string): string {
  return packId;
}

export function buildPackRunnerDeps(
  env: Cloudflare.Env,
  tenantId: string | null,
  packId: string,
): RunnerDeps {
  const tracer = trace.getTracer("@nlqdb/api");
  const askDeps = buildAskDeps(env);
  const agentId = packAgentId(packId);

  return {
    store: makeD1DraftStore(env.DB),
    packs: PACKS,
    ctx: { tracer, fetch: (input, init) => fetch(input, init), limits: SOURCE_LIMITS },
    now: () => Date.now(),
    newId: () => crypto.randomUUID(),

    async writeMemory(dbId, record) {
      const args = { db: dbId, kind: record.object, payload: record.payload } as RememberArgs;
      const outcome = await orchestrateRemember(
        {
          resolveDb: askDeps.resolveDb,
          execMemory: buildMemoryExec,
          // The per-principal `/v1/ask` limiter is 60/min, so applying it
          // per row would make any real import impossible. The import is
          // rate-limited once per advance at the route instead — the right
          // granularity, since one user action is one advance.
          rateLimiter: { check: async () => ({ allowed: true, count: 0, limit: 0, resetAt: 0 }) },
        },
        {
          args,
          userId: tenantId ?? "",
          agentId,
        },
      );
      if (!outcome.ok) throw new Error(`remember_failed:${outcome.error.status}`);
    },

    async countRows(dbId) {
      const db = tenantId ? await resolveDb(env.DB, dbId, tenantId) : null;
      if (!db) throw new Error("remember_failed:db_not_found");
      // Server-built constant SELECT — never LLM-composed. It reuses the
      // memory exec wrapper so the count runs under the same tenant role
      // and the same `app.agent_id` scope as the writes did, which is what
      // makes "planned vs written" a real reconcile rather than a guess.
      // `table` on the plan type is descriptive metadata only; the wrapper
      // executes `text` + `params`.
      const result = await buildMemoryExec(db, {
        table: "facts",
        text:
          "SELECT (SELECT COUNT(*) FROM entities) AS entity, " +
          "(SELECT COUNT(*) FROM facts) AS fact, " +
          "(SELECT COUNT(*) FROM episodes) AS episode",
        params: [],
        scope: { agentId },
      });
      const row = (result.rows[0] ?? {}) as Record<string, unknown>;
      return {
        entity: Number(row["entity"] ?? 0),
        fact: Number(row["fact"] ?? 0),
        episode: Number(row["episode"] ?? 0),
      };
    },
  };
}
