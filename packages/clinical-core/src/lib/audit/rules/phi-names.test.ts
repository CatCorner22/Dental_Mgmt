import { describe, expect, it } from "vitest";
import { runPhiRule } from "./phi";
import { buildReport, computeGates, isValidPhiAttestation } from "../engine";

// The largest hole in the PHI screen: phi.name required an honorific, so
// "John Smith presented for a recall" — a bare name, the commonest way a name
// actually appears in prose — passed the whole screen clean. The premise of
// this tool is that no patient identity ever enters it; the screen now at
// least SEES the commonest form, at REVIEW severity, honestly labelled as a
// heuristic.
//
// Both directions are tested, and the false-positive suite is the longer one
// on purpose. A name screen that flags "Bradley County" as a patient teaches
// staff to ignore the screen, and an ignored screen is worse than none.

const ids = (text: string) => runPhiRule(text).map((f) => f.ruleId);
const bare = (text: string) => runPhiRule(text).filter((f) => f.ruleId.startsWith("phi.name-"));

describe("bare names are seen", () => {
  it("catches given + surname with no honorific", () => {
    expect(ids("John Smith presented for a recall.")).toContain("phi.name-bare");
    expect(ids("Referred by Sarah Johnson for evaluation.")).toContain("phi.name-bare");
    expect(ids("Spoke with Maria Garcia about the estimate.")).toContain("phi.name-bare");
  });

  it("catches Mc/Mac/O'-style surnames and hyphenated ones", () => {
    expect(ids("Karen McDonald was seen at the recall.")).toContain("phi.name-bare");
    expect(ids("Mary O'Brien reports sensitivity.")).toContain("phi.name-bare");
    expect(ids("Robert Smith-Jones declined the radiograph.")).toContain("phi.name-bare");
  });

  it("catches the chart-header order too", () => {
    expect(ids("Smith, John — recall and prophylaxis")).toContain("phi.name-comma");
    expect(ids("McDonald, Karen")).toContain("phi.name-comma");
    // No space after the comma: how a CSV or EHR field usually pastes.
    expect(ids("Smith,John")).toContain("phi.name-comma");
  });

  it("is not shadowed by a capitalized word in front of the name", () => {
    // The regression that mattered most. Matching the surname normally
    // consumed both words, so "Patient John" was matched, rejected by the
    // dictionary, and the scan resumed AFTER "John" — the real name was never
    // examined. "Patient/Pt <Name>" is the commonest way a name enters a
    // clinical note, so the rule missed the case it exists for while passing
    // its own tests, which never put a capitalized word in front.
    for (const text of [
      "Patient John Smith presented for a recall.",
      "Pt John Smith presented for a recall.",
      "Guardian Mary Johnson consented.",
      "Hygienist Amy Brown recorded the pocket depths.",
      "Today John Smith called about pain.",
      "The John Smith case was discussed."
    ]) {
      expect(ids(text), text).toContain("phi.name-bare");
    }
  });

  it("catches ALL CAPS, the way an EHR header pastes", () => {
    expect(ids("JOHN SMITH presented for a recall.")).toContain("phi.name-bare");
    expect(ids("SMITH, JOHN")).toContain("phi.name-comma");
  });

  it("catches a middle initial", () => {
    expect(ids("John Q. Smith presented.")).toContain("phi.name-bare");
  });

  it("reports the EXACT source text, so masking can replace it", () => {
    // matchedText drives a literal substring replacement in the masking pass.
    // A normalized "John Smith" would silently fail to replace a real
    // "John  Smith", leaving the identifier in the note.
    const f = bare("Seen by John  Smith.")[0];
    expect(f.matchedText).toBe("John  Smith");
  });

  it("counts repeats instead of listing the same name twice", () => {
    const f = bare("John Smith arrived. John Smith left.");
    expect(f).toHaveLength(1);
    expect(f[0].occurrences).toBe(2);
  });
});

