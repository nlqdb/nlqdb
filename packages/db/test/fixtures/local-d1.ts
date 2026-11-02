// A local D1 behind the REST client (`GLOBAL-043` roadmap 1a, the D1 slice):
// miniflare runs workerd's own D1, so its authorizer and pragma rules are D1's,
// and `fetch` is answered in the REST `query` endpoint's shape. Shared by the
// observer's tests here and the attach door's in `apps/api`.

import { Miniflare } from "miniflare";
import { type D1BatchFn, type D1Target, d1RestBatch } from "../../src/index.ts";

export const D1_TARGET: D1Target = {
  accountId: "0123456789abcdef0123456789abcdef",
  databaseId: "01234567-89ab-cdef-0123-456789abcdef",
  token: "t",
};

export type LocalD1 = {
  // A fresh database per call, seeded with `schema`; `requests` counts REST calls.
  open: (schema: string) => Promise<{ batch: D1BatchFn; fetchFn: typeof fetch }>;
  requests: () => number;
  dispose: () => Promise<void>;
};

export function localD1(): LocalD1 {
  const mf = new Miniflare({ modules: true, script: "export default {}", d1Databases: [] });
  let fresh = 0;
  let requests = 0;
  return {
    requests: () => requests,
    dispose: () => mf.dispose(),
    async open(schema) {
      const name = `DB${fresh++}`;
      await mf.setOptions({
        modules: true,
        script: "export default { fetch() { return new Response('') } }",
        d1Databases: Array.from({ length: fresh }, (_, i) => `DB${i}`),
      });
      const db = await mf.getD1Database(name);
      if (schema) await db.exec(schema.replace(/\n\s*/g, " ").replace(/;\s*/g, ";\n"));
      const fetchFn = (async (_url: string, init: RequestInit) => {
        requests++;
        const { batch } = JSON.parse(String(init.body)) as { batch: { sql: string }[] };
        try {
          const rs = await db.batch(batch.map((s) => db.prepare(s.sql)));
          return Response.json({
            success: true,
            errors: [],
            result: rs.map((r) => ({ results: r.results, success: true, meta: r.meta })),
          });
        } catch (err) {
          return Response.json(
            { success: false, errors: [{ code: 7500, message: (err as Error).message }] },
            { status: 400 },
          );
        }
      }) as typeof fetch;
      return { batch: d1RestBatch(D1_TARGET, fetchFn), fetchFn };
    },
  };
}
