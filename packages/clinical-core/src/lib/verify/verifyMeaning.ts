// THE MEANING VERIFIER: the deterministic gate every AI-proposed rewrite must
// pass before a human is even shown it.
//
// The trust model is "the model proposes, the rails dispose". A language model
// is allowed to rewrite wording, reorder sentences, and tighten prose — the
// things regex cannot do — precisely BECAUSE this module rejects any output
// that differs from the input in clinical substance. The checks are the
// runtime form of the invariants meaning.test.ts pins for the deterministic
// pass: if a property matters enough to test, it matters enough to enforce on
// text a model wrote.
//
// Every rejection is typed and loud. A silent fallback would teach users that
// the AI "sometimes does nothing"; a stated rejection teaches them the tool
// checks its own work — which is the entire reason to trust it.

import { canonical, clauses, stem, words } from "./normalize";
import { checkGrounding, checkQuestionGrounding } from "./grounding";
import { licenseFor } from "./vocabulary";

export interface VerifyRejection {
  code:
    | "digits-changed"
    | "negation-changed"
    // The negation MULTISET can match while the meaning inverts: "No swelling;
    // tenderness present" and "Swelling present; no tenderness" both contain
    // exactly one "no". This is what each negation actually applies to.
    | "negation-scope-changed"
    | "teeth-changed"
    | "units-changed"
    | "drugs-changed"
    | "attribution-dropped"
    // The opposite direction, and not symmetric with dropping: adding an
    // attribution demotes a clinician's own finding to something the patient
    // merely said.
    | "attribution-added"
    | "content-shrunk"
    | "not-questions"
    // Laterality and anatomical direction. Wrong-site is an S0 STOP everywhere
    // else in this application and the verifier could not see it at all.
    | "site-changed"
    | "surfaces-changed"
    // The fabrication guard: the model added a claim rather than altering one.
    | "content-invented"
    // Empty output, a markdown fence, or a chat preamble wrapped round the note.
    | "output-degenerate"
    // From main, and kept alongside content-invented rather than merged into it.
    // The two guards catch different shapes of the same harm: mine asks whether a
    // CLAUSE is grounded, which misses a single procedure noun swapped inside an
    // otherwise faithful sentence ("crown" becoming "bridge"); this diffs a fixed
    // list of diagnoses, procedures and outcome verbs, which catches exactly that
    // and nothing about clause structure. Belt and braces on the one property that
    // matters most, at the cost of one extra rejection code.
    | "claims-added";
  detail: string;
}

export interface VerifyResult {
  ok: boolean;
  rejections: VerifyRejection[];
}

// Sorted multiset compare: order may legitimately change (a restructure moves
// sentences), values may not.
function multiset(tokens: string[]): string {
  return tokens
    .map((t) => t.toLowerCase())
    .sort()
    .join("|");
}

/**
 * Drop tokens a licensed standardization could have introduced or consumed.
 *
 * The reason every one of these comparisons needs it, stated once: they compare
 * the input's tokens against the output's, and expanding shorthand legitimately
 * changes both sides. "UL" carries no site token; "upper left quadrant" carries
 * three. "epi" is not a drug to the drug regex; "epinephrine" is. A raw multiset
 * compare therefore reported the transformer's own correct output as a changed
 * site and a changed drug — and it did so on FOUR of five realistic rewrites,
 * which is how a safety feature turns into a feature nobody can use.
 *
 * `noise` is per-input and covers both halves of every standardization the note
 * actually triggers, so nothing is forgiven that the note did not license. An
 * unlicensed change still fails: "lower left" to "lower right" survives this
 * filter intact, because no shorthand in the note licenses either word.
 */
function neutralize(tokens: string[], noise: ReadonlySet<string>): string[] {
  return tokens.filter((t) => !noise.has(stem(t.toLowerCase())));
}

// EVERY extractor below reads canonical() text, never the raw string.
//
// Before that was true, three red-team attacks walked through on Unicode alone:
// a dose fabricated as "٥٠٠ mg" and a tooth number as "１９" both left the digit
// check comparing an empty list against an empty list, because \d is ASCII-only.
// Folding once, here, is what stops every check needing its own opinion about
// Unicode — see normalize.ts.
function digits(text: string): string[] {
  return canonical(text).match(/\d+(?:\.\d+)?/g) ?? [];
}

