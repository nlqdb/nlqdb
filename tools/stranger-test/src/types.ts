// Output schema for the stranger-test walker. Consumed by `runner.ts`
// and by future §1.2 KPI dashboard tiles that ingest the JSON shape.

export type FlowId = "flow-001" | "flow-002" | "flow-003";
export type PersonaId = "P1" | "P2" | "P3" | "P6";

// `blocked` = the instrument was refused, not the product (SK-STRG-010).
export type StepStatus = "ok" | "fail" | "blocked" | "skip";

export type StepResult = {
  step: number;
  description: string;
  status: StepStatus;
  detail?: string;
};

export type RunState = "passed" | "failed" | "blocked";

export type FlowRun = {
  prompt: string;
  state: RunState;
  // Names a *failed* step or nothing; a blocked run's stopping point is the
  // `blocked` entry in `steps` (see runOutcome).
  failedStep: number | null;
  // Time from submit to first POST /v1/ask response (time-to-first-value).
  ttfvMs: number | null;
  durationMs: number;
  steps: StepResult[];
  consoleErrors: string[];
  httpErrors: string[];
};

export type FlowResult = {
  id: FlowId;
  persona: PersonaId;
  runs: FlowRun[];
  passed: number;
  failed: number;
  blocked: number;
};

export type WalkResult = {
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  flows: FlowResult[];
  summary: {
    totalRuns: number;
    passed: number;
    failed: number;
    blocked: number;
    // Passing runs only: a challenge rejection answers in ~400 ms, and
    // reporting that as time-to-first-value would flatter the number the
    // Phase-2 TTFV gate reads.
    ttfvP50Ms: number | null;
    ttfvP95Ms: number | null;
  };
};
