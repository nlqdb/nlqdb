// Unit tests for the shared pack-runner state machine (D-08 slice 1).
//
// The four properties the runner exists to guarantee, each pinned here:
//   1. resume — a draft reopens at the phase it stopped in, and every phase
//      boundary is durable in the store, not only in memory;
//   2. retry idempotency — a retry after a mid-`saving` crash writes each
//      remaining row exactly once and never re-writes a durable one;
//   3. reconciliation — `verifying` compares planned against read-back and
//      says so honestly when they disagree;
//   4. the credential guard — a record carrying a secret value is rejected
//      with a visible reason, for every pack, with no pack opt-out.
//
// The adapter contract is exercised through a **fake pack** whose source is
// not a repository. That is the N+1 test in test form: if the runner ever
// grows repo-shaped assumptions, this file stops compiling.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMemoryDraftStore } from "./draft-store.ts";
import {
  advanceDraft,
  carriesSecretValue,
  createDraft,
  guardSecretValues,
  importIsEmpty,
  type RunnerDeps,
  retryDraft,
} from "./runner.ts";
import type { MemoryRecord, PackAdapter, SourceItem } from "./types.ts";

// ── a pack whose source is nothing like a repository ──────────────────

const SESSION_ITEMS: SourceItem[] = [
  { id: "exchange-1", bytes: 40, text: "student said: I go to school yesterday" },
  { id: "exchange-2", bytes: 30, text: "tutor said: past tense is 'went'" },
  { id: "exchange-3", bytes: 0, text: null },
];

function fakePack(overrides: Partial<PackAdapter> = {}): PackAdapter {
  return {
    id: "interview",
    preset: "agent_memory_v1",
    label: "Import interview memory",
    goldenQueries: ["Which mistakes did the student make?"],
    parseSource(input) {
      return input.startsWith("session:")
        ? { ok: true, source: { kind: "interview-session", ref: input, pin: null, meta: {} } }
        : { ok: false, reason: "Expected a `session:<id>` reference." };
    },
    async acquire(source) {
      return { ok: true, source: { ...source, pin: "rev-7" }, items: SESSION_ITEMS };
    },
    classify(items) {
      const eligible = items.filter((i) => i.text !== null);
      return {
        eligible,
        skipped: items.filter((i) => i.text === null).map((i) => ({ id: i.id, reason: "binary" })),
      };
    },
    extract(items) {
      return items.map<MemoryRecord>((item) => ({
        category: "exchange",
        object: "fact",
        payload: { content: item.text ?? "", kind: "mistake", tags: [item.id] },
      }));
    },
    ...overrides,
  };
}

type Harness = {
  deps: RunnerDeps;
  store: ReturnType<typeof makeMemoryDraftStore>;
  writes: { dbId: string; record: MemoryRecord }[];
  writeMemory: ReturnType<typeof vi.fn>;
};

function harness(pack: PackAdapter = fakePack(), overrides: Partial<RunnerDeps> = {}): Harness {
  const store = makeMemoryDraftStore();
  const writes: { dbId: string; record: MemoryRecord }[] = [];
  const writeMemory = vi.fn(async (dbId: string, record: MemoryRecord) => {
    writes.push({ dbId, record });
  });
  let seq = 0;
  const deps: RunnerDeps = {
    store,
    packs: { [pack.id]: pack },
    ctx: {
      tracer: { startActiveSpan: (_n: string, fn: unknown) => (fn as () => unknown)() } as never,
      fetch: (() => {
        throw new Error("the fake pack must not touch the network");
      }) as never,
      limits: { maxItems: 100, maxItemBytes: 1024, maxTotalBytes: 4096 },
    },
    writeMemory,
    now: () => 1_000 + seq++,
    newId: () => "imp_test",
    ...overrides,
  };
  return { deps, store, writes, writeMemory };
}

async function preflight(h: Harness, input = "session:abc", tenantId: string | null = null) {
  const created = await createDraft(h.deps, { packId: "interview", input, tenantId });
  if (!created.ok) throw new Error(`createDraft rejected: ${created.reason}`);
  return advanceDraft(h.deps, created.draft, { until: "saving" });
}

// ── 1. phases, checkpoints, resume ────────────────────────────────────

