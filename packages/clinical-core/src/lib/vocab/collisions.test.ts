import { describe, expect, it } from "vitest";
import { standardize } from "@/lib/standardize/standardize";
import { BANNED_ABBREVIATIONS } from "./abbreviations";
import { SHORTHAND } from "./shorthand";

// THE COLLISION TRIPWIRE.
//
// Every abbreviation added to the tables makes the transformer more useful and
// widens the chance it fires on something it should not. A two- or three-letter
// pattern matched case-insensitively is a loaded gun pointed at ordinary prose:
// "ant" is anterior in a dental note and an insect in English, "mo" is months and
// a name, "iso" is isolation and a prefix.
//
// This file is what makes growing the vocabulary safe. Two guards, and the first
// is the one that scales:
//
//   1. A corpus of ALREADY-CORRECT clinical prose that the transformer must pass
//      through without a single substantive change. If a new entry fires inside a
//      well-written sentence, this fails, and it fails with the sentence in the
//      message so the offending entry is obvious.
//
//   2. A snapshot of the short, case-insensitive, SILENTLY APPLIED expansions —
//      the genuinely dangerous class. Adding one trips this test, which forces a
//      deliberate decision rather than letting it arrive as a side effect of a
//      bulk import. The same curated-tripwire pattern the drug licensing list uses.
//
// Neither guard says "never add abbreviations". They say "prove the new one does
// not fire where it should not", which is a question a test can answer and a
// reviewer cannot.

/**
 * Notes already written the way the practice's standard asks for.
 *
 * Deliberately full of the words that short abbreviations collide with —
 * anterior, isolation, months, tolerance, moderate, temporary, implant,
 * impression, calculus — spelled out correctly. Nothing here should change.
 */
const ALREADY_STANDARD: string[] = [
  "The clinician examined the anterior teeth and found no caries.",
  "Calculus covering the cervical third was present on the lower anterior teeth and was removed.",
  "A temporary restoration was cemented and the margins were checked.",
  "An impression was taken and sent to the laboratory.",
  "The implant site healed without complication and the tissue was firm.",
  "Rubber dam isolation was used for the duration of the procedure.",
  "Recall interval set at six months, and the patient agreed to return.",
  "Clinical attachment loss measured 2 mm at the distal of the first molar.",
  "Probing depths ranged from 3 to 5 mm with generalized bleeding on probing.",
  "The patient reported no tolerance for cold liquids on the upper right side.",
  "Extraction of the mandibular left third molar was completed with forceps.",
  "Percussion testing was negative and the tooth responded normally to cold.",
  "Root canal therapy was completed and the access was restored with composite.",
  "Postoperative instructions were reviewed with the patient before discharge.",
  "Blood pressure was recorded before the appointment and medical history reviewed.",
  "Lidocaine with epinephrine was administered as the local anesthetic.",
  "Fluoride varnish was applied to all erupted surfaces.",
  "The treatment plan was discussed and the patient elected to proceed.",
  "Continuing care was scheduled and the patient was given written instructions.",
  "Endodontic treatment was recommended and the patient was referred.",
  // The sentence the bid pattern was written to protect. It must come back
  // unchanged: "a twice daily for the implant case" is the failure it prevents.
  "The laboratory submitted a bid for the implant case."
];

describe("already-correct prose survives the transformer untouched", () => {
  it.each(ALREADY_STANDARD)("changes nothing in: %s", (sentence) => {
    const r = standardize(sentence);
    const substantive = r.applied.filter((a) => a.kind !== "formatting");
    // The message carries the change so a failure names the offending entry.
    expect(
      substantive.map((a) => `${a.kind}: "${a.from}" -> "${a.to}"`).join("; "),
      `an entry fired inside standard prose`
    ).toBe("");
  });

  it("does not bury a correct note under flags either", () => {
    // Over-flagging is the other way this gets switched off. A note that is
    // already right should come back quiet — anything else trains staff to
    // dismiss the queue, and then the flags that matter are dismissed too.
    const noisy = ALREADY_STANDARD.map((s) => [s, standardize(s).flags.length] as const).filter(
      ([, n]) => n > 0
    );
    expect(noisy.map(([s, n]) => `${n} flag(s): ${s}`)).toEqual([]);
  });
});

describe("short, case-insensitive, silently-applied expansions are a curated set", () => {
  // The dangerous class: <= 3 characters, matched in any case, and REWRITTEN
  // without asking. Long abbreviations cannot collide with prose by accident and
  // flagged ones never rewrite, so neither needs a tripwire.
  function riskySilentExpansions(): string[] {
    const out: string[] = [];
    const risky = (display: string, insensitive: boolean) =>
      insensitive &&
      // Written in lower case, i.e. a token staff type as a word rather than as
      // an initialism. "BOP" and "CEJ" are three letters too, and no reader or
      // pattern will ever confuse them with English.
      display === display.toLowerCase() &&
      display.replace(/[^A-Za-z]/g, "").length <= 3;

    for (const a of BANNED_ABBREVIATIONS) {
      if (a.severityClass !== "style") continue;
      if (risky(a.display, a.pattern.flags.includes("i"))) out.push(a.display);
    }
    for (const s of SHORTHAND) {
      if (s.alternatives) continue;
      if (risky(s.display, s.pattern.flags.includes("i"))) out.push(s.display);
    }
    return out.sort();
  }

  it("matches the reviewed list exactly", () => {
    // Adding a short case-insensitive silent expansion FAILS HERE ON PURPOSE.
    // Add it below only after checking it does not fire inside the prose corpus
    // above, and say in one line why the lower-case form is safe.
    expect(riskySilentExpansions()).toEqual([
      "ant", // an insect in English, anterior in every dental note ever written
      "c/o", // not a word
      "dx", // not a word
      "epi", // a prefix, never a standalone word
      "f/u", // not a word
      "fl", // not a word
      "gtt", // not a word; the standard sig abbreviation for drops
      "hx", // not a word
      "iso", // a prefix, never a standalone word
      "mo", // not a word
      "q12h", // a dosing interval; "q12h" is not a word in any language
      "q4h", // as above
      "q6h", // as above
      "q8h", // as above
      "qid", // not a word
      "s/s", // not a word
      "tid", // not a word
      "tol", // not a word
      "tx", // not a word
      "w/", // not a word
      "w/o" // not a word — and the one whose failure mode is an inverted negation
    ]);
  });
});
