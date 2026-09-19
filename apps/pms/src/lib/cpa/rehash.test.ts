import { describe, expect, it } from "vitest";
import { compareClose } from "./rehash";

const CLOSE_HASH = "a".repeat(64);
const NOW_HASH = "b".repeat(64);

describe("compareClose", () => {
  it("answers from the frozen hash while the shape has not moved", () => {
    expect(
      compareClose({ closedUnder: "package-v6", closeHash: CLOSE_HASH, currentSchema: "package-v6", currentHash: CLOSE_HASH, baseline: null })
    ).toEqual({ state: "same_shape", movedSinceClose: false });
    expect(
      compareClose({ closedUnder: "package-v6", closeHash: CLOSE_HASH, currentSchema: "package-v6", currentHash: NOW_HASH, baseline: null })
    ).toEqual({ state: "same_shape", movedSinceClose: true });
  });

  it("claims nothing about movement when the shape has moved and no baseline exists", () => {
    // This is the honest state Increment 1.43 established and the cost it
    // carries: the hashes cannot support a "moved" claim either way.
    const c = compareClose({ closedUnder: "package-v3", closeHash: CLOSE_HASH, currentSchema: "package-v6", currentHash: NOW_HASH, baseline: null });
    expect(c.state).toBe("older_shape_no_baseline");
    if (c.state !== "older_shape_no_baseline") return;
    expect(c.closedUnder).toBe("package-v3");
    expect(c.sentence).toContain("do not compare and nothing here can say whether a figure moved");
    expect(c.sentence).toContain("from the day it is taken rather than from the close");
  });

  it("answers again once a baseline under the current shape exists, and says what the claim runs from", () => {
    const baseline = { packageSchema: "package-v6", packageHash: NOW_HASH, computedAt: "2026-09-19T08:00:00.000Z" };
    const held = compareClose({ closedUnder: "package-v3", closeHash: CLOSE_HASH, currentSchema: "package-v6", currentHash: NOW_HASH, baseline });
    expect(held).toMatchObject({ state: "older_shape_with_baseline", movedSinceBaseline: false, takenAt: baseline.computedAt });
    if (held.state !== "older_shape_with_baseline") return;
    expect(held.sentence).toContain("Nothing this month states has moved since the baseline taken on 2026-09-19");
    // The claim is explicitly dated from the baseline, never from the close.
    expect(held.sentence).toContain("runs from the baseline, not from the close");

    const moved = compareClose({ closedUnder: "package-v3", closeHash: CLOSE_HASH, currentSchema: "package-v6", currentHash: "c".repeat(64), baseline });
    expect(moved).toMatchObject({ state: "older_shape_with_baseline", movedSinceBaseline: true });
    if (moved.state !== "older_shape_with_baseline") return;
    expect(moved.sentence).toContain("has moved since the baseline taken on 2026-09-19");
    // And it still does not pretend the close's own hash says anything.
    expect(moved.sentence).toContain("says only what the accountant received");
  });

  it("ignores a baseline taken under a shape that is no longer current", () => {
    // A v5 baseline cannot answer a v6 question any more than the close can.
    const stale = { packageSchema: "package-v5", packageHash: NOW_HASH, computedAt: "2026-09-01T08:00:00.000Z" };
    expect(
      compareClose({ closedUnder: "package-v3", closeHash: CLOSE_HASH, currentSchema: "package-v6", currentHash: NOW_HASH, baseline: stale }).state
    ).toBe("older_shape_no_baseline");
  });

  it("says nothing at all about a month that was never closed", () => {
    expect(compareClose({ closedUnder: null, closeHash: null, currentSchema: "package-v6", currentHash: NOW_HASH, baseline: null })).toEqual({
      state: "not_closed",
    });
  });
});
