// Unit tests for the repo-ops pack adapter — instance #1 of the shared
// runner (D-08). Covers the three things a pack owns and can get wrong:
// naming its source, deciding what is eligible (with an honest reason), and
// producing the exact row vocabulary D-03's golden queries are written
// against.

import { describe, expect, it } from "vitest";
import { parseRepoInput, parseTar } from "../github-source.ts";
import type { SourceDescriptor, SourceItem } from "../types.ts";
import { extractDecisionRecord, repoOpsPack, skipReasonFor } from "./repo-ops.ts";

const SOURCE: SourceDescriptor = {
  kind: "github-repo",
  ref: "nlqdb/nlqdb",
  pin: "a1b2c3d",
  meta: { owner: "nlqdb", repo: "nlqdb" },
};

function item(id: string, text: string | null, bytes = text?.length ?? 0): SourceItem {
  return { id, bytes, text };
}

describe("source naming", () => {
  it.each([
    ["https://github.com/nlqdb/nlqdb", "nlqdb", "nlqdb", null],
    ["http://www.github.com/nlqdb/nlqdb/", "nlqdb", "nlqdb", null],
    ["github.com/nlqdb/nlqdb.git", "nlqdb", "nlqdb", null],
    ["nlqdb/nlqdb", "nlqdb", "nlqdb", null],
    ["git@github.com:nlqdb/nlqdb.git", "nlqdb", "nlqdb", null],
    ["https://github.com/nlqdb/nlqdb/tree/release/1.x", "nlqdb", "nlqdb", "release/1.x"],
  ])("accepts %s", (input, owner, repo, ref) => {
    expect(parseRepoInput(input)).toEqual({ owner, repo, ref });
  });

  it.each([
    "",
    "nlqdb",
    "https://gitlab.com/nlqdb/nlqdb",
    "https://github.com/nlqdb/nlqdb/blob/main/README.md",
    "https://github.com/nlqdb/nlq db",
  ])("rejects %s", (input) => {
    expect(parseRepoInput(input)).toBeNull();
  });

  it("produces a credential-free, unpinned descriptor", () => {
    const parsed = repoOpsPack.parseSource("https://github.com/nlqdb/nlqdb");
    expect(parsed).toEqual({
      ok: true,
      source: {
        kind: "github-repo",
        ref: "nlqdb/nlqdb",
        pin: null,
        meta: { owner: "nlqdb", repo: "nlqdb" },
      },
    });
  });

  it("explains itself in one sentence with the next action", () => {
    const parsed = repoOpsPack.parseSource("not a repo");
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.reason).toMatch(/Paste a GitHub repository URL/);
  });
});

describe("classification", () => {
  it.each([
    ["docs/decisions/GLOBAL-013-free-tier.md", null],
    ["docs/features/auth/FEATURE.md", null],
    ["docs/blocked-by-human.md", null],
    ["README.md", "narrative_prose"],
    ["docs/architecture.md", "narrative_prose"],
    ["src/index.ts", "no_extractable_structure"],
    ["node_modules/x/docs/features/y/FEATURE.md", "generated_or_vendor"],
    ["bun.lock", "generated_or_vendor"],
    ["dist/app.min.js", "generated_or_vendor"],
  ])("%s → %s", (path, reason) => {
    expect(skipReasonFor(item(path, "# heading\n"))).toBe(reason);
  });

  it("skips a binary with the binary reason, not a guess", () => {
    expect(
      skipReasonFor({ id: "docs/og/card.png", bytes: 40_000, text: null, omitted: "binary" }),
    ).toBe("binary");
  });

  it("distinguishes a capped file from a binary one", () => {
    expect(
      skipReasonFor({ id: "docs/huge.md", bytes: 900_000, text: null, omitted: "too_large" }),
    ).toBe("too_large");
  });

  it("splits eligible from skipped and keeps one reason per skipped item", () => {
    const { eligible, skipped } = repoOpsPack.classify([
      item("docs/features/auth/FEATURE.md", "## Open questions\n- a real one\n"),
      item("README.md", "# nlqdb\n"),
      item("logo.png", null, 900),
    ]);
    expect(eligible.map((e) => e.id)).toEqual(["docs/features/auth/FEATURE.md"]);
    expect(skipped).toEqual([
      { id: "README.md", reason: "narrative_prose" },
      { id: "logo.png", reason: "binary" },
    ]);
  });
});

