// Tests for the engine classifier. These cases lock the SK-DB-010
// contract (classifier-default with confidence floor; explicit override
// is exercised in `orchestrate.test.ts` via the no-mock-call assertion)
// and the SK-MULTIENG-002 fit-table behaviour (Postgres for tracker /
// app data; ClickHouse for events / analytics / dashboard).
//
// We test the classifier wrapper, not the LLM itself — the wrapper is
// the layer that enforces the floor and the fallback. The 6+ goal
// fixtures per engine assert that the wrapper hands the LLM's pick
// through unchanged when confidence ≥ floor.

import type { LLMRouter } from "@nlqdb/llm";
import { describe, expect, it, vi } from "vitest";
import {
  classifyEngine,
  DEFAULT_ENGINE,
  ENGINE_CLASSIFY_CONFIDENCE_FLOOR,
} from "../src/db-create/engine-classify.ts";

function stubRouter(impl: () => Promise<{ engine: string; confidence: number }>): LLMRouter {
  return {
    classify: vi.fn(),
    plan: vi.fn(),
    summarize: vi.fn(),
    schemaInfer: vi.fn(),
    disambiguate: vi.fn(),
    engineClassify: vi.fn(impl),
  } as unknown as LLMRouter;
}

const POSTGRES_GOALS = [
  "an orders tracker for my coffee shop",
  "a meal planner with recipes and ingredients",
  "task management app with users, projects, and assignees",
  "customer CRM with contacts, deals, and notes",
  "blog with posts, comments, and tags",
  "inventory tracker for a small warehouse",
];

const CLICKHOUSE_GOALS = [
  "events tracker for a real-time analytics dashboard",
  "analytics for billions of pageviews per day",
  "ad-impression event log with high-cardinality dimensions",
  "time-series metrics from IoT sensors at 1Hz",
  "click-stream warehouse for session funnels",
  "real-time dashboard over append-only telemetry events",
];

describe("classifyEngine", () => {
  describe("Postgres-fit goals (SK-MULTIENG-002 default)", () => {
    for (const goal of POSTGRES_GOALS) {
      it(`returns postgres when LLM picks postgres ≥ floor: "${goal}"`, async () => {
        const llm = stubRouter(async () => ({ engine: "postgres", confidence: 0.92 }));
        const out = await classifyEngine({ llm }, goal);
        expect(out.engine).toBe("postgres");
        expect(out.confidence).toBe(0.92);
        expect(out.fallbackReason).toBeNull();
      });
    }
  });

  describe("ClickHouse-fit goals (SK-MULTIENG-002 analytics row)", () => {
    for (const goal of CLICKHOUSE_GOALS) {
      it(`returns clickhouse when LLM picks clickhouse ≥ floor: "${goal}"`, async () => {
        const llm = stubRouter(async () => ({ engine: "clickhouse", confidence: 0.88 }));
        const out = await classifyEngine({ llm }, goal);
        expect(out.engine).toBe("clickhouse");
        expect(out.confidence).toBe(0.88);
        expect(out.fallbackReason).toBeNull();
      });
    }
  });

  describe("confidence floor (SK-DB-010 default-fallback)", () => {
    it(`falls back to postgres when LLM confidence < floor (${ENGINE_CLASSIFY_CONFIDENCE_FLOOR})`, async () => {
      const llm = stubRouter(async () => ({ engine: "clickhouse", confidence: 0.4 }));
      const out = await classifyEngine({ llm }, "ambiguous goal");
      expect(out.engine).toBe(DEFAULT_ENGINE);
      // The wrapper passes through the LLM's confidence so dashboards
      // can see the low-signal pattern even after the fallback.
      expect(out.confidence).toBe(0.4);
      expect(out.fallbackReason).toBe("below_floor");
    });

    it("returns the LLM pick when confidence is exactly at the floor (boundary)", async () => {
      const llm = stubRouter(async () => ({
        engine: "clickhouse",
        confidence: ENGINE_CLASSIFY_CONFIDENCE_FLOOR,
      }));
      const out = await classifyEngine({ llm }, "events analytics");
      expect(out.engine).toBe("clickhouse");
      expect(out.fallbackReason).toBeNull();
    });
  });

  describe("graceful failure (GLOBAL-014 — router emits the span)", () => {
    it("falls back to postgres with confidence 0 when the router throws", async () => {
      const llm = stubRouter(async () => {
        throw new Error("provider down");
      });
      const out = await classifyEngine({ llm }, "tracker goal");
      expect(out.engine).toBe(DEFAULT_ENGINE);
      expect(out.confidence).toBe(0);
      expect(out.fallbackReason).toBe("provider_failed");
    });

    it("falls back to postgres when LLM returns a deferred engine (sqlite)", async () => {
      const llm = stubRouter(async () => ({ engine: "sqlite", confidence: 0.95 }));
      const out = await classifyEngine({ llm }, "read-heavy content catalog");
      expect(out.engine).toBe(DEFAULT_ENGINE);
      expect(out.fallbackReason).toBe("deferred");
    });

    it("falls back to postgres when LLM returns a deferred engine (redis)", async () => {
      const llm = stubRouter(async () => ({ engine: "redis", confidence: 0.95 }));
      const out = await classifyEngine({ llm }, "leaderboard counters");
      expect(out.engine).toBe(DEFAULT_ENGINE);
      expect(out.fallbackReason).toBe("deferred");
    });

    it("falls back to postgres when LLM returns an unknown engine string", async () => {
      const llm = stubRouter(async () => ({ engine: "mongodb", confidence: 0.95 }));
      const out = await classifyEngine({ llm }, "tracker goal");
      expect(out.engine).toBe(DEFAULT_ENGINE);
      // Pass-through confidence so the dashboard can spot LLM drift.
      expect(out.confidence).toBe(0.95);
      expect(out.fallbackReason).toBe("unknown_string");
    });

    it("falls back to postgres when LLM returns an empty engine string", async () => {
      const llm = stubRouter(async () => ({ engine: "", confidence: 0.7 }));
      const out = await classifyEngine({ llm }, "tracker goal");
      expect(out.engine).toBe(DEFAULT_ENGINE);
      expect(out.fallbackReason).toBe("unknown_string");
    });
  });
});
