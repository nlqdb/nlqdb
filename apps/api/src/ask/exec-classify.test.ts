// SK-ASK-030 data-exception classifier — the class-22 table and its one carve-out.

import { describe, expect, it } from "vitest";
import { classifyDataException } from "./exec-classify.ts";

const pgError = (message: string, code?: string) => Object.assign(new Error(message), { code });

describe("classifyDataException", () => {
  it("returns the SQLSTATE of a class-22 data exception", () => {
    expect(
      classifyDataException(pgError('invalid input syntax for type integer: "x"', "22P02")),
    ).toBe("22P02");
  });

  it("falls back to the message when the driver dropped .code", () => {
    expect(classifyDataException(pgError("division by zero"))).toBe("22000");
  });

  it("ignores other SQLSTATE classes", () => {
    expect(classifyDataException(pgError("duplicate key value", "23505"))).toBeNull();
  });

  it("leaves a missing tenant role (22023 on SET LOCAL ROLE) transient — SK-ASK-024", () => {
    expect(
      classifyDataException(pgError('role "tenant_0123456789abcdef" does not exist', "22023")),
    ).toBeNull();
  });
});
