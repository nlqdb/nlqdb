// The MCP door to the DBA (`GLOBAL-043` items 5–6, `END_GOAL.md` row 8): a
// coding agent attaches a Postgres with one tool call, lists the proposals,
// and applies or rejects each — over the real MCP protocol and the real
// `@nlqdb/sdk` client, against a recorded fixture of the API's responses
// (the same shapes as the CLI's `TestAttachDoorWalk` / `TestAttachD1DoorWalk`;
// D1 DDL as `createD1IndexProposal` writes it). No network, no LLM.
// The fixture keeps the API's key boundary: only an `sk_live_` key attaches
// (`SK-APIKEYS-015`); an `sk_mcp_` key decides, named in `decided_by`.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { renderError } from "@nlqdb/errors";
import { createClient } from "@nlqdb/sdk";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/index.ts";

const TABLES = ["posts", "comments", "likes", "follows", "sessions"];
type Engine = "postgres" | "d1";
const ddl = (t: string, engine: Engine = "postgres") =>
  engine === "d1"
    ? `CREATE INDEX IF NOT EXISTS "nlqdb_${t}_user_id_idx" ON "${t}" (\`user_id\`)`
    : `CREATE INDEX CONCURRENTLY nlqdb_${t}_user_id_idx ON public.${t} (user_id)`;
const inverse = (t: string, engine: Engine) =>
  engine === "d1"
    ? `DROP INDEX IF EXISTS "nlqdb_${t}_user_id_idx"`
    : `DROP INDEX CONCURRENTLY public.nlqdb_${t}_user_id_idx`;
// Verify's verdict per engine: a D1 keeps no percentile, so mean time and rows read per run.
const keep = (engine: Engine) =>
  engine === "d1"
    ? {
        verdict: "keep",
        query: "SELECT * FROM posts WHERE user_id = ?",
        beforeMeanMs: 1.2,
        afterMeanMs: 0.1,
        beforeRowsRead: 4999,
        afterRowsRead: 1,
      }
    : { verdict: "keep", fingerprint: "f", beforeP95Ms: 2, afterP95Ms: 0.1 };

function fakeApi(engine: Engine = "postgres") {
  const status = new Map<number, string>();
  const decidedBy = new Map<number, string>();
  const requests: { method: string; path: string; body: string }[] = [];
  const json = (body: unknown, code = 200) =>
    new Response(JSON.stringify(body), {
      status: code,
      headers: { "content-type": "application/json" },
    });
  const fail = (
    code:
      | "proposal_not_found"
      | "proposal_decided"
      | "connect_requires_account"
      | "invalid_request",
    params?: { status: string } | { message: string },
  ) => {
    const { httpStatus, recoverability: _r, ...wire } = renderError(code, params ?? {});
    return json({ error: wire }, httpStatus);
  };

  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : "";
    requests.push({ method, path: url.pathname, body });
    const key = new Headers(init?.headers).get("authorization")?.replace(/^Bearer /, "") ?? "";
    const kind = key.startsWith("sk_live_") ? "sk_live" : "sk_mcp";

    // `/v1/attach` is the `/v1/db/connect` alias the SDK's `attach()` calls.
    if (method === "POST" && (url.pathname === "/v1/db/connect" || url.pathname === "/v1/attach")) {
      if (kind !== "sk_live") return fail("connect_requires_account");
      const req = JSON.parse(body || "{}");
      if ((req.engine ?? "postgres") !== engine)
        return fail("invalid_request", { message: "wrong engine" });
      if (engine === "d1" && !(req.account_id && req.database_id && req.token)) {
        return fail("invalid_request", {
          message: "account_id, database_id and token are required for a D1.",
        });
      }
      const proposals = TABLES.map((t, i) => {
        status.set(i + 1, "proposed");
        return {
          id: i + 1,
          kind: "create_index",
          tier: 0,
          schema: engine === "d1" ? "main" : "public",
          table: t,
          columns: ["user_id"],
          ddl: ddl(t, engine),
          inverse: inverse(t, engine),
          reason: "foreign key without an index",
          evidence: { rowEstimate: 1000, tableBytes: 8192 },
        };
      });
      return json(
        {
          dbId: "db_attach_1",
          name: "app",
          engine,
          schemaPreview: "posts(id, user_id)",
          pkLive: "pk_live_must_not_leak",
          proposals,
        },
        201,
      );
    }
    if (method === "GET" && url.pathname === "/v1/databases/db_attach_1/changes") {
      const changes = [...TABLES.keys()].reverse().map((i) => ({
        id: i + 1,
        origin: "attach",
        status: status.get(i + 1),
        kind: "create_index",
        table: TABLES[i],
        ddl: ddl(TABLES[i] as string, engine),
        inverse: inverse(TABLES[i] as string, engine),
        reason: "foreign key without an index",
        createdAt: 1,
        ...(status.get(i + 1) === "applied" ? { verification: keep(engine) } : {}),
      }));
      // A committed hosted-path row sits in the same ledger; it is not a proposal.
      changes.push({ ...changes[0], id: 99, origin: "ask", status: "applied" } as never);
      return json({ changes });
    }
    const m = url.pathname.match(/^\/v1\/proposals\/(\d+)\/(apply|reject)$/);
    if (method === "POST" && m) {
      const id = Number(m[1]);
      const want = m[2] === "apply" ? "applied" : "rejected";
      const cur = status.get(id);
      if (!cur) return fail("proposal_not_found");
      if (cur !== "proposed" && cur !== want) return fail("proposal_decided", { status: cur });
      const replayed = cur === want;
      status.set(id, want);
      decidedBy.set(id, `${kind}:key_1`);
      const reason = want === "rejected" ? (JSON.parse(body || "{}").reason ?? null) : null;
      return json({
        proposal: {
          id,
          dbId: "db_attach_1",
          status: want,
          decidedBy: `${kind}:key_1`,
          decidedAt: 1,
          rejectReason: reason,
        },
        replayed,
      });
    }
    return json({ error: { code: "not_found", message: "no route" } }, 404);
  };
  return { fetch, status, decidedBy, requests };
}

