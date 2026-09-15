import { describe, expect, it } from "vitest";
import { runPhiRule } from "./phi";
import { applyMaskPlan, buildMaskPlan } from "@/lib/audit/maskPhi";
import { buildReport } from "@/lib/audit/engine";

// The findings that survived three debug storms.
//
// Each case here was reproduced against main before a line of the fix was
// written, so this file starts red and the fixes make it green — the order that
// proves a change rather than describing one. They are grouped by DIRECTION,
// because the privacy layer was wrong both ways at once and fixing either side
// alone makes the other worse: a screen that misses real names is useless, and
// a screen that blocks real clinical terms gets muted, which is the same thing
// one step later.

const ids = (t: string) => runPhiRule(t).map((f) => f.ruleId);
const findingFor = (t: string, ruleId: string) => runPhiRule(t).find((f) => f.ruleId === ruleId);

describe("false negatives — a real identifier the screen let through", () => {
  it("catches a name announced by a SECOND cue", () => {
    // NAME_CUE consumed its cue, so "referred to" swallowed "dr." and the name
    // behind it was never examined. phi.name did not fire either, because it
    // needs a capitalized word after the honorific. Two rules, one gap, and a
    // real name walked between them.
    expect(ids("referred to dr. john smith")).not.toEqual([]);
  });

  it("still catches the single-cue forms it always did", () => {
    // Guards against fixing the chained case by loosening the rule into
    // something that fires everywhere.
    for (const t of ["patient john smith", "seen by dr. john smith", "spoke with mary obrien"]) {
      expect(ids(t), t).not.toEqual([]);
    }
  });

  it("catches every date format a clinician actually types", () => {
    // Only MM/DD/YYYY was caught. The other four are ordinary ways to write a
    // date, and an exact date beside clinical detail is the identifier the rest
    // of this layer is built around.
    for (const t of [
      "Seen on 08/02/2026.",
      "Seen on 2026/08/02.",
      "Seen on 08.02.2026.",
      "Seen on 2 August 2026.",
      "Seen on 02-AUG-2026."
    ]) {
      expect(
        runPhiRule(t).some((f) => f.ruleId.startsWith("phi.date")),
        t
      ).toBe(true);
    }
  });

  it("does not read a tooth sequence or a fraction as a date", () => {
    // The guard that must survive the widened patterns. "14-15-16" is three
    // teeth; "3/4 crown" is a crown type. Hard-blocking either would be the
    // cry-wolf failure arriving from the other direction.
    for (const t of ["Teeth 14-15-16 charted.", "3/4 crown seated.", "1/3 apical resorption."]) {
      expect(
        runPhiRule(t).filter((f) => f.ruleId.startsWith("phi.date")),
        t
      ).toEqual([]);
    }
  });
});

describe("false positives — clinical vocabulary read as a person", () => {
  it("does not hard-block a legitimate opioid line", () => {
    // "MS Contin" is morphine sulfate extended-release. The honorific
    // alternation includes the ALL-CAPS "MS", so a real controlled-substance
    // entry was S0 — export blocked outright. A clinician who cannot file an
    // opioid note works around the tool, and a worked-around tool documents
    // nothing at all.
    expect(ids("MS Contin 15 mg given.")).toEqual([]);
  });

  it("does not read imaging or sensor hardware as a person", () => {
    expect(ids("MR Imaging reviewed.")).toEqual([]);
    expect(ids("DR Sensor size 2 used.")).toEqual([]);
  });

  it("does not read ALL-CAPS charting as a person", () => {
    // "IAN" is the inferior alveolar nerve and also a given name; "FRANK" pus
    // is a clinical adjective; "MAX" is the maxillary arch. The Mask button
    // acts on S2 findings too, so one click would rewrite the anaesthesia
    // record of a legal document.
    expect(ids("IAN INJECTION given.")).toEqual([]);
    expect(ids("FRANK PUS expressed from the site.")).toEqual([]);
    expect(ids("MAX CENTRAL restored.")).toEqual([]);
  });

  it("does not read periodontal charting as a record number", () => {
    // Found by sweeping the widened patterns across realistic clinical prose,
    // not by the reported findings — phi.mrn had an OPTIONAL qualifier, so bare
    // "chart" plus any digit matched. "Perio chart 4/5/4" is charting, and this
    // was an S0 hard block on a legitimate perio note.
    for (const t of [
      "Perio chart 4/5/4 on the mesial.",
      "Charted 14-15-16.",
      "record 5 of 8 reviewed.",
      "chart 6 sites probed."
    ]) {
      expect(runPhiRule(t).filter((f) => f.ruleId === "phi.mrn"), t).toEqual([]);
    }
  });

  it("still catches a real record number, with or without the qualifier", () => {
    for (const t of [
      "MRN 4483920",
      "chart no. 12345",
      "chart #12345",
      "patient id ABC-123",
      "record number 55512",
      "chart 4483920"
    ]) {
      expect(
        runPhiRule(t).some((f) => f.ruleId === "phi.mrn"),
        t
      ).toBe(true);
    }
  });

  it("stays quiet across ordinary clinical prose", () => {
    // The whole-screen sweep. A privacy layer earns its keep by being silent on
    // the hundred normal lines between the one that matters.
    for (const t of [
      "Probing depths 3.2.1 charted on the buccal.",
      "Composite 2.5 mm deep, occlusal.",
      "Teeth 14-15-16 charted; 3/4 crown on 30.",
      "Lidocaine 2% 1.8 mL x 2 carpules.",
      "Recall in 6 months. Follow up in 2 weeks.",
      "BP 120/80, pulse 72.",
      "Torque 35 Ncm. Implant 4.1 x 10 mm.",
      "Bitewings 2 taken; PA of 19 taken.",
      "Shade A2. Matrix 1.5 mm band.",
      "The patient may return in 5 days.",
      "Seen by the hygienist for a recall exam."
    ]) {
      expect(runPhiRule(t), t).toEqual([]);
    }
  });

  it("still catches a real honorific name", () => {
    // The other half of the contract. Suppressing the clinical terms must not
    // suppress the case the rule exists for.
    expect(ids("Dr. Smith reviewed the chart.")).toContain("phi.name");
    expect(ids("Seen by Mrs. Patterson-Hill.")).not.toEqual([]);
  });
});

