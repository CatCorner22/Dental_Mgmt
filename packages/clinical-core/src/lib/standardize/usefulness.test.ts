import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";
import { verifyMeaning } from "@/lib/verify/verifyMeaning";

// THE USEFULNESS SUITE.
//
// Every other test in this repository asks whether the transformer is SAFE. This
// one asks whether it WORKS, and it exists because the answer was measured and it
// was no.
//
// The whole point of this application is to be a useful notes tool. A transformer
// that refuses everything is not a cautious transformer, it is a broken feature
// that staff switch off in week one — at which point every safety property in
// here protects nothing, because nothing is running. Safety and usefulness are
// not a trade-off to be balanced; below a certain usefulness the safety is
// theoretical.
//
// The numbers that prompted this file, measured on the notes below:
//
//   deterministic pass:  16 substantive changes across 8 notes (~2 per note),
//                        walking past c/o, w/, mh, bp, epi, lido, ant, iso,
//                        perc, imp, temp, mod, cal, tp, cx and more.
//   AI verifier:         0 of 5 faithful rewrites accepted. ZERO. The normalize
//                        capability was dead on arrival for every real note.
//
// Both had one root cause — the vocabulary tables did not contain the shorthand
// staff actually type — and one fix. The tables are what the deterministic pass
// applies AND what licenses the model's expansions, so filling them repaired both
// transformers at once.
//
// These notes are the contract. If a future change to the rails drops the numbers
// below the floors asserted here, that change has broken the product, and this
// file is where it gets caught rather than in a practice.

/** Notes as staff actually type them: lowercase, shorthand, run-on, mid-shift. */
const NOTES: Record<string, string> = {
  endoEmergency:
    "pt c/o pain ul quad x3 days. no swelling. took ibuprofen 400mg q6h prn. perc + on #14. pa taken shows periapical radiolucency. dx irreversible pulpitis. plan rct #14, referred to endo.",
  recallProphy:
    "recall pt, no changes to mh. bp 118/76. prophy completed, mod calculus lower ant. bwx taken, no new caries. ohi given, reappoint 6mo.",
  restorative:
    "tooth #3 mod composite. 1 carpule 4% septocaine w/ epi. rubber dam iso. occlusion checked w/ articulating paper. pt tol well. poi given.",
  perio:
    "srp ur quad. pd 4-6mm w/ bop generalized. cal 2mm. ohi reviewed, recommend cx 3mo. pt states brushing bid, flossing occasionally.",
  extraction:
    "ext #17 w/ forceps. 2 carpules lido w/ epi. hemostasis achieved w/ pressure. no complications. poi and rx ibuprofen 600mg given. f/u prn.",
  peds:
    "5yo pt for exam. teeth a-t present, mixed dentition. sealants placed on t and s. fl varnish applied. parent states child brushes qd. nka.",
  crownPrep:
    "crown prep #19, pfm. shade a2. imp taken w/ pvs. temp cemented w/ tempbond. margins checked. pt advised no hard foods.",
  limitedExam:
    "pt c/o sensitivity lr. no perc pain. cold + on #30, resolves quickly. dx reversible pulpitis. plan monitor, desensitizing tp recommended."
};

/**
 * Everything the writer gets back that they can act on.
 *
 * Expansions AND flags, because a flag is help too: "mod is ambiguous — say
 * whether you mean moderate or the MOD surfaces" is worth more to a note than
 * another mechanical substitution, and counting only rewrites undervalues exactly
 * the cases where guessing would be dangerous. Formatting is excluded because it
 * happens on every note and would make the number meaningless.
 */
function actionable(note: string): number {
  const r = standardize(note);
  return r.applied.filter((a) => a.kind !== "formatting").length + r.flags.length;
}

