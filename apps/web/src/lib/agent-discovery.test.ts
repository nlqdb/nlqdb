import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MCP_ENDPOINT_URL,
  STDIO_KEY_ENV,
  STDIO_PACKAGE,
  STDIO_PLACEHOLDER_KEY,
} from "./mcp-install.ts";

// SK-WEB-028 drift guards. The `.well-known` agent-discovery surfaces are
// static files (an agent fetches them before reading any HTML), so every
// endpoint, name, version, and digest they carry is pinned here to its source
// of truth — same contract as `agent-artifacts.test.ts`: a value that can
// drift from what production serves must fail the build, not a reader.
//
// Two of the four formats are pre-standard, pinned to the drafts as verified
// 2026-08-04 (re-verify before reshaping):
//   - /.well-known/ai-catalog.json + inline MCP Server Card — SEP-2127
//     (github.com/modelcontextprotocol/modelcontextprotocol/pull/2127, Draft;
//     schema: modelcontextprotocol/experimental-ext-server-card@main). The
//     current draft rejects the earlier /.well-known/mcp/server-card.json
//     placement and deliberately omits tool enumeration — runtime tools/list
//     stays canonical, so the card lists no tools.
//   - /.well-known/agent-skills/index.json — Cloudflare Agent Skills
//     Discovery RFC v0.2.0 (github.com/cloudflare/agent-skills-discovery-rfc).
// The other two are standards: /.well-known/api-catalog (RFC 9727 + RFC 9264
// linkset) and /auth.md (workos/auth.md convention — prose, not a schema).

const PUB = join(import.meta.dir, "../../public");
const REPO_ROOT = join(import.meta.dir, "../../../..");
const read = (p: string) => readFileSync(join(PUB, p), "utf8");

const API_CATALOG = JSON.parse(read(".well-known/api-catalog"));
const AI_CATALOG = JSON.parse(read(".well-known/ai-catalog.json"));
const SKILLS_INDEX = JSON.parse(read(".well-known/agent-skills/index.json"));
const AUTH_MD = read("auth.md");
const HEADERS_FILE = read("_headers");

describe("/.well-known/api-catalog (RFC 9727 linkset)", () => {
  const anchors = API_CATALOG.linkset.map((e: { anchor: string }) => e.anchor);

  test("anchors the real API base from the SDK and the real MCP endpoint", () => {
    // `DEFAULT_BASE_URL` is not exported by @nlqdb/sdk; read it from source
    // (the same pin style `agent-artifacts.test.ts` uses for tool names).
    const sdk = readFileSync(join(REPO_ROOT, "packages/sdk/src/index.ts"), "utf8");
    const base = sdk.match(/DEFAULT_BASE_URL = "([^"]+)"/)?.[1];
    expect(base).toBeDefined();
    expect(anchors).toContain(`${base}/v1/`);
    expect(anchors).toContain(MCP_ENDPOINT_URL);
  });

  test("no service-desc: no OpenAPI document is served (docs-site slice d is Parked)", () => {
    // Re-adding `service-desc` requires an actually-served spec URL first —
    // a 404 link in a machine catalog is a false claim.
    expect(read(".well-known/api-catalog")).not.toContain("service-desc");
  });

  test("every href is https and service-doc targets end in a trailing slash", () => {
    for (const entry of API_CATALOG.linkset) {
      for (const rel of ["service-doc", "service-meta"]) {
        for (const link of entry[rel] ?? []) {
          expect(link.href).toStartWith("https://");
          if (rel === "service-doc") expect(link.href).toEndWith("/");
        }
      }
    }
  });
});

describe("/.well-known/ai-catalog.json (SEP-2127 draft, inline Server Card)", () => {
  const entry = AI_CATALOG.entries[0];
  const card = entry.data;

  test("one MCP entry with the draft's media type and a domain-anchored urn", () => {
    expect(AI_CATALOG.specVersion).toBe("1.0");
    expect(AI_CATALOG.entries).toHaveLength(1);
    expect(entry.type).toBe("application/mcp-server-card+json");
    expect(entry.identifier).toBe("urn:air:nlqdb.com:mcp:nlqdb");
    // Exactly one of url | data — we inline.
    expect(entry.url).toBeUndefined();
  });

  test("card identity matches the published registry name and the deployed runtime version", () => {
    // `mcpName` is the identifier published to the official MCP registry.
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "packages/mcp/package.json"), "utf8"));
    expect(card.name).toBe(pkg.mcpName);
    // The card describes the HOSTED remote server, so its version must match
    // what a connected client observes in `serverInfo` — apps/mcp's constant,
    // not the npm package version (SEP-2127 "Consistency with Runtime Behavior").
    const agent = readFileSync(join(REPO_ROOT, "apps/mcp/src/mcp-agent.ts"), "utf8");
    expect(card.version).toBe(agent.match(/SERVICE_VERSION = "([^"]+)"/)?.[1]);
  });

  test("card shape stays inside the pinned v1 schema", () => {
    expect(card.$schema).toBe(
      "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    );
    expect(card.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
    expect(card.description.length).toBeLessThanOrEqual(100);
    expect(card.remotes).toEqual([{ type: "streamable-http", url: MCP_ENDPOINT_URL }]);
    // The draft schema has no tools/resources/prompts fields — runtime
    // tools/list is canonical. Enumerating them here would be schema-invalid
    // AND a second place for the catalog to lie from.
    for (const absent of ["tools", "resources", "prompts"]) {
      expect(card[absent], absent).toBeUndefined();
    }
  });
});