const NEGATION = /\b(?:no|not|never|denies|denied|without|non|none|nothing|negative|absent|free\s+of|unable)\b/gi;

function negations(text: string): string[] {
  return canonical(text).match(NEGATION) ?? [];
}

/**
 * What each negation actually applies to.
 *
 * The multiset check above compares HOW MANY negations there are, which a model
 * can preserve while inverting the note: "No swelling; tenderness present"
 * becomes "Swelling present; no tenderness" with the same single "no" and the
 * same zero digits. Both statements cannot be true and the verifier had no
 * opinion.
 *
 * So pair each negation with the content of the clause it sits in, as a sorted
 * set. A set rather than a sequence because reordering inside a clause is
 * legitimate — "no pain or swelling" and "no swelling or pain" say the same
 * thing — while moving the negation onto a different finding is not.
 *
 * This also closes the short-note hole in the shrink guard for free: dropping
 * three items from "denies pain, swelling, numbness and fever" changes what
 * "denies" covers, whatever the word count does.
 */
function negationScopes(text: string, noise: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const clause of clauses(text)) {
    if (!NEGATION.test(clause)) {
      NEGATION.lastIndex = 0;
      continue;
    }
    NEGATION.lastIndex = 0;
    const negs = clause.match(NEGATION) ?? [];
    // `noise` covers grammar AND both sides of every standardization the input
    // licenses. Expanding "NKA" to "no known allergies" genuinely changes what
    // the word "no" sits beside, and without that allowance this check would
    // report the transformer's own correct output as an inverted negation.
    //
    // BOUNDED TO THE NEGATED HEAD, not the whole clause, and main's evaluation set
    // is why. Comparing whole-clause content refused "No bleeding was observed."
    // becoming "No bleeding was observed at the site." — a locative added inside a
    // negated clause, which is tightening wording rather than inverting anything.
    // A negation attaches to what it negates, so a two-word window is both more
    // principled and less brittle. Every attack this check exists for still fails:
    // moving "no" from swelling onto tenderness changes the window, and shortening
    // a list of denials changes it too (and is caught by the shrink guard besides).
    const content = words(clause)
      .map(stem)
      .filter((s) => !noise.has(s));
    const NEGATED_HEAD_WINDOW = 2;
    for (const n of negs) {
      const at = content.indexOf(stem(n.toLowerCase()));
      const scope = content
        .slice(at + 1, at + 1 + NEGATED_HEAD_WINDOW)
        .sort()
        .join(",");
      out.push(`${n.toLowerCase()}:${scope}`);
    }
  }
  return out;
}

/**
 * Laterality and anatomical direction.
 *
 * The verifier could not see a wrong-site rewrite at all: "lower left first
 * molar" to "lower right first molar" changed no digit, no drug, no negation and
 * no tooth letter. Wrong-site is an S0 STOP everywhere else in this application,
 * which made this the largest single inconsistency between what the audit
 * enforces on a human and what the verifier enforced on a model.
 */
const SITE =
  /\b(?:left|right|upper|lower|maxillary|mandibular|mesial|distal|buccal|lingual|facial|labial|palatal|occlusal|incisal|apical|coronal|cervical|anterior|posterior|superior|inferior|proximal|midline|bilateral|unilateral|ipsilateral|contralateral|quadrant|sextant|arch)\b/gi;

function sites(text: string): string[] {
  return canonical(text).match(SITE) ?? [];
}

/**
 * Surface designators in a tooth or restoration context.
 *
 * "MOD composite on tooth 3" to "MO composite on tooth 3" documents a smaller
 * restoration on the same tooth — a billing fact and a treatment fact, invisible
 * to every other check here. Matched only as an all-caps run of surface letters
 * so ordinary words are not mistaken for codes.
 */
function surfaceCodes(text: string): string[] {
  const out: string[] = [];
  for (const m of canonical(text).matchAll(/\b([MODBFLIP]{2,5})\b/g)) {
    // Sorted, because MOD and DOM name the same surfaces.
    out.push([...m[1]].sort().join(""));
  }
  return out;
}