describe("the note title is screened like everything else", () => {
  // The submit route folds runPhiRule(draft.title) into the same report the
  // body produces. This pins the LOGIC of that fold; the route wiring itself is
  // covered by the live probe, since this repo has no route-level test harness.
  const asTitleFindings = (title: string) =>
    runPhiRule(title).map((f) => ({
      ...f,
      message: `In the note title, which becomes the emailed filename: ${f.message}`
    }));

  it("makes a name in the title visible, where there was silence", () => {
    const findings = asTitleFindings("John Smith crown seat 8");
    expect(findings.length).toBeGreaterThan(0);
    // S2 REVIEW, exactly as the same name would be in the note body.
    //
    // Severity follows the strength of the EVIDENCE, not the location of the
    // text. A capitalized pair is a heuristic wherever it appears, and giving
    // the title its own harsher rule would mean identical evidence carrying two
    // different verdicts depending on which box it was typed into — which is
    // how a screen loses the user's trust.
    //
    // What changed is that the note no longer reports AUDIT PASS while the name
    // rides out on the filename. It now reports a finding that names the title.
    const report = buildReport(findings);
    expect(report.status).toBe("READY FOR CLINICIAN REVIEW");
    expect(report.findings.some((f) => f.category === "phi")).toBe(true);
  });

  it("BLOCKS the title on a definite identifier", () => {
    // The formats that are almost never anything else keep their hard stop in
    // the title too — a date, a phone number, a record number.
    for (const t of ["crown seat 08/02/2026", "recall 865-555-0100", "chart MRN 4483920"]) {
      const report = buildReport(asTitleFindings(t));
      expect(report.status, t).toBe("BLOCKED");
    }
  });

  it("says where the problem is, because the filename is not on screen", () => {
    const [f] = asTitleFindings("John Smith crown seat");
    expect(f.message).toContain("emailed filename");
  });

  it("leaves an ordinary clinical title alone", () => {
    for (const t of [
      "Crown seat tooth 8",
      "MS Contin refill note",
      "IAN INJECTION follow-up",
      "Recall exam and prophy"
    ]) {
      expect(asTitleFindings(t), t).toEqual([]);
    }
  });
});

describe("masking spans stay exact", () => {
  // matchedText drives LITERAL substring replacement. A pattern that matches
  // the right text at the wrong offset does not merely mislabel a finding — it
  // corrupts the note during redaction, and the re-audit then reports clean.
  it("masks the identifier and nothing around it", () => {
    for (const [text, mustSurvive] of [
      ["Seen on 2026/08/02 for a recall.", "for a recall"],
      ["Seen on 2 August 2026 for a recall.", "for a recall"],
      ["referred to dr. john smith for evaluation", "for evaluation"]
    ] as const) {
      const plan = buildMaskPlan(runPhiRule(text));
      const masked = applyMaskPlan(text, plan);
      expect(masked, text).toContain(mustSurvive);
      expect(masked, text).not.toBe(text);
    }
  });

  it("leaves text alone when nothing is flagged", () => {
    const text = "MS Contin 15 mg given. IAN INJECTION completed.";
    expect(applyMaskPlan(text, buildMaskPlan(runPhiRule(text)))).toBe(text);
  });

  it("reports the identifier as matchedText, not the surrounding words", () => {
    const f = findingFor("Seen on 2026/08/02.", "phi.date-ymd") ?? findingFor("Seen on 2026/08/02.", "phi.date");
    expect(f?.matchedText).toBe("2026/08/02");
  });
});
