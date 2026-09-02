import { describe, expect, it } from "vitest";
import { createClient, type FetchLike, NlqdbApiError } from "../src/index.ts";

// Coverage for verbs the existing suite never exercised (remember,
// getKeyStatus, redeemOAuthBridgeCode) plus two cross-cutting contracts:
// per-call Idempotency-Key uniqueness (SK-SDK-006) and the documented —
// but currently unimplemented — 401 silent-refresh path (SK-SDK-005).

function headerBag(init: RequestInit | undefined): Record<string, string> {
  return (init?.headers ?? {}) as Record<string, string>;
}

describe("remember (E-02)", () => {
  it("POSTs /v1/memory/remember with the typed body + auto Idempotency-Key", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fakeFetch: FetchLike = async (u, i) => {
      url = String(u);
      init = i;
      return new Response(
        JSON.stringify({
          status: "ok",
          id: 42,
          kind: "fact",
          materialised_at: "2026-07-02T00:00:00Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ apiKey: "sk_live_test", fetch: fakeFetch });
    const out = await client.remember({
      db: "db_mem",
      kind: "fact",
      payload: { content: "the sky is blue", tags: ["trivia"] },
    });

    expect(url).toBe("https://app.nlqdb.com/v1/memory/remember");
    expect(init?.method).toBe("POST");
    expect(headerBag(init)["idempotency-key"]).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.parse(String(init?.body))).toEqual({
      db: "db_mem",
      kind: "fact",
      payload: { content: "the sky is blue", tags: ["trivia"] },
    });
    expect(out).toMatchObject({ status: "ok", id: 42, kind: "fact" });
  });

  it("surfaces 409 wrong_preset as NlqdbApiError", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(JSON.stringify({ error: { code: "wrong_preset" } }), {
        status: 409,
        headers: { "content-type": "application/json" },
      });
    const client = createClient({ apiKey: "sk_live_test", fetch: fakeFetch });
    await expect(
      client.remember({ db: "db_plain", kind: "fact", payload: { content: "x" } }),
    ).rejects.toMatchObject({ name: "NlqdbApiError", code: "wrong_preset", httpStatus: 409 });
  });

  it("honours a caller-supplied idempotencyKey", async () => {
    let init: RequestInit | undefined;
    const fakeFetch: FetchLike = async (_u, i) => {
      init = i;
      return new Response(
        JSON.stringify({ status: "ok", id: 1, kind: "fact", materialised_at: "t" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ apiKey: "sk_live_test", fetch: fakeFetch });
    await client.remember(
      { db: "db_mem", kind: "fact", payload: { content: "x" } },
      { idempotencyKey: "stable-mem-key" },
    );
    expect(headerBag(init)["idempotency-key"]).toBe("stable-mem-key");
  });
});

describe("getKeyStatus (SK-MCP-014)", () => {
  it("GETs /v1/keys/:hash/status with the hash URL-encoded", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fakeFetch: FetchLike = async (u, i) => {
      url = String(u);
      init = i;
      return new Response(JSON.stringify({ revoked: true, revoked_at: 1700000000 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    const out = await client.getKeyStatus("abc/def+ghi");

    expect(url).toBe("https://app.nlqdb.com/v1/keys/abc%2Fdef%2Bghi/status");
    expect(init?.method ?? "GET").toBe("GET");
    // Read-only probe: no idempotency key.
    expect(headerBag(init)["idempotency-key"]).toBeUndefined();
    expect(out).toEqual({ revoked: true, revoked_at: 1700000000 });
  });
});

describe("redeemOAuthBridgeCode (SK-MCP-013)", () => {
  it("POSTs the one-shot code and returns the redemption record", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fakeFetch: FetchLike = async (u, i) => {
      url = String(u);
      init = i;
      return new Response(
        JSON.stringify({
          user_id: "u_1",
          mcp_host: "cursor",
          device_id: "dev_1",
          bearer: "sk_mcp_xyz",
          bearer_hash: "deadbeef",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ fetch: fakeFetch });
    const out = await client.redeemOAuthBridgeCode("one-shot-code");

    expect(url).toBe("https://app.nlqdb.com/v1/oauth/mcp-callback/redeem");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ code: "one-shot-code" });
    expect(out.bearer).toBe("sk_mcp_xyz");
    expect(out.mcp_host).toBe("cursor");
  });
});

describe("Idempotency-Key uniqueness across distinct mutations (SK-SDK-006)", () => {
  it("mints a fresh key per call (two separate creates → two different keys)", async () => {
    const keys: string[] = [];
    const fakeFetch: FetchLike = async (_u, i) => {
      keys.push(headerBag(i)["idempotency-key"] ?? "");
      return new Response(
        JSON.stringify({ dbId: "db_x", slug: "x", engine: "postgres", pkLive: "pk_x" }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ apiKey: "sk_live_test", fetch: fakeFetch });
    await client.createDatabase({ name: "a" });
    await client.createDatabase({ name: "b" });

    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(keys[1]).toMatch(/^[0-9a-f]{32}$/);
    // Distinct calls must NOT share a key, or the API's dedupe store would
    // collapse two legitimate creates into one.
    expect(keys[0]).not.toBe(keys[1]);
  });
});

describe("packImports — the shared pack-import runner (SK-SDK-014)", () => {
  const okImport = {
    import: {
      id: "imp_1",
      packId: "language-tutor",
      source: { kind: "interview-session", ref: "sess_1", pin: null },
      dbId: null,
      claimed: false,
      progress: {
        phase: "saving",
        items: { total: 3, eligible: 2, skipped: 1, skipReasons: { binary: 1 } },
        records: { mistake: 2 },
        written: {},
        plannedWrites: { fact: 2 },
        verification: null,
      },
      skippedSample: [{ id: "x", reason: "binary" }],
      error: null,
      createdAt: 1,
      updatedAt: 2,
    },
  };

  it("create POSTs /v1/packs/imports with the typed body + auto Idempotency-Key", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fakeFetch: FetchLike = async (u, i) => {
      url = String(u);
      init = i;
      return new Response(JSON.stringify(okImport), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createClient({ apiKey: "sk_live_test", fetch: fakeFetch });
    const out = await client.packImports.create({
      packId: "language-tutor",
      source: "sess_1",
    });

    expect(url).toBe("https://app.nlqdb.com/v1/packs/imports");
    expect(init?.method).toBe("POST");
    expect(headerBag(init)["idempotency-key"]).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.parse(String(init?.body))).toEqual({ packId: "language-tutor", source: "sess_1" });
    expect(out.import.id).toBe("imp_1");
    expect(out.import.progress.phase).toBe("saving");
  });

  it("advance is bearer-drivable — an sk_live_ key drives it without a session (SK-PIVOT-010)", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fakeFetch: FetchLike = async (u, i) => {
      url = String(u);
      init = i;
      return new Response(JSON.stringify(okImport), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    // A bearer client, NOT withCredentials — the opposite of the grant verbs.
    const client = createClient({ apiKey: "sk_live_test", fetch: fakeFetch });
    const out = await client.packImports.advance("imp/1");

    // The id is URL-encoded into the /advance path.
    expect(url).toBe("https://app.nlqdb.com/v1/packs/imports/imp%2F1/advance");
    expect(init?.method).toBe("POST");
    expect(headerBag(init)["authorization"]).toBe("Bearer sk_live_test");
    expect(headerBag(init)["idempotency-key"]).toMatch(/^[0-9a-f]{32}$/);
    expect(out.import.packId).toBe("language-tutor");
  });

  it("get GETs the resume read with the id URL-encoded and no idempotency-key", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fakeFetch: FetchLike = async (u, i) => {
      url = String(u);
      init = i;
      return new Response(JSON.stringify(okImport), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createClient({ fetch: fakeFetch });
    await client.packImports.get("imp 1");

    expect(url).toBe("https://app.nlqdb.com/v1/packs/imports/imp%201");
    expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
    expect(headerBag(init)["idempotency-key"]).toBeUndefined();
  });

  it("delete DELETEs the draft and resolves void", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fakeFetch: FetchLike = async (u, i) => {
      url = String(u);
      init = i;
      return new Response(null, { status: 204 });
    };
    const client = createClient({ apiKey: "sk_live_test", fetch: fakeFetch });
    const out = await client.packImports.delete("imp_1");

    expect(url).toBe("https://app.nlqdb.com/v1/packs/imports/imp_1");
    expect(init?.method).toBe("DELETE");
    expect(out).toBeUndefined();
  });

  it("surfaces 403 account_required as NlqdbApiError (anon/pk_live rejected)", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(JSON.stringify({ error: { code: "account_required" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    const client = createClient({ fetch: fakeFetch });
    await expect(client.packImports.advance("imp_1")).rejects.toMatchObject({
      name: "NlqdbApiError",
      code: "account_required",
      httpStatus: 403,
    });
  });

  it("honours a caller-supplied idempotencyKey on retry", async () => {
    let init: RequestInit | undefined;
    const fakeFetch: FetchLike = async (_u, i) => {
      init = i;
      return new Response(JSON.stringify(okImport), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createClient({ apiKey: "sk_live_test", fetch: fakeFetch });
    await client.packImports.retry("imp_1", { idempotencyKey: "stable-retry-key" });
    expect(init?.method).toBe("POST");
    expect(headerBag(init)["idempotency-key"]).toBe("stable-retry-key");
  });
});

describe("401 handling on a withCredentials client", () => {
  // TODO(bug): SK-SDK-005 / GLOBAL-009 promise that a 401 on a
  // `withCredentials` client is refreshed via `POST /v1/auth/refresh`
  // and retried once, so surfaces NEVER see a 401. The FEATURE.md points
  // at `packages/sdk/src/fetch.ts` for this logic — but that file does
  // not exist, and `src/index.ts` has no refresh path at all (401 is a
  // 4xx → `isRecoverable` returns false → it surfaces immediately). This
  // test documents the CURRENT (non-conforming) behavior: the 401 is
  // thrown straight through, un-refreshed, after a single request.
  // Reported to the caller; NOT fixed here (implementing refresh needs
  // the /v1/auth/refresh contract + is a behavior change, not a test).
  it("currently surfaces the 401 directly instead of silently refreshing (documents SK-SDK-005 gap)", async () => {
    let calls = 0;
    const fakeFetch: FetchLike = async () => {
      calls++;
      return new Response(JSON.stringify({ error: { code: "unauthorized" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    try {
      await client.listChat();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NlqdbApiError);
      const e = err as NlqdbApiError;
      expect(e.code).toBe("unauthorized");
      expect(e.httpStatus).toBe(401);
    }
    // No refresh round-trip happened — exactly one request went out.
    expect(calls).toBe(1);
  });
});
