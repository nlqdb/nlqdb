// E-04 lazy TTL sweep (SK-PIVOT-011 lazy variant): every memory INSERT
// opportunistically evicts expired facts in the same transaction, so
// agent memory decays without a cron — a person's memory forgets what
// it no longer needs. Bound via subquery (Postgres DELETE has no LIMIT).
//
// Split from `build-deps.ts` so unit tests don't pay the
// `cloudflare:workers` import.
//
// **Runs as the schema OWNER** — spliced in *before* `SET LOCAL ROLE` in
// the caller's step list. Same reason `orchestrateSweep` runs as owner
// (see `memory/expire.ts`): the `facts` RLS policy's TTL arm
// (`expires_at IS NULL OR expires_at > now()`, SK-PIVOT-011) makes
// expired rows invisible under the tenant role, so a DELETE run as the
// tenant silently targets zero rows. Owner bypasses RLS, so this works
// on every memory DB — including any provisioned before the read-side
// TTL arm landed.
//
// Gated on write plans (`INSERT` prefix) — `buildMemoryExec` also serves
// the pack-runner's reconcile SELECT (`pack-runner/deps.ts`), which
// shouldn't mutate. `buildRememberInsert` always emits `INSERT INTO …`.
//
// ponytail: hard-cap 200 rows/call keeps the write's p95 flat. Sustained
// expiry beyond that catches up on subsequent writes; if a real workload
// pushes past it consistently, add the cron half of E-04 back.

export type MemoryExecStep = { text: string; params: unknown[] };

export const LAZY_TTL_SWEEP_LIMIT = 200;

export function withLazyTtlSweep(
  baseSteps: MemoryExecStep[],
  plan: { text: string },
): MemoryExecStep[] {
  const isWritePlan = /^\s*INSERT\b/i.test(plan.text);
  if (!isWritePlan) return baseSteps;
  // `baseSteps` from `buildHostedExecSteps` ends with
  //   [..., SET LOCAL ROLE "<tenant>", <user step>]
  // Insert the owner-scoped sweep right before the role switch.
  return [
    ...baseSteps.slice(0, -2),
    {
      text:
        "DELETE FROM facts WHERE id IN (" +
        "SELECT id FROM facts " +
        "WHERE expires_at IS NOT NULL AND expires_at < now() " +
        `LIMIT ${LAZY_TTL_SWEEP_LIMIT})`,
      params: [],
    },
    ...baseSteps.slice(-2),
  ];
}
