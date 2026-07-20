// R-06 coding-agent walker — the reach track's measurement backbone.
//
// The reach thesis (docs/features/agent-memory-pivot/worksheets/reach/INDEX.md)
// makes one falsifiable claim: a builder who tells their *coding agent* "add
// persistent per-user memory to this app, web-search for the best option"
// ends up at nlqdb, one command away. This walker measures that claim.
//
// It drops a cold Claude Code session into a scratch agent-app fixture
// (fixtures/agent-app/ — a stateless support bot that needs per-user memory
// on Postgres) with exactly that prompt and read-only + web tools, captures
// the whole stream-json transcript, and grades three graded outcomes the
// track cares about:
//   (a) does the agent SURFACE nlqdb in its own recommendation,
//   (b) does it reach the one-command MCP SETUP string,
//   (c) does it complete a first memory read/write.
//
// (c) — and the live half of (b) — require the browser-OAuth connect that
// SK-PIVOT-010 puts behind sign-in; an autonomous walk cannot clear it, so
// those are recorded as `blocked_oauth`, never silently failed. (a) is fully
// measurable headless and is the headline baseline number (expected ≈ 0 until
// R-05 registries + R-07 artifacts move it).
//
// Non-determinism (live web search) is inherent and matches the stranger-test
// precedent: the JSON outcome records what happened this walk, not a pass gate.
// The scoring is a pure function (assessTranscript) so test/ pins it without a
// live session.
//
// Exit: 0 the walk completed and produced a graded outcome · 2 the harness
// could not spawn or drive the agent session (matches runner.ts / flow-005).

import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const FIXTURE_DIR = resolve(REPO_ROOT, "tools/stranger-test/fixtures/agent-app");

// The task a builder hands their coding agent at pivot stage 0/1.
export const WALK_PROMPT =
  "This app (see README.md and agent.ts) is a multi-tenant support agent that " +
  "forgets everything between sessions. Add persistent per-user memory to it. " +
  "Use web search to pick the best option, then tell me which one you'd use and " +
  "the exact steps to wire it in. The stack already runs Postgres.";

// Read-only + web tools: let the agent research and read the fixture, but never
// mutate the repo or run shell — we measure its recommendation, not its edits.
const ALLOWED_TOOLS = ["WebSearch", "WebFetch", "Read", "Grep", "Glob"];
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const SESSION_TIMEOUT_MS = 240_000;

// Known alternatives an agent reaches for at this moment (INDEX.md thesis:
// the real default is a DIY table on the Postgres they already run).
const COMPETITORS = [
  "mem0",
  "zep",
  "letta",
  "langmem",
  "langgraph",
  "pgvector",
  "supabase",
  "pinecone",
  "chroma",
  "weaviate",
  "redis",
  "mongodb",
];

export type Transcript = {
  // What the agent chose to say (assistant message text only).
  assistantText: string;
  // Web-search / fetch tool-result payloads (what the web returned to it).
  toolResultText: string;
  webSearchCount: number;
};

export type Check = { name: string; status: "ok" | "fail"; detail?: string };

export type Grade = {
  webSearched: boolean;
  // (a) — the headline metric. nlqdb in the agent's OWN recommendation.
  surfacedNlqdb: boolean;
  // nlqdb merely appeared in the web results, even if the agent didn't pick it.
  appearedInSearchResults: boolean;
  // (b, headless half) the one-command MCP setup string was produced.
  setupCommandPresent: boolean;
  competitorsSurfaced: string[];
  checks: Check[];
};

const NLQDB = /nlqdb/i;
// The one-command answer the track wants the agent to reach (mcp-install.ts).
const SETUP_CMD =
  /mcp\.nlqdb\.com|claude\s+mcp\s+add[^\n]*nlqdb|nlqdb[^\n]*mcp\s+add|npx\s+@nlqdb/i;

