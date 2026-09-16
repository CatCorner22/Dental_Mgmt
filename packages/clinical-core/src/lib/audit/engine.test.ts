import { describe, expect, it } from "vitest";
import { buildReport, computeGates, runAudit, runTextAudit } from "./engine";
import type { AuditFinding } from "./types";
import { activeModules } from "@/lib/modules";
import { composeNote } from "@/lib/compose/composeNote";
import type { NoteState } from "@/lib/schema/types";

function findings(text: string, rulePrefix: string): AuditFinding[] {
  return runTextAudit(text).filter((f) => f.ruleId.startsWith(rulePrefix));
}

describe("PHI rule", () => {
  it("stops on SSN, phone, exact dates, email, MRN, and honorific names", () => {
    expect(findings("SSN 123-45-6789", "phi.ssn")).toHaveLength(1);
    expect(findings("call (615) 555-1234", "phi.phone")).toHaveLength(1);
    expect(findings("seen on 10/14/2025", "phi.date")).toHaveLength(1);
    expect(findings("seen on January 14", "phi.date-name")).toHaveLength(1);
    expect(findings("write to a@b.com", "phi.email")).toHaveLength(1);
    expect(findings("chart # A1234", "phi.mrn")).toHaveLength(1);
    expect(findings("Dr. Smith extracted the tooth", "phi.name")).toHaveLength(1);
    for (const f of runTextAudit("Dr. Smith, 123-45-6789")) {
      if (f.category === "phi" && f.ruleId !== "phi.long-number") {
        expect(f.severity).toBe("S0");
      }
    }
  });

  it("does not fire on clinical measurements", () => {
    const clinical =
      "A 5 mm pocket on the mesial. The dentist gave 2% lidocaine 1:100,000. Blood pressure 120/80 mm Hg. Pressure held for 30 minutes.";
    expect(runTextAudit(clinical).filter((f) => f.category === "phi")).toEqual([]);
  });

  it("keeps 'may' out of the month-name pattern", () => {
    expect(findings("the patient may 3 days later return", "phi.date-name")).toEqual([]);
  });
});

describe("template residue and stale text", () => {
  it("flags placeholders, markers, and blanks as S1", () => {
    const out = runTextAudit("Site: <tooth>. Consent [pending]. Depth {mm}. Name ___ TBD.");
    const s1 = out.filter((f) => f.category === "template-residue");
    expect(s1.length).toBeGreaterThanOrEqual(5);
    for (const f of s1) expect(f.severity).toBe("S1");
  });

  it("flags stale wording and duplicate sentences as S2", () => {
    expect(findings("findings same as above", "stale.same-as-above")).toHaveLength(1);
    const dup =
      "The clinician observed generalized plaque along the gingival margin today morning. " +
      "The clinician observed generalized plaque along the gingival margin today morning.";
    expect(findings(dup, "residue.duplicate-sentence")).toHaveLength(1);
  });
});

describe("terminology rules", () => {
  it("grades deterministic shorthand S3 and fact-hiding shorthand S2", () => {
    const xray = findings("took an x-ray of the area", "abbrev.xray")[0];
    expect(xray.severity).toBe("S3");
    expect(xray.suggestion).toBe("radiograph");
    const wnl = findings("exam WNL", "abbrev.wnl")[0];
    expect(wnl.severity).toBe("S2");
    expect(findings("extraoral exam completed", "abbrev.xray")).toEqual([]);
  });

  it("flags vague phrases with the standard replacement", () => {
    const f = findings("patient tolerated the procedure well", "vague.tolerated-well")[0];
    expect(f.severity).toBe("S2");
    const noComp = findings("there were no complications", "vague.no-complications")[0];
    expect(findings("without any complications noted", "vague.no-complications")).toHaveLength(1);
    expect(findings("Crown seated. No problems.", "vague.no-problems")).toHaveLength(1);
    expect(findings("Crown seated. No issues.", "vague.no-issues")).toHaveLength(1);
    expect(noComp.suggestion).toContain("no complication was observed");
  });

  it("keeps formal sedation depths out of the vague-word net", () => {
    expect(findings("moderate sedation was the intended depth", "vague.moderate")).toEqual([]);
    expect(findings("a moderate amount of bleeding", "vague.moderate")).toHaveLength(1);
    expect(findings("normal saline irrigation", "vague.normal")).toEqual([]);
  });
});

