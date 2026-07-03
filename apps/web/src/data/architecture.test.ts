import { describe, expect, test } from "bun:test";
import {
  ARCH_EDGES,
  ARCH_FLOW_STEPS,
  ARCH_GROUP_EDGES,
  ARCH_GROUPS,
  ARCH_NODES,
  archNeighborLabels,
  archNodeById,
} from "./architecture.ts";

// The /architecture 3D map and its server-rendered prose fallback both
// render from this one module (SK-WEB-021). These checks pin the graph
// invariants the scene relies on — a dangling edge renders as a line
// into nothing, which is exactly the "what connects to what" confusion
// the page exists to prevent.

describe("architecture graph integrity", () => {
  test("node ids are unique", () => {
    const ids = ARCH_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every node belongs to a declared group", () => {
    const groups = new Set(ARCH_GROUPS.map((g) => g.id));
    for (const n of ARCH_NODES) {
      expect(groups.has(n.group)).toBe(true);
    }
  });

  test("every group has at least one node", () => {
    for (const g of ARCH_GROUPS) {
      expect(ARCH_NODES.some((n) => n.group === g.id)).toBe(true);
    }
  });

  test("every edge references existing nodes, and no self-loops", () => {
    for (const e of ARCH_EDGES) {
      expect(archNodeById(e.from)).toBeDefined();
      expect(archNodeById(e.to)).toBeDefined();
      expect(e.from).not.toBe(e.to);
    }
  });

  test("group edges reference declared groups", () => {
    const groups = new Set(ARCH_GROUPS.map((g) => g.id));
    for (const e of ARCH_GROUP_EDGES) {
      expect(groups.has(e.from)).toBe(true);
      expect(groups.has(e.to)).toBe(true);
    }
  });

  test("no orphan nodes — everything is on the request path", () => {
    const connected = new Set(ARCH_EDGES.flatMap((e) => [e.from, e.to]));
    for (const n of ARCH_NODES) {
      expect(connected.has(n.id)).toBe(true);
    }
  });

  test("every surface reaches every data engine through the flow graph", () => {
    const out = new Map<string, string[]>();
    for (const e of ARCH_EDGES) {
      out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
    }
    const surfaces = ARCH_NODES.filter((n) => n.group === "ask");
    const engines = ARCH_NODES.filter((n) => n.group === "data");
    for (const s of surfaces) {
      const seen = new Set<string>();
      const stack = [s.id];
      while (stack.length > 0) {
        const id = stack.pop();
        if (id === undefined || seen.has(id)) continue;
        seen.add(id);
        stack.push(...(out.get(id) ?? []));
      }
      for (const d of engines) {
        expect(seen.has(d.id)).toBe(true);
      }
    }
  });

  test("blurbs and labels are non-empty; blurbs stay card-sized", () => {
    for (const n of ARCH_NODES) {
      expect(n.label.length).toBeGreaterThan(0);
      expect(n.blurb.length).toBeGreaterThan(20);
      expect(n.blurb.length).toBeLessThanOrEqual(220);
    }
    for (const g of ARCH_GROUPS) {
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.sub.length).toBeGreaterThan(0);
      expect(g.blurb.length).toBeGreaterThan(20);
    }
  });

  test("flow steps tell a non-empty story", () => {
    expect(ARCH_FLOW_STEPS.length).toBeGreaterThanOrEqual(4);
    for (const s of ARCH_FLOW_STEPS) {
      expect(s.length).toBeGreaterThan(20);
    }
  });

  test("neighbor lookup is symmetric with the edge list", () => {
    expect(archNeighborLabels("cache").sort()).toEqual(
      ["Auth & quota", "Executor", "NL→plan compiler"].sort(),
    );
  });
});
