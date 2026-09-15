import { describe, expect, it } from "vitest";
import { runShorthandGate } from "./shorthand-gate";
import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { applyMaskPlan, buildMaskPlan } from "../maskPhi";

const ids = (text: string) => runShorthandGate(text).map((f) => f.ruleId);
const blocks = (text: string) => runShorthandGate(text).some((f) => f.severity === "S1");
const matched = (text: string) => runShorthandGate(text).map((f) => f.matchedText);

describe("TIER 1 — shorthand the tool can already read never blocks", () => {
  // The whole reason the gate is tiered. Blocking these would make the tool
  // slower than a blank text box and would ask a person to do work the
  // vocabulary tables already did.
  it.each([
    "RCT completed on tooth 3.",
    "SRP upper right quadrant.",
    "4 BW taken.",
    "OHI given.",
    "Prophylaxis completed."
  ])("does not block %j", (text) => {
    expect(blocks(text)).toBe(false);
  });
});

describe("TIER 2 — ambiguous shorthand blocks, because only the writer knows", () => {
  it.each([
    ["CR placed on tooth 14.", "gate.ambiguous"],
    ["GP removed.", "gate.ambiguous"]
  ])("blocks %j", (text, prefix) => {
    expect(ids(text).some((id) => id.startsWith(prefix))).toBe(true);
    expect(blocks(text)).toBe(true);
  });

  it("stops asking once the writer has defined the term", () => {
    // The house convention: full term, shorthand in parentheses, shorthand
    // alone thereafter. Having complied, the writer must not be asked again.
    expect(blocks("Composite resin (CR) placed on tooth 14. CR margins checked.")).toBe(false);
  });
});

describe("TIER 3 — shorthand no table can read blocks", () => {
  it("blocks a token nobody will be able to expand later", () => {
    expect(ids("Patient given ZQF before the procedure.")).toContain("gate.unknown-shorthand");
  });

  it("offers a route out that makes the next occurrence free", () => {
    const finding = runShorthandGate("Patient given ZQF today.")[0];
    expect(finding.suggestion).toMatch(/vocabulary/i);
  });
});

describe("TIER 4 — do-not-use constructs block and are never expanded", () => {
  it.each(["insulin 10U given", "amoxicillin 500 mg qhs", "APAP 650 mg"])("blocks %j", (text) => {
    expect(ids(text).some((id) => id.startsWith("gate.do-not-use"))).toBe(true);
  });

  // THE INVARIANT THAT KEEPS THIS TIER HONEST.
  //
  // A do-not-use entry's `replacement` is an INSTRUCTION TO THE WRITER, not a
  // substitution the tool applies — "write \"units\" in full", not "units".
  // That distinction is the entire category: expanding a dangerous abbreviation
  // launders it, because the note comes out clean, the reader is reassured, and
  // the writing habit that caused the documented misreading survives intact.
  //
  // An earlier version of this test asserted the replacement was EMPTY, which
  // was a guess that happened to pass for the wrong reason. The real rule is
  // that the text tells a person what to do.
  it("every do-not-use entry instructs rather than substitutes", () => {
    for (const abbr of BANNED_ABBREVIATIONS) {
      if (!abbr.doNotUse) continue;
      expect(abbr.replacement, `${abbr.id}`).toMatch(/\b(write|name|use)\b/i);
    }
  });

  it("every do-not-use entry says WHY it is misread", () => {
    // A gate that blocks without explaining gets worked around. Each of these
    // carries the specific misreading — "U is read as a zero, so 10U becomes
    // 100" — because that sentence is what changes the habit.
    for (const abbr of BANNED_ABBREVIATIONS) {
      if (!abbr.doNotUse) continue;
      expect(abbr.replacement, `${abbr.id}`).toMatch(/read|misread|recognis|confus/i);
    }
  });

  it("marks the constructs with a documented misreading history", () => {
    const flagged = new Set(BANNED_ABBREVIATIONS.filter((a) => a.doNotUse).map((a) => a.id));
    for (const id of ["unit-u", "unit-iu", "morphine-ms", "hs", "tiw", "apap", "cc-volume", "dc"]) {
      expect(flagged.has(id), `${id} should be do-not-use`).toBe(true);
    }
  });

  it("does NOT mark ordinary house-style expansions", () => {
    // These have a real replacement and are expanded automatically. Blocking
    // them would spend the gate's credibility on tidiness.
    const flagged = new Set(BANNED_ABBREVIATIONS.filter((a) => a.doNotUse).map((a) => a.id));
    for (const id of ["rct", "srp", "prophy", "ohi", "poi", "fu", "nkda", "xray"]) {
      expect(flagged.has(id), `${id} must not be do-not-use`).toBe(false);
    }
  });
});

// ===========================================================================
// FALSE POSITIVES. Every one of these blocked a legitimate note before it was
// fixed, and each would have been enough on its own to get the gate switched
// off. They are pinned individually.
// ===========================================================================
describe("what the gate must never block", () => {
  it("units of measurement", () => {
    // The worst of them: this blocked a note for containing a millimetre, which
    // is to say it blocked essentially every clinical note there is.
    const text = "Probing depths of 5 mm. Weight 20 kg. Administered 10 mL of oral suspension.";
    expect(matched(text)).toEqual([]);
    expect(blocks(text)).toBe(false);
  });

  it("Roman numerals, which are the term rather than shorthand for it", () => {
    for (const text of ["ASA physical status II", "Angle Class III malocclusion", "Class IV restoration"]) {
      expect(matched(text), text).not.toContain("II");
      expect(matched(text), text).not.toContain("III");
    }
  });

  it("the tool's own PHI masks", () => {
    // Blocking these punished the one action the tool most wants people to
    // take: masking an identifier before filing.
    const findings = [
      {
        ruleId: "phi.name",
        category: "phi" as const,
        severity: "S0" as const,
        message: "name",
        matchedText: "Kowalczyk"
      }
    ];
    const masked = applyMaskPlan("Patient Kowalczyk seen today.", buildMaskPlan(findings));
    expect(masked).toMatch(/\[PERSON-/);
    expect(runShorthandGate(masked).map((f) => f.matchedText)).toEqual([]);
  });

  it("ordinary clinical prose with no shorthand at all", () => {
    const text =
      "Scaling and root planing completed, upper right and lower right quadrants. " +
      "Oral hygiene instruction given; re-evaluation planned in four to six weeks.";
    expect(blocks(text)).toBe(false);
  });
});

describe("tolerance", () => {
  it.each(["", "   ", "\u0000", "###", "a".repeat(5000), "MOD MOD MOD"])(
    "never throws on %j",
    (text) => {
      expect(() => runShorthandGate(text)).not.toThrow();
    }
  );

  it("is deterministic", () => {
    const text = "CR placed, insulin 10U, ZQF given, 5 mm pockets.";
    const once = JSON.stringify(runShorthandGate(text));
    expect(JSON.stringify(runShorthandGate(text))).toBe(once);
  });

  it("orders do-not-use ahead of ambiguous ahead of unknown", () => {
    const found = ids("CR placed, insulin 10U given, ZQF administered.");
    const kinds = found.map((id) => id.split(".")[1]);
    const rank = { "do-not-use": 0, ambiguous: 1, "unknown-shorthand": 2 } as Record<string, number>;
    const ranks = kinds.map((k) => rank[k] ?? 9);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});
