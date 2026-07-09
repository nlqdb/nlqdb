import { describe, expect, test } from "bun:test";
import { makeTtfvOnce, TTFV_EVENT } from "./ttfv.ts";

// The TTFV recorder must fire exactly once per landing (a stranger has
// one SK-ANON-012 create call, so a second fire could only come from a
// re-render / resubmit and would inflate the funnel). The two invariants
// below pin that: the first answer yields a payload, every later one is
// null; and the recorded ms is the (rounded) clock reading at first fire.

describe("makeTtfvOnce", () => {
  test("fires once, then null", () => {
    const record = makeTtfvOnce(() => 1234.6);
    const first = record("create");
    expect(first).toEqual({ event: TTFV_EVENT, props: { ttfv_ms: 1235, surface: "create" } });
    expect(record("create")).toBeNull();
    expect(record("chat")).toBeNull();
  });

  test("captures the clock at the first (not a later) answer", () => {
    let t = 500;
    const record = makeTtfvOnce(() => t);
    const first = record("create");
    t = 9999; // a later tick must not change the recorded ms
    expect(first?.props.ttfv_ms).toBe(500);
    expect(record("create")).toBeNull();
  });

  test("recorders are independent (one landing does not silence another)", () => {
    const a = makeTtfvOnce(() => 10);
    const b = makeTtfvOnce(() => 20);
    expect(a("create")?.props.ttfv_ms).toBe(10);
    expect(b("create")?.props.ttfv_ms).toBe(20);
  });
});