// Tooth designators: "#19", "tooth 19", "teeth 1, 16", and primary letters in
// a tooth context. Bare numbers are already covered by the digit check; this
// adds the letter designators a digit check cannot see.
function toothLetters(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b(?:tooth|teeth)\s+((?:[A-T](?:\s*,\s*|\s+and\s+|\s*))+)/gi)) {
    for (const letter of m[1].match(/[A-T]/g) ?? []) out.push(letter.toUpperCase());
  }
  return out;
}

const UNIT = /\b(?:mg|mcg|µg|kg|g|mL|ml|L|mm|cm|carpules?|units?|%)\b|%/gi;

// canonical(), like every other extractor here. Reading raw text meant a glued
// "400mg" carried no unit at all, so a rewrite that correctly separated it to
// "400 mg" looked like a measurement appearing out of nowhere.
function units(text: string): string[] {
  return canonical(text).match(UNIT) ?? [];
}

// Drug tokens: the same lexicon family the interaction screens watch, plus
// the common dental prescriptions. A model output that gains or loses one of
// these has changed the clinical record, whatever else it kept.
const DRUG =
  /\b(?:amoxicillin|penicillin|clindamycin|azithromycin|metronidazole|flagyl|doxycycline|clarithromycin|erythromycin|fluconazole|miconazole|ketoconazole|itraconazole|nystatin|chlorhexidine|ibuprofen|advil|motrin|naproxen|aleve|diclofenac|ketorolac|toradol|acetaminophen|tylenol|hydrocodone|oxycodone|codeine|tramadol|warfarin|coumadin|dabigatran|rivaroxaban|apixaban|lithium|methotrexate|propranolol|nadolol|timolol|simvastatin|atorvastatin|lovastatin|prednisone|dexamethasone|epinephrine|lidocaine|articaine|septocaine|mepivacaine|bupivacaine|marcaine|midazolam|diazepam|valium|triazolam|halcion|fentanyl|ketamine|propofol|nitrous)\b/gi;

function drugs(text: string): string[] {
  return canonical(text).match(DRUG) ?? [];
}

// Attribution markers: "patient reports/states/denies", "per patient",
// "parent reports". Dropping one converts a reported statement into an
// asserted clinical fact — the exact promotion the TN scope rules forbid.
// `pt` is in the alternation because it is what staff actually type — the
// shorthand table's own entry for "patient" — and leaving it out made the
// verifier reject its own transformer's correct output: expanding "Pt states
// pain" to "The patient states pain" read as an attribution appearing out of
// nowhere, because the input's attribution was invisible to this regex.
const ATTRIBUTION =
  /\b(?:pt|patient|parent|guardian|caregiver)\s+(?:reports?|states?|stated|denies|denied|describes?|says?|complains?\s+of|c\/o)\b|\bper\s+(?:the\s+)?(?:pt|patient|parent|guardian)\b|\bexternal\s+record\s+states?\b/gi;

function attributions(text: string): string[] {
  return canonical(text).match(ATTRIBUTION) ?? [];
}

/**
 * The content that sits inside an attributed clause.
 *
 * A plain count cannot express the rule. "Patient reports pain and swelling"
 * legitimately becomes "The patient reports pain. The patient reports swelling."
 * — the VOICE prompt asks for one idea per sentence — and that doubles the count
 * while attributing exactly the same two findings. Meanwhile the harm being
 * guarded is not arithmetic at all: it is a clause that nobody attributed
 * ACQUIRING an attribution, which moves professional accountability for a
 * finding off the examiner and onto the person in the chair.
 *
 * So compare WHAT is attributed, not how often.
 */
function attributedContent(
  text: string,
  attributed: boolean,
  noise: ReadonlySet<string>
): Set<string> {
  const out = new Set<string>();
  for (const clause of clauses(text)) {
    ATTRIBUTION.lastIndex = 0;
    const hasAttribution = ATTRIBUTION.test(clause);
    ATTRIBUTION.lastIndex = 0;
    if (hasAttribution !== attributed) continue;
    for (const w of words(clause)) {
      const s = stem(w);
      if (!noise.has(s)) out.add(s);
    }
  }
  return out;
}

