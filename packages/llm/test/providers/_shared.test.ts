// parseJsonResponse contract: strict JSON first, ```-fence tolerance,
// and the SK-LLM-025 reasoning-preamble recovery fallback.

import { describe, expect, it } from "vitest";
import { parseJsonResponse } from "../../src/providers/_shared.ts";

describe("parseJsonResponse", () => {
  it("parses clean JSON", () => {
    expect(parseJsonResponse<{ sql: string }>('{"sql":"SELECT 1"}').sql).toBe("SELECT 1");
  });

  it("strips ```json fences", () => {
    expect(parseJsonResponse<{ sql: string }>('```json\n{"sql":"SELECT 2"}\n```').sql).toBe(
      "SELECT 2",
    );
  });

  describe("SK-LLM-025 — recovers the JSON object from reasoning-model preamble leaks", () => {
    it("strips a leading think-text preamble", () => {
      const raw = 'We need to count rows. The answer is:\n{"sql":"SELECT count(*) FROM t"}';
      expect(parseJsonResponse<{ sql: string }>(raw).sql).toBe("SELECT count(*) FROM t");
    });

    it("strips trailing prose after the object", () => {
      expect(parseJsonResponse<{ sql: string }>('{"sql":"SELECT 3"}\nHope this helps!').sql).toBe(
        "SELECT 3",
      );
    });

    it("keeps braces inside string literals balanced", () => {
      const raw = 'reasoning... {"sql":"SELECT \'{\' AS brace"} done';
      expect(parseJsonResponse<{ sql: string }>(raw).sql).toBe("SELECT '{' AS brace");
    });

    it("still throws a parse error when no JSON object is present", () => {
      expect(() => parseJsonResponse("I cannot answer that.")).toThrow(/not parseable JSON/);
    });
  });
});
