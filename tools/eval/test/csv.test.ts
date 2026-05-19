import { describe, expect, it } from "bun:test";

import { csvToGoldTable, parseCsv } from "../src/csv.ts";

describe("parseCsv", () => {
  it("parses a simple header + rows shape", () => {
    expect(parseCsv("a,b\n1,2\n3,4\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("ignores a trailing newline (pandas-emitted CSVs always have one)", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles fields without a trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a leading BOM (pandas occasionally writes one)", () => {
    expect(parseCsv("﻿a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("respects quoted fields containing commas", () => {
    expect(parseCsv('a,b\n"one,two",3\n')).toEqual([
      ["a", "b"],
      ["one,two", "3"],
    ]);
  });

  it("respects quoted fields containing newlines", () => {
    expect(parseCsv('a,b\n"line1\nline2",3\n')).toEqual([
      ["a", "b"],
      ["line1\nline2", "3"],
    ]);
  });

  it("handles RFC 4180 doubled-quote escapes inside quoted fields", () => {
    expect(parseCsv('a,b\n"he said ""hi""",3\n')).toEqual([
      ["a", "b"],
      ['he said "hi"', "3"],
    ]);
  });

  it("preserves empty fields (NaN cells in pandas)", () => {
    expect(parseCsv("a,b,c\n1,,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ]);
  });
});

describe("csvToGoldTable", () => {
  it("returns column-major data shape", () => {
    const t = csvToGoldTable("rfm,sales\nChampions,301.07\nLost,79.36\n");
    expect(t.columns).toEqual(["rfm", "sales"]);
    expect(t.cells).toHaveLength(2);
    expect(t.cells[0]).toEqual(["Champions", "Lost"]);
    expect(t.cells[1]).toEqual([301.07, 79.36]);
  });

  it("infers a numeric column when every non-empty cell parses as a finite number", () => {
    const t = csvToGoldTable("a,b\n1,x\n2,y\n");
    expect(t.cells[0]).toEqual([1, 2]);
    expect(t.cells[1]).toEqual(["x", "y"]);
  });

  it("falls back to a string column when any non-empty cell is non-numeric", () => {
    const t = csvToGoldTable("a\n1\n2\nabc\n");
    expect(t.cells[0]).toEqual(["1", "2", "abc"]);
  });

  it("emits null for empty cells (pandas NaN equivalent)", () => {
    const t = csvToGoldTable("a,b\n1,\n2,y\n");
    expect(t.cells[0]).toEqual([1, 2]);
    expect(t.cells[1]).toEqual([null, "y"]);
  });

  it("returns empty cells/columns for a header-only file", () => {
    const t = csvToGoldTable("a,b\n");
    expect(t.columns).toEqual(["a", "b"]);
    expect(t.cells[0]).toEqual([]);
    expect(t.cells[1]).toEqual([]);
  });

  it("returns the empty shape on empty input rather than throwing", () => {
    const t = csvToGoldTable("");
    expect(t.columns).toEqual([]);
    expect(t.cells).toEqual([]);
  });

  it("treats a single trailing newline as a pandas-style row terminator, not a data row", () => {
    // `a\nb\n` is a 1-column header + one data row in pandas; our parser matches that contract.
    const t = csvToGoldTable("a\nb\n");
    expect(t.cells[0]).toEqual(["b"]);
  });

  it("preserves an empty data row between content rows (not a trailing-newline artifact)", () => {
    const t = csvToGoldTable("a\nrow1\n\nrow2\n");
    expect(t.cells[0]).toEqual(["row1", null, "row2"]);
  });
});
