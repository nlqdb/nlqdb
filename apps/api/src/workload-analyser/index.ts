// Workload-analyser barrel — re-exports the public surface.
//
// The cron entry point (`runWorkloadAnalyser`) is invoked from the
// `scheduled()` handler in `apps/api/src/index.ts`. The pure analyser
// (`analyseQueryLog`) is exported for unit-test fixtures + future
// reuse (e.g. operator dry-run from a one-off script).

export type { Engine, ProposalStats, QueryLogRow, ReshapeProposal } from "./analyse.ts";
export { analyseQueryLog, pipeNameFor } from "./analyse.ts";
export type { RunWorkloadAnalyserDeps, RunWorkloadAnalyserResult } from "./cron.ts";
export { runWorkloadAnalyser } from "./cron.ts";
export type { Policy } from "./policy.ts";
export { POLICY } from "./policy.ts";