/**
 * Output that is not a note at all.
 *
 * Three separate red-team results collapse into one check. An empty string
 * passed every value comparison, because an empty note changes no digit and
 * names no drug — and on a short input the shrink guard did not run, so the
 * service would have handed a staff member a successful, blank result. A
 * markdown fence and a "Here is the rewritten note:" preamble passed for the
 * same reason, and both end up pasted into a clinical record.
 *
 * Refused rather than stripped. Stripping guesses at which part the model meant
 * as the note, and a guess about the content of a legal record is not a thing
 * this codebase does.
 */
function degenerate(output: string, mode: "rewrite" | "questions"): string | null {
  const text = canonical(output).trim();
  // An EMPTY answer is the honest one for a complete note: the interrogator has
  // nothing to ask, and main's structured list path expresses that as an empty
  // array. Refusing it turned "this note is fine" into an error, which is both
  // wrong and the most discouraging possible response to good work. Caught by
  // main's evaluation set, which is exactly what an eval set is for.
  if (text.length === 0) {
    return mode === "questions" ? null : "The model returned nothing.";
  }
  if (/```|~~~/.test(text)) return "The model wrapped the note in a code fence.";
  if (
    /^(?:here(?:'s| is)\b|sure\b|certainly\b|of course\b|i(?:'ve| have)\b|below is\b|the (?:rewritten|revised|updated|following)\b)/i.test(
      text
    )
  ) {
    return "The model added conversational preamble instead of returning only the note.";
  }
  return null;
}

// Clinical claim tokens: diagnoses, procedures, and outcome verbs a rewrite must
// not invent. From main. Digits and drugs catch numeric and prescription
// hallucinations; this catches "examined" becoming "extracted" with no number
// changing anywhere.
const CLINICAL_CLAIM =
  /\b(?:caries|decay|pulpitis|abscess|periodontitis|gingivitis|periapical|radiolucency|fracture|fractured|extracted|extraction|extirpation|obturation|pulpotomy|pulpectomy|crown|bridge|implant|veneer|onlay|inlay|sealant|scaling|planing|curettage|osteotomy|biopsy|sutured|suture|incision|drainage|referral|referred|diagnosis|diagnosed|irreversible|necrosis|perforat(?:ed|ion)|separated\s+instrument|file\s+separation)\b/gi;

function clinicalClaims(text: string): string[] {
  return canonical(text).match(CLINICAL_CLAIM) ?? [];
}

export interface VerifyOptions {
  /**
   * "rewrite": full content-preservation contract (normalize, restructure).
   * "questions": output must contain no clinical assertions at all — every
   * substantive line ends in a question mark (interrogate, conflicts).
   */
  mode: "rewrite" | "questions";
}

/**
 * Lines a question capability is allowed to emit that are not questions.
 *
 * The prompts instruct the model to return exactly these when it has nothing to
 * ask. Without an explicit exemption, tightening the declarative check below
 * would refuse the model's own correct "nothing to report" answer.
 */
const QUESTION_SENTINELS = new Set([
  "no open questions.",
  "no contradictions found.",
  "no conflicts found.",
  "none."
]);

export function verifyMeaning(input: string, output: string, opts: VerifyOptions): VerifyResult {
  const rejections: VerifyRejection[] = [];

  const degeneracy = degenerate(output, opts.mode);
  if (degeneracy) {
    // Returned immediately: every check below compares two notes, and there is
    // no second note to compare.
    return { ok: false, rejections: [{ code: "output-degenerate", detail: degeneracy }] };
  }

  if (opts.mode === "questions") {
    // A question engine must never assert.
    const lines = canonical(output)
      .split("\n")
      .map((l) => l.replace(/^[\s\-*\d.)]+/, "").trim())
      .filter((l) => l.length > 0);
    // NO LENGTH THRESHOLD. This used to exempt anything under 60 characters,
    // which meant "Tooth 19 is abscessed." — twenty-two characters, a diagnosis
    // the note never contained, asserted by a model — was accepted as a
    // question. A short assertion is not a lesser assertion. Headings are the
    // one thing genuinely allowed to be short and declarative, so the test is
    // now "does it contain a verb-bearing clause", approximated by requiring
    // whitespace and no question mark.
    const declarative = lines.filter(
      (l) =>
        !/\?$/.test(l) &&
        // Main's form, which is STRICTER than the one this replaced: any
        // non-question line fails, with no whitespace or letter-count heuristic
        // to slip a short recommendation through. A question engine's output ends
        // in a question mark or it is a sentinel; there is no third case, and the
        // heuristic was a loophole waiting to be found.
        !QUESTION_SENTINELS.has(l.toLowerCase())
    );
    if (declarative.length > 0) {
      rejections.push({
        code: "not-questions",
        detail: `A question list may not assert: "${declarative[0].slice(0, 80)}"`
      });
    }
    // Questions must not smuggle in new numbers either — "was the dose
    // 500 mg?" plants a value the note never contained.
    const inDigits = new Set(digits(input));
    const newDigits = digits(output).filter((d) => !inDigits.has(d));
    if (newDigits.length > 0) {
      rejections.push({
        code: "digits-changed",
        detail: `A question introduced a number the note never contained: ${newDigits[0]}`
      });
    }
    // Nor a drug, material, or named diagnosis. Asking "Was the amoxicillin
    // course completed?" about a note that never mentioned amoxicillin is the
    // model deciding a clinical fact and dressing it as a query.
    const planted = checkQuestionGrounding(input, output);
    if (planted.length > 0) {
      rejections.push({
        code: "content-invented",
        detail: `A question named something the note never contained: ${planted.join(", ")}`
      });
    }
    return { ok: rejections.length === 0, rejections };
  }

  const { noise } = licenseFor(input);

  if (multiset(digits(input)) !== multiset(digits(output))) {
    rejections.push({
      code: "digits-changed",
      detail: `Input numbers [${digits(input).join(", ")}] != output numbers [${digits(output).join(", ")}]`
    });
  }

  if (multiset(negations(input)) !== multiset(negations(output))) {
    rejections.push({
      code: "negation-changed",
      detail: `Negation tokens changed: [${negations(input).join(", ")}] -> [${negations(output).join(", ")}]`
    });
  }

  if (multiset(toothLetters(input)) !== multiset(toothLetters(output))) {
    rejections.push({
      code: "teeth-changed",
      detail: "Primary-tooth letter designators changed."
    });
  }

  if (multiset(neutralize(units(input), noise)) !== multiset(neutralize(units(output), noise))) {
    rejections.push({
      code: "units-changed",
      detail: `Measurement units changed: [${units(input).join(", ")}] -> [${units(output).join(", ")}]`
    });
  }

  // A drug may be introduced ONLY by an explicit shorthand the note contains —
  // "epi" licenses "epinephrine". It is never licensed by a spelling correction,
  // because the practice's own rule is that a medication typo waits for a
  // clinician; vocabulary.test.ts asserts that separation holds.
  if (multiset(neutralize(drugs(input), noise)) !== multiset(neutralize(drugs(output), noise))) {
    rejections.push({
      code: "drugs-changed",
      detail: `Drug mentions changed: [${drugs(input).join(", ")}] -> [${drugs(output).join(", ")}]`
    });
  }

  if (multiset(neutralize(sites(input), noise)) !== multiset(neutralize(sites(output), noise))) {
    rejections.push({
      code: "site-changed",
      detail: `Laterality or anatomical site changed: [${sites(input).join(", ")}] -> [${sites(output).join(", ")}]`
    });
  }

  if (multiset(neutralize(surfaceCodes(input), noise)) !== multiset(neutralize(surfaceCodes(output), noise))) {
    rejections.push({
      code: "surfaces-changed",
      detail: "Surface designators changed — the documented restoration is not the one performed."
    });
  }

  if (multiset(negationScopes(input, noise)) !== multiset(negationScopes(output, noise))) {
    rejections.push({
      code: "negation-scope-changed",
      detail:
        "A negation moved onto a different finding — the note now denies something else, or denies less."
    });
  }

  // Attributions may be REWORDED but not reduced in count: "pt states" may
  // become "patient states", never disappear.
  if (attributions(output).length < attributions(input).length) {
    rejections.push({
      code: "attribution-dropped",
      detail:
        "A reported statement lost its attribution — a patient report must never become an asserted fact."
    });
  }

  // And nothing UNATTRIBUTED may acquire an attribution, which is not the same
  // rule in reverse. Dropping an attribution promotes hearsay to a clinical
  // finding; adding one demotes a clinician's own finding to something the
  // patient merely said. A radiolucency the dentist read off a radiograph must
  // not become "patient reports a periapical radiolucency" — that rewrites who
  // is professionally accountable for the finding, and it is the direction that
  // quietly empties a note of its evidence.
  // The test is narrow on purpose: content the input stated in an UNATTRIBUTED
  // clause, now sitting inside an attributed one. Comparing attributed word sets
  // wholesale was too literal — expanding "pain x3 days" to "pain lasting 3
  // days" adds "lasting" inside an already-attributed clause and asserts nothing
  // — and subtracting what was already attributed is what keeps a note that
  // legitimately mentions the same finding in both voices from tripping it.
  const wasAttributed = attributedContent(input, true, noise);
  const wasAsserted = attributedContent(input, false, noise);
  const nowAttributed = [...attributedContent(output, true, noise)].filter(
    (s) => wasAsserted.has(s) && !wasAttributed.has(s)
  );
  if (nowAttributed.length > 0) {
    rejections.push({
      code: "attribution-added",
      detail:
        `A finding your note asserted directly is now written as something the patient said ` +
        `(${nowAttributed.slice(0, 4).join(", ")}). An examiner's own finding must stay the examiner's.`
    });
  }

  // Content-shrink guard: a rewrite that returns much less text has dropped
  // clauses, and a dropped clause in a clinical note is a dropped fact.
  //
  // The floor used to be `inWords >= 10`, which exempted every short note from
  // the check entirely — and short notes are where a dropped clause hides best.
  // Now the check always runs; the fraction is simply more forgiving for very
  // short inputs, where one added connective moves the ratio a long way.
  const inWords = words(input).length;
  const outWords = words(output).length;
  const floor = inWords >= 10 ? 0.6 : 0.5;
  if (inWords > 0 && outWords < inWords * floor) {
    rejections.push({
      code: "content-shrunk",
      detail: `Output has ${outWords} words for ${inWords} input words — content was dropped, not standardized.`
    });
  }

  // THE FABRICATION GUARD. Everything above asks whether a value was altered;
  // this asks whether a claim was invented, which is the failure mode that
  // actually makes a language model dangerous on a clinical record.
  const grounding = checkGrounding(input, output);
  if (grounding.fabricatedAssertions.length > 0) {
    rejections.push({
      code: "content-invented",
      detail:
        `The draft asserts something your note does not say: ` +
        `${grounding.fabricatedAssertions.join(", ")}. A missing fact is asked about, never supplied.`
    });
  }
  if (grounding.inventedClauses.length > 0) {
    rejections.push({
      code: "content-invented",
      detail: `The draft added a statement that is not in your note: "${grounding.inventedClauses[0].slice(0, 100)}"`
    });
  }

  // Main's claim diff, routed through the STANDARDIZATION LICENCE, which is the
  // whole reason the two guards can coexist without one wrecking the other.
  //
  // As a raw set difference it refuses legitimate work: "SSC" expands to
  // "stainless steel crown", which introduces the claim token "crown" that the
  // input never literally contained, and the first-use convention does that on
  // purpose. Measured acceptance on realistic rewrites was 5 of 5 before this
  // check existed, and a raw diff would have cost some of that — which is the
  // failure mode this branch spent a long time climbing out of.
  //
  // Licence-aware, it keeps the coverage it was written for (a procedure noun
  // swapped inside an otherwise faithful sentence) and drops the false alarms.
  const inClaims = new Set(clinicalClaims(input).map((c) => c.toLowerCase()));
  const addedClaims = [
    ...new Set(
      clinicalClaims(output)
        .map((c) => c.toLowerCase())
        .filter((c) => !inClaims.has(c) && !noise.has(stem(c)))
    )
  ];
  if (addedClaims.length > 0) {
    rejections.push({
      code: "claims-added",
      detail: `The draft names a diagnosis or procedure your note does not: ${addedClaims.join(", ")}.`
    });
  }

  return { ok: rejections.length === 0, rejections };
}
