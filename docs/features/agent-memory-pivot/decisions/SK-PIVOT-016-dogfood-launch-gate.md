# SK-PIVOT-016 — The launch is condition-gated on a lived dogfood workload; conditions, never calendar dates

- **Decision:** Queue bullet #1 (fire the launch sequence) is gated on a
  **dogfood gate**: nlqdb's own operating agents run a real memory workload
  through the **public** surfaces (`npx -y @nlqdb/mcp` + an `sk_mcp_*` key,
  `nlqdb_remember`/`nlqdb_query` — no privileged backdoors) until the gate's
  criteria are green. The gate is **condition-gated, not date-gated**
  (founder-directed 2026-07-26: founder availability is random; calendar
  deadlines are banned from this gate). Initial criteria — agents may
  tighten them, only the founder may loosen or remove one:
  1. ≥ 100 real `/v1/ask` calls served through the public MCP surface from
     the ops workload (SK-PIVOT-017).
  2. First-10-queries success ≥ 95 % **on that workload** (row #4's
     instrument, finally with N > 0).
  3. Zero silent data loss / wrong-answer-accepted incidents.
  4. The temporal golden queries pass (the measured weak axis,
     `SK-QUAL-023`: temporal 2/3).
  5. The live memory dashboard is public on `/agents`.
  When all are green, the queue bullet becomes "everything is green — only
  the founder's ~30-minute sitting remains."
- **Core value:** Honest, Bullet-proof, Goal-first
- **Why:** The launch bullet sat idle 42+ days because "I'm afraid to launch
  before real usage" operated as an undated veto. The fear's substance was
  real — until 2026-07-26 no agent could use nlqdb headlessly (the
  `@nlqdb/mcp` publish closed that) and row #21's ask path past Turnstile
  has never been proven in prod. A gate with criteria converts the fear
  into product truth; a date would convert it into pressure the founder's
  availability can't absorb. Conditions are the repo's native idiom
  ("Parked until <trigger>"), and every criterion is agent-movable, so the
  gate cannot silently become a veto again.
- **Consequence in code:** `/daily` step 1 restates the top queue bullet's
  **gate progress (n/5 green)** beside its age. The dogfood workload must
  authenticate exactly as a stranger's agent would; a reviewer rejects any
  ops-agent path that bypasses the public MCP/auth surface. Loosening a
  criterion without a founder note in this file is a P1 violation.
  `MEMORY_PRESET=1` in prod is a prerequisite (flag flip, own PR).
- **Alternatives rejected:** **Date-gated launch plan** — founder is
  randomly available; a missed date teaches the queue to ignore dates. ·
  **Launch now, dogfood later** — spends the one first impression on an
  unproven ask path (row #21: "0 failed is observed, not proven"). ·
  **Wait for "real external usage" before launching** — circular: strangers
  arrive *because* of the launch; the only real agent available pre-launch
  is our own.
