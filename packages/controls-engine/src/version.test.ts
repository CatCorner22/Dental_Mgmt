import { describe, expect, it } from "vitest";
import { CONTROL_RULEBOOK_VERSION, SCORING_VERSION } from "./index";

describe("version stamps", () => {
  it("exports non-empty CONTROL_RULEBOOK_VERSION and SCORING_VERSION", () => {
    expect(typeof CONTROL_RULEBOOK_VERSION).toBe("string");
    expect(CONTROL_RULEBOOK_VERSION.length).toBeGreaterThan(0);
    expect(typeof SCORING_VERSION).toBe("string");
    expect(SCORING_VERSION.length).toBeGreaterThan(0);
    expect(SCORING_VERSION).toBe("precog-residual-v1.1.0");
    expect(CONTROL_RULEBOOK_VERSION).toBe("0.2.1");
  });
});
