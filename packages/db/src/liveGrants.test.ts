import { describe, expect, it } from "vitest";
import { isLiveGrant } from "./liveGrants";

const NOW = new Date("2026-09-22T12:00:00.000Z");
const before = new Date(NOW.getTime() - 60_000);
const after = new Date(NOW.getTime() + 60_000);

describe("isLiveGrant", () => {
  it("holds a grant that has begun and has not ended", () => {
    expect(isLiveGrant({ effectiveFrom: before, effectiveTo: null }, NOW)).toBe(true);
  });

  it("holds a grant that begins at this instant", () => {
    expect(isLiveGrant({ effectiveFrom: NOW, effectiveTo: null }, NOW)).toBe(true);
  });

  it("drops a grant that has not begun", () => {
    expect(isLiveGrant({ effectiveFrom: after, effectiveTo: null }, NOW)).toBe(false);
  });

  /**
   * `revokeEntitlement` stamps `effective_to` with the instant of the revoke,
   * so the comparison must be strict: the duty is gone at the moment it ends,
   * not one tick later.
   */
  it("drops a grant revoked at this instant", () => {
    expect(isLiveGrant({ effectiveFrom: before, effectiveTo: NOW }, NOW)).toBe(false);
  });

  it("drops a grant revoked earlier", () => {
    expect(isLiveGrant({ effectiveFrom: before, effectiveTo: before }, NOW)).toBe(false);
  });

  it("holds a grant whose end is still ahead", () => {
    expect(isLiveGrant({ effectiveFrom: before, effectiveTo: after }, NOW)).toBe(true);
  });

  it("drops a grant that ends before it begins", () => {
    expect(isLiveGrant({ effectiveFrom: after, effectiveTo: before }, NOW)).toBe(false);
  });
});
