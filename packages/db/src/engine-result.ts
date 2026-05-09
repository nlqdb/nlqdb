// Buffered-iterable factory shared across adapters that materialise
// the engine response in memory before yielding rows. The contract is
// `EngineResult = AsyncIterable<Row> & { meta: EngineMeta }`
// (`SK-MULTIENG-001`); adapters that genuinely stream (Tinybird's
// `format=ndjson`, future PG cursors) return their own `EngineResult`
// instead of using this helper.
//
// A fresh iterator is produced per `[Symbol.asyncIterator]()` call so
// consumers can re-iterate the same buffered result safely — the PG
// adapter test "yields a fresh iterator per call so the buffered result
// is re-iterable" pins this behaviour.

import type { EngineMeta, EngineResult, Row } from "./types.ts";

export function bufferedEngineResult(rows: Row[], meta: EngineMeta): EngineResult {
  return {
    meta,
    [Symbol.asyncIterator]: async function* () {
      for (const row of rows) yield row;
    },
  };
}
