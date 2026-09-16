import { describe, expect, it } from "vitest";
import { advise } from "./advisor";

describe("Byte author-scope coaching", () => {
  it("does not push clinical-rationale tips at hygienists", () => {
    const text = "SRP UR quadrant completed. Probing depths recorded.";
    const hygienist = advise(text, { clinicalRole: "hygienist" });
    const dentist = advise(text, { clinicalRole: "dentist" });
    expect(hygienist.advice.some((a) => a.id === "byte.clinical-rationale")).toBe(false);
    expect(dentist.advice.some((a) => a.id === "byte.clinical-rationale")).toBe(true);
  });

  it("offers hygiene handoff coaching to hygienists", () => {
    const text =
      "Prophylaxis completed. Probing 4 mm at tooth 3. Bleeding on probing noted. Fluoride varnish applied.";
    const report = advise(text, { clinicalRole: "hygienist" });
    expect(
      report.advice.some(
        (a) => a.id === "byte.hygiene-dentist-handoff" || a.id === "byte.hygiene-findings-loop"
      )
    ).toBe(true);
  });
});
