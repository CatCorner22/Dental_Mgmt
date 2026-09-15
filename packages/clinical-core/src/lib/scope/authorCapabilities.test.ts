import { describe, expect, it } from "vitest";
import {
  authorCapabilities,
  canAuthorSelectModule,
  moduleVisibleInRail
} from "./authorCapabilities";
import { featuredPicksForRole, pickAvailableToRole, QUICK_PICKS } from "@/lib/presets/quickPicks";

describe("authorCapabilities", () => {
  it("maps each clinical role to a license lens and featured picks", () => {
    expect(authorCapabilities("hygienist").licenseLevel).toBe("dental-hygienist");
    expect(authorCapabilities("assistant").licenseLevel).toBe("registered-dental-assistant");
    expect(authorCapabilities("dentist").licenseLevel).toBe("dentist");
    expect(authorCapabilities("unset").mayRecordJudgement).toBe(true);
    expect(authorCapabilities("hygienist").mayRecordJudgement).toBe(false);
    expect(authorCapabilities("hygienist").bytestarLens).toMatch(/hygienist/i);
  });

  it("hides dentist-filed modules from auxiliaries in the rail", () => {
    expect(moduleVisibleInRail("hygienist", "sedation-anesthesia")).toBe(false);
    expect(moduleVisibleInRail("assistant", "robotic-surgery")).toBe(false);
    expect(moduleVisibleInRail("dentist", "sedation-anesthesia")).toBe(true);
    expect(moduleVisibleInRail("hygienist", "preventive")).toBe(true);
  });

  it("blocks hygienists from starting judgement-heavy modules", () => {
    expect(canAuthorSelectModule("hygienist", "implant")).toBe(false);
    expect(canAuthorSelectModule("hygienist", "preventive")).toBe(true);
    expect(canAuthorSelectModule("assistant", "direct-restorative")).toBe(true);
    expect(canAuthorSelectModule("assistant", "sedation-anesthesia")).toBe(false);
  });
});

describe("scope-aware quick picks", () => {
  it("offers hygiene scaffolds to hygienists and hides IV sedation", () => {
    const ids = featuredPicksForRole("hygienist").map((p) => p.id);
    expect(ids).toContain("hygiene-prophy");
    expect(ids).not.toContain("surgical-extraction-iv");
    const iv = QUICK_PICKS.find((p) => p.id === "surgical-extraction-iv")!;
    expect(pickAvailableToRole(iv, "hygienist")).toBe(false);
    expect(pickAvailableToRole(iv, "dentist")).toBe(true);
  });

  it("offers chairside scaffold to assistants", () => {
    const ids = featuredPicksForRole("assistant").map((p) => p.id);
    expect(ids).toContain("assistant-chairside");
  });

  it("offers dentist exam to dentists", () => {
    const ids = featuredPicksForRole("dentist").map((p) => p.id);
    expect(ids).toContain("dentist-exam");
  });
});
