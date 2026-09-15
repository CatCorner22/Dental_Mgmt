import { describe, expect, it } from "vitest";
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
  indexOfRecoveryCode,
  normalizeRecoveryCode,
} from "./recovery";

describe("recovery codes", () => {
  it("normalizes dashes and case", () => {
    expect(normalizeRecoveryCode("AbCd-EfGh")).toBe("abcdefgh");
  });

  it("matches one hash and no other", () => {
    const codes = generateRecoveryCodes(3);
    const hashes = hashRecoveryCodes(codes, "pepper");
    expect(indexOfRecoveryCode(codes[1]!, hashes, "pepper")).toBe(1);
    expect(indexOfRecoveryCode("zzzz-zzzz", hashes, "pepper")).toBe(-1);
    expect(indexOfRecoveryCode(codes[1]!, hashes, "other")).toBe(-1);
  });
});
