// stranger-test — §1.1 anti-self-deception primitive from
// docs/research/automated-icp-validation-plan.md.
//
// Usage:
//   bun src/runner.ts [--base-url URL] [--flows flow-001,flow-002,flow-003]
//                     [--prompts N] [--out path.json] [--quiet]
//
// Exits 0 when every walked run passed; non-zero with a one-line summary
// otherwise, so an agent can cron it without parsing JSON.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import type { Browser } from "@playwright/test";

import { launchBrowser, percentile } from "./browser.ts";
import { walkFlow001 } from "./flows/flow-001.ts";
import { SOLVE_SLUGS, walkFlow002 } from "./flows/flow-002.ts";
import { VS_SLUGS, walkFlow003 } from "./flows/flow-003.ts";
import { FLOW_PERSONA, PERSONA_PROMPTS } from "./personas.ts";
import type { FlowId, FlowResult, FlowRun, PersonaId, WalkResult } from "./types.ts";

const USER_AGENT = "nlqdb-stranger-test/1.0 (+https://nlqdb.com; contact: hello@nlqdb.com)";

type Args = {
  baseUrl: string;
  flows: FlowId[];
  prompts: number;
  out: string | null;
  quiet: boolean;
  // SK-STRG-004 — when set, walkers navigate to `?invite=<code>` so the
  // homepage's captureInviteFromUrl() can write localStorage["nlqdb_invite"]
  // and the api.ts client forwards X-Invite-Code on /v1/ask. Inverts the
  // gate-403 step from expected-fail to expected-200.
  inviteCode: string | null;
};

function parseFlowsArg(raw: string | undefined): FlowId[] {
  if (!raw) return ["flow-001", "flow-002", "flow-003"];
  const known = new Set<FlowId>(["flow-001", "flow-002", "flow-003"]);
  const out: FlowId[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim().toLowerCase() as FlowId;
    if (!known.has(id)) throw new Error(`unknown flow id: ${id}`);
    out.push(id);
  }
  return out;
}

// 80-bit min per SK-GATE-003 invite-code entropy; base64url charset is the
// shape the Resend template emits and `apps/web/src/lib/invite.ts` parses.
const INVITE_CODE_RE = /^[A-Za-z0-9_-]{16,128}$/;

