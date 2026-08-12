// listSupabaseProjects — maps the Management-API /v1/projects rows to the
// picker shape and drops rows without a ref; non-2xx throws.

import { describe, expect, it } from "vitest";
import { SupabaseOAuthError } from "./supabase-oauth.ts";
import { listSupabaseProjects } from "./supabase-projects.ts";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("listSupabaseProjects", () => {
  it("maps ref/name/region and sends the Bearer token", async () => {
    const { impl, calls } = fakeFetch(200, [
      { id: "r1", ref: "r1", name: "prod", region: "us-east-1", status: "ACTIVE_HEALTHY" },
      { id: "r2", ref: "r2", name: "staging", region: "eu-west-1" },
    ]);
    const projects = await listSupabaseProjects("tok_abc", { fetchImpl: impl });
    expect(projects).toEqual([
      { ref: "r1", name: "prod", region: "us-east-1" },
      { ref: "r2", name: "staging", region: "eu-west-1" },
    ]);
    expect(calls[0]!.url).toBe("https://api.supabase.com/v1/projects");
    expect((calls[0]!.init.headers as Record<string, string>)["authorization"]).toBe(
      "Bearer tok_abc",
    );
  });

  it("throws on a non-2xx", async () => {
    const { impl } = fakeFetch(401, { message: "no" });
    await expect(listSupabaseProjects("tok", { fetchImpl: impl })).rejects.toBeInstanceOf(
      SupabaseOAuthError,
    );
  });
});
