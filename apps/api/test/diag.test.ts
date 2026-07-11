// SK-ASK-023 — KV-backed exec diagnostics. Preview invocations emit no
// logs, so the exec catch-all's SQLSTATE is persisted to the shared KV
// namespace where a post-run pull (CF REST API / wrangler) still sees it.

import { describe, expect, it } from "vitest";
import { DIAG_KEY_PREFIX, DIAG_TTL_SECONDS, makeKvDiagSink } from "../src/ask/diag.ts";
import type { KVPutOptions } from "../src/kv-store.ts";

function stubKv() {
  const puts: Array<{ key: string; value: string; opts?: KVPutOptions }> = [];
  return {
    puts,
    store: {
      get: async () => null,
      put: async (key: string, value: string, opts?: KVPutOptions) => {
        puts.push({ key, value, opts });
      },
    },
  };
}

const ENTRY = {
  pgCode: "42501",
  pgMessage: "permission denied for schema x",
  dbId: "db_1",
  cacheHit: false,
  planModel: "stub-model",
};

describe("makeKvDiagSink", () => {
  it("writes a prefixed, TTL'd JSON row carrying the SQLSTATE + source", async () => {
    const kv = stubKv();
    await makeKvDiagSink(kv.store, "preview").record(ENTRY);
    expect(kv.puts).toHaveLength(1);
    const put = kv.puts[0];
    expect(put?.key.startsWith(DIAG_KEY_PREFIX)).toBe(true);
    expect(put?.opts).toEqual({ expirationTtl: DIAG_TTL_SECONDS });
    expect(JSON.parse(put?.value ?? "{}")).toMatchObject({ ...ENTRY, source: "preview" });
  });

  it("keys two same-instant rows distinctly", async () => {
    const kv = stubKv();
    const sink = makeKvDiagSink(kv.store, "production");
    await sink.record(ENTRY);
    await sink.record(ENTRY);
    expect(kv.puts).toHaveLength(2);
    expect(kv.puts[0]?.key).not.toBe(kv.puts[1]?.key);
  });
});