describe("phase model", () => {
  it("rejects a source the pack cannot name, before creating a draft", async () => {
    const h = harness();
    const out = await createDraft(h.deps, {
      packId: "interview",
      input: "not-a-session",
      tenantId: null,
    });
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.reason).toBe("invalid_source");
    expect(h.store.size()).toBe(0);
  });

  it("rejects an unknown pack id", async () => {
    const h = harness();
    const out = await createDraft(h.deps, { packId: "nope", input: "session:a", tenantId: null });
    expect(out.ok === false && out.reason).toBe("unknown_pack");
  });

  it("runs the pre-write phases with real counters and pins the revision", async () => {
    const h = harness();
    const out = await preflight(h);
    expect(out.ok).toBe(true);
    const draft = out.ok ? out.draft : null;
    expect(draft?.phase).toBe("saving");
    expect(draft?.source.pin).toBe("rev-7");
    expect(draft?.scan).toMatchObject({ itemsTotal: 3, eligible: 2, skipReasons: { binary: 1 } });
    expect(draft?.records).toHaveLength(2);
    // No write happened before the account existed.
    expect(h.writes).toHaveLength(0);
  });

  it("advances exactly one phase when no target is given", async () => {
    const h = harness();
    const created = await createDraft(h.deps, {
      packId: "interview",
      input: "session:abc",
      tenantId: null,
    });
    if (!created.ok) throw new Error("unreachable");
    const out = await advanceDraft(h.deps, created.draft);
    expect(out.ok && out.draft.phase).toBe("classifying");
  });

  it("persists every phase boundary, so a reload reopens the same phase", async () => {
    const h = harness();
    await preflight(h);
    const reloaded = await h.store.get("imp_test");
    expect(reloaded?.phase).toBe("saving");
    expect(reloaded?.records).toHaveLength(2);
    expect(reloaded?.source.pin).toBe("rev-7");
  });

  it("holds at `saving` with auth_required until an account claims it, without mutating", async () => {
    const h = harness();
    const pre = await preflight(h);
    if (!pre.ok) throw new Error("unreachable");
    const out = await advanceDraft(h.deps, pre.draft, { until: "complete" });
    expect(out.ok === false && out.reason).toBe("auth_required");
    expect((await h.store.get("imp_test"))?.phase).toBe("saving");
    expect(h.writes).toHaveLength(0);
  });

  it("holds at `saving` with db_required once claimed but not yet provisioned", async () => {
    const h = harness();
    const pre = await preflight(h, "session:abc", "tenant-1");
    if (!pre.ok) throw new Error("unreachable");
    const out = await advanceDraft(h.deps, pre.draft, { until: "complete" });
    expect(out.ok === false && out.reason).toBe("db_required");
  });

  it("completes with an honest empty state when the source has no structure", async () => {
    const h = harness(fakePack({ extract: () => [] }));
    const out = await preflight(h);
    expect(out.ok).toBe(true);
    const draft = out.ok ? out.draft : null;
    expect(draft && importIsEmpty(draft)).toBe(true);
    // The skip reasons are still there, so "why nothing?" is answerable.
    expect(draft?.scan?.skipReasons).toEqual({ binary: 1 });
    expect(draft?.dbId).toBeNull();
  });

  it("stamps the failing phase and leaves the checkpoint intact on a source failure", async () => {
    const h = harness(fakePack({ acquire: async () => ({ ok: false, reason: "source_private" }) }));
    const created = await createDraft(h.deps, {
      packId: "interview",
      input: "session:abc",
      tenantId: null,
    });
    if (!created.ok) throw new Error("unreachable");
    const out = await advanceDraft(h.deps, created.draft, { until: "saving" });
    expect(out.ok === false && out.reason).toBe("source_unavailable");
    const stored = await h.store.get("imp_test");
    expect(stored?.phase).toBe("inspecting");
    expect(stored?.error).toEqual({ phase: "inspecting", reason: "source_private" });
  });
});

// ── 2. retry idempotency ──────────────────────────────────────────────

describe("retry idempotency", () => {
  async function claimedAtSaving(h: Harness) {
    const pre = await preflight(h, "session:abc", "tenant-1");
    if (!pre.ok) throw new Error("unreachable");
    const draft = { ...pre.draft, dbId: "db_mem1" };
    await h.store.save(draft);
    return draft;
  }

  it("writes each record exactly once across a crash and a retry", async () => {
    let failNext = true;
    const h = harness(fakePack(), {});
    h.deps.writeMemory = async (dbId, record) => {
      // Fail on the second row, after the first is durable.
      if (failNext && h.writes.length === 1) {
        failNext = false;
        throw new Error("neon_unreachable");
      }
      h.writes.push({ dbId, record });
    };
    const draft = await claimedAtSaving(h);

    const first = await advanceDraft(h.deps, draft, { until: "complete" });
    expect(first.ok).toBe(false);
    const mid = await h.store.get("imp_test");
    expect(mid?.saveCursor).toBe(1);
    expect(mid?.error?.phase).toBe("saving");
    if (!mid) throw new Error("unreachable");

    const resumed = await retryDraft(h.deps, mid, { until: "complete" });
    expect(resumed.ok).toBe(true);
    expect(resumed.ok && resumed.draft.phase).toBe("complete");
    // Two records, two writes total — the durable one was not repeated.
    expect(h.writes).toHaveLength(2);
    expect(
      h.writes.map((w) => (w.record.object === "fact" ? w.record.payload.content : "")),
    ).toEqual(["student said: I go to school yesterday", "tutor said: past tense is 'went'"]);
  });

  it("re-advancing a completed draft writes nothing more", async () => {
    const h = harness();
    const draft = await claimedAtSaving(h);
    const done = await advanceDraft(h.deps, draft, { until: "complete" });
    expect(done.ok).toBe(true);
    if (!done.ok) throw new Error("unreachable");
    const again = await advanceDraft(h.deps, done.draft, { until: "complete" });
    expect(again.ok).toBe(true);
    expect(h.writes).toHaveLength(2);
  });

  it("checkpoints the cursor after every single write", async () => {
    const cursors: number[] = [];
    const h = harness();
    const draft = await claimedAtSaving(h);
    const realSave = h.deps.store.save;
    h.deps.store.save = async (d) => {
      cursors.push(d.saveCursor);
      await realSave(d);
    };
    await advanceDraft(h.deps, draft, { until: "complete" });
    expect(cursors).toContain(1);
    expect(cursors).toContain(2);
  });
});

