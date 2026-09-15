import { describe, expect, it } from "vitest";
import { verifyMeaning } from "./verifyMeaning";

// The verifier is the load-bearing wall of the whole AI layer, so it gets the
// adversarial treatment: every test models a model misbehaving.

const rewrite = { mode: "rewrite" as const };
const questions = { mode: "questions" as const };

describe("digits", () => {
  it("rejects a changed dose", () => {
    const r = verifyMeaning("Amoxicillin 500 mg tid for 7 days.", "Amoxicillin 5000 mg three times daily for 7 days.", rewrite);
    expect(r.ok).toBe(false);
    expect(r.rejections.some((x) => x.code === "digits-changed")).toBe(true);
  });

  it("rejects a dropped number", () => {
    const r = verifyMeaning("Probing depths 3, 4, and 5 mm.", "Probing depths 3 and 4 mm.", rewrite);
    expect(r.ok).toBe(false);
  });

  it("accepts reordering", () => {
    const r = verifyMeaning(
      "Tooth 19 restored. 2 carpules used.",
      "2 carpules used. Tooth 19 restored.",
      rewrite
    );
    expect(r.ok).toBe(true);
  });
});

describe("negations", () => {
  it("rejects a dropped negation", () => {
    const r = verifyMeaning("No bleeding observed after extraction of tooth 30.", "Bleeding observed after extraction of tooth 30.", rewrite);
    expect(r.rejections.some((x) => x.code === "negation-changed")).toBe(true);
  });

  it("rejects an invented negation", () => {
    const r = verifyMeaning("Patient consented to the procedure today in writing.", "Patient did not consent to the procedure today in writing.", rewrite);
    expect(r.rejections.some((x) => x.code === "negation-changed")).toBe(true);
  });
});

describe("drugs and units", () => {
  it("rejects a swapped drug", () => {
    const r = verifyMeaning("Prescribed amoxicillin 500 mg.", "Prescribed metronidazole 500 mg.", rewrite);
    expect(r.rejections.some((x) => x.code === "drugs-changed")).toBe(true);
  });

  it("rejects a changed unit", () => {
    const r = verifyMeaning("Gave 5 mL by syringe.", "Gave 5 mg by syringe.", rewrite);
    expect(r.rejections.some((x) => x.code === "units-changed")).toBe(true);
  });
});

describe("attribution", () => {
  it("rejects promoting a patient report to a fact", () => {
    const r = verifyMeaning(
      "Patient reports pain for three days in the lower left.",
      "Pain present for three days in the lower left.",
      rewrite
    );
    expect(r.rejections.some((x) => x.code === "attribution-dropped")).toBe(true);
  });

  it("accepts rewording that keeps the attribution", () => {
    const r = verifyMeaning(
      "Pt states pain for three days.",
      "The patient states pain for three days.",
      rewrite
    );
    expect(r.ok).toBe(true);
  });
});

describe("content shrink", () => {
  it("rejects a rewrite that dropped clauses", () => {
    const input =
      "Reviewed medical history and medications. No changes reported since the last visit. " +
      "Completed the restoration and gave postoperative instructions with a follow-up planned.";
    const r = verifyMeaning(input, "Restoration completed.", rewrite);
    expect(r.rejections.some((x) => x.code === "content-shrunk")).toBe(true);
  });
});

describe("tooth letters", () => {
  it("rejects changed primary designators", () => {
    const r = verifyMeaning("Sealants placed on teeth A and B.", "Sealants placed on teeth A and C.", rewrite);
    expect(r.rejections.some((x) => x.code === "teeth-changed")).toBe(true);
  });
});

describe("questions mode", () => {
  it("accepts a pure question list", () => {
    const r = verifyMeaning("RCT completed on 19.", "- Was the consent conversation documented?\n- Which anesthetic and amount were used?", questions);
    expect(r.ok).toBe(true);
  });

  it("rejects a clinical assertion smuggled into the list", () => {
    const r = verifyMeaning(
      "RCT completed on 19.",
      "- Was consent documented?\n- The patient has irreversible pulpitis and requires immediate obturation at the second visit.",
      questions
    );
    expect(r.rejections.some((x) => x.code === "not-questions")).toBe(true);
  });

  it("rejects a short declarative recommendation (length is not a loophole)", () => {
    const r = verifyMeaning("Pain on tooth 19.", "Tooth 19 needs extraction.", questions);
    expect(r.rejections.some((x) => x.code === "not-questions")).toBe(true);
  });

  it("accepts the empty-sentinel lines", () => {
    const r = verifyMeaning("Tooth 19 restored.", "No open questions.", questions);
    expect(r.ok).toBe(true);
  });

  it("rejects a question that plants a number the note never had", () => {
    const r = verifyMeaning("Amoxicillin prescribed.", "- Was the dose 500 mg?", questions);
    expect(r.rejections.some((x) => x.code === "digits-changed")).toBe(true);
  });
});

describe("invented clinical claims", () => {
  it("rejects a rewrite that invents a procedure", () => {
    const r = verifyMeaning(
      "Tooth 19 examined today.",
      "Tooth 19 had caries and was extracted today.",
      rewrite
    );
    expect(r.rejections.some((x) => x.code === "claims-added")).toBe(true);
  });

  it("accepts a rewrite that keeps the same clinical claims", () => {
    const r = verifyMeaning(
      "Caries on tooth 19 restored with composite.",
      "Composite restoration placed for caries on tooth 19.",
      rewrite
    );
    expect(r.ok).toBe(true);
  });
});
