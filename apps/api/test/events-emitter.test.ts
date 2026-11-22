import { describe, expect, it, vi } from "vitest";
import { buildEventEmitter } from "../src/events-emitter.ts";

describe("buildEventEmitter", () => {
  const event = { name: "user.first_query", userId: "u_1", dbId: "db_1" } as const;

  it("enqueues on prod", async () => {
    const send = vi.fn(async () => undefined);
    const queue = { send } as unknown as Queue;
    await buildEventEmitter({ EVENTS_QUEUE: queue, NODE_ENV: "production" }).emit(event);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("emits nothing from a preview version, which shares prod's queue (SK-EVENTS-006)", async () => {
    const send = vi.fn(async () => undefined);
    const queue = { send } as unknown as Queue;
    await buildEventEmitter({ EVENTS_QUEUE: queue, NODE_ENV: "preview" }).emit(event);
    expect(send).not.toHaveBeenCalled();
  });
});
