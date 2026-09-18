import { describe, expect, it } from "vitest";
import { isLoosening } from "./reasonThreshold";

describe("whether a threshold change lets more through", () => {
  it("reads clearing the figure as the loosest move of all", () => {
    // Null hands the row back to the channel's own figure, which is never stricter.
    expect(isLoosening(5_000, null)).toBe(true);
    expect(isLoosening(0, null)).toBe(true);
    // Unless there was no rule to begin with, in which case nothing moved.
    expect(isLoosening(null, null)).toBe(false);
  });

  it("reads setting a first figure as a tightening, whatever the figure", () => {
    // Before, the channel governed; after, the lesser of the two does.
    expect(isLoosening(null, 90_000)).toBe(false);
    expect(isLoosening(null, 0)).toBe(false);
  });

  it("compares two figures the way the reader would", () => {
    expect(isLoosening(5_000, 9_000)).toBe(true);
    expect(isLoosening(5_000, 2_500)).toBe(false);
    // Zero is the strictest state: every posting waits.
    expect(isLoosening(0, 1)).toBe(true);
    expect(isLoosening(1, 0)).toBe(false);
  });
});
