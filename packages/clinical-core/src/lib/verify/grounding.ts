// THE FABRICATION GUARD.
//
// The verifier this sits beside was built to catch SUBSTITUTION: a changed dose,
// a swapped drug, a dropped negation. It did that well and it could not see the
// other half of the problem. A red-team probe of fifteen attacks got fifteen
// through, and the ones that mattered were all the same shape — the model did
// not alter anything, it ADDED something:
//
//   "Composite placed on tooth 19."
//     -> "... Occlusion was checked and adjusted. The patient tolerated the
//         procedure well."
//   "Extraction of tooth 17 completed."
//     -> "... Risks and alternatives were discussed and consent was obtained."
//   "Examined the lower arch."
//     -> "... Findings were within normal limits."
//
// Every one passed: no digits changed, no drug named, no negation touched, no
// attribution lost, and the output was LONGER so the shrink guard had nothing to
// say. That is not a gap in the checks, it is a missing category of check. It is
// also the exact failure mode that turns a documentation assistant into a
// liability generator, because each of those sentences is a claim a plaintiff's
// expert would read aloud and no clinician ever made.
//
// So: nothing in the output may assert what the input did not. The tractable
// form of that is lexical grounding — every clinical word the model writes must
// trace back to a word the writer typed, or to the practice's own standard
// vocabulary, or it is an invention.
//
// TWO TIERS, because one threshold cannot serve both jobs:
//
//   Tier 1 names the words whose fabrication is independently unacceptable
//   ("consent", "uneventful", "reviewed"). One is enough to refuse.
//
//   Tier 2 catches whole invented sentences built from words that are individually
//   innocent. It asks what fraction of a sentence's content is grounded, which
//   lets ordinary grammar repair through ("pain x3 days" -> "pain lasting 3
//   days" introduces "lasting" and keeps everything else) while refusing a clause
//   that shares almost nothing with the note.
//
// The asymmetry is deliberate and is the whole thesis. Refusing a good rewrite
// costs a staff member one click and shows them a reason. Accepting a fabricated
// one puts a sentence nobody wrote into a legal and medical record. Those are
// not comparable, so this errs hard toward refusal, and every refusal names the
// specific words that caused it so a false alarm is diagnosable rather than
// mysterious.

import { clauses, stem, stems, words } from "./normalize";
import { LOADED_ASSERTIONS, SYNTACTIC_STEMS, licenseFor } from "./vocabulary";

export interface GroundingVerdict {
  /** Loaded assertions the output introduced. Any one of these refuses. */
  fabricatedAssertions: string[];
  /** Whole clauses whose content is mostly absent from the input. */
  inventedClauses: string[];
}

/**
 * A clause needs this many content words before its grounded FRACTION means
 * anything. Below it, one unrecognised connective would look like an invention:
 * "Tooth 19 restored" has three content words and dropping to two-thirds
 * grounded is noise, not fabrication.
 */
const MIN_CONTENT_WORDS = 3;

/**
 * Below this share of grounded content words, a clause is treated as invented.
 *
 * Tuned against both directions, which is the only honest way to pick it. At
 * 0.5, the legitimate rewrite "The patient reports pain lasting 3 days." scores
 * 4/5 and passes, while the fabricated "The patient tolerated the procedure
 * well." scores 0/3 and fails. The invented clauses a model actually produces
 * are not near this line — they are wholly new sentences, scoring at or near
 * zero — so the threshold is not load-bearing in the way a tighter one would be.
 */
const MIN_GROUNDED_FRACTION = 0.5;

function isGrounded(word: string, inputStems: Set<string>, licensed: ReadonlySet<string>): boolean {
  const s = stem(word);
  return inputStems.has(s) || licensed.has(s);
}

/**
 * What did the output claim that the input did not?
 *
 * Pure, and reported rather than judged: the caller decides what to do with a
 * finding, and the tests below assert on the specific words so a change in
 * behaviour cannot hide inside a boolean.
 */