describe("extraction — the SK-QUAL-023 row vocabulary", () => {
  const DECISION = [
    "# GLOBAL-013 — Cloudflare Workers free tier is the budget",
    "",
    "**Status:** recorded",
    "",
    "See also SK-HDC-012 and GLOBAL-025.",
  ].join("\n");

  it("turns a decision record into a `decision` entity plus its status fact", () => {
    const records = extractDecisionRecord("docs/decisions/GLOBAL-013-free-tier.md", DECISION);
    const entity = records.find((r) => r.object === "entity");
    expect(entity).toMatchObject({
      category: "decision",
      object: "entity",
      payload: { kind: "decision", canonical_name: "GLOBAL-013" },
    });
    const status = records.find((r) => r.category === "decision_status");
    expect(status).toMatchObject({
      object: "fact",
      payload: {
        kind: "decision_status",
        content: "GLOBAL-013 status: recorded",
        tags: ["GLOBAL-013"],
      },
    });
  });

  it("records supersession when there is no explicit status line", () => {
    const records = extractDecisionRecord(
      "docs/decisions/SK-ASK-011-old.md",
      "# SK-ASK-011 — old plan\n\nThis is superseded by SK-ASK-014.\n",
    );
    const status = records.find((r) => r.category === "decision_status");
    expect(status?.object === "fact" && status.payload.content).toBe(
      "SK-ASK-011 status: superseded",
    );
  });

  it("carries cross-references as `reference` facts tagged with both endpoints", () => {
    const refs = extractDecisionRecord("docs/decisions/GLOBAL-013-x.md", DECISION).filter(
      (r) => r.category === "reference",
    );
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => (r.object === "fact" ? r.payload.tags : []))).toEqual([
      ["GLOBAL-013", "SK-HDC-012"],
      ["GLOBAL-013", "GLOBAL-025"],
    ]);
  });

  it("reuses the D-01 recipe for open questions and the blocked queue", () => {
    const records = repoOpsPack.extract(
      [
        item(
          "docs/features/auth/FEATURE.md",
          "## Open questions\n- Should sessions rotate on IP change?\n- **Resolved** — nothing here\n",
        ),
        item(
          "docs/blocked-by-human.md",
          "| 1 | ~30 min | Sit the Stripe webhook test | 2026-06-13 |\n",
        ),
      ],
      SOURCE,
    );
    const kinds = records.map((r) => `${r.category}:${r.object}`);
    expect(kinds).toContain("feature:entity");
    expect(kinds).toContain("open_question:fact");
    expect(kinds).toContain("tracker:entity");
    expect(kinds).toContain("tracker:fact");
    // The resolved bullet is not an open question.
    expect(records.filter((r) => r.category === "open_question")).toHaveLength(1);
    // Fact kinds must match the eval corpus exactly.
    const factKinds = new Set(
      records.filter((r) => r.object === "fact").map((r) => r.object === "fact" && r.payload.kind),
    );
    expect(factKinds).toContain("open_question");
    expect(factKinds).toContain("blocked");
  });

  it("closes every import with one `sync` episode naming the pinned commit", () => {
    const records = repoOpsPack.extract([item("docs/decisions/GLOBAL-013-x.md", DECISION)], SOURCE);
    const episodes = records.filter((r) => r.object === "episode");
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ category: "sync_run", payload: { role: "sync" } });
    expect(episodes[0]?.object === "episode" && episodes[0].payload.content).toContain("a1b2c3d");
    // The episode is last, so its counts describe the rest of the import.
    expect(records.at(-1)?.object).toBe("episode");
  });

  it("produces nothing — not an episode — from a source with no structure", () => {
    expect(repoOpsPack.extract([], SOURCE)).toEqual([]);
  });

  it("declares golden queries as the durable completion proof", () => {
    expect(repoOpsPack.goldenQueries.length).toBeGreaterThanOrEqual(4);
  });
});

describe("tar reader", () => {
  // Build a minimal POSIX tar in memory: the archive shape codeload returns.
  function tar(files: { name: string; body: string }[]): Uint8Array {
    const blocks: Uint8Array[] = [];
    const enc = new TextEncoder();
    for (const f of files) {
      const header = new Uint8Array(512);
      header.set(enc.encode(f.name).subarray(0, 100), 0);
      const size = enc.encode(f.body).byteLength;
      header.set(enc.encode(size.toString(8).padStart(11, "0")), 124);
      header[156] = "0".charCodeAt(0);
      blocks.push(header);
      const payload = new Uint8Array(Math.ceil(size / 512) * 512);
      payload.set(enc.encode(f.body));
      blocks.push(payload);
    }
    blocks.push(new Uint8Array(512));
    const total = blocks.reduce((n, b) => n + b.byteLength, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const b of blocks) {
      out.set(b, at);
      at += b.byteLength;
    }
    return out;
  }

  const LIMITS = { maxItems: 100, maxItemBytes: 1024 };

  it("strips the `<repo>-<sha>/` archive root so paths read as repo paths", () => {
    const entries = parseTar(
      tar([{ name: "nlqdb-a1b2c3d/docs/features/auth/FEATURE.md", body: "# hi\n" }]),
      LIMITS,
    );
    expect(entries).toEqual([{ path: "docs/features/auth/FEATURE.md", bytes: 5, text: "# hi\n" }]);
  });

  it("lists an oversized file without decoding it, and says why", () => {
    const big = "x".repeat(2000);
    const entries = parseTar(tar([{ name: "r-1/big.md", body: big }]), LIMITS);
    expect(entries[0]).toMatchObject({
      path: "big.md",
      bytes: 2000,
      text: null,
      omitted: "too_large",
    });
  });

  it("reports a NUL-containing file as non-text", () => {
    const entries = parseTar(tar([{ name: "r-1/logo.png", body: "PNG  data" }]), LIMITS);
    expect(entries[0]).toMatchObject({ text: null, omitted: "binary" });
  });

  it("stops at the terminating zero block", () => {
    expect(parseTar(tar([{ name: "r-1/a.md", body: "a" }]), LIMITS)).toHaveLength(1);
  });

  it("honours the item cap", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ name: `r-1/f${i}.md`, body: "x" }));
    expect(parseTar(tar(many), { maxItems: 3, maxItemBytes: 1024 })).toHaveLength(3);
  });
});