describe("the deterministic pass earns its place on a real note", () => {
  it("gives the writer at least three things to act on, on every one of them", () => {
    // Not a vanity metric. Below about three, a staff member reads the itemised
    // list, sees "pt -> patient", and concludes the button does nothing. That is
    // what the measurement found before this work: a median of two, both trivial.
    const thin = Object.entries(NOTES)
      .map(([label, note]) => [label, actionable(note)] as const)
      .filter(([, n]) => n < 3);
    expect(thin).toEqual([]);
  });

  it("expands the shorthand staff type in lower case, not only in capitals", () => {
    // Every one of these was walked past before. Staff type between patients and
    // they do not reach for the shift key.
    const out = standardize(NOTES.endoEmergency).text;
    expect(out).toContain("complains of"); // c/o
    expect(out).toContain("Patient"); // pt
    expect(out).toContain("Diagnosis"); // dx
    expect(out).toContain("root canal therapy (RCT)"); // rct, first-use convention

    const rest = standardize(NOTES.restorative).text;
    expect(rest).toContain("with epinephrine"); // w/ + epi
    expect(rest).toContain("isolation"); // iso
    expect(rest).toContain("tolerated"); // tol

    const perioOut = standardize(NOTES.recallProphy).text;
    expect(perioOut).toContain("medical history"); // mh
    expect(perioOut).toContain("Blood pressure"); // bp
    expect(perioOut).toContain("anterior"); // ant
  });

  it("never turns w/o into 'with o' — that would invert a clinical statement", () => {
    // The one entry in this batch whose failure mode is a falsified record rather
    // than an unexpanded abbreviation.
    const out = standardize("no swelling w/o pressure. tx completed w/ care.").text;
    expect(out).toContain("without pressure");
    expect(out).not.toMatch(/with o\b/);
    expect(out).toContain("with care");
  });

  it("asks rather than guesses when the shorthand has two real readings", () => {
    // "mod" is "moderate" AND the mesial-occlusal-distal surfaces, and the
    // measured notes used it in both senses. One is an observation, the other is a
    // billed site. Expanding it either way would put a claim in the record the
    // writer did not make, so the tool flags and leaves the text alone.
    const r = standardize(NOTES.restorative);
    expect(r.flags.map((f) => f.display)).toContain("mod");
    expect(r.text).toContain("mod composite");

    const perioR = standardize(NOTES.perio);
    const flagged = perioR.flags.map((f) => f.display);
    expect(flagged).toContain("cal"); // calculus vs clinical attachment loss
    expect(flagged).toContain("cx"); // continuing care vs cancelled vs complications
  });

  it("never corrects a medication name on its own authority", () => {
    // The boundary that does not move, whatever else this file asks for.
    const r = standardize("Dispensed amoxicilin 500 mg.");
    expect(r.text).toContain("amoxicilin");
    expect(r.flags.some((f) => f.kind === "medication-spelling")).toBe(true);
  });
});

// What a competent model returns for `normalize`: wording only, every fact
// preserved, shorthand written out, and the ambiguous shorthand LEFT ALONE
// because the tool refuses to guess it and so should the model.
const REWRITES: Record<keyof typeof NOTES, string> = {
  endoEmergency:
    "The patient complains of pain in the upper left quadrant lasting 3 days. No swelling. The patient took ibuprofen 400 mg every 6 hours as needed. Perc + on tooth 14. A periapical radiograph shows a periapical radiolucency. Diagnosis: irreversible pulpitis. Plan: root canal therapy on tooth 14, referred to endo.",
  recallProphy:
    "Recall patient with no changes to medical history. Blood pressure 118/76. Prophylaxis completed. Moderate calculus on the lower anterior teeth. Bitewing radiographs taken, with no new caries. Oral hygiene instructions given. Reappoint in 6 months.",
  restorative:
    "Tooth 3 received a mod composite. One carpule of 4% Septocaine with epinephrine. Rubber dam isolation. Occlusion checked with articulating paper. The patient tolerated it well. Postoperative instructions given.",
  perio:
    "Scaling and root planing in the upper right quadrant. Probing depths 4-6 mm with generalized bleeding on probing. Cal 2 mm. Oral hygiene instructions reviewed. Recommend cx in 3 months. The patient states brushing twice daily and flossing occasionally.",
  extraction:
    "Extraction of tooth 17 with forceps. 2 carpules of lidocaine with epinephrine. Hemostasis achieved with pressure. No complications. Postoperative instructions given and a prescription for ibuprofen 600 mg. Follow up as needed.",
  peds: "",
  crownPrep: "",
  limitedExam: ""
};

describe("the verifier accepts the rewrites the feature exists to produce", () => {
  const cases = (Object.keys(REWRITES) as (keyof typeof NOTES)[]).filter(
    (k) => REWRITES[k].length > 0
  );

  it.each(cases)("accepts a faithful rewrite of the %s note", (key) => {
    const verdict = verifyMeaning(NOTES[key], REWRITES[key], { mode: "rewrite" });
    // The detail is in the message on purpose: a failure here has to say WHICH
    // check refused, or the next person just loosens the first one they find.
    expect(
      verdict.rejections.map((r) => `${r.code}: ${r.detail}`).join("\n"),
      `refused a faithful rewrite of ${key}`
    ).toBe("");
    expect(verdict.ok).toBe(true);
  });

  it("still refuses the same rewrite once one fact is altered", () => {
    // Proof that the acceptances above are the checks working rather than the
    // checks being switched off. Same text, one changed dose.
    const tampered = REWRITES.extraction.replace("600 mg", "800 mg");
    expect(verifyMeaning(NOTES.extraction, tampered, { mode: "rewrite" }).ok).toBe(false);
  });

  it("still refuses the same rewrite once a claim is added", () => {
    const padded = `${REWRITES.perio} Risks and alternatives were discussed and consent was obtained.`;
    const verdict = verifyMeaning(NOTES.perio, padded, { mode: "rewrite" });
    expect(verdict.rejections.map((r) => r.code)).toContain("content-invented");
  });

  it("still refuses the same rewrite once the site moves", () => {
    const wrongSite = REWRITES.perio.replace("upper right", "upper left");
    expect(verifyMeaning(NOTES.perio, wrongSite, { mode: "rewrite" }).ok).toBe(false);
  });
});
