import { describe, expect, it } from "vitest";

import {
  type Exemplar,
  maskedTokens,
  maskQuestion,
  questionSimilarity,
  selectExemplars,
} from "../src/few-shot-select.ts";

describe("maskQuestion", () => {
  it("masks quoted string literals to a single placeholder", () => {
    expect(maskQuestion("How many albums does the artist named 'Queen' have?")).toBe(
      "How many albums does the artist named  val  have?",
    );
    // Two questions differing only by the value collapse to the same skeleton.
    expect(maskQuestion("artist named 'Queen'")).toBe(maskQuestion("artist named 'Metallica'"));
  });

  it("masks double-quoted literals and bare numbers", () => {
    expect(maskQuestion('students older than 18 in "Math"')).toBe(
      "students older than  val  in  val ",
    );
    expect(maskQuestion("orders over 99.50 dollars")).toBe("orders over  val  dollars");
  });
});

describe("maskedTokens", () => {
  it("keeps the mask token `val` as a shared value slot", () => {
    expect(maskedTokens("named 'Queen'")).toEqual(new Set(["named", "val"]));
  });
});

describe("questionSimilarity", () => {
  it("is 1 for questions identical after masking", () => {
    expect(
      questionSimilarity(
        "albums by the artist named 'Queen'",
        "albums by the artist named 'AC/DC'",
      ),
    ).toBe(1);
  });

  it("is symmetric and bounded in [0,1]", () => {
    const s = questionSimilarity("how many drivers", "count the races");
    expect(s).toBe(questionSimilarity("count the races", "how many drivers"));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it("is 0 when either side has no comparable tokens", () => {
    expect(questionSimilarity("", "how many albums")).toBe(0);
    expect(questionSimilarity("a of is", "how many albums")).toBe(0);
  });
});

describe("selectExemplars", () => {
  const ex = <T>(question: string, payload: T): Exemplar<T> => ({ question, payload });

  it("masking ranks the structural twin above a value-overlap distractor", () => {
    // The DAIL property: the goal asks 'count entities named <val>'. The
    // structurally identical exemplar is over a different domain (no shared
    // domain words); the distractor reuses the literal 'Queen' but asks a
    // different question shape. Raw lexical overlap would pick the distractor;
    // masked similarity must pick the twin.
    const goal = "How many albums does the artist named 'Queen' have?";
    const pool = [
      ex("List every track on the 'Queen' greatest-hits compilation", "distractor"),
      ex("How many employees does the company named 'Acme' have?", "twin"),
    ];
    expect(selectExemplars(goal, pool, 1).map((e) => e.payload)).toEqual(["twin"]);
  });

  it("returns up to k, most-similar first", () => {
    const goal = "average points scored by each driver";
    const pool = [
      ex("total points scored by each player", "near"),
      ex("average salary by each department", "mid"),
      ex("list every country", "far"),
    ];
    const picked = selectExemplars(goal, pool, 2).map((e) => e.payload);
    expect(picked).toHaveLength(2);
    expect(picked[0]).toBe("near"); // shares points/scored/each/by
    expect(picked).not.toContain("far"); // shares nothing → dropped
  });

  it("drops zero-similarity candidates rather than padding the prompt", () => {
    const pool = [ex("how many albums", "match"), ex("unrelated weather forecast", "noise")];
    expect(selectExemplars("how many albums are there", pool, 3).map((e) => e.payload)).toEqual([
      "match",
    ]);
  });

  it("breaks ties on pool order (earliest wins) for run-to-run reproducibility", () => {
    const pool = [
      ex("how many drivers", "first"),
      ex("how many drivers", "second"), // identical question → identical score
    ];
    expect(selectExemplars("how many drivers race", pool, 1).map((e) => e.payload)).toEqual([
      "first",
    ]);
  });

  it("returns empty for k<=0, an empty pool, or a token-less goal", () => {
    const pool = [ex("how many albums", "x")];
    expect(selectExemplars("how many albums", pool, 0)).toEqual([]);
    expect(selectExemplars("how many albums", [], 3)).toEqual([]);
    expect(selectExemplars("a of is", pool, 3)).toEqual([]);
  });
});