// ── 3. reconciliation ─────────────────────────────────────────────────

describe("verification", () => {
  async function runToComplete(countRows?: RunnerDeps["countRows"]) {
    const h = harness(fakePack(), countRows ? { countRows } : {});
    const pre = await preflight(h, "session:abc", "tenant-1");
    if (!pre.ok) throw new Error("unreachable");
    const draft = { ...pre.draft, dbId: "db_mem1" };
    await h.store.save(draft);
    const out = await advanceDraft(h.deps, draft, { until: "complete" });
    return { h, out };
  }

  it("reconciles against a real read-back and records the golden queries", async () => {
    const { out } = await runToComplete(async () => ({ entity: 0, fact: 2, episode: 0 }));
    const v = out.ok ? out.draft.verification : null;
    expect(v?.writtenSource).toBe("read_back");
    expect(v?.reconciled).toBe(true);
    expect(v?.golden).toEqual([{ query: "Which mistakes did the student make?", answer: null }]);
  });

  it("reports a mismatch instead of claiming success", async () => {
    const { out } = await runToComplete(async () => ({ entity: 0, fact: 1, episode: 0 }));
    const v = out.ok ? out.draft.verification : null;
    expect(v?.reconciled).toBe(false);
    expect(v?.mismatches).toEqual(["fact: planned 2, found 1"]);
  });

  it("falls back to the save cursor and says so when no read-back is wired", async () => {
    const { out } = await runToComplete();
    const v = out.ok ? out.draft.verification : null;
    expect(v?.writtenSource).toBe("save_cursor");
    expect(v?.reconciled).toBe(true);
  });

  it("tolerates fewer entities than planned, because entities upsert", async () => {
    const pack = fakePack({
      extract: () => [
        { category: "s", object: "entity", payload: { kind: "student", canonical_name: "ana" } },
        { category: "s", object: "entity", payload: { kind: "student", canonical_name: "ana" } },
      ],
    });
    const h = harness(pack, { countRows: async () => ({ entity: 1, fact: 0, episode: 0 }) });
    const pre = await preflight(h, "session:abc", "tenant-1");
    if (!pre.ok) throw new Error("unreachable");
    const draft = { ...pre.draft, dbId: "db_mem1" };
    await h.store.save(draft);
    const out = await advanceDraft(h.deps, draft, { until: "complete" });
    expect(out.ok && out.draft.verification?.reconciled).toBe(true);
  });
});

// ── 4. the credential guard ───────────────────────────────────────────

