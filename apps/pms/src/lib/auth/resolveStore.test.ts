import { describe, expect, it } from "vitest";
import { assertAuthStoreAllowed, authStoreKind } from "./resolveStore";

describe("auth store resolution", () => {
  it("uses memory only when AUTH_DEV_MEMORY=1", () => {
    expect(authStoreKind({ AUTH_DEV_MEMORY: "1" })).toBe("memory");
    expect(authStoreKind({ POSTGRES_URL: "postgres://db" })).toBe("postgres");
    expect(authStoreKind({})).toBe("none");
  });

  it("refuses the memory store in production", () => {
    expect(() =>
      assertAuthStoreAllowed({ NODE_ENV: "production", AUTH_DEV_MEMORY: "1" })
    ).toThrow(/AUTH_DEV_MEMORY/);
  });
});
