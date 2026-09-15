import { describe, expect, it } from "vitest";
import { DISCLOSURE_CHANNELS, DISCLOSURE_PURPOSES, isDisclosureChannel, isDisclosurePurpose } from "./disclosures";

describe("disclosure enums", () => {
  it("names the Phase 0 channels and purposes", () => {
    expect(DISCLOSURE_CHANNELS).toContain("print");
    expect(DISCLOSURE_CHANNELS).toContain("portal");
    expect(DISCLOSURE_PURPOSES).toContain("treatment");
    expect(DISCLOSURE_PURPOSES).toContain("patient_request");
  });

  it("rejects unknown values", () => {
    expect(isDisclosureChannel("fax")).toBe(true);
    expect(isDisclosureChannel("carrier")).toBe(false);
    expect(isDisclosurePurpose("export")).toBe(true);
    expect(isDisclosurePurpose("marketing")).toBe(false);
  });
});
