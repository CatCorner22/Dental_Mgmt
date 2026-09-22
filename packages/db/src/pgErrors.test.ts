import { describe, expect, it } from "vitest";
import { UNIQUE_VIOLATION, USERNAME_GLOBAL_UIDX, isUniqueViolation } from "./pgErrors";

describe("isUniqueViolation", () => {
  it("holds a unique violation on any index when none is named", () => {
    expect(isUniqueViolation({ code: UNIQUE_VIOLATION })).toBe(true);
  });

  it("holds a unique violation on the index it names", () => {
    expect(isUniqueViolation({ code: UNIQUE_VIOLATION, constraint: USERNAME_GLOBAL_UIDX }, USERNAME_GLOBAL_UIDX)).toBe(true);
  });

  /**
   * The case the named form exists for: a collision on a different index is a
   * different defect, and reporting it as this one would hide it behind this
   * one's refusal.
   */
  it("drops a unique violation on a different index", () => {
    expect(isUniqueViolation({ code: UNIQUE_VIOLATION, constraint: "some_other_uidx" }, USERNAME_GLOBAL_UIDX)).toBe(false);
  });

  it("drops a unique violation carrying no index when one is named", () => {
    expect(isUniqueViolation({ code: UNIQUE_VIOLATION }, USERNAME_GLOBAL_UIDX)).toBe(false);
  });

  it("drops every other SQLSTATE", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false); // foreign key
    expect(isUniqueViolation({ code: "23514" })).toBe(false); // check constraint
    expect(isUniqueViolation({ code: "25P02" })).toBe(false); // transaction aborted
  });

  /**
   * The shape the live case actually produced: drizzle's own error, with the
   * driver's underneath. The first version of this function read only the top
   * and the refusal never fired.
   */
  it("finds the violation the query wrapper is hiding", () => {
    const wrapped = Object.assign(new Error("Failed query: insert into \"users\" ..."), {
      cause: { code: UNIQUE_VIOLATION, constraint: USERNAME_GLOBAL_UIDX },
    });
    expect(isUniqueViolation(wrapped, USERNAME_GLOBAL_UIDX)).toBe(true);
    expect(isUniqueViolation(wrapped, "some_other_uidx")).toBe(false);
  });

  it("gives up rather than looping on a cause that points at itself", () => {
    const loop: { code: string; cause?: unknown } = { code: "23503" };
    loop.cause = loop;
    expect(isUniqueViolation(loop, USERNAME_GLOBAL_UIDX)).toBe(false);
  });

  it("drops what is not a Postgres error at all", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation(new Error("unique violation"))).toBe(false);
  });
});
