import { describe, expect, it } from "vitest";
import { currentCodeForTest, generateMfaSecret, verifyMfaCode } from "./totp";

describe("TOTP", () => {
  it("accepts the current code and rejects a wrong one", () => {
    const secret = generateMfaSecret();
    const now = Date.UTC(2026, 8, 14, 12, 0, 0);
    const code = currentCodeForTest("owner", secret, now);
    expect(verifyMfaCode("owner", secret, code, now)).toBe(true);
    expect(verifyMfaCode("owner", secret, "000000", now)).toBe(false);
  });
});