function parseCliArgs(): Args {
  const { values } = parseArgs({
    options: {
      "base-url": { type: "string" },
      flows: { type: "string" },
      prompts: { type: "string" },
      out: { type: "string" },
      quiet: { type: "boolean" },
      "invite-code": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  const inviteCodeRaw = values["invite-code"] ?? process.env["NLQDB_INVITE_CODE"] ?? null;
  if (inviteCodeRaw !== null && !INVITE_CODE_RE.test(inviteCodeRaw)) {
    throw new Error("invite code must match /[A-Za-z0-9_-]{16,128}/ (refusing to forward)");
  }
  return {
    baseUrl: (values["base-url"] ?? process.env["NLQDB_BASE_URL"] ?? "https://nlqdb.com").replace(
      /\/$/,
      "",
    ),
    flows: parseFlowsArg(values["flows"]),
    prompts: values["prompts"] ? Math.max(1, Number.parseInt(values["prompts"], 10)) : 3,
    out: values["out"] ?? null,
    quiet: values["quiet"] ?? false,
    inviteCode: inviteCodeRaw,
  };
}

function summarise(id: FlowId, persona: PersonaId, runs: FlowRun[]): FlowResult {
  let passed = 0;
  let failed = 0;
  for (const r of runs) {
    if (r.state === "passed") passed++;
    else failed++;
  }
  return { id, persona, runs, passed, failed };
}

async function runFlow001(args: Args, browser: Browser): Promise<FlowResult> {
  const persona: PersonaId = FLOW_PERSONA["flow-001"];
  const pool = PERSONA_PROMPTS[persona];
  const take = Math.min(args.prompts, pool.length);
  const runs: FlowRun[] = [];
  for (let i = 0; i < take; i++) {
    const prompt = pool[i] as string;
    if (!args.quiet) process.stdout.write(`  flow-001 prompt="${prompt}" ... `);
    const r = await walkFlow001(prompt, args.baseUrl, USER_AGENT, browser, args.inviteCode);
    if (!args.quiet)
      process.stdout.write(`${r.state}${r.failedStep ? ` step=${r.failedStep}` : ""}\n`);
    runs.push(r);
  }
  return summarise("flow-001", persona, runs);
}

async function runFlow002(args: Args, browser: Browser): Promise<FlowResult> {
  const persona: PersonaId = FLOW_PERSONA["flow-002"];
  const take = Math.min(args.prompts, SOLVE_SLUGS.length);
  const runs: FlowRun[] = [];
  for (let i = 0; i < take; i++) {
    const slug = SOLVE_SLUGS[i] as string;
    if (!args.quiet) process.stdout.write(`  flow-002 slug="${slug}" ... `);
    const r = await walkFlow002(slug, args.baseUrl, USER_AGENT, browser, args.inviteCode);
    if (!args.quiet)
      process.stdout.write(`${r.state}${r.failedStep ? ` step=${r.failedStep}` : ""}\n`);
    runs.push(r);
  }
  return summarise("flow-002", persona, runs);
}

async function runFlow003(args: Args, browser: Browser): Promise<FlowResult> {
  const persona: PersonaId = FLOW_PERSONA["flow-003"];
  const take = Math.min(args.prompts, VS_SLUGS.length);
  const runs: FlowRun[] = [];
  for (let i = 0; i < take; i++) {
    const slug = VS_SLUGS[i] as string;
    if (!args.quiet) process.stdout.write(`  flow-003 slug="${slug}" ... `);
    const r = await walkFlow003(slug, args.baseUrl, USER_AGENT, browser, args.inviteCode);
    if (!args.quiet)
      process.stdout.write(`${r.state}${r.failedStep ? ` step=${r.failedStep}` : ""}\n`);
    runs.push(r);
  }
  return summarise("flow-003", persona, runs);
}

export async function main(): Promise<number> {
  const args = parseCliArgs();
  if (!args.quiet) {
    const mode = args.inviteCode ? " mode=invite-bearing" : "";
    console.info(
      `stranger-test → ${args.baseUrl} (flows=${args.flows.join(",")} prompts=${args.prompts}${mode})`,
    );
  }

  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const browser = await launchBrowser();
  const flows: FlowResult[] = [];
  try {
    for (const id of args.flows) {
      if (id === "flow-001") flows.push(await runFlow001(args, browser));
      else if (id === "flow-002") flows.push(await runFlow002(args, browser));
      else if (id === "flow-003") flows.push(await runFlow003(args, browser));
    }
  } finally {
    await browser.close().catch(() => {});
  }
  const durationMs = Date.now() - t0;
  const finishedAt = new Date().toISOString();

  const allRuns = flows.flatMap((f) => f.runs);
  const ttfvs = allRuns.map((r) => r.ttfvMs).filter((v): v is number => v !== null);
  const passed = allRuns.filter((r) => r.state === "passed").length;
  const failed = allRuns.filter((r) => r.state === "failed").length;

  const result: WalkResult = {
    baseUrl: args.baseUrl,
    startedAt,
    finishedAt,
    durationMs,
    inviteBearing: args.inviteCode !== null,
    flows,
    summary: {
      totalRuns: allRuns.length,
      passed,
      failed,
      ttfvP50Ms: percentile(ttfvs, 50),
      ttfvP95Ms: percentile(ttfvs, 95),
    },
  };

  if (args.out) {
    const path = resolve(args.out);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(result, null, 2)}\n`);
    if (!args.quiet) console.info(`wrote ${path}`);
  } else if (!args.quiet) {
    console.info(JSON.stringify(result, null, 2));
  }

  if (!args.quiet) {
    console.info(
      `\n  → ${passed}/${allRuns.length} passed (failed=${failed}) ` +
        `ttfv p50=${result.summary.ttfvP50Ms ?? "—"}ms p95=${result.summary.ttfvP95Ms ?? "—"}ms ` +
        `wall=${durationMs}ms`,
    );
  }
  return failed > 0 ? 1 : 0;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`stranger-test failed: ${msg}`);
      process.exit(2);
    });
}