describe("a name after a cue word needs no capital", () => {
  // The rules above all require a capital letter, and clinicians type fast and
  // lowercase. "patient john smith presented" was invisible to the whole
  // screen — and because the Mask identifiers button replaces exactly what the
  // screen matched, a name it could not see was a name masking silently left
  // behind. The clinician clicked Mask, the phone and "John Smith" vanished,
  // "patient john smith" stayed, and the note then LOOKED redacted. That is
  // worse than no button, because it turns a visible problem into a hidden one.
  it("catches lowercase names that follow a cue", () => {
    for (const text of [
      "patient john smith presented for a recall",
      "pt john smith declined the radiograph",
      "seen by john smith today",
      "referred to sarah johnson",
      "guardian maria garcia consented",
      "spoke with karen mcdonald about cost",
      "Pt john smith declined"
    ]) {
      expect(ids(text), text).toContain("phi.name-cued");
    }
  });

  it("excludes the cue word from matchedText", () => {
    // masking replaces matchedText literally. "patient" is not an identifier,
    // and masking it away would damage the sentence for no privacy gain.
    const f = bare("patient john smith presented")[0];
    expect(f.matchedText).toBe("john smith");
  });

  it("reports one finding per name, not one per rule that saw it", () => {
    // "patient John Smith" satisfies both the capitalized rule and the cued
    // rule. Two rows saying the same thing is how a findings panel starts
    // getting skimmed.
    expect(bare("patient John Smith presented")).toHaveLength(1);
    expect(ids("patient John Smith presented")).toContain("phi.name-bare");
  });

  it("stays quiet when the cue is followed by ordinary clinical words", () => {
    for (const text of [
      "patient reports pain on biting",
      "patient declined the referral",
      "patient states the crown feels high",
      "parent consented to treatment",
      "seen by hygienist for prophylaxis",
      "referred to periodontist for evaluation",
      "treated by the covering dentist",
      "patient denies any allergy",
      "assistant charted the findings"
    ]) {
      expect(bare(text), text).toEqual([]);
    }
  });

  it("still respects the institution filter after a cue", () => {
    // "Referred to Christian Dental Clinic" — the cue announces a name and
    // "Christian" is one, but the next word says it went to an organization.
    // The cry-wolf suite caught this regression before it shipped.
    expect(bare("Referred to Christian Dental Clinic."), "institution").toEqual([]);
    expect(bare("referred to grace family dentistry"), "lowercase institution").toEqual([]);
  });
});

