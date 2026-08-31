// EK-04 box 3 — "Rows verifiably on `agent_memory_v1` via public surfaces
// only", executed by Postgres rather than asserted about a mock. The unit
// tests (`language-tutor.test.ts`) pin the adapter's four pure methods; the
// runner unit tests (`runner.test.ts`) drive the journey over an in-memory
// `writeMemory`. Neither proves the one thing box 3 asks: that the rows the
// language-tutor pack plans actually LAND on a real `agent_memory_v1`
// database through the **public write surface** and read back with the
// vocabulary the golden queries depend on.
//
// "Public surface" is enforced structurally here: every write goes through
// `buildRememberInsert` — the exact deterministic builder the
// `nlqdb_remember` verb runs (`memory/remember.ts`), whose identifiers come
// only from the fixed `agent_memory_v1` column allow-list and whose caller
// values are all bound params. No bespoke DDL, no LLM-composed SQL, no
// direct table poke: the same statement production emits, run under the same
// tenant + `app.agent_id` scope and the same non-owner role
// (`buildMemoryExec`'s shape). So a green run is proof the pilot pack's
// import is real on the engine, not just faithful in a mock — the
// `INV-EKP-037` egress guard already proved the *query* side stays
// schema-only; this proves the *write* side lands.
//
// Gated on `NEON_TEST_BRANCH_URL` exactly like the other
// `*.integration.test.ts` files — unset ⇒ the whole block skips, so CI
// without the secret stays green. Every provisioning statement mirrors what
// the real provisioner emits (schema → preset DDL → role + grants → RLS +
// the tenant/scope policies), and the policy SQL comes from the real
// builder, so the test cannot drift from production.
//
// This does not tick box 2 ("runner executes an interview-sourced import
// end-to-end"): that box stays open until the live `experts` interview
// endpoint serves a transcript. Here the transcript is a fixture over an
// injected `fetch` — the runner drives the whole journey against a real DB,
// but the source is not yet the live one.

import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentMemoryV1Ddl,
  agentMemoryV1ScopePolicies,
} from "../../db-create/presets/agent-memory-v1.ts";
import { buildRememberInsert, type RememberArgs } from "../../memory/remember.ts";
import { makeMemoryDraftStore } from "../draft-store.ts";
import { advanceDraft, createDraft, type RunnerDeps } from "../runner.ts";
import type { MemoryRecord, PackContext } from "../types.ts";
import { type InterviewTranscript, languageTutorPack } from "./language-tutor.ts";

const TEST_BRANCH_URL = process.env["NEON_TEST_BRANCH_URL"];
const SCHEMA = "test_ek04_import";
const ROLE = "test_ek04_role";
const TENANT = "user_ek04";
// The runner writes each pack's rows under `app.agent_id = packAgentId(id)`,
// which is the pack id itself (`deps.ts`) — inlined here so this node-run
// test never imports the Workers-only `deps.ts`/`build-deps.ts` chain.
const AGENT = languageTutorPack.id; // "language-tutor"
const SESSION_ID = "s-ek04pilot";

const describeIntegration = TEST_BRANCH_URL ? describe : describe.skip;