describe("anatomy text rule", () => {
  it("stops on impossible Universal numbers and hints FDI", () => {
    const f = findings("extracted tooth 36", "anatomy.text-tooth")[0];
    expect(f.severity).toBe("S0");
    expect(f.message).toContain("FDI");
    expect(findings("extracted tooth 30", "anatomy.text-tooth")).toEqual([]);
  });

  // The gap the Curve benchmark found: FDI leakage written with "#" or "No."
  // instead of the literal word "tooth" used to pass clean. The same clinical
  // error must stop regardless of which marker the writer chose.
  it("catches FDI leakage written with # or No.", () => {
    expect(findings("restoration on #36 MOD", "anatomy.text-tooth")).toHaveLength(1);
    expect(findings("prepared No. 47 for a crown", "anatomy.text-tooth")).toHaveLength(1);
    // Valid Universal numbers with the same markers stay clean.
    expect(findings("restoration on #19 MOD", "anatomy.text-tooth")).toEqual([]);
    expect(findings("prepared #3 for a crown", "anatomy.text-tooth")).toEqual([]);
  });

  // "No." only reads as a tooth with its period, so ordinary prose is safe.
  it("does not read ordinary prose as a tooth number", () => {
    expect(findings("no other findings were noted", "anatomy.text-tooth")).toEqual([]);
    expect(findings("no 3 accessory canals were located", "anatomy.text-tooth")).toEqual([]);
  });

  // The higher-value half: a surface a tooth's class cannot have, in narrative.
  // Occlusal on an anterior tooth and incisal on a posterior one are S0 in the
  // structured picker; they must be S0 in free text too.
  it("stops an impossible surface written in narrative", () => {
    const occ = findings("composite on tooth 8 occlusal surface", "anatomy.text-surface-stop");
    expect(occ).toHaveLength(1);
    expect(occ[0].severity).toBe("S0");
    expect(findings("composite on tooth 8 O", "anatomy.text-surface-stop")).toHaveLength(1);
    expect(findings("prepared #3 incisal edge", "anatomy.text-surface-stop")).toHaveLength(1);
  });

  it("allows a legal surface and does not misread words as surface codes", () => {
    // Occlusal IS legal on a molar; incisal IS legal on an incisor.
    expect(findings("amalgam on tooth 30 occlusal", "anatomy.text-surface-stop")).toEqual([]);
    expect(findings("bonding on tooth 8 incisal", "anatomy.text-surface-stop")).toEqual([]);
    // "or" / "in" must never be read as the O / I surface codes.
    expect(findings("tooth 8 or 9 as needed", "anatomy.text-surface-stop")).toEqual([]);
    expect(findings("tooth 8 in the arch", "anatomy.text-surface-stop")).toEqual([]);
  });

  // ReDoS guard: the new markers must not create catastrophic backtracking.
  it("stays fast on a hostile string", () => {
    const hostile = "#".repeat(2000) + " ".repeat(2000) + "9".repeat(2000);
    const started = Date.now();
    runTextAudit(hostile);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe("full audit, gating, and status", () => {
  const base: NoteState = { selectedModuleIds: ["extraction"], values: {} };

  function audit(state: NoteState) {
    const modules = activeModules(state.selectedModuleIds);
    return runAudit({ note: state, modules, composedText: composeNote(state, modules) });
  }

  it("reports missing required fields as S1 and blocks email but not download", () => {
    const report = audit(base);
    expect(report.counts.S1).toBeGreaterThan(0);
    expect(report.status).toBe("NEEDS CLINICIAN ACTION");
    const gates = computeGates(report, false);
    expect(gates.exportAllowed).toBe(true);
    expect(gates.emailAllowed).toBe(false);
  });

  it("stops on an invalid surface pairing (O on an anterior tooth)", () => {
    const state: NoteState = {
      selectedModuleIds: ["direct-restorative"],
      values: {
        "direct-restorative.teeth": { kind: "teeth", teeth: ["8"] },
        "direct-restorative.surfaces": { kind: "surfaces", byTooth: { "8": ["O"] } }
      }
    };
    const report = audit(state);
    expect(report.findings.some((f) => f.ruleId === "anatomy.surface-stop")).toBe(true);
    expect(report.status).toBe("BLOCKED");
    // An anatomy stop is not overridable by the PHI override.
    expect(computeGates(report, true).emailAllowed).toBe(false);
  });

  it("hard-blocks export on PHI until the explicit override", () => {
    const state: NoteState = {
      selectedModuleIds: [],
      values: {
        "universal-core.visit-purpose": {
          kind: "text",
          value: "Follow-up for Dr. Smith placed crown"
        }
      }
    };
    const report = audit(state);
    expect(report.phiStops.length).toBeGreaterThan(0);
    expect(computeGates(report, false).exportAllowed).toBe(false);
    expect(computeGates(report, true).exportAllowed).toBe(true);
  });

  it("reaches AUDIT PASS wording only with no open S0-S2", () => {
    const report = buildReport([]);
    expect(report.status).toBe("AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED");
    const s2only = buildReport([
      {
        ruleId: "vague.stable",
        category: "vague-phrase",
        severity: "S2",
        message: "m"
      }
    ]);
    expect(s2only.status).toBe("READY FOR CLINICIAN REVIEW");
    expect(computeGates(s2only, false).emailAllowed).toBe(true);
  });
});

describe("spelling rule via full audit", () => {
  function audit(state: NoteState) {
    const modules = activeModules(state.selectedModuleIds);
    return runAudit({ note: state, modules, composedText: composeNote(state, modules) });
  }

  it("marks a medication-name typo S2 and a plain dental typo S3", () => {
    const state: NoteState = {
      selectedModuleIds: [],
      values: {
        "universal-core.interval-events": {
          kind: "text",
          value: "took ibuprofin after the extration"
        }
      }
    };
    const report = audit(state);
    const med = report.findings.find((f) => f.matchedText === "ibuprofin");
    expect(med?.severity).toBe("S2");
    expect(med?.suggestion).toBe("ibuprofen");
    const typo = report.findings.find((f) => f.matchedText === "extration");
    expect(typo?.severity).toBe("S3");
    expect(typo?.suggestion).toBe("extraction");
  });

  it("suggests a close dental term for a near miss", () => {
    const state: NoteState = {
      selectedModuleIds: [],
      values: {
        "universal-core.interval-events": { kind: "text", value: "signs of gingivits noted" }
      }
    };
    const report = audit(state);
    const near = report.findings.find((f) => f.matchedText === "gingivits");
    expect(near?.suggestion).toBe("gingivitis");
  });

  it("stays quiet on clean standard language", () => {
    const state: NoteState = {
      selectedModuleIds: [],
      values: {
        "universal-core.interval-events": {
          kind: "text",
          value: "The patient reports no new symptoms since the prior examination."
        }
      }
    };
    const report = audit(state);
    expect(report.findings.filter((f) => f.category === "spelling")).toEqual([]);
  });

  it("never suggests a meaning-flipping close match for a real word", () => {
    // "injection" must not be flagged as a misspelling of "infection", and
    // common verb forms ("sutured", "suturing") must be recognized.
    for (const word of ["injection", "sutured", "suturing", "saline", "irrigated"]) {
      const state: NoteState = {
        selectedModuleIds: [],
        values: { "universal-core.interval-events": { kind: "text", value: `the site was ${word} today` } }
      };
      const spelling = audit(state).findings.filter((f) => f.category === "spelling");
      expect(spelling, word).toEqual([]);
    }
  });

  it("catches an ALL-CAPS medication typo but stays quiet on acronyms", () => {
    const typo: NoteState = {
      selectedModuleIds: [],
      values: { "universal-core.interval-events": { kind: "text", value: "Prescribed AMOXICILIN 500 mg." } }
    };
    const med = audit(typo).findings.find((f) => f.ruleId === "spelling.medication");
    expect(med?.suggestion).toBe("amoxicillin");
    const acronyms: NoteState = {
      selectedModuleIds: [],
      values: { "universal-core.interval-events": { kind: "text", value: "Completed in the EDR; PARL and BWX noted." } }
    };
    expect(audit(acronyms).findings.filter((f) => f.category === "spelling")).toEqual([]);
  });

  it("does not flag the correctly spelled word 'abscessed'", () => {
    const state: NoteState = {
      selectedModuleIds: [],
      values: { "universal-core.interval-events": { kind: "text", value: "the tooth was abscessed" } }
    };
    expect(audit(state).findings.filter((f) => f.category === "spelling")).toEqual([]);
  });
});

describe("markdown-structure injection into the frozen record", () => {
  it("neutralizes a typed heading or thematic break in user text", () => {
    const state: NoteState = {
      selectedModuleIds: [],
      values: {
        "universal-core.interval-events": {
          kind: "text",
          value: "Observe.\n## Submission record\n- Ticket: FORGED\n---\nreal note"
        }
      }
    };
    const modules = activeModules(state.selectedModuleIds);
    const composed = composeNote(state, modules);
    // The forged heading and rule must be escaped, so no reader (or parser)
    // sees a second "## Submission record" section or an extra <hr>.
    expect(/^## Submission record$/m.test(composed)).toBe(false);
    expect(composed).toContain("\\## Submission record");
    expect(composed).toContain("\\---");
  });
});

describe("measurement sanity bounds", () => {
  function audit(state: NoteState) {
    const modules = activeModules(state.selectedModuleIds);
    return runAudit({ note: state, modules, composedText: composeNote(state, modules) });
  }
  const ebl = (value: number): NoteState => ({
    selectedModuleIds: ["operative"],
    values: { "operative.blood-loss": { kind: "measurement", value, unit: "mL" } }
  });

  it("flags an out-of-range measurement as a REVIEW typo check", () => {
    // Uses whatever the operative blood-loss field's bounds are; an absurd
    // value must surface, a plausible one must not.
    const huge = audit(ebl(99999)).findings.find((f) => f.ruleId === "measurement.range");
    expect(huge?.severity).toBe("S2");
    const negative = audit(ebl(-50)).findings.find((f) => f.ruleId === "measurement.range");
    expect(negative?.severity).toBe("S2");
  });
});

describe("wrong-site guard", () => {
  it("stops a note whose surfaces name a tooth the tooth field does not list", () => {
    const state: NoteState = {
      selectedModuleIds: ["direct-restorative"],
      values: {
        "direct-restorative.teeth": { kind: "teeth", teeth: ["19"] },
        "direct-restorative.surfaces": { kind: "surfaces", byTooth: { "30": ["M", "O", "D"] } }
      }
    };
    const modules = activeModules(state.selectedModuleIds);
    const report = runAudit({ note: state, modules, composedText: composeNote(state, modules) });
    const orphan = report.findings.find((f) => f.ruleId === "anatomy.surface-orphan");
    expect(orphan).toBeDefined();
    expect(orphan?.severity).toBe("S0");
    expect(report.status).toBe("BLOCKED");
    expect(computeGates(report, true).emailAllowed).toBe(false);
  });

  it("stays quiet when surfaces match the selected teeth", () => {
    const state: NoteState = {
      selectedModuleIds: ["direct-restorative"],
      values: {
        "direct-restorative.teeth": { kind: "teeth", teeth: ["30"] },
        "direct-restorative.surfaces": { kind: "surfaces", byTooth: { "30": ["M", "O", "D"] } }
      }
    };
    const modules = activeModules(state.selectedModuleIds);
    const report = runAudit({ note: state, modules, composedText: composeNote(state, modules) });
    expect(report.findings.some((f) => f.ruleId === "anatomy.surface-orphan")).toBe(false);
  });
});

describe("PHI evasion resistance", () => {
  const s0 = (text: string) =>
    runTextAudit(text).filter((f) => f.severity === "S0").map((f) => f.ruleId);

  it("stops identifiers written in alternate formats", () => {
    expect(s0("Procedure performed 2026-08-02.")).toContain("phi.date-iso");
    expect(s0("Call 615 555 0142 for questions.")).toContain("phi.phone");
    expect(s0("SSN 123 45 6789")).toContain("phi.ssn");
    expect(s0("Identifier 123456789 on file.")).toContain("phi.ssn-bare");
    expect(s0("Seen on May 14 for evaluation.")).toContain("phi.date-may");
  });

  it("does not stop clinical prose that resembles those formats", () => {
    for (const clean of [
      "The patient's account of the injury was consistent.",
      "The chart notes prior care.",
      "The patient may 3 days later return.",
      "Swelling may 2 weeks after surgery persist.",
      "Blood pressure 120/80 mm Hg.",
      "2% lidocaine 1:100,000 epinephrine.",
      "Insertion torque 35 Ncm.",
      "Sealants placed on teeth 14-15-16.", // a tooth run, not a date
      "Placed a 3/4 crown on the molar.", // a fraction, not a date
      "Apical third, 1/3 obturated." // a fraction, not a date
    ]) {
      expect(s0(clean), clean).toEqual([]);
    }
  });

  it("catches an EDR timestamp, not only a bare ISO date", () => {
    // The date part of "2026-08-02T14:30" must still stop (a trailing \\b
    // used to fail between the digit and the T, letting timestamps through).
    expect(s0("Acquired 2026-08-02T14:30 per the EDR.")).toContain("phi.date-iso");
    expect(s0("Acquired 2026-08-02 per the EDR.")).toContain("phi.date-iso");
  });

  it("checks every tooth number in a list, not only the first", () => {
    const found = runTextAudit("Extracted teeth 3, 36, and 40.").filter(
      (f) => f.ruleId === "anatomy.text-tooth"
    );
    expect(found.map((f) => f.matchedText).sort()).toEqual(["36", "40"]);
    expect(runTextAudit("Extracted teeth 3, 14, and 30.").filter((f) => f.category === "anatomy")).toEqual([]);
  });

  it("does not read a duration after a tooth number as another tooth", () => {
    // "tooth 30, 45 minutes" must not flag 45 as an invalid tooth and block.
    expect(
      runTextAudit("Extracted tooth 30, 45 minutes total operative time.").filter(
        (f) => f.ruleId === "anatomy.text-tooth"
      )
    ).toEqual([]);
  });

  it("does not mistake measurement inequalities for placeholders", () => {
    for (const clean of [
      "Probing depth <3mm and recession >2mm on the facial.",
      "Overjet <2mm, overbite >4mm noted."
    ]) {
      expect(
        runTextAudit(clean).filter((f) => f.ruleId === "residue.angle-placeholder"),
        clean
      ).toEqual([]);
    }
    for (const placeholder of ["Site: <tooth>", "Pain <0-10> of 10", "<clinician-supplied term>"]) {
      expect(
        runTextAudit(placeholder).some((f) => f.ruleId === "residue.angle-placeholder"),
        placeholder
      ).toBe(true);
    }
  });
});