describe("/.well-known/agent-skills/index.json (Agent Skills Discovery RFC v0.2.0)", () => {
  test("declares the v0.2.0 schema", () => {
    expect(SKILLS_INDEX.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
  });

  test("lists both served skills, and each entry is true for the served bytes", () => {
    expect(SKILLS_INDEX.skills.map((s: { name: string }) => s.name).sort()).toEqual([
      "nlqdb-docs-memory",
      "nlqdb-memory",
    ]);
    for (const skill of SKILLS_INDEX.skills) {
      expect(skill.type).toBe("skill-md");
      expect(skill.name).toMatch(/^[a-z0-9-]{1,64}$/);
      expect(skill.description.length).toBeLessThanOrEqual(1024);
      // The url must resolve on this host — the served file is the artifact.
      expect(skill.url).toBe(`/agent-artifacts/${skill.name}/SKILL.md`);
      const body = read(skill.url.slice(1));
      // The digest is recomputed from the bytes the site serves; editing a
      // SKILL.md without re-hashing fails here, never at a reader.
      const hex = createHash("sha256").update(body).digest("hex");
      expect(skill.digest).toBe(`sha256:${hex}`);
      // name + description mirror the SKILL.md frontmatter (what `skills add`
      // and the RFC index both key on), so the two can't tell different stories.
      const fm = body.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      expect(fm).toContain(`name: ${skill.name}`);
      expect(fm).toContain(`description: ${skill.description}`);
    }
  });
});

describe("/auth.md (workos/auth.md convention)", () => {
  test("names only live auth paths: hosted OAuth endpoint + headless sk_mcp_ route", () => {
    expect(AUTH_MD).toContain(MCP_ENDPOINT_URL);
    expect(AUTH_MD).toContain("https://mcp.nlqdb.com/.well-known/oauth-authorization-server");
    expect(AUTH_MD).toContain("https://mcp.nlqdb.com/.well-known/oauth-protected-resource");
    expect(AUTH_MD).toContain(STDIO_PACKAGE);
    expect(AUTH_MD).toContain(STDIO_KEY_ENV);
    expect(AUTH_MD).toContain(STDIO_PLACEHOLDER_KEY);
    expect(AUTH_MD).toContain("https://app.nlqdb.com/app/keys");
    expect(AUTH_MD).toContain("https://docs.nlqdb.com/agent-memory/");
  });

  test("never names the over-scoped key and never promises agent self-registration", () => {
    // Same rule as SK-APIKEYS-015 for the droppable artifacts.
    expect(AUTH_MD).not.toContain("sk_live_");
    // We have no agent self-registration endpoint; the WorkOS `agent_auth`
    // block would promise identity/claim endpoints that do not exist.
    expect(AUTH_MD).not.toContain("agent_auth");
    expect(AUTH_MD.toLowerCase()).toContain("no agent self-registration");
  });
});

describe("_headers advertises the discovery surfaces (RFC 8288)", () => {
  test("the homepage Link header names the api-catalog and the canonical service-doc", () => {
    expect(HEADERS_FILE).toContain('</.well-known/api-catalog>; rel="api-catalog"');
    expect(HEADERS_FILE).toContain('<https://docs.nlqdb.com/agent-memory/>; rel="service-doc"');
  });

  test("the extensionless catalog gets its mandated media type", () => {
    // RFC 9727: MUST serve application/linkset+json; the asset pipeline
    // would otherwise infer from the (absent) extension.
    expect(HEADERS_FILE).toContain("application/linkset+json");
  });
});

describe("Content-Signal declaration (contentsignals.org)", () => {
  const SIGNAL = "Content-Signal: search=yes, ai-input=yes, ai-train=yes";

  test.each([
    ["marketing", join(PUB, "robots.txt")],
    ["docs", join(REPO_ROOT, "apps/docs/public/robots.txt")],
  ])("every robots.txt group on the %s host carries the permissive signal", (_host, file) => {
    const body = readFileSync(file, "utf8");
    // Signals attach to the group they appear in — a crawler matching a named
    // group ignores the `*` group, so the line must repeat per group (same
    // reasoning as the repeated Disallows documented in the file itself).
    const groups = body.split(/\n\s*\n/).filter((b) => /^user-agent:/im.test(b));
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) expect(group).toContain(SIGNAL);
  });
});