describe("the screen does not cry wolf", () => {
  const clean = (text: string) => expect(bare(text), text).toEqual([]);

  it("leaves an imperative verb before a dental noun alone", () => {
    // Sentence-initial position is what makes this class possible: the first
    // word's capital carries no information there, so a given name that is
    // also an ordinary verb reads as a name. Nobody is surnamed "Tooth".
    clean("Mark Tooth 14 for extraction.");
    clean("Mark Crown prep on 30.");
    // The suppression list is dental STRUCTURE nouns only, and stays that way
    // deliberately. Administrative prose ("Bill insurance for the implant")
    // is written lowercase, so it never reaches this rule — and padding the
    // list with every word I could invent a capitalized example for is how a
    // targeted filter turns into whack-a-mole.
    clean("Bill insurance for the implant.");
  });

  it("leaves clinical capitalized pairs alone", () => {
    clean("Angle Class II malocclusion noted.");
    clean("Epworth Sleepiness Scale not recorded.");
    clean("Frankfort Horizontal reference used.");
    clean("Shade VITA Classical A3.");
    clean("Grade 1 mobility recorded.");
  });

  it("leaves the practice's own geography alone", () => {
    clean("Seen at Fort Sanders West.");
    clean("Transferred from Executive Park.");
    clean("Town & Country Circle front desk called.");
  });

  it("leaves institutions and places alone even when they start with a name", () => {
    // These START with common given names, and are exactly what the
    // institution lookahead exists for.
    clean("Referred to Christian Dental Clinic.");
    clean("Coordinated with Bradley County Health Department.");
    clean("Records requested from Holly Springs office.");
    clean("Referred to Grace Family Dentistry.");
  });

  it("leaves dental supply houses alone", () => {
    // "Henry Schein" on a materials line is the likeliest false positive in a
    // real note, and flagging the supplier teaches staff to dismiss the flag.
    clean("Composite ordered from Henry Schein.");
    clean("Burs supplied by Patterson Dental.");
  });

  it("leaves named stains and materials alone", () => {
    // Rose and Crystal are deliberately absent from the given-name list so
    // that a mucosal stain never reads as a patient.
    clean("Rose Bengal staining of the lesion margin.");
    clean("Crystal Violet applied per protocol.");
    clean("Gentian Violet applied to the mucosa.");
  });

  it("leaves date prose alone", () => {
    // April, May, and June are deliberately absent from the list; exact dates
    // have their own rules and their own severities.
    clean("Review in May next year.");
    clean("The June Recall list was checked.");
  });

  it("needs BOTH words capitalized", () => {
    clean("Mark the midline before impressions.");
    clean("Grace period on the account has ended.");
    clean("The patient reports pain on biting.");
  });

  it("stays quiet on ordinary clinical prose", () => {
    clean("Prophylaxis completed. Oral hygiene instruction given. Recall six months.");
    clean("Scaling and root planing, upper right quadrant, under local anesthetic.");
  });
});

describe("a heuristic reviews; it does not block", () => {
  it("is S2 phi — visible, but never a stop and never a gate", () => {
    const findings = runPhiRule("John Smith presented for a recall.");
    const nameFinding = findings.find((f) => f.ruleId === "phi.name-bare")!;
    expect(nameFinding.severity).toBe("S2");
    expect(nameFinding.category).toBe("phi");

    // phiStops is S0-only, so a bare-name review does not join the stop list,
    // does not demand an attestation, and does not block export or email.
    const report = buildReport(findings);
    expect(report.phiStops).toEqual([]);
    expect(computeGates(report, false).exportAllowed).toBe(true);
  });

  it("the definite formats still stop the line", () => {
    const report = buildReport(runPhiRule("Call 865-555-1234 about Mr. Smith."));
    expect(report.phiStops.length).toBeGreaterThan(0);
    expect(computeGates(report, false).exportAllowed).toBe(false);
  });
});

describe("what counts as an attestation", () => {
  it("refuses the old five-character theater", () => {
    expect(isValidPhiAttestation("valid")).toBe(false);
    expect(isValidPhiAttestation("")).toBe(false);
    expect(isValidPhiAttestation("     ")).toBe(false);
  });

  it("refuses length without content", () => {
    expect(isValidPhiAttestation("aaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
    expect(isValidPhiAttestation("aa aa aa aa aa aa aa aa aa")).toBe(false);
  });

  it("refuses an attestation made of invisible characters", () => {
    // Zero-width and format characters are not matched by \s, so a reason
    // built from them counted as 23 characters, 4 words, and 5 distinct
    // characters while rendering blank to every human who would read it —
    // the waive-with-no-reason failure this validator exists to close,
    // wearing a costume.
    const invisible = "​‌‍⁠­";
    const attack = [invisible, invisible, invisible, invisible].join(" ");
    expect(attack.length).toBeGreaterThan(20);
    expect(isValidPhiAttestation(attack)).toBe(false);
    // Padding a real-looking reason with invisibles does not buy length either.
    expect(isValidPhiAttestation("too short" + "​".repeat(50))).toBe(false);
  });

  it("accepts a reason that states what the flagged text is", () => {
    expect(isValidPhiAttestation("These are tooth numbers, not a calendar date.")).toBe(true);
    expect(isValidPhiAttestation("This is the implant lot number from the sticker.")).toBe(true);
  });
});
