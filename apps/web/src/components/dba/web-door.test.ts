// The web door to the DBA (`GLOBAL-043` items 5–6a): paste a Postgres
// connection string at `/app/connect`, get the first proposals, then apply or
// reject each from `/app/dba` — the same calls the two islands make
// (`postConnect`, then `decide` through the cookie-session SDK client), against
// a recorded fixture of the API's responses (the shapes of the CLI's
// `TestAttachDoorWalk` and MCP's `dba-door.test.ts`). No network, no LLM.
import { afterEach, describe, expect, it } from "bun:test";
import { renderError } from "@nlqdb/errors";
import { createClient } from "@nlqdb/sdk";
import { postConnect } from "../../lib/connect";
import { decide, withStatus } from "./ledger";

const TABLES = ["posts", "comments", "likes", "follows", "sessions"];

function fakeApi() {
  const status = new Map<number, string>();
  const decidedBy = new Map<number, string>();
  const reasons = new Map<number, string | null>();
  const credentials: (RequestCredentials | undefined)[] = [];
  const json = (body: unknown, code = 200) =>
    new Response(JSON.stringify(body), {
      status: code,
      headers: { "content-type": "application/json" },
    });
  const fail = (code: "proposal_not_found" | "proposal_decided", params = {}) => {
    const { httpStatus, recoverability: _r, ...wire } = renderError(code, params);
    return json({ error: wire }, httpStatus);
  };

  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    credentials.push(init?.credentials);
    if (method === "POST" && url.pathname === "/v1/db/connect") {
      const proposals = TABLES.map((t, i) => {
        status.set(i + 1, "proposed");
        return {
          id: i + 1,
          kind: "create_index",
          tier: 0,
          schema: "public",
          table: t,
          columns: ["user_id"],
          ddl: `CREATE INDEX CONCURRENTLY nlqdb_${t}_user_id_idx ON public.${t} (user_id)`,
          inverse: `DROP INDEX CONCURRENTLY public.nlqdb_${t}_user_id_idx`,
          reason: `Foreign key ${t}(user_id) → users has no index.`,
          evidence: { rowEstimate: 1000, tableBytes: 8192 },
        };
      });
      return json(
        {
          dbId: "db_attach_1",
          name: "app",
          engine: "postgres",
          schemaPreview: "posts(id, user_id)",
          pkLive: null,
          proposals,
        },
        201,
      );
    }
    const m = url.pathname.match(/^\/v1\/proposals\/(\d+)\/(apply|reject)$/);
    if (method === "POST" && m) {
      const id = Number(m[1]);
      const want = m[2] === "apply" ? "applied" : "rejected";
      const cur = status.get(id);
      if (!cur) return fail("proposal_not_found");
      if (cur !== "proposed" && cur !== want) return fail("proposal_decided", { status: cur });
      status.set(id, want);
      decidedBy.set(id, "user:u_1");
      const body = typeof init?.body === "string" && init.body ? JSON.parse(init.body) : {};
      if (want === "rejected") reasons.set(id, body.reason ?? null);
      return json({
        proposal: {
          id,
          dbId: "db_attach_1",
          status: want,
          decidedBy: "user:u_1",
          decidedAt: 1,
          rejectReason: reasons.get(id) ?? null,
        },
        replayed: cur === want,
      });
    }
    return json({ error: { code: "not_found", message: "no route" } }, 404);
  };
  return { fetch, status, decidedBy, reasons, credentials };
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("the web door to the DBA (GLOBAL-043 items 5–6a)", () => {
  it("attaches, applies 3 and rejects 2 — every proposal decided from the web", async () => {
    const api = fakeApi();
    globalThis.fetch = api.fetch as typeof fetch;
    const client = createClient({
      baseUrl: "https://api.test",
      withCredentials: true,
      fetch: api.fetch,
    });

    const attached = await postConnect("https://api.test", {
      engine: "postgres",
      connectionUrl: "postgres://app:s3cret@db.example.com:5432/app",
    });
    if (!attached.ok) throw new Error(attached.message);
    const proposals = attached.result.proposals ?? [];
    expect(proposals.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);

    for (const p of proposals) {
      const out =
        p.id <= 3
          ? await decide(client, p.id, "apply")
          : await decide(client, p.id, "reject", "  write-heavy table  ");
      expect(out).toEqual({ ok: true, status: p.id <= 3 ? "applied" : "rejected" });
    }
    const decided = [...api.status.values()].filter((s) => s !== "proposed").length;
    // biome-ignore lint/suspicious/noConsole: the door's reading belongs in the CI log
    console.log(`proposals decided from the web: ${decided}/5`);
    expect(decided).toBe(5);
    // The cookie session is the principal on every call, so the ledger names the person.
    expect(api.credentials.every((c) => c === "include")).toBe(true);
    expect([...api.decidedBy.values()].every((d) => d === "user:u_1")).toBe(true);
    expect(api.reasons.get(4)).toBe("write-heavy table");
  });

  it("a replay is a no-op; the opposite verb and an unknown id show the API's sentence", async () => {
    const api = fakeApi();
    globalThis.fetch = api.fetch as typeof fetch;
    const client = createClient({
      baseUrl: "https://api.test",
      withCredentials: true,
      fetch: api.fetch,
    });
    await postConnect("https://api.test", { engine: "postgres", connectionUrl: "postgres://x" });

    expect(await decide(client, 1, "apply")).toEqual({ ok: true, status: "applied" });
    expect(await decide(client, 1, "apply")).toEqual({ ok: true, status: "applied" });
    expect(await decide(client, 1, "reject")).toEqual({
      ok: false,
      message: "That proposal was already applied.",
    });
    expect(await decide(client, 404, "apply")).toEqual({
      ok: false,
      message: "No proposal of yours matched that id.",
    });
  });

  it("only the decided row's status moves", () => {
    const row = (id: number) => ({
      id,
      origin: "attach" as const,
      status: "proposed" as const,
      kind: "create_index" as const,
      table: "posts",
      ddl: "CREATE INDEX …",
      inverse: "DROP INDEX …",
      reason: null,
      createdAt: 1,
    });
    const after = withStatus([row(1), row(2)], 2, "applied");
    expect(after.map((c) => c.status)).toEqual(["proposed", "applied"]);
  });
});