export function checkGrounding(input: string, output: string): GroundingVerdict {
  const inputStems = stems(input);
  const { licensed } = licenseFor(input);

  const fabricated = new Set<string>();
  for (const w of words(output)) {
    const s = stem(w);
    if (!LOADED_ASSERTIONS.has(s)) continue;
    // `licensed` is per-input: "no known allergies" is available because the
    // writer typed NKA, and unavailable to a note that did not.
    if (inputStems.has(s) || licensed.has(s)) continue;
    fabricated.add(w.toLowerCase());
  }

  const invented: string[] = [];
  for (const clause of clauses(output)) {
    const content = words(clause).filter((w) => {
      const s = stem(w);
      // Grammar is not evidence either way, so it neither grounds a clause nor
      // counts against it. Licensed standard vocabulary is deliberately NOT
      // excluded here: it counts as grounded, which is different, and lets a
      // clause made entirely of legitimate expansions pass on its merits.
      return !SYNTACTIC_STEMS.has(s);
    });
    if (content.length < MIN_CONTENT_WORDS) continue;
    const grounded = content.filter((w) => isGrounded(w, inputStems, licensed)).length;
    if (grounded / content.length < MIN_GROUNDED_FRACTION) invented.push(clause);
  }

  return { fabricatedAssertions: [...fabricated].sort(), inventedClauses: invented };
}

/**
 * Grounding for question output.
 *
 * A question cannot assert, so tier 2 does not apply — "Was the occlusion
 * checked?" is a legitimate thing to ask about a note that never mentions
 * occlusion, and is in fact the entire point of the interrogate capability.
 * Tier 1 still does, narrowly: a question may not NAME a drug, a dose, or a
 * clinical entity the note never contained, because "Was the amoxicillin course
 * completed?" plants amoxicillin in the writer's mind and in the screen they are
 * reading. The question form is not a licence to introduce facts.
 */
export function checkQuestionGrounding(input: string, output: string): string[] {
  const inputStems = stems(input);
  const planted = new Set<string>();
  for (const w of words(output)) {
    const s = stem(w);
    // No licence consulted at all. A drug or a named diagnosis has to be
    // grounded in the note itself, full stop — the practice's standard
    // vocabulary is a licence to reword, never a licence to introduce a clinical
    // entity. Skipping the licence check here is what closed the last surviving
    // red-team attack, and vocabulary.test.ts asserts no rule can ever license a
    // drug name so a future table entry cannot quietly re-open it.
    if (!PLANTABLE_ENTITIES.has(s)) continue;
    if (inputStems.has(s)) continue;
    planted.add(w.toLowerCase());
  }
  return [...planted].sort();
}

/**
 * Entities a QUESTION may not introduce.
 *
 * Narrower than LOADED_ASSERTIONS on purpose: an interrogator's job is to ask
 * about consent and review when they are missing, so those words must be
 * available to it. What it may never do is supply a specific drug, material, or
 * named diagnosis, because that is the model deciding a clinical fact and
 * dressing it as a query.
 */
export const PLANTABLE_ENTITIES: ReadonlySet<string> = new Set(
  [
    // drugs — the same family the interaction screens watch
    "amoxicillin", "penicillin", "clindamycin", "azithromycin", "metronidazole",
    "flagyl", "doxycycline", "clarithromycin", "erythromycin", "fluconazole",
    "chlorhexidine", "ibuprofen", "advil", "motrin", "naproxen", "aleve",
    "acetaminophen", "tylenol", "hydrocodone", "oxycodone", "codeine",
    "tramadol", "warfarin", "coumadin", "prednisone", "dexamethasone",
    "epinephrine", "lidocaine", "articaine", "septocaine", "mepivacaine",
    "bupivacaine", "marcaine", "midazolam", "diazepam", "valium", "triazolam",
    "halcion", "fentanyl", "ketamine", "propofol", "nitrous",
    // named diagnoses a question must not assert into existence
    "pulpitis", "periodontitis", "gingivitis", "pericoronitis", "abscess",
    "caries", "necrosis", "osteonecrosis", "fracture", "malignancy",
    "carcinoma", "leukoplakia", "candidiasis", "cellulitis"
  ].map(stem)
);
