import { describe, expect, it } from "vitest";
import { FREE_ATTEMPTS, lockMsFor, loginPairKey } from "./throttle";

describe("throttle", () => {
  it("does not lock inside the free budget", () => {
    expect(lockMsFor(FREE_ATTEMPTS)).toBe(0);
  });

  it("keys login on the address and username pair", () => {
    expect(loginPairKey("1.1.1.1", "Admin")).toBe(loginPairKey("1.1.1.1", "admin"));
    expect(loginPairKey("1.1.1.1", "admin")).not.toBe(loginPairKey("1.1.1.1", "other"));
  });
});
