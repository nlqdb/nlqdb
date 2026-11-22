import { describe, expect, it } from "vitest";
import { isWebEvent, makeQueueEmitter, parseWebEvent } from "../src/index.ts";
import { makeFakeQueue } from "../src/test.ts";

describe("parseWebEvent — SK-EVENTS-015", () => {
  it("keeps the event's schema props and stamps the principal", () => {
    expect(
      parseWebEvent(
        { event: "solve.try_query_clicked", props: { slug: "top-users", goal: "top 5 users" } },
        "pv:abc",
      ),
    ).toEqual({
      name: "solve.try_query_clicked",
      principalId: "pv:abc",
      slug: "top-users",
      goal: "top 5 users",
    });
  });

  it("rejects a name outside WEB_EVENTS, including inherited keys", () => {
    for (const event of ["user.registered", "toString", "__proto__", 42, undefined]) {
      expect(parseWebEvent({ event }, "pv:x")).toBeNull();
    }
    expect(parseWebEvent(null, "pv:x")).toBeNull();
  });

  it("drops off-schema and wrong-type props, clamps strings, refuses NaN", () => {
    const parsed = parseWebEvent(
      {
        event: "home.snippet_copied",
        props: {
          surface: "x".repeat(500),
          goal_length: Number.NaN,
          principalId: "u_spoof",
          extra: 1,
        },
      },
      "pv:x",
    );
    expect(parsed).toEqual({
      name: "home.snippet_copied",
      principalId: "pv:x",
      surface: "x".repeat(120),
    });
  });

  it("accepts a propless event", () => {
    expect(parseWebEvent({ event: "handoff.rejected" }, "pv:x")).toEqual({
      name: "handoff.rejected",
      principalId: "pv:x",
    });
  });

  it("gives each click its own envelope id", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);
    const event = parseWebEvent({ event: "anon.adopt_failed" }, "pv:x");
    if (!event) throw new Error("expected a parsed event");
    expect(isWebEvent(event)).toBe(true);
    await emitter.emit(event);
    await emitter.emit(event);
    const [a, b] = queue.sent.map((e) => e.id);
    expect(a).toMatch(/^evt\./);
    expect(a).not.toBe(b);
  });
});
