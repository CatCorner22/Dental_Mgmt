import { describe, expect, it } from "vitest";
import { ANY_REASON, mappingKey, type GlMapping } from "./types";
import { resolveMapping } from "./mappings";

function mapping(over: Partial<GlMapping>): GlMapping {
  return {
    id: "m-1",
    glBucket: "patient_ar",
    kind: "write_off",
    reasonCode: ANY_REASON,
    accountCode: "6100",
    accountName: "Courtesy write-offs",
    side: "debit",
    note: "",
    status: "approved",
    proposedById: "u-om",
    proposedByName: "Maya Chen",
    proposedAt: "2026-09-01T10:00:00Z",
    decidedById: "u-owner",
    decidedByName: "Riley Owner",
    decidedAt: "2026-09-02T10:00:00Z",
    supersedesId: null,
    ...over,
  };
}

describe("resolveMapping (Increment 1.35)", () => {
  const anyReason = mapping({});
  const courtesy = mapping({ id: "m-2", reasonCode: "courtesy", accountCode: "6110", accountName: "Courtesy adjustments" });
  const active = new Map([
    [mappingKey("patient_ar", "write_off", ANY_REASON), anyReason],
    [mappingKey("patient_ar", "write_off", "courtesy"), courtesy],
  ]);

  it("prefers the mapping for the exact reason code", () => {
    expect(resolveMapping(active, "patient_ar", "write_off", "courtesy")?.accountCode).toBe("6110");
  });

  it("falls back to the mapping covering every reason code", () => {
    expect(resolveMapping(active, "patient_ar", "write_off", "contractual_ppo")?.accountCode).toBe("6100");
    expect(resolveMapping(active, "patient_ar", "write_off", null)?.accountCode).toBe("6100");
  });

  it("is null when the bucket and kind are unmapped", () => {
    expect(resolveMapping(active, "patient_ar", "charge", "courtesy")).toBeNull();
    expect(resolveMapping(new Map(), "patient_ar", "write_off", null)).toBeNull();
  });
});
