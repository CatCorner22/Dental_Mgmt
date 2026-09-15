import { describe, expect, it } from "vitest";
import {
  detectForeignJurisdiction,
  hasStrongClaim,
  isRegulatorySource,
  isTennesseeSource,
  resolveModes,
  resolveProfile,
  strictPromptAddendum
} from "./router";

const ROUTING_CASES: Array<{ id: string; text: string; expect: string[] }> = [
  {
    id: "route.plain-operative",
    text: "Tooth 14 MOD composite placed by the dentist. 2 carpules lidocaine 2% with epinephrine.",
    expect: ["documentation"]
  },
  {
    id: "route.sedation-nitrous",
    text: "Nitrous oxide at 30%; NPO confirmed; recovered on oxygen.",
    expect: ["documentation", "sedation"]
  },
  {
    id: "route.sedation-mgkg",
    text: "Dose held under the 4.4 mg/kg ceiling for the visit.",
    expect: ["documentation", "sedation"]
  },
  {
    id: "route.imaging-bitewings",
    text: "Four bitewing radiographs acquired; interpretation recorded by the dentist.",
    expect: ["documentation", "imaging"]
  },
  {
    id: "route.imaging-cbct",
    text: "CBCT reviewed for implant planning of site 30.",
    expect: ["documentation", "imaging"]
  },
  {
    id: "route.legal-supervision",
    text: "Hygiene visit completed under general supervision per licensure.",
    expect: ["documentation", "legal"]
  },
  {
    id: "route.legal-scope",
    text: "Scope of practice question raised about coronal polishing.",
    expect: ["documentation", "legal"]
  },
  {
    id: "route.sedation-plus-imaging",
    text: "Panoramic radiograph reviewed before moderate sedation planning; NPO instructions given.",
    expect: ["documentation", "sedation", "imaging"]
  }
];

describe("SuperByte mode router (deterministic)", () => {
  it("routes every frozen case exactly", () => {
    for (const c of ROUTING_CASES) {
      expect(resolveModes(c.text), c.id).toEqual(c.expect);
    }
  });

  it("a filling note stays documentation", () => {
    const modes = resolveModes(
      "Tooth 14 MOD composite placed by the dentist. 2 carpules lidocaine 2% with epinephrine."
    );
    expect(modes).toEqual(["documentation"]);
    expect(resolveProfile(modes).id).toBe("documentation");
  });

  it("routine local anesthetic does not trip sedation mode", () => {
    const modes = resolveModes("2 carpules lidocaine 2% with 1:100,000 epinephrine administered.");
    expect(modes).toEqual(["documentation"]);
  });

  it("sedation plus imaging escalates to legal", () => {
    const modes = resolveModes(
      "Panoramic radiograph reviewed before moderate sedation planning; NPO instructions given."
    );
    expect(modes).toEqual(["documentation", "sedation", "imaging"]);
    expect(resolveProfile(modes).id).toBe("legal");
  });

  it("documentation profile allows rewrites and majority consensus", () => {
    const p = resolveProfile(["documentation"]);
    expect(p.id).toBe("documentation");
    expect(p.forbidRewrites).toBe(false);
    expect(p.unanimous).toBe(false);
  });

  it("single high-risk mode gets unanimous reads and no rewrites", () => {
    const p = resolveProfile(["documentation", "sedation"]);
    expect(p.id).toBe("high-risk");
    expect(p.unanimous).toBe(true);
    expect(p.forbidRewrites).toBe(true);
    expect(p.minReads).toBe(3);
  });

  it("legal mode — and any two high-risk modes — escalate to the legal profile", () => {
    expect(resolveProfile(["documentation", "legal"]).id).toBe("legal");
    expect(resolveProfile(["documentation", "sedation", "imaging"]).id).toBe("legal");
    expect(resolveProfile(["documentation", "legal"]).regulatorySourcesOnly).toBe(true);
  });

  it("strict addendum exists for strict profiles only", () => {
    expect(strictPromptAddendum(resolveProfile(["documentation"]), ["documentation"])).toBe("");
    const strict = strictPromptAddendum(resolveProfile(["documentation", "sedation"]), [
      "documentation",
      "sedation"
    ]);
    expect(strict).toMatch(/STRICT READ/);
    expect(strict).toMatch(/sedation/);
  });

  it("detects a foreign jurisdiction only with a legal cue present", () => {
    expect(
      detectForeignJurisdiction("Patient moving; asked about Georgia licensure rules for records.")
    ).toBe("Georgia");
    expect(detectForeignJurisdiction("Georgia peach flavoring on the fluoride varnish.")).toBeNull();
    expect(detectForeignJurisdiction("Tennessee law requires a treatment record.")).toBeNull();
  });

  it("labels strong claims and recognizes regulatory sources", () => {
    expect(hasStrongClaim("This must be documented.", "")).toBe(true);
    expect(hasStrongClaim("Consider naming the actor.", "The sentence is passive.")).toBe(false);
    expect(isRegulatorySource("TN Board of Dentistry Rules 0460-02")).toBe(true);
    expect(isRegulatorySource("Practice writing standard — active voice")).toBe(false);
    expect(isTennesseeSource("TN Board of Dentistry")).toBe(true);
    expect(isTennesseeSource("ADA glossary")).toBe(false);
  });
});