// Pure grader — exported so test/reach-agent-walk.test.ts pins the scoring
// without a live agent session.
export function assessTranscript(t: Transcript): Grade {
  const checks: Check[] = [];
  const ok = (name: string, cond: boolean, detail: string): boolean => {
    checks.push(cond ? { name, status: "ok" } : { name, status: "fail", detail });
    return cond;
  };

  const surfacedNlqdb = NLQDB.test(t.assistantText);
  const appearedInSearchResults = NLQDB.test(t.toolResultText);
  const setupCommandPresent = SETUP_CMD.test(t.assistantText);
  const competitorsSurfaced = COMPETITORS.filter((c) =>
    new RegExp(`\\b${c}\\b`, "i").test(t.assistantText),
  );

  ok("agent used web search", t.webSearchCount > 0, "no WebSearch tool_use in transcript");
  ok(
    "agent surfaced nlqdb in its recommendation",
    surfacedNlqdb,
    `recommended instead: ${competitorsSurfaced.join(", ") || "(none named)"}`,
  );
  ok(
    "agent reached the one-command MCP setup",
    setupCommandPresent,
    "no mcp.nlqdb.com / `claude mcp add … nlqdb` in the answer",
  );

  return {
    webSearched: t.webSearchCount > 0,
    surfacedNlqdb,
    appearedInSearchResults,
    setupCommandPresent,
    competitorsSurfaced,
    checks,
  };
}

// Concatenate the text an agent emitted vs. the text the web returned to it,
// from a Claude Code `--output-format stream-json` line stream.
export function parseStreamJson(lines: string[]): Transcript {
  let assistantText = "";
  let toolResultText = "";
  let webSearchCount = 0;

  const prop = (o: unknown, k: string): unknown =>
    typeof o === "object" && o !== null ? (o as Record<string, unknown>)[k] : undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ev: unknown;
    try {
      ev = JSON.parse(trimmed);
    } catch {
      continue; // non-JSON noise (progress, ansi) — ignore
    }
    if (typeof ev !== "object" || ev === null) continue;
    const type = prop(ev, "type");
    const message = prop(ev, "message");

    // Assistant turns carry the model's own words + its tool_use requests.
    if (type === "assistant") {
      const content = prop(message, "content");
      if (Array.isArray(content)) {
        for (const b of content) {
          const bt = prop(b, "type");
          const text = prop(b, "text");
          if (bt === "text" && typeof text === "string") assistantText += `${text}\n`;
          if (bt === "tool_use") {
            const name = String(prop(b, "name") ?? "");
            if (/websearch|webfetch/i.test(name)) webSearchCount += 1;
            // The query itself is the agent's phrasing — count it as its text.
            assistantText += `${JSON.stringify(prop(b, "input") ?? {})}\n`;
          }
        }
      }
    }

    // User turns in -p mode carry tool_result blocks (what the web returned).
    if (type === "user") {
      const content = prop(message, "content");
      if (Array.isArray(content)) {
        for (const b of content) {
          if (prop(b, "type") === "tool_result") {
            toolResultText += `${flattenContent(prop(b, "content"))}\n`;
          }
        }
      }
    }

    // The terminal result event repeats the final answer — fold it into text.
    const result = prop(ev, "result");
    if (type === "result" && typeof result === "string") assistantText += `${result}\n`;
  }

  return { assistantText, toolResultText, webSearchCount };
}

function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        const text =
          typeof c === "object" && c !== null ? (c as Record<string, unknown>)["text"] : undefined;
        return typeof text === "string" ? text : JSON.stringify(c);
      })
      .join(" ");
  }
  return content == null ? "" : JSON.stringify(content);
}

async function runAgentSession(model: string): Promise<{ lines: string[]; code: number | null }> {
  // Cold scratch copy of the fixture so the agent works in an isolated repo.
  const work = await mkdtemp(join(tmpdir(), "reach-agent-"));
  await cp(FIXTURE_DIR, work, { recursive: true });

  return await new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      "claude",
      [
        "-p",
        WALK_PROMPT,
        "--model",
        model,
        "--output-format",
        "stream-json",
        "--verbose",
        "--allowedTools",
        ...ALLOWED_TOOLS,
      ],
      { cwd: work, env: process.env, stdio: ["ignore", "pipe", "inherit"] },
    );

    const lines: string[] = [];
    let buf = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), SESSION_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      const parts = buf.split("\n");
      buf = parts.pop() ?? "";
      for (const p of parts) lines.push(p);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      rejectRun(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (buf) lines.push(buf);
      resolveRun({ lines, code });
    });
  });
}

