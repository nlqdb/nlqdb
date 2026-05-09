// Pinned thresholds for the daily workload analyser (`SK-MIGRATE-002`).
// Constants by name, no env-var knobs — changing a threshold requires a
// code edit + a new SK-MIGRATE supersession block.

export type Policy = {
  readonly WINDOW_DAYS: number;
  readonly MIN_CALLS: number;
  readonly MIN_P99_MS: number;
  readonly MIN_DISTINCT_DAYS: number;
};

export const POLICY: Policy = {
  WINDOW_DAYS: 7,
  MIN_CALLS: 25,
  MIN_P99_MS: 500,
  MIN_DISTINCT_DAYS: 1,
} as const;
