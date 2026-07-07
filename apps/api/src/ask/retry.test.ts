// Coverage for `withStageRetry` (GLOBAL-022).
//
// The helper itself is tiny — three attempts, recoverable→retry,
// `Nonrecoverable`→propagate. Tests pin three behaviors that downstream
// stages depend on:
//   1. Three attempts max — fourth attempt never fires.
//   2. `prevError` flows into the next attempt's callback.
//   3. `Nonrecoverable` short-circuits to one attempt (no retry).

import { resetInstrumentsForTest, resetTelemetryForTest } from "@nlqdb/otel";
import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Nonrecoverable, RETRY_MAX_ATTEMPTS, withStageRetry } from "./retry.ts";

describe("withStageRetry", () => {
  let telemetry: TestTelemetry;

  beforeEach(() => {
    telemetry = createTestTelemetry();
  });
  afterEach(() => {
    resetInstrumentsForTest();
    resetTelemetryForTest();
  });

  it("returns immediately on first-attempt success", async () => {
    let attempts = 0;
    const out = await withStageRetry("plan", async () => {
      attempts++;
      return "ok";
    });
    expect(out).toBe("ok");
    expect(attempts).toBe(1);
  });

  it("retries up to RETRY_MAX_ATTEMPTS, then throws the last error", async () => {
    let attempts = 0;
    const seenPrev: Array<Error | null> = [];
    await expect(
      withStageRetry("plan", async (_attempt, prev) => {
        attempts++;
        seenPrev.push(prev);
        throw new Error(`boom-${attempts}`);
      }),
    ).rejects.toThrow("boom-3");
    expect(attempts).toBe(RETRY_MAX_ATTEMPTS);
    // First attempt sees no prev; subsequent attempts see the previous throw.
    expect(seenPrev[0]).toBeNull();
    expect(seenPrev[1]?.message).toBe("boom-1");
    expect(seenPrev[2]?.message).toBe("boom-2");
  });

  it("succeeds on attempt 3 if first two fail", async () => {
    let attempts = 0;
    const out = await withStageRetry("exec", async () => {
      attempts++;
      if (attempts < 3) throw new Error("transient");
      return "ok";
    });
    expect(out).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("Nonrecoverable propagates after one attempt with the wrapped cause", async () => {
    let attempts = 0;
    const cause = new Error("config_bug");
    await expect(
      withStageRetry("exec", async () => {
        attempts++;
        throw new Nonrecoverable("nope", cause);
      }),
    ).rejects.toBe(cause);
    expect(attempts).toBe(1);
  });

  it("SK-ASK-013 — exec backoff gives a scale-to-zero DB time to warm; instant retries would miss it", async () => {
    // Cold-start model: the DB is unreachable until virtual time `warmAt`,
    // then resumes. A fake sleep advances a virtual clock so the test is
    // deterministic and instant.
    const warmAt = 700;
    let now = 0;
    const sleep = async (ms: number) => {
      now += ms;
    };
    let attempts = 0;
    const out = await withStageRetry(
      "exec",
      async () => {
        attempts++;
        if (now < warmAt) throw new Error("connect ECONNREFUSED");
        return "rows";
      },
      { reasonOf: () => "db_unreachable", backoffMs: (n) => 300 * 2 ** (n - 1), sleep },
    );
    // attempt 1 (t=0) cold → wait 300 (t=300); attempt 2 cold → wait 600
    // (t=900); attempt 3 warm → recovers. Backoff, not luck, is what lands it.
    expect(out).toBe("rows");
    expect(attempts).toBe(3);
    expect(now).toBe(900);
  });

  it("without backoff, instant retries replay the cold state and surface db_unreachable", async () => {
    // Same cold-start, no backoff (the plan/route default): the clock never
    // advances, so all three attempts land in the cold window and fail —
    // this is the pre-SK-ASK-023 behavior the exec stage suffered from.
    const warmAt = 700;
    const now = 0;
    let attempts = 0;
    await expect(
      withStageRetry(
        "exec",
        async () => {
          attempts++;
          if (now < warmAt) throw new Error("connect ECONNREFUSED");
          return "rows";
        },
        { reasonOf: () => "db_unreachable" },
      ),
    ).rejects.toThrow("ECONNREFUSED");
    expect(attempts).toBe(RETRY_MAX_ATTEMPTS);
  });

  it("does not sleep when no backoff is configured (plan/route stay instant)", async () => {
    let slept = 0;
    const sleep = async (ms: number) => {
      slept += ms;
    };
    let attempts = 0;
    await expect(
      withStageRetry(
        "plan",
        async () => {
          attempts++;
          throw new Error("boom");
        },
        { sleep },
      ),
    ).rejects.toThrow("boom");
    expect(attempts).toBe(RETRY_MAX_ATTEMPTS);
    expect(slept).toBe(0);
  });

  it("emits nlqdb.retry.total per failed attempt with stage + reason labels", async () => {
    await expect(
      withStageRetry(
        "plan",
        async () => {
          throw new Error("any");
        },
        { reasonOf: () => "llm_failed" },
      ),
    ).rejects.toBeDefined();

    await telemetry.collectMetrics();
    type Point = { value: unknown; attributes: Record<string, unknown> };
    const points: Point[] = telemetry.metricExporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics))
      .filter((m) => m.descriptor.name === "nlqdb.retry.total")
      .flatMap((m) => m.dataPoints as unknown as Point[]);
    expect(points.length).toBeGreaterThan(0);
    const total = points.reduce((acc, p) => acc + Number(p.value), 0);
    // Three attempts, three failures → three increments.
    expect(total).toBe(RETRY_MAX_ATTEMPTS);
    for (const p of points) {
      expect(p.attributes).toMatchObject({ stage: "plan", reason: "llm_failed" });
    }
  });
});