// One MCP host on `apiKey`, against a shared fake API.
async function connect(api: ReturnType<typeof fakeApi>, apiKey: string) {
  const client = createClient({
    apiKey,
    baseUrl: "https://api.test",
    fetch: api.fetch,
  });
  const server = createServer({ client, name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: "dba-door-test", version: "0.0.0" });
  await mcp.connect(clientTransport);
  const call = async (name: string, args: Record<string, unknown>) => {
    const res = (await mcp.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content: { type: string; text: string }[];
      structuredContent?: Record<string, unknown>;
    };
    return { ...res, text: res.content.map((c) => c.text).join("\n") };
  };
  return { call, teardown: () => mcp.close() };
}

describe("the MCP door to the DBA (GLOBAL-043 items 5–6)", () => {
  it("attaches, lists, applies 3 and rejects 2 — every proposal decided from MCP", async () => {
    const api = fakeApi();
    const owner = await connect(api, "sk_live_owner");
    const { call, teardown } = await connect(api, "sk_mcp_agent");
    try {
      const secret = "postgres://app:s3cret@db.example.com:5432/app";
      // An `sk_mcp_` key can't attach yet — the error names the sk_live_ route.
      const refused = await call("nlqdb_connect_database", {
        engine: "postgres",
        connection_url: secret,
      });
      expect(refused.isError).toBe(true);
      expect(refused.text).toContain("sk_live_");

      const attached = await owner.call("nlqdb_connect_database", {
        engine: "postgres",
        connection_url: secret,
      });
      expect(attached.isError).toBeFalsy();
      const first = attached.structuredContent as {
        dbId: string;
        proposals: { id: number; ddl: string }[];
      };
      expect(first.dbId).toBe("db_attach_1");
      expect(first.proposals.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
      expect(first.proposals[0]?.ddl).toMatch(/^CREATE INDEX CONCURRENTLY/);
      // The secret and the publishable key never re-enter the transcript.
      expect(attached.text).not.toContain("s3cret");
      expect(attached.text).not.toContain("pk_live_must_not_leak");

      for (const p of first.proposals) {
        const res =
          p.id <= 3
            ? await call("nlqdb_apply_proposal", { id: p.id })
            : await call("nlqdb_reject_proposal", { id: p.id, reason: "write-heavy table" });
        expect(res.isError, res.text).toBeFalsy();
      }
      const decided = [...api.status.values()].filter((s) => s !== "proposed").length;
      // biome-ignore lint/suspicious/noConsole: the door's reading belongs in the CI log
      console.log(`proposals decided from MCP: ${decided}/5`);
      expect(decided).toBe(5);
      expect([...api.decidedBy.values()].every((d) => d === "sk_mcp:key_1")).toBe(true);
      expect(api.requests.at(-1)?.body).toContain('"reason":"write-heavy table"');

      const listed = await call("nlqdb_list_proposals", { db: "db_attach_1" });
      const rows = (
        listed.structuredContent as {
          proposals: { id: number; status: string; verification?: { verdict: string } }[];
        }
      ).proposals;
      expect(rows.map((r) => r.id)).toEqual([5, 4, 3, 2, 1]);
      expect(rows.find((r) => r.id === 1)).toMatchObject({
        status: "applied",
        verification: { verdict: "keep" },
      });
      expect(rows.find((r) => r.id === 5)?.status).toBe("rejected");
    } finally {
      await teardown();
      await owner.teardown();
    }
  });

  it("a replayed verb is a no-op; the opposite verb and an unknown id say what to call next", async () => {
    const { call, teardown } = await connect(fakeApi(), "sk_live_owner");
    try {
      await call("nlqdb_connect_database", {
        engine: "postgres",
        connection_url: "postgres://u:p@h/db",
      });
      await call("nlqdb_apply_proposal", { id: 1 });
      const again = await call("nlqdb_apply_proposal", { id: 1 });
      expect(again.isError).toBeFalsy();
      expect(again.structuredContent).toMatchObject({ replayed: true });

      const opposite = await call("nlqdb_reject_proposal", { id: 1 });
      expect(opposite.isError).toBe(true);
      expect(opposite.text).toContain("already applied");
      expect(opposite.text).toContain("nlqdb_list_proposals");

      const unknown = await call("nlqdb_apply_proposal", { id: 42 });
      expect(unknown.isError).toBe(true);
      expect(unknown.text).toContain("nlqdb_list_proposals");
    } finally {
      await teardown();
    }
  });
  it("attaches a D1 with its token, account and database ids — every D1 proposal decided from MCP", async () => {
    const api = fakeApi("d1");
    const { call, teardown } = await connect(api, "sk_live_owner");
    try {
      const token = "cf_token_s3cret";
      const ids = { account_id: "acc_1", database_id: "6f1c0d1e-d1d1-4d1d-8d1d-000000000001" };
      // A missing credential is the API's one-sentence refusal, naming the fields.
      const missing = await call("nlqdb_connect_database", { engine: "d1", ...ids });
      expect(missing.isError).toBe(true);
      expect(missing.text).toContain("account_id, database_id and token");

      const attached = await call("nlqdb_connect_database", { engine: "d1", ...ids, token });
      expect(attached.isError, attached.text).toBeFalsy();
      const first = attached.structuredContent as {
        dbId: string;
        engine: string;
        proposals: { id: number; ddl: string }[];
      };
      expect(first.engine).toBe("d1");
      expect(first.proposals.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
      expect(first.proposals[0]?.ddl).toMatch(/^CREATE INDEX IF NOT EXISTS "nlqdb_posts/);
      // The token rides the body of `/v1/attach` once, as the API names it, and never comes back.
      const sent = api.requests.at(-1);
      expect(sent?.path).toBe("/v1/attach");
      expect(JSON.parse(sent?.body ?? "{}")).toEqual({ engine: "d1", ...ids, token });
      expect(attached.text).not.toContain(token);
      expect(attached.text).not.toContain("pk_live_must_not_leak");

      for (const p of first.proposals) {
        const res =
          p.id <= 3
            ? await call("nlqdb_apply_proposal", { id: p.id })
            : await call("nlqdb_reject_proposal", { id: p.id, reason: "write-heavy table" });
        expect(res.isError, res.text).toBeFalsy();
      }
      const decided = [...api.status.values()].filter((s) => s !== "proposed").length;
      // biome-ignore lint/suspicious/noConsole: the door's reading belongs in the CI log
      console.log(`D1 proposals decided from MCP: ${decided}/5`);
      expect(decided).toBe(5);

      const listed = await call("nlqdb_list_proposals", { db: first.dbId });
      const rows = (
        listed.structuredContent as {
          proposals: { id: number; status: string; verification?: Record<string, unknown> }[];
        }
      ).proposals;
      expect(rows.find((r) => r.id === 1)).toMatchObject({
        status: "applied",
        verification: { verdict: "keep", beforeRowsRead: 4999, afterRowsRead: 1 },
      });
    } finally {
      await teardown();
    }
  });
});
