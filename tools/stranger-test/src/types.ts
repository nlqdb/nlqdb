// Output schema for the stranger-test walker. Consumed by `runner.ts`
// and by future §1.2 KPI dashboard tiles that ingest the JSON shape.

export type FlowId = "flow-001" | "flow-002" | "flow-003";
export type PersonaId = "P1" | "P2" | "P3" | "P6";

export type StepStatus = "ok" | "fail" | "skip";

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
  failedStep: number | null;
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
    ttfvP50Ms: number | null;
    ttfvP95Ms: number | null;
  };
};