type Outcome = {
  utc: string;
  flow: "R-06";
  walker: "reach-agent";
  model: string;
  state: "graded" | "error";
  total_wall_s: number;
  web_searched: boolean;
  // The three track boxes, honestly graded:
  surfaced_nlqdb: boolean; // (a) headless-measurable
  setup_command_present: boolean; // (b) headless half
  first_memory_rw: "blocked_oauth"; // (c) needs the SK-PIVOT-010 authed connect
  appeared_in_search_results: boolean;
  competitors_surfaced: string[];
  checks: Check[];
  notes: string;
};

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      out: { type: "string" },
      model: { type: "string" },
      quiet: { type: "boolean" },
    },
    strict: true,
  });
  const quiet = values.quiet ?? false;
  const model = values.model ?? DEFAULT_MODEL;
  const out =
    values.out ??
    `tools/stranger-test/results/reach-agent-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const log = (s: string) => !quiet && process.stdout.write(s);

  const t0 = Date.now();
  let outcome: Outcome;
  try {
    log(`\n\x1b[1;34m== R-06 coding-agent walk — cold session, "add per-user memory" ==\x1b[0m\n`);
    const { lines } = await runAgentSession(model);
    const transcript = parseStreamJson(lines);
    const grade = assessTranscript(transcript);
    for (const c of grade.checks) {
      if (c.status === "ok") log(`  \x1b[1;32m✓\x1b[0m ${c.name}\n`);
      else log(`  \x1b[1;31m✗\x1b[0m ${c.name}  — ${c.detail}\n`);
    }
    outcome = {
      utc: new Date().toISOString(),
      flow: "R-06",
      walker: "reach-agent",
      model,
      state: "graded",
      total_wall_s: Math.round((Date.now() - t0) / 100) / 10,
      web_searched: grade.webSearched,
      surfaced_nlqdb: grade.surfacedNlqdb,
      setup_command_present: grade.setupCommandPresent,
      first_memory_rw: "blocked_oauth",
      appeared_in_search_results: grade.appearedInSearchResults,
      competitors_surfaced: grade.competitorsSurfaced,
      checks: grade.checks,
      notes: grade.surfacedNlqdb
        ? "cold agent surfaced nlqdb in its recommendation"
        : `cold agent did NOT surface nlqdb — recommended ${
            grade.competitorsSurfaced.join(", ") || "(no named vendor)"
          }; (c) first read/write is blocked_oauth (SK-PIVOT-010 authed connect)`,
    };
  } catch (e) {
    outcome = {
      utc: new Date().toISOString(),
      flow: "R-06",
      walker: "reach-agent",
      model,
      state: "error",
      total_wall_s: Math.round((Date.now() - t0) / 100) / 10,
      web_searched: false,
      surfaced_nlqdb: false,
      setup_command_present: false,
      first_memory_rw: "blocked_oauth",
      appeared_in_search_results: false,
      competitors_surfaced: [],
      checks: [],
      notes: `harness error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const path = resolve(out);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(outcome, null, 2)}\n`);
  if (outcome.state === "graded") {
    log(
      `\n  \x1b[1;34m→\x1b[0m R-06 baseline: surfaced_nlqdb=${outcome.surfaced_nlqdb} ` +
        `setup_command=${outcome.setup_command_present} (first_rw=blocked_oauth) in ${outcome.total_wall_s}s\n`,
    );
    log(`  \x1b[1;34m→\x1b[0m outcome JSON written to ${out}\n`);
    return 0;
  }
  log(`\n  \x1b[1;31m✗\x1b[0m R-06 walk ERROR — ${outcome.notes}\n`);
  return 2;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(
        `reach-agent-walk failed: ${e instanceof Error ? e.message : String(e)}\n`,
      );
      process.exit(2);
    });
}
