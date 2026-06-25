import { describe, expect, test } from "bun:test";
import {
  MCP_ENDPOINT_URL,
  MCP_SERVER_ROUTE,
  buildCursorHref,
  buildMcpHosts,
} from "./mcp-install.ts";

// SK-WEB-016 regression guard. The hosted MCP server serves the protocol
// at `/mcp` (`apps/mcp/src/index.ts` — `apiRoute: "/mcp"`), but every
// install config we shipped first pointed at the bare domain
// `https://mcp.nlqdb.com`. Cursor's deep-link then wrote a config that
// 404'd on the first POST and failed the SSE fallback with the wrong
// content-type. Two test universes existed and never met: `apps/mcp`
// tests POST to `/mcp` (server works), web tests check the snippet's
// SHAPE — nothing followed the URL the web SHIPS. These tests are that
// missing binding: every URL a user pastes resolves to the server's
// actual route. (The live "does prod 401 not 404" check belongs in the
// stranger-test walk, `scripts/flow-005-walk.sh` — it needs the network;
// this layer is deterministic and runs on every commit.)

/** Pathname of a URL, or "" if it isn't a parseable absolute URL. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

/** Every `http(s)://` string value anywhere in a parsed config object. */
function collectUrls(value: unknown): string[] {
  if (typeof value === "string") return value.startsWith("http") ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectUrls);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectUrls);
  return [];
}

describe("MCP endpoint contract", () => {
  test("the shipped endpoint URL's path matches the server's route", () => {
    // If someone reverts the default to the bare domain, the path becomes
    // "/" and this fails — the exact regression that shipped.
    expect(MCP_SERVER_ROUTE).toBe("/mcp");
    expect(pathOf(MCP_ENDPOINT_URL)).toBe(MCP_SERVER_ROUTE);
  });

  test("the Cursor deep-link's embedded config points at the server route", () => {
    const config = new URL(buildCursorHref(MCP_ENDPOINT_URL)).searchParams.get("config");
    expect(config).not.toBeNull();
    const inner = JSON.parse(Buffer.from(config as string, "base64").toString("utf8"));
    expect(pathOf(inner.url)).toBe(MCP_SERVER_ROUTE);
  });

  test("every host config connects at the server route — not root, not doubled", () => {
    for (const host of buildMcpHosts(MCP_ENDPOINT_URL)) {
      const urls =
        host.status === "deep-link"
          ? // decode the deep-link's config payload
            collectUrls(
              JSON.parse(
                Buffer.from(
                  new URL(host.href as string).searchParams.get("config") as string,
                  "base64",
                ).toString("utf8"),
              ),
            )
          : collectUrls(JSON.parse(host.config as string));

      // Each host advertises at least one connection URL, and all of them
      // resolve to the server's route. Catches root ("/"), a doubled
      // suffix ("/mcp/mcp"), or any other drift from the endpoint.
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(pathOf(url)).toBe(MCP_SERVER_ROUTE);
      }
    }
  });
});