describe("credential-value guard", () => {
  const SECRETS = [
    "sk_live_abcdefghijklmnop",
    "the key is sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAA",
    "AIzaSyD-1234567890abcdefghijklmnopqrstu",
    "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    "xoxb-123456789012-abcdefghijkl",
    "AKIAIOSFODNN7EXAMPLE",
    "-----BEGIN RSA PRIVATE KEY-----",
    'DATABASE_PASSWORD="hunter2hunter2hunter2"',
    "STRIPE_SECRET_KEY=sk_test_51Hxxxxxxxxxxxxxxxxx",
  ];

  it.each(SECRETS)("rejects %s", (text) => {
    expect(carriesSecretValue(text)).toBe(true);
  });

  const METADATA = [
    "credential: STRIPE_SECRET_KEY, scope live, rotated 2026-07-01",
    "the auth feature stores a session token in a cookie",
    "open question in billing: should we rotate keys on downgrade?",
    "GLOBAL-013 status: recorded",
  ];

  it.each(METADATA)("keeps credential metadata: %s", (text) => {
    expect(carriesSecretValue(text)).toBe(false);
  });

  it("drops the offending record and counts it", () => {
    const records: MemoryRecord[] = [
      {
        category: "c",
        object: "fact",
        payload: { content: "service: stripe, key STRIPE_SECRET_KEY" },
      },
      {
        category: "c",
        object: "fact",
        payload: { content: "STRIPE_SECRET_KEY=sk_test_51Hxxxxxxxxxxxxxxxxx" },
      },
    ];
    const { kept, rejected } = guardSecretValues(records);
    expect(rejected).toBe(1);
    expect(kept).toHaveLength(1);
  });

  it("applies to every pack, and surfaces the rejection as a skip reason", async () => {
    const leaky = fakePack({
      extract: () => [
        {
          category: "leak",
          object: "fact",
          payload: { content: "token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" },
        },
        { category: "ok", object: "fact", payload: { content: "past tense is 'went'" } },
      ],
    });
    const h = harness(leaky);
    const out = await preflight(h);
    expect(out.ok).toBe(true);
    const draft = out.ok ? out.draft : null;
    expect(draft?.records).toHaveLength(1);
    expect(draft?.scan?.skipReasons.credential_value_rejected).toBe(1);
  });

  it("also guards a secret hidden in a fact's tags", () => {
    const { rejected } = guardSecretValues([
      {
        category: "c",
        object: "fact",
        payload: { content: "harmless", tags: ["ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"] },
      },
    ]);
    expect(rejected).toBe(1);
  });

  it("also guards a secret hidden in a fact's source metadata", () => {
    const { rejected } = guardSecretValues([
      {
        category: "c",
        object: "fact",
        payload: {
          content: "harmless",
          source: { url: "https://x.dev?token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" },
        },
      },
    ]);
    expect(rejected).toBe(1);
  });
});

// ── the store contract the routes depend on ───────────────────────────

describe("draft store", () => {
  it("leases a draft to one caller per version, so concurrent advances cannot both run", async () => {
    const h = harness();
    const pre = await preflight(h, "session:abc", "tenant-1");
    if (!pre.ok) throw new Error("unreachable");
    const version = pre.draft.updatedAt;
    // Two callers that read the same version: the first wins, the second is
    // told the draft is busy rather than provisioning and writing twice.
    expect(await h.store.lease("imp_test", version, version + 1)).toBe(true);
    expect(await h.store.lease("imp_test", version, version + 2)).toBe(false);
    // The next request reads the new version and proceeds normally.
    const fresh = await h.store.get("imp_test");
    expect(fresh && (await h.store.lease("imp_test", fresh.updatedAt, version + 3))).toBe(true);
  });

  it("never lets a save rewrite `tenant_id` — `claim` is its only writer", async () => {
    const h = harness();
    const pre = await preflight(h);
    if (!pre.ok) throw new Error("unreachable");
    expect(await h.store.claim("imp_test", "tenant-9")).toBe(true);
    // A request that read the draft before the claim saves its own stale copy.
    await h.store.save({ ...pre.draft, tenantId: null, saveCursor: 0 });
    expect((await h.store.get("imp_test"))?.tenantId).toBe("tenant-9");
  });
});

// ── the adapter contract itself ───────────────────────────────────────

describe("adapter contract (the N+1 test)", () => {
  let calls: string[];
  beforeEach(() => {
    calls = [];
  });

  it("drives a non-repository pack end to end with no runner change", async () => {
    const traced = fakePack({
      async acquire(source) {
        calls.push("acquire");
        return { ok: true, source: { ...source, pin: "rev-7" }, items: SESSION_ITEMS };
      },
    });
    const h = harness(traced, { countRows: async () => ({ entity: 0, fact: 2, episode: 0 }) });
    const pre = await preflight(h, "session:abc", "tenant-1");
    if (!pre.ok) throw new Error("unreachable");
    const draft = { ...pre.draft, dbId: "db_mem1" };
    await h.store.save(draft);
    const out = await advanceDraft(h.deps, draft, { until: "complete" });
    expect(out.ok && out.draft.phase).toBe("complete");
    expect(out.ok && out.draft.verification?.reconciled).toBe(true);
    // One acquisition for the three pre-write phases in one request.
    expect(calls.filter((c) => c === "acquire")).toHaveLength(1);
  });

  it("never asks an adapter for source content after `saving` begins", async () => {
    const traced = fakePack({
      async acquire(source) {
        calls.push("acquire");
        return { ok: true, source: { ...source, pin: "rev-7" }, items: SESSION_ITEMS };
      },
    });
    const h = harness(traced);
    const pre = await preflight(h, "session:abc", "tenant-1");
    if (!pre.ok) throw new Error("unreachable");
    calls.length = 0;
    const draft = { ...pre.draft, dbId: "db_mem1" };
    await h.store.save(draft);
    await advanceDraft(h.deps, draft, { until: "complete" });
    expect(calls).toEqual([]);
  });
});