// A pilot language-tutor debrief covering the vocabulary the four live
// golden queries read: a lesson episode kept even when nothing extracts, a
// grammar mistake anchored on a rule (+ the rule entity), a pricing
// heuristic, and the student's profile (+ the student entity). Each fact
// must read back carrying `source_episode` provenance.
const TRANSCRIPT: InterviewTranscript = {
  sessionId: SESSION_ID,
  exchanges: [
    {
      id: "ex-1",
      role: "lesson",
      episode: "Alex kept using the indicative where the subjunctive was required.",
      extractions: [
        { object: "entity", kind: "grammar_rule", name: "subjunctive" },
        {
          object: "fact",
          kind: "mistake",
          content: "indicative used where subjunctive was required",
          tags: ["subjunctive"],
        },
      ],
    },
    {
      id: "ex-2",
      role: "lesson",
      episode: "We set out how I price exam-prep intensives.",
      extractions: [
        {
          object: "fact",
          kind: "pricing_heuristic",
          content: "charge a premium for exam-prep intensive lessons",
          tags: ["pricing"],
        },
      ],
    },
    {
      id: "ex-3",
      role: "lesson",
      episode: "Placement recap: Alex is a solid B1 working toward B2.",
      extractions: [
        { object: "entity", kind: "student", name: "Alex" },
        {
          object: "fact",
          kind: "student_profile",
          content: "current level B1, working toward B2",
          tags: ["Alex"],
        },
      ],
    },
    { id: "ex-4", role: "lesson", episode: "Small talk to warm up; nothing worth recording." },
  ],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const NOOP_SPAN = {
  setAttribute() {},
  setStatus() {},
  recordException() {},
  end() {},
};

describeIntegration("language-tutor import lands on agent_memory_v1 — Neon (EK-04 box 3)", () => {
  const sql = neon(TEST_BRANCH_URL ?? "postgresql://u:p@host.tld/db", { fullResults: true });

  // The exec shape the memory write path uses: scope GUCs, drop to the
  // non-owner role, run the statement — identical to `buildMemoryExec`, so a
  // write here is checked by the very RLS policies production runs under.
  function execScoped(agentId: string, text: string, params: unknown[]): Promise<unknown> {
    return sql.transaction(
      [
        sql.query("SELECT set_config('search_path', $1, true)", [SCHEMA]),
        sql.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT]),
        sql.query("SELECT set_config('app.agent_id', $1, true)", [agentId]),
        sql.query(`SET LOCAL ROLE "${ROLE}"`),
        sql.query(text, params),
      ],
      { isolationLevel: "ReadCommitted" },
    );
  }

  // A scoped read — the same GUC + role shell, returning the final rows.
  async function readScoped(query: string): Promise<Record<string, unknown>[]> {
    const results = await sql.transaction(
      [
        sql.query("SELECT set_config('search_path', $1, true)", [SCHEMA]),
        sql.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT]),
        sql.query("SELECT set_config('app.agent_id', $1, true)", [AGENT]),
        sql.query(`SET LOCAL ROLE "${ROLE}"`),
        sql.query(query),
      ],
      { isolationLevel: "ReadCommitted" },
    );
    return (results[results.length - 1]?.rows ?? []) as Record<string, unknown>[];
  }

  // The runner's `writeMemory`, wired to the real public write builder over
  // Neon — this is what makes the assertion "via public surfaces only".
  async function writeMemory(dbId: string, record: MemoryRecord): Promise<void> {
    const args = { db: dbId, kind: record.object, payload: record.payload } as RememberArgs;
    const plan = buildRememberInsert(args, { agentId: AGENT, nowMs: Date.now() });
    await execScoped(plan.scope.agentId, plan.text, plan.params);
  }

  // Real read-back reconcile, under scope — the same counts `deps.ts`
  // `countRows` reads, so `verifying` compares planned against what Postgres
  // actually holds.
  async function countRows(): Promise<Record<string, number>> {
    const rows = await readScoped(
      "SELECT (SELECT count(*) FROM entities) AS entity, " +
        "(SELECT count(*) FROM facts) AS fact, " +
        "(SELECT count(*) FROM episodes) AS episode",
    );
    const row = rows[0] ?? {};
    return {
      entity: Number(row["entity"] ?? 0),
      fact: Number(row["fact"] ?? 0),
      episode: Number(row["episode"] ?? 0),
    };
  }

  function ctx(): PackContext {
    return {
      tracer: {
        startActiveSpan: (_n: string, f: (s: typeof NOOP_SPAN) => unknown) => f(NOOP_SPAN),
      } as never,
      fetch: (async () => jsonResponse(TRANSCRIPT)) as never,
      limits: { maxItems: 20_000, maxItemBytes: 512 * 1024, maxTotalBytes: 24 * 1024 * 1024 },
    };
  }

  function deps(): RunnerDeps {
    return {
      store: makeMemoryDraftStore(),
      packs: { [languageTutorPack.id]: languageTutorPack },
      ctx: ctx(),
      writeMemory,
      countRows: async () => countRows(),
      now: () => Date.now(),
      newId: () => "imp_ek04",
    };
  }

  async function teardown(): Promise<void> {
    await sql.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await sql.query(`DROP ROLE IF EXISTS "${ROLE}"`);
  }

  beforeAll(async () => {
    await teardown();
    await sql.transaction(
      [
        sql.query(`CREATE SCHEMA "${SCHEMA}"`),
        ...agentMemoryV1Ddl(SCHEMA).map((s) => sql.query(s)),
        sql.query(`CREATE ROLE "${ROLE}"`),
        sql.query(`GRANT "${ROLE}" TO CURRENT_USER WITH SET TRUE`),
        sql.query(`GRANT USAGE ON SCHEMA "${SCHEMA}" TO "${ROLE}"`),
        sql.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${SCHEMA}" TO "${ROLE}"`,
        ),
        sql.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA "${SCHEMA}" TO "${ROLE}"`),
        // The provisioner's permissive tenant policy + the restrictive scope
        // policies, per table — the real gate the write runs under.
        ...["facts", "episodes", "entities", "entity_facts"].flatMap((t) => [
          sql.query(`ALTER TABLE "${SCHEMA}"."${t}" ENABLE ROW LEVEL SECURITY`),
          sql.query(
            `CREATE POLICY tenant_isolation ON "${SCHEMA}"."${t}" ` +
              `USING (current_setting('app.tenant_id', true) = '${TENANT}')`,
          ),
        ]),
        ...agentMemoryV1ScopePolicies(SCHEMA, TENANT).map((s) => sql.query(s)),
      ],
      { isolationLevel: "ReadCommitted" },
    );
  });

  afterAll(teardown);

  it("the pilot pack's interview import reconciles planned-vs-written against real Postgres", async () => {
    const d = deps();
    const created = await createDraft(d, {
      packId: languageTutorPack.id,
      input: `interview:${SESSION_ID}`,
      tenantId: TENANT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Claim + provision, then run the whole journey to `complete` — the
    // saving phase writes through the public builder, verifying reconciles
    // against the scoped read-back.
    const claimed = { ...created.draft, dbId: "db_ek04_mem" };
    await d.store.save(claimed);
    const done = await advanceDraft(d, claimed, { until: "complete" });

    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.draft.phase).toBe("complete");
    // 4 lesson episodes; 3 facts (mistake, pricing_heuristic, student_profile);
    // 2 entities (grammar_rule, student) — matched by a real read-back, not
    // the save cursor.
    expect(done.draft.verification?.writtenSource).toBe("read_back");
    expect(done.draft.verification?.reconciled).toBe(true);
    expect(done.draft.verification?.written).toEqual({ entity: 2, fact: 3, episode: 4 });
  });

  it("the rows read back under scope with the golden-query vocabulary and provenance", async () => {
    // The write already happened in the first test; these read the same
    // durable rows, under the pack's agent scope only.
    const facts = await readScoped("SELECT kind, content, tags, source FROM facts ORDER BY kind");
    const factKinds = facts.map((f) => String(f["kind"]));
    expect(factKinds).toEqual(["mistake", "pricing_heuristic", "student_profile"]);

    // Every fact carries its originating episode (SK-EKP-007 stake 2 — no
    // orphan rows), keyed under the interview session.
    for (const f of facts) {
      const source = (f["source"] ?? {}) as Record<string, unknown>;
      expect(source["session"]).toBe(SESSION_ID);
      expect(typeof source["source_episode"]).toBe("string");
      expect(String(source["source_episode"]).length).toBeGreaterThan(0);
    }

    // The grammar mistake is anchored on the rule the student slipped on —
    // the anchor rides `tags`, exactly as the "which rules most often" gold
    // reads it.
    const mistake = facts.find((f) => f["kind"] === "mistake");
    expect(mistake?.["tags"]).toEqual(["subjunctive"]);

    // Entities landed with the eval-corpus kinds.
    const entities = await readScoped("SELECT kind, canonical_name FROM entities ORDER BY kind");
    expect(entities).toEqual([
      { kind: "grammar_rule", canonical_name: "subjunctive" },
      { kind: "student", canonical_name: "Alex" },
    ]);

    // Episodes are all `lesson` role and include the bare warm-up exchange —
    // the conversation is memory even when nothing structured extracted.
    const episodes = await readScoped("SELECT role, content FROM episodes");
    expect(episodes).toHaveLength(4);
    expect(episodes.every((e) => e["role"] === "lesson")).toBe(true);
    expect(episodes.some((e) => String(e["content"]).startsWith("Small talk"))).toBe(true);
  });

  it("another agent in the same DB cannot see the pilot import (isolation holds for the pack)", async () => {
    // The import wrote under `app.agent_id = 'language-tutor'`; a different
    // agent scope in the same memory DB reads none of it — the wedge's
    // isolation is real for the pilot pack, not just the fixtures.
    const results = await sql.transaction(
      [
        sql.query("SELECT set_config('search_path', $1, true)", [SCHEMA]),
        sql.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT]),
        sql.query("SELECT set_config('app.agent_id', $1, true)", ["some-other-agent"]),
        sql.query(`SET LOCAL ROLE "${ROLE}"`),
        sql.query("SELECT count(*)::int AS n FROM facts"),
      ],
      { isolationLevel: "ReadCommitted" },
    );
    const rows = (results[results.length - 1]?.rows ?? []) as { n: number }[];
    expect(rows[0]?.n).toBe(0);
  });
});
