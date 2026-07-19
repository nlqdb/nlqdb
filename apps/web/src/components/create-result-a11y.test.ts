import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The marketing create-result surface (CreateForm's CreateResultView +
// SampleTable) and its in-chat twin (ChatPanel's created reply + Data.tsx)
// render the same "did it work?" success beat and share the sample-row
// rendering (SK-HDC-001; GLOBAL-020 "returns rows"). They MUST keep the same
// accessibility contract, or a screen-reader stranger silently loses the
// pivotal funnel beat: the chat twin announces the success line with
// role="status" and marks header cells with scope="col"; the marketing
// surface had dropped both. This surface has no React render-test harness
// (react isn't a resolvable test dep — every component test here is a source
// scan), so guard the parity the same way the *-integrity suites do: read the
// source and assert the attribute lives on the right element on both twins.
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("create-result surface keeps a11y parity with its chat twin", () => {
  test('the create-success summary announces with role="status" (twin: ChatPanel created-line)', () => {
    expect(read("./CreateForm.tsx")).toContain('className="createresult__schema" role="status"');
    expect(read("./chat/ChatPanel.tsx")).toContain(
      'className="chat-reply__created-line" role="status"',
    );
  });

  test('sample-table header cells carry scope="col" (twin: Data.tsx query-result table)', () => {
    expect(read("./SampleTable.tsx")).toMatch(/<th key=\{c\} scope="col">/);
    expect(read("./chat/Data.tsx")).toMatch(/<th key=\{c\} scope="col">/);
  });
});
