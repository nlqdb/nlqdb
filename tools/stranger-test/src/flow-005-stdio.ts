// FLOW-005 (P2 agent builder) local-stdio-transport walker — the npm-fallback
// install path from SK-MCP-001 (`@nlqdb/mcp` over stdio, the surface a Claude
// Desktop / Cursor user runs when they paste a key instead of the connector URL).
//
// `scripts/flow-005-walk.sh` covers the *hosted* discovery + auth-wall on
// mcp.nlqdb.com; nothing covered the *stdio* transport. This walker spawns the
// real `@nlqdb/mcp` binary and drives a real MCP `initialize` + `tools/list`
// handshake over OS pipes — no mocking, no network: `initialize` and
// `tools/list` are served from the in-memory tool registry, so the
// NLQDB_API_KEY prefix-gate is satisfied with a throwaway token that never
// authenticates (tool *invocation*, which would, stays in the credentialed
// mirror). Asserts the exact catalog an MCP host discovers before it can call
// any tool — a regression here silently breaks every npm-fallback install.
//
// Exit: 0 every assertion green · 1 a catalog/handshake assertion failed ·
// 2 the harness could not spawn or handshake (matches runner.ts).

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const BIN_PATH = resolve(REPO_ROOT, "packages/mcp/bin/nlqdb-mcp.mjs");
// Prefix-valid (stdio.ts KEY_PREFIXES) so the server starts; never sent to the
// API because the walk stops before any tool invocation.
const STARTUP_KEY = "sk_live_flow005_stdio_walker_noauth";
const HANDSHAKE_TIMEOUT_MS = 20_000;

// The contract an MCP host discovers (packages/mcp/src/server.ts · SK-MCP-002).
// `nlqdb_query` carries the implicit create ("materialised on first reference")
// — there is no `create_database` / `ask` / `run` tool.
type ToolSpec = { readOnly: boolean; destructive: boolean; inputKeys: string[] };
const EXPECTED_TOOLS: Record<string, ToolSpec> = {
  nlqdb_query: { readOnly: false, destructive: true, inputKeys: ["db", "q", "confirm"] },
  nlqdb_list_databases: { readOnly: true, destructive: false, inputKeys: [] },
  nlqdb_describe: { readOnly: true, destructive: false, inputKeys: ["db"] },
};
// Names the tracker has mis-referenced as MCP tools — none may exist.
const FORBIDDEN_TOOLS = ["create_database", "nlqdb_create_database", "ask", "run"];

type DiscoveredTool = {
  name: string;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  inputSchema?: { properties?: Record<string, unknown> };
};

export type Handshake = {
  serverName: string;
  serverVersion: string;
  toolsCapability: boolean;
  tools: DiscoveredTool[];
};

export type Check = { name: string; status: "ok" | "fail"; detail?: string };

// Pure catalog assessment — exported so test/flow-005-stdio.test.ts can pin the
// contract without spawning a process.
export function assessHandshake(hs: Handshake): {
  checks: Check[];
  protocolOk: boolean;
  catalogOk: boolean;
} {
  const checks: Check[] = [];
  const ok = (name: string, cond: boolean, detail: string): boolean => {
    checks.push(cond ? { name, status: "ok" } : { name, status: "fail", detail });
    return cond;
  };

  // Reaching here means client.connect() resolved — the MCP `initialize`
  // protocol-version negotiation succeeded (the SDK throws on a mismatch).
  const proto: boolean[] = [];
  proto.push(
    ok("server identifies as @nlqdb/mcp", hs.serverName === "@nlqdb/mcp", `saw '${hs.serverName}'`),
  );
  proto.push(
    ok("server advertises the tools capability", hs.toolsCapability, "capabilities.tools missing"),
  );

  const byName = new Map(hs.tools.map((t) => [t.name, t] as const));
  const cat: boolean[] = [];
  cat.push(
    ok(
      `exactly ${Object.keys(EXPECTED_TOOLS).length} tools listed`,
      hs.tools.length === Object.keys(EXPECTED_TOOLS).length,
      `saw ${hs.tools.length}: ${hs.tools.map((t) => t.name).join(", ")}`,
    ),
  );
  for (const [name, spec] of Object.entries(EXPECTED_TOOLS)) {
    const t = byName.get(name);
    if (!cat.push(ok(`tool ${name} present`, t !== undefined, "missing from catalog")) || !t)
      continue;
    cat.push(
      ok(
        `tool ${name} annotation hints match SK-MCP-002`,
        (t.annotations?.readOnlyHint ?? false) === spec.readOnly &&
          (t.annotations?.destructiveHint ?? false) === spec.destructive,
        `readOnly=${t.annotations?.readOnlyHint} destructive=${t.annotations?.destructiveHint}`,
      ),
    );
    const keys = Object.keys(t.inputSchema?.properties ?? {}).sort();
    cat.push(
      ok(
        `tool ${name} input schema is { ${spec.inputKeys.join(", ")} }`,
        JSON.stringify(keys) === JSON.stringify([...spec.inputKeys].sort()),
        `saw [${keys.join(", ")}]`,
      ),
    );
  }
  for (const forbidden of FORBIDDEN_TOOLS) {
    cat.push(
      ok(
        `no '${forbidden}' tool (create is implicit via nlqdb_query)`,
        !byName.has(forbidden),
        "present",
      ),
    );
  }

  return { checks, protocolOk: proto.every(Boolean), catalogOk: cat.every(Boolean) };
}

