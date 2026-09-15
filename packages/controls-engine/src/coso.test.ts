import { describe, expect, it } from "vitest";
import { assessCoso } from "./coso";
import { ridgeviewPractice } from "./fixtures/ridgeview";

describe("assessCoso", () => {
  it("returns an overall score from 0 to 100 from PracticeState", () => {
    const result = assessCoso(ridgeviewPractice());
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.components).toHaveLength(5);
    for (const component of result.components) {
      expect(component.score).toBeGreaterThanOrEqual(0);
      expect(component.score).toBeLessThanOrEqual(100);
    }
  });
});
