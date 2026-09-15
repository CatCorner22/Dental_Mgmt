import { describe, expect, it } from "vitest";
import { fieldIsInvalid, findingsByField } from "./byField";
import type { AuditFinding } from "./types";

const f = (over: Partial<AuditFinding>): AuditFinding => ({
  ruleId: "r",
  category: "required",
  severity: "S1",
  message: "m",
  ...over
});

describe("findingsByField", () => {
  it("groups findings that carry a field ref and ignores text-only ones", () => {
    const map = findingsByField([
      f({ fieldRef: { moduleId: "universal-core", fieldId: "diagnosis" } }),
      f({ fieldRef: { moduleId: "universal-core", fieldId: "diagnosis" }, severity: "S2" }),
      f({ fieldRef: { moduleId: "extraction", fieldId: "teeth" }, severity: "S0" }),
      f({ severity: "S0" }) // no fieldRef — a text-level finding
    ]);
    expect(map["universal-core.diagnosis"]).toHaveLength(2);
    expect(map["extraction.teeth"]).toHaveLength(1);
    expect(Object.keys(map)).toHaveLength(2);
  });

  it("treats a field as invalid only for S0/S1", () => {
    expect(fieldIsInvalid([f({ severity: "S0" })])).toBe(true);
    expect(fieldIsInvalid([f({ severity: "S1" })])).toBe(true);
    expect(fieldIsInvalid([f({ severity: "S2" })])).toBe(false);
    expect(fieldIsInvalid([f({ severity: "S3" })])).toBe(false);
    expect(fieldIsInvalid(undefined)).toBe(false);
  });
});