async function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, guard]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function handshake(): Promise<Handshake> {
  const transport = new StdioClientTransport({
    command: process.execPath, // the bun/node running this walker
    args: [BIN_PATH],
    env: { ...(process.env as Record<string, string>), NLQDB_API_KEY: STARTUP_KEY },
    stderr: "inherit", // surface a failing child's fatal stderr for triage
  });
  const client = new Client({ name: "flow-005-stdio-walker", version: "1.0" });
  try {
    await withDeadline(client.connect(transport), HANDSHAKE_TIMEOUT_MS, "MCP initialize");
    const sv = client.getServerVersion();
    const caps = client.getServerCapabilities();
    const { tools } = await withDeadline(client.listTools(), HANDSHAKE_TIMEOUT_MS, "tools/list");
    return {
      serverName: sv?.name ?? "",
      serverVersion: sv?.version ?? "",
      toolsCapability: caps?.tools !== undefined,
      tools: tools as DiscoveredTool[],
    };
  } finally {
    await client.close().catch(() => {});
  }
}

type Outcome = {
  utc: string;
  flow: "FLOW-005";
  transport: "stdio";
  bin: string;
  state: "passed" | "failed" | "error";
  total_wall_s: number;
  checks_passed: number;
  checks_failed: number;
  protocol_ok: boolean;
  catalog_ok: boolean;
  server_name?: string;
  server_version?: string;
  tools?: string[];
  notes: string;
};

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { out: { type: "string" }, quiet: { type: "boolean" } },
    strict: true,
  });
  const quiet = values.quiet ?? false;
  const out =
    values.out ??
    `tools/stranger-test/results/flow-005-stdio-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const log = (s: string) => !quiet && process.stdout.write(s);

  // A spawn/handshake failure (missing build, bad bin) lands as a harness
  // error (state:"error", exit 2) via the catch below — distinct from a
  // catalog-contract failure (state:"failed", exit 1).
  const t0 = Date.now();
  let outcome: Outcome;
  try {
    const hs = await handshake();
    const { checks, protocolOk, catalogOk } = assessHandshake(hs);
    const failed = checks.filter((c) => c.status === "fail");
    log(`\n\x1b[1;34m== FLOW-005 stdio transport — @nlqdb/mcp initialize + tools/list ==\x1b[0m\n`);
    for (const c of checks) {
      if (c.status === "ok") log(`  \x1b[1;32m✓\x1b[0m ${c.name}\n`);
      else log(`  \x1b[1;31m✗\x1b[0m ${c.name}  — ${c.detail}\n`);
    }
    const state = protocolOk && catalogOk ? "passed" : "failed";
    outcome = {
      utc: new Date().toISOString(),
      flow: "FLOW-005",
      transport: "stdio",
      bin: "packages/mcp/bin/nlqdb-mcp.mjs",
      state,
      total_wall_s: Math.round((Date.now() - t0) / 100) / 10,
      checks_passed: checks.length - failed.length,
      checks_failed: failed.length,
      protocol_ok: protocolOk,
      catalog_ok: catalogOk,
      server_name: hs.serverName,
      server_version: hs.serverVersion,
      tools: hs.tools.map((t) => t.name),
      notes:
        state === "passed"
          ? "stdio handshake green; catalog = nlqdb_query/list_databases/describe (no create_database tool)"
          : `failed: ${failed.map((c) => c.name).join("; ")}`,
    };
  } catch (e) {
    outcome = {
      utc: new Date().toISOString(),
      flow: "FLOW-005",
      transport: "stdio",
      bin: "packages/mcp/bin/nlqdb-mcp.mjs",
      state: "error",
      total_wall_s: Math.round((Date.now() - t0) / 100) / 10,
      checks_passed: 0,
      checks_failed: 0,
      protocol_ok: false,
      catalog_ok: false,
      notes: `harness error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const path = resolve(out);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(outcome, null, 2)}\n`);
  if (outcome.state === "passed") {
    const total = outcome.checks_passed + outcome.checks_failed;
    log(
      `\n  \x1b[1;32m✓\x1b[0m FLOW-005 stdio PASS — ${outcome.checks_passed}/${total} checks in ${outcome.total_wall_s}s\n`,
    );
    log(`  \x1b[1;32m✓\x1b[0m outcome JSON written to ${out}\n`);
    return 0;
  }
  log(`\n  \x1b[1;31m✗\x1b[0m FLOW-005 stdio ${outcome.state.toUpperCase()} — ${outcome.notes}\n`);
  return outcome.state === "error" ? 2 : 1;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(
        `flow-005-stdio failed: ${e instanceof Error ? e.message : String(e)}\n`,
      );
      process.exit(2);
    });
}
