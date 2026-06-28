import { describe, expect, test } from "bun:test";
import {
  buildCursorHref,
  buildMcpHosts,
  buildVscodeHref,
  MCP_ENDPOINT_URL,
  MCP_SERVER_ROUTE,
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
  if (typeof value === "string") return /^https?:\/\//.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectUrls);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectUrls);
  return [];
}

/** Every `https://…` token in a raw command / TOML string. */
function urlsInText(text: string): string[] {
  return text.match(/https?:\/\/[^\s"]+/g) ?? [];
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

  test("the VS Code deep-link decodes to {name,type:http,url} at the server route", () => {
    const href = buildVscodeHref(MCP_ENDPOINT_URL);
    // `vscode:mcp/install?<encodeURIComponent(JSON)>` — the whole query is the
    // URL-encoded JSON (no named param), NOT base64. Slice off the scheme+path.
    expect(href.startsWith("vscode:mcp/install?")).toBe(true);
    const payload = href.slice("vscode:mcp/install?".length);
    const obj = JSON.parse(decodeURIComponent(payload));
    expect(obj).toMatchObject({ name: "nlqdb", type: "http" });
    expect(pathOf(obj.url)).toBe(MCP_SERVER_ROUTE);
    // It is URL-encoded JSON, not base64 — base64-decoding wouldn't be JSON.
    expect(payload).not.toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  test("every host's connection URL points at the server route — not root, not doubled", () => {
    for (const host of buildMcpHosts(MCP_ENDPOINT_URL)) {
      let urls: string[];
      if (host.status === "deep-link") {
        const query = host.href!.includes("?") ? host.href!.split("?")[1]! : "";
        if (host.id === "cursor") {
          // base64(JSON) in the `config` query param.
          const b64 = new URLSearchParams(query).get("config") as string;
          urls = collectUrls(JSON.parse(Buffer.from(b64, "base64").toString("utf8")));
        } else {
          // VS Code: the whole query is url-encoded JSON.
          urls = collectUrls(JSON.parse(decodeURIComponent(query)));
        }
      } else if (host.status === "command") {
        // The shell command and/or the TOML/JSON config block carry the URL.
        urls = [
          ...(host.command ? urlsInText(host.command) : []),
          ...(host.config ? urlsInText(host.config) : []),
        ];
      } else {
        urls = collectUrls(JSON.parse(host.config as string));
      }

      // Each host advertises at least one connection URL, and all of them
      // resolve to the server's route. Catches root ("/"), a doubled
      // suffix ("/mcp/mcp"), or any other drift from the endpoint.
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(pathOf(url)).toBe(MCP_SERVER_ROUTE);
      }
    }
  });

  test("command hosts carry the full endpoint URL", () => {
    const hosts = buildMcpHosts(MCP_ENDPOINT_URL).filter((h) => h.status === "command");
    expect(hosts.map((h) => h.id).sort()).toEqual(["claude-code", "codex"]);
    for (const host of hosts) {
      const text = `${host.command ?? ""}\n${host.config ?? ""}`;
      expect(text).toContain(MCP_ENDPOINT_URL);
    }
  });
});
