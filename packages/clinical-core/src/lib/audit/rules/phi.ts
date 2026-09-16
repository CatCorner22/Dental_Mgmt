import type { AuditFinding } from "../types";
import { GIVEN_NAMES } from "@/lib/vocab/given-names";
import { NON_ASCII_DIGIT } from "@/lib/text/foldDigits";

// Heuristic prohibited-data screen. It helps; it cannot certify
// de-identification. Drafts stay de-identified by construction (placeholders),
// and identifiers are completed only in the EDR.

interface PhiPattern {
  id: string;
  pattern: RegExp;
  severity: "S0" | "S2";
  message: string;
  /**
   * Which capture group holds THE IDENTIFIER ITSELF. Defaults to 0 (the whole
   * match).
   *
   * This exists because `matchedText` is not just a display string: the Mask
   * identifiers button replaces it by literal substring. A rule whose match
   * spans something other than the identifier therefore masks the wrong text —
   * and worse, clears its own STOP while the identifier stays in the note.
   * `phi.name-label` matched only the words "Patient name:", so one click
   * deleted the label, left the name, and the re-audit reported AUDIT PASS.
   *
   * When the group is present but empty the whole match is used, so a bare
   * "Patient name:" with nothing after it still stops the line.
   */
  captureGroup?: number;
  /**
   * Drop the finding when the captured word is clinical vocabulary rather than
   * a surname.
   *
   * The honorific rule reads "<title> <Capitalized>" as a person, and the
   * ALL-CAPS titles collide head-on with everyday clinical initialisms: MS is
   * morphine sulfate, MR is magnetic resonance, DR is direct radiography. So
   * "MS Contin 15 mg" — a controlled-substance entry — was S0 BLOCKED, and the
   * Mask button rewrote it to "MS [PERSON-XXXX]", destroying the drug name in a
   * legal document while the re-audit reported clean.
   *
   * Checked against the same INSTITUTION_WORDS the bare-name rules already use,
   * so the two halves of this file cannot disagree about what a person is. The
   * lookup happens inside runPhiRule rather than here, which is what lets a
   * `const` declared further down the file be referenced at all.
   */
  suppressClinicalCapture?: boolean;
}

const PHI_PATTERNS: PhiPattern[] = [
  {
    id: "phi.ssn",
    pattern: /\b\d{3}[-.\s]\d{2}[-.\s]\d{4}\b/g,
    severity: "S0",
    message: "This looks like a Social Security number. Remove it. Identifiers belong only in the EDR."
  },
  {
    id: "phi.phone",
    pattern: /(?:\(\d{3}\)\s?|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g,
    severity: "S0",
    message: "This looks like a phone number. Remove it. Contact details belong only in the EDR."
  },
  {
    // Numeric M/D/Y or D/M/Y with real month (1-12) and day (1-31) parts, so
    // a tooth sequence like "14-15-16" (month 14 is impossible) does not read
    // as a date and hard-block a legitimate note. Two-part forms ("3/4 crown",
    // "1/3 apical") are intentionally NOT matched.
    //
    // That reasoning held for HIGH tooth numbers and failed for low ones: the
    // precision corpus blocks on "teeth 12-13-14" and "teeth 2-3-4", which parse
    // as month/day/year perfectly well. Two additions close it without loosening
    // the date catch:
    //
    //   - a hyphenated run must not be preceded by a tooth cue (# or the words
    //     tooth/teeth within a short span), and
    //   - a hyphenated run's final part must be a plausible year — four digits,
    //     or two digits that are not a tooth number (35 and up).
    //
    // Slash-separated dates are untouched: nobody writes a tooth range with
    // slashes, so 3/14/2024 still stops exactly as before.
    id: "phi.date",
    pattern:
      /(?<!(?:#|\btooth|\bteeth)[\s#0-9-]{0,12})\b(?:(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])|(?:0?[1-9]|[12]\d|3[01])[/-](?:0?[1-9]|1[0-2]))[/-](?:\d{4}|[3-9]\d)\b/g,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval (for example, three days ago) and enter exact dates only in the EDR."
  },
  {
    // ISO 8601, e.g. 2026-08-02, and the date part of a timestamp like
    // 2026-08-02T14:30. The trailing lookahead allows a following "T" or time
    // separator (a plain \b fails between "2" and "T", letting EDR timestamps
    // slip through) while still rejecting a run of extra digits.
    id: "phi.date-iso",
    pattern: /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?![\d-])/g,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval and enter exact dates only in the EDR."
  },
  {
    id: "phi.date-name",
    pattern:
      /\b(?:january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval and enter exact dates only in the EDR."
  },
  {
    // "May" is also a modal verb, so this one is case-sensitive and must be
    // followed by a day number that is not a duration ("May 14" vs "may 3 days").
    id: "phi.date-may",
    pattern: /\bMay\s+\d{1,2}(?:st|nd|rd|th)?\b(?!\s*(?:days?|weeks?|months?|years?|hours?|minutes?|mm|cm|ml)\b)/g,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval and enter exact dates only in the EDR."
  },
  {
    // Year first, with either separator: 2026/08/02 and 2026.08.02.
    // phi.date-iso already covers the hyphenated ISO form; these two are what a
    // person types when they are not thinking about ISO at all.
    id: "phi.date-ymd",
    pattern: /\b(?:19|20)\d{2}([/.])(?:0?[1-9]|1[0-2])\1(?:0?[1-9]|[12]\d|3[01])\b/g,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval and enter exact dates only in the EDR."
  },
  {
    // Dot-separated M.D.Y — common in European-influenced charting and in
    // anything pasted out of a spreadsheet.
    //
    // Requires BOTH dots and a real month and day, so "1.5 mm" and a decimal
    // dose cannot match. The year is 2-4 digits like phi.date, so 08.02.26 is
    // caught too.
    id: "phi.date-dotted",
    pattern: /\b(?:0?[1-9]|1[0-2])\.(?:0?[1-9]|[12]\d|3[01])\.\d{2,4}\b/g,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval and enter exact dates only in the EDR."
  },
  {
    // Day first, month spelled out, with a year: "2 August 2026", "2 Aug 2026".
    // phi.date-name is month-first and stops at the day, so this whole shape
    // passed the screen untouched.
    id: "phi.date-day-month",
    pattern:
      /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?,?\s+(?:19|20)?\d{2}\b/gi,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval and enter exact dates only in the EDR."
  },
  {
    // The EHR export format: 02-AUG-2026. Hyphens with a spelled month, which
    // the numeric hyphen rule cannot see and the month-name rule does not reach.
    id: "phi.date-mon-abbrev",
    pattern:
      /\b\d{1,2}-(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*-\d{2,4}\b/gi,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval and enter exact dates only in the EDR."
  },
  {
    id: "phi.email",
    // Quantifiers are bounded (RFC-plausible maximums) so a long run of word
    // characters with no "@" fails fast instead of backtracking quadratically.
    pattern: /\b[\w.+-]{1,64}@[\w-]{1,255}\.[\w.]{1,24}\b/g,
    severity: "S0",
    message: "This looks like an email address. Remove it. Contact details belong only in the EDR."
  },
  {
    // The trailing token must look like an identifier (contains a digit), so
    // ordinary prose such as "the patient's account of the injury" is not a
    // stop. "account"/"acct" additionally require an explicit number cue.
    // Separator class widened from [:#] to also accept "-" and "=", which the
    // rule's own advertised format ("MRN: 4471902") differs from only by
    // punctuation — "MRN - 4471902" was passing clean. "chart"/"record" no
    // longer demand the word "number", and "patient id" is recognised, because
    // a bare "Chart 4471902" is as much a record link as any other spelling.
    //
    // The separator is one character class rather than `\s*[:#]?\s*`: the old
    // shape was ambiguous and backtracked quadratically on a long run of
    // spaces followed by a long run of letters.
    id: "phi.mrn",
    // Two alternatives, because the QUALIFIER is the evidence.
    //
    // "chart" and "record" had an optional qualifier, so a bare "chart" plus
    // any digit matched — and "Perio chart 4/5/4 on the mesial" is ordinary
    // periodontal charting, not a record number. That S0 hard-blocked a
    // legitimate perio note, the same cry-wolf failure as "MS Contin" one rule
    // over.
    //
    // With an explicit qualifier ("chart no. 12345", "MRN 4483920", "patient
    // id ABC-123") the cue carries the signal and any following token counts.
    // Bare "chart 4483920" still matches, but now the NUMBER has to look like a
    // record number — four or more digits — because nothing else in the phrase
    // says it is one. Perio numbers are one or two digits; MRNs are not.
    pattern:
      /\b(?:(?:mrn|medical record|patient\s*id|(?:chart|record)\s*(?:no\.?|number|#)|(?:account|acct)\s*(?:no\.?|number|#))[\s:#=-]*(?=[\w-]*\d)[\w-]+|(?:chart|record)\b[\s:#=-]*(?=[\w-]*\d{4})[\w-]+)/gi,
    severity: "S0",
    message: "This looks like a record or account number. Remove it. Record links belong only in the EDR."
  },
  {
    // The honorific announces the name; the CAPTURE is the name, so masking
    // removes the identifier and leaves "Dr. [PERSON-XXXX]" reading sensibly.
    //
    // The old pattern was `[A-Z][a-z]+`, which stopped dead at an internal
    // capital: "Dr. McDonald" matched only "Dr. Mc", so masking produced
    // "[PERSON-XXXX]Donald" — a recoverable surname — and cleared the S0.
    // "Dr. O'Brien" matched nothing at all, even though the bare-name rule
    // below has always handled Mc/Mac/O' surnames. The strict S0 rule was the
    // weaker of the two, because no test ever put an honorific in front of one.
    //
    // The honorific is spelled in both cases rather than using the /i flag:
    // with /i the name class would match lowercase too and "Dr. the patient"
    // would read as a name. ALL CAPS matters because that is how an EHR header
    // pastes in — "DR. SMITH" was previously invisible.
    id: "phi.name",
    pattern:
      /\b(?:Mr|Mrs|Ms|Miss|Dr|Doctor|MR|MRS|MS|MISS|DR|DOCTOR)\.?\s+((?:Mc|Mac|O['’]|D['’])?[A-Z][A-Za-z'’]{0,24}(?:-[A-Z][A-Za-z'’]{0,24})?)\b/g,
    captureGroup: 1,
    suppressClinicalCapture: true,
    severity: "S0",
    message:
      "This looks like a person's name. Use a role instead (for example, the treating dentist, the referring provider)."
  },
  {
    // Capture what FOLLOWS the label, because that is the identifier. The rule
    // used to match "Patient name:" alone, so the mask button deleted the
    // label and left the patient's name in a note that then audited clean.
    id: "phi.name-label",
    pattern: /\b(?:patient|guardian|parent)\s+name\s*[:=]\s*([^\n,;.|]{0,60})/gi,
    captureGroup: 1,
    severity: "S0",
    message: "Do not enter names. Identity belongs only in the EDR."
  },
  {
    // Exactly nine digits is the unpunctuated Social Security format — but the
    // claim that "no clinical measurement uses it" was too strong, and the
    // precision corpus caught it twice. An implant fixture lot number and an
    // intraoral scanner serial are both nine digits, both belong in the record,
    // and both used to hard-block copying and filing until someone signed a PHI
    // attestation to say the lot number was not a Social Security number.
    //
    // So the stop now needs a CUE. It stays S0, because where the cue is present
    // the reading is not ambiguous; it simply no longer treats every nine-digit
    // run in dentistry as an identifier. An uncued nine-digit run is still
    // reported by phi.long-number's sibling logic at review severity rather than
    // vanishing.
    id: "phi.ssn-bare",
    pattern:
      /\b(?:ssn|s\.s\.n|social\s+security(?:\s+(?:number|no|#))?|tax\s*id(?:entification)?(?:\s+number)?|identifier|member(?:ship)?(?:\s+(?:number|no|id))?|subscriber|policy(?:\s+(?:number|no))?|account(?:\s+(?:number|no))?)\b\s*[:#=-]?\s*(\d{9})\b/gi,
    captureGroup: 1,
    severity: "S0",
    message:
      "This looks like an unpunctuated Social Security number. Remove it. Identifiers belong only in the EDR."
  },
  {
    id: "phi.long-number",
    pattern: /\b\d{10,}\b/g,
    severity: "S2",
    message:
      "This long number could be an identifier. A clinician confirms it is a clinical value, not an identifier."
  },
  // -------------------------------------------------------------------------
  // Obfuscation: the screen cannot read the number, so it cannot screen it
  // -------------------------------------------------------------------------
  //
  // Every pattern above is written with `\d`, which in JavaScript matches ASCII
  // 0-9 and nothing else. So a phone number typed in fullwidth digits
  // (８６５-５５５-１２３４) or Arabic-Indic ones (١٢٣-٤٥-٦٧٨٩) reads identically to a
  // human, arrives identically in the email, and is completely invisible to
  // phi.phone and phi.ssn. The same is true of a zero-width space dropped
  // between two digits: "865​-555-1234" defeats every \b-anchored rule in this
  // file, and the Mask button then has nothing to mask.
  //
  // Rather than teach eleven patterns about Unicode — a fight this codebase has
  // already lost once and written down about, in isValidPhiAttestation — invert
  // the test. A clinical record written by this practice contains ASCII digits
  // and visible characters. Anything else is a defect in its own right: it is
  // unverifiable by the screen, it renders inconsistently in whatever system
  // reads the note next, and it is the standard way hidden text is smuggled
  // through a copy-paste. So the OBFUSCATION is the finding, and there is no
  // need to work out what it was hiding.
  //
  // S0 rather than S1: the remedy is one press of Standardize, whose whitespace
  // pass already removes exactly these characters, and a PHI stop is waivable
  // with a named attestation for the rare case where a paste is innocent.
  {
    id: "phi.obfuscated-digits",
    // Anchored AT the non-ASCII digit, and that is a performance requirement
    // rather than a stylistic choice. The natural way to write "a digit run
    // containing at least one non-ASCII digit" is `\p{Nd}*(?![0-9])\p{Nd}\p{Nd}*`,
    // whose leading `\p{Nd}*` consumes to the end of a digit run and then
    // backtracks through every remaining position looking for a non-ASCII digit
    // that never arrives — once per start position. Quadratic. Measured on a run
    // of plain ASCII digits: 1.8 ms at 1,000, 28 ms at 4,000, 445 ms at 16,000,
    // and 6.5 SECONDS at 64,000, on a rule that runs inside the per-keystroke
    // audit. performance.test.ts exists to forbid exactly that and its digit case
    // has dashes in it, so the run never got long enough to show.
    //
    // Anchoring here is linear: an ASCII digit fails the lookahead in constant
    // time and the scan moves on. The cost is that the match begins at the first
    // non-ASCII digit rather than at the start of the run, so "12٣45" reports
    // "٣45" — which is the right trade, because the finding is the obfuscation
    // and Standardize folds the whole run either way.
    pattern: NON_ASCII_DIGIT,
    severity: "S0",
    message:
      "This number is written in non-ASCII digits, so the privacy screen cannot read it and " +
      "another system may render it differently. Press Standardize to convert it, then check the number."
  },
  {
    id: "phi.hidden-characters",
    // The same class normalizeWhitespace() strips, detected rather than removed
    // so nothing silently rewrites a legal record: soft hyphen, bidi marks and
    // isolates, zero-width spaces and joiners, variation selectors, interlinear
    // annotation, and the TAG block that encodes arbitrary ASCII invisibly.
    pattern:
      /[\u00AD\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFE00-\uFE0F\uFEFF\uFFF9-\uFFFB]+|[\u{E0000}-\u{E007F}]+/gu,
    severity: "S0",
    message:
      "This text contains invisible characters. They hide content from the privacy screen and from " +
      "anyone reading the note. Press Standardize to remove them, then check the text still says what you meant."
  }
];

// ---------------------------------------------------------------------------
// Bare names — the gap the honorific rule left open
// ---------------------------------------------------------------------------
//
// phi.name catches "Dr. Smith" because the honorific announces the name.
// "John Smith presented for a recall" announced nothing, and passed the whole
// screen clean — the largest hole in a tool whose premise is that no patient
// identity ever enters it.
//
// The only deterministic signal available without an honorific is that "John"
// is overwhelmingly a person's name. So: a capitalized pair whose FIRST word
// is a common given name is flagged for review. A capitalized pair alone is
// not — clinical prose is full of them ("Angle Class", "Epworth Sleepiness",
// "Fort Sanders") and a screen that flags those gets muted, which costs more
// than it gains.
//
// S2 REVIEW, not S0 STOP, on purpose. The definite formats (SSN, phone,
// email, dates) earn a hard stop because they are almost never anything else.
// A name heuristic is a heuristic: "Grace Miller" is a patient, and "Bradley
// County" is where the health department is. The institution lookahead below
// removes the worst of that class, and what remains surfaces for a human
// instead of blocking the line on a guess.

// Second-word vocabulary that marks the pair as a PLACE or ORGANIZATION, not a
// person: "Christian Dental Clinic", "Bradley County", "Holly Springs". A
// Korean-style surname such as "Park" is deliberately not protected from this
// list — a screen, not a certification, and the header of this file says so.
const INSTITUTION_WORDS = new Set([
  "county", "dental", "dentistry", "clinic", "hospital", "health", "medical",
  "university", "college", "center", "centre", "pharmacy", "laboratory",
  "lab", "imaging", "radiology", "orthodontics", "periodontics",
  "endodontics", "oral", "family", "associates", "group", "practice",
  "office", "care", "springs", "street", "avenue", "road", "drive", "lane",
  "boulevard", "pike", "highway",
  // Dental supply houses whose names read exactly like a person's. "Henry
  // Schein" on a materials line is the single likeliest false positive in a
  // real note, and a flag on the supplier teaches staff to dismiss the flag.
  "schein", "patterson", "benco", "darby", "ultradent", "dentsply",
  // Dental structures and chart references. Nobody is surnamed "Tooth" or
  // "Molar", and this domain capitalizes them constantly — "Mark Tooth 14 for
  // extraction" is an imperative sentence, not a patient called Mark Tooth.
  // Sentence-initial position is what makes this class possible at all: the
  // first word's capital carries no information there, so a given name that is
  // also an ordinary verb ("mark", "bill", "max", "don") reads as a name.
  "tooth", "teeth", "crown", "bridge", "implant", "quadrant", "arch", "class",
  "grade", "canal", "molar", "premolar", "incisor", "canine", "cusp",
  "surface", "site", "sextant", "denture", "veneer", "onlay", "inlay",
  // ALL-CAPS dental charting is full of two-word phrases whose first word is
  // also a given name: "IAN BLOCK" (inferior alveolar nerve block), "MAX LEFT
  // QUADRANT", "X-RAY SERIES", "Grace Period" on a billing note. Flagging
  // those is the cry-wolf failure this file's own header calls worse than no
  // screen — and it is worse than that here, because the Mask button acts on
  // S2 findings too, so one click rewrote the anaesthesia record of a legal
  // document and the re-audit called the result AUDIT PASS.
  "block", "series", "taken", "left", "right", "upper", "lower", "anterior",
  "posterior", "buccal", "lingual", "mesial", "distal", "occlusal", "period",
  "exam", "recall", "prophy", "scaled", "given", "administered", "completed",
  "placed", "prep", "noted", "assessed", "carpules", "carpule",
  // The ALL-CAPS collisions that were still live, each reproduced from a real
  // note before being added here. "IAN INJECTION" is the inferior alveolar
  // nerve; "FRANK PUS" is a clinical adjective for frank suppuration; "MAX
  // CENTRAL" is the maxillary central incisor. In every case the FIRST word is
  // genuinely a given name (Ian, Frank, Max), which is exactly why the pair
  // rule fires and exactly why the second word has to be the one that decides.
  "injection", "pus", "central", "lateral", "nerve", "root", "pulp", "apex",
  // Product names the honorific rule reads as surnames, because the ALL-CAPS
  // titles MS, MR and DR are also clinical initialisms. "MS Contin" is
  // morphine sulfate extended-release; "DR Sensor" is a direct-radiography
  // sensor. Sourced from real product vocabulary, not invented to pass a test.
  "contin", "sensor"
]);

// Words that ANNOUNCE a name, so the name after them needs no capital to be
// worth flagging. This is the difference between a guess and evidence.
// The cue is a LOOKBEHIND, and that is the whole trick — the same one the
// surname lookahead below uses, for the same reason.
//
// Consuming the cue meant one cue could swallow the next. On "referred to dr.
// john smith" the alternation matched "referred to", captured "dr" as the given
// name, failed the dictionary check, and `matchAll` resumed PAST the real name.
// "seen by dr. john smith" failed identically. Two cues stacked is the ordinary
// way a referral is written, and the name between them was never examined by
// this rule — while phi.name missed it too, because that rule needs a capital
// after the honorific. Two rules, one gap, and a real name walked between them.
//
// Matching zero-width means the scan re-enters at every position, so a chained
// cue cannot hide the name behind it.
const NAME_CUE =
  /(?<=\b(?:patients?|pts?|guardians?|parents?|mother|father|caregiver|seen\s+by|referred\s+(?:to|by)|spoke\s+with|treated\s+by|assisted\s+by|dr\.?|doctor|dentist|hygienist|assistant)\s+)([A-Za-z][A-Za-z'’-]{1,20})((?:\s+(?:[A-Za-z]\.\s+)?[A-Za-z][A-Za-z'’-]{1,24}(?:-[A-Za-z][A-Za-z'’-]{1,24})?)?)/gi;

// "John Smith", "Karen McDonald", "Mary O'Brien", "Robert Smith-Jones",
// "John Q. Smith".
//
// The surname is a LOOKAHEAD, and that is the whole trick. Matching it
// normally consumed both words, so on "Patient John Smith" the regex matched
// "Patient John", the dictionary rejected it, and `matchAll` resumed AFTER
// "John" — the real name was never examined. "Patient/Pt <Name>" is the
// commonest way a name enters a clinical note, so the rule missed the case it
// exists for while passing its own tests, which never put a capitalized word
// in front of the name. Consuming only the given name lets the scan re-enter
// on the next word and catch it.
//
// The whitespace is captured rather than assumed so `matchedText` is the
// EXACT source text: the masking pass replaces by literal substring, and a
// normalized "John Smith" would silently fail to replace a "John  Smith" that
// really had two spaces, leaving the identifier in the note.
// The `(?<![-\w])` guard is why "X-Ray Series" is not a patient called Ray.
// `\b` fires after a hyphen, so the given name "ray" matched inside "X-Ray",
// and masking then rewrote the radiograph line to "X-[PERSON-XXXX]".
const NAME_PAIR =
  /(?<![-\w])([A-Z][a-z]{1,20})(\s+(?:[A-Z]\.\s+)?)(?=((?:Mc|Mac|O['’]|D['’])?[A-Z][a-z]{1,24}(?:-[A-Z][a-z]{1,24})?)\b)/g;

// The same pair in ALL CAPS — how an EHR chart header usually pastes in.
const NAME_PAIR_CAPS = /(?<![-\w])([A-Z]{2,20})(\s+(?:[A-Z]\.\s+)?)(?=([A-Z][A-Z'’-]{1,24})\b)/g;

// Chart-header order: "Smith, John" and "SMITH, JOHN". High signal — prose
// rarely puts a capitalized word, a comma, and a given name in a row for any
// other reason. `\s*` because a CSV or EHR paste often has no space.
const NAME_COMMA =
  /\b((?:Mc|Mac|O['’]|D['’])?[A-Z][a-zA-Z]{1,24}),(\s*)([A-Z][a-zA-Z]{1,20})\b/g;

const BARE_NAME_MESSAGE =
  "This may be a person's name. The tool cannot be sure — if it is a person, use a role instead (the patient, the referring provider); if it is a product, place, or term of art, a clinician confirms that.";

function pushCounted(
  findings: AuditFinding[],
  seen: Map<string, number>,
  ruleId: string,
  message: string
): void {
  for (const [matched, count] of seen) {
    findings.push({
      ruleId,
      category: "phi",
      severity: "S2",
      message,
      matchedText: matched,
      occurrences: count
    });
  }
}

function runBareNameRules(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Title case and ALL CAPS share the filter; only the regex differs. The
  // surname arrives in the lookahead group (index 3), so the matched text is
  // rebuilt from the given name + the real whitespace + the surname.
  const pairSeen = new Map<string, number>();
  for (const re of [NAME_PAIR, NAME_PAIR_CAPS]) {
    for (const m of text.matchAll(re)) {
      const [given, gap, surname] = [m[1], m[2], m[3]];
      if (!GIVEN_NAMES.has(given.toLowerCase())) continue;
      if (INSTITUTION_WORDS.has(surname.toLowerCase())) continue;
      const matched = given + gap + surname;
      pairSeen.set(matched, (pairSeen.get(matched) ?? 0) + 1);
    }
  }
  pushCounted(findings, pairSeen, "phi.name-bare", BARE_NAME_MESSAGE);

  const commaSeen = new Map<string, number>();
  for (const m of text.matchAll(NAME_COMMA)) {
    const [surname, gap, given] = [m[1], m[2], m[3]];
    if (!GIVEN_NAMES.has(given.toLowerCase())) continue;
    if (INSTITUTION_WORDS.has(surname.toLowerCase())) continue;
    const matched = `${surname},${gap}${given}`;
    commaSeen.set(matched, (commaSeen.get(matched) ?? 0) + 1);
  }
  pushCounted(
    findings,
    commaSeen,
    "phi.name-comma",
    "This reads like a chart-header name (surname, given name). " + BARE_NAME_MESSAGE
  );

  // Cued names, in ANY case.
  //
  // The rules above all require a capital letter, and clinicians type fast and
  // lowercase: "patient john smith presented" was invisible to the entire
  // screen. That was not merely a missed flag. The Mask identifiers button
  // replaces exactly what the screen matched, so a name it cannot see is a
  // name masking silently leaves behind — the clinician clicks Mask, the
  // phone number and "John Smith" disappear, "patient john smith" stays, and
  // the note now LOOKS redacted. A remediation that quietly does half the job
  // is worse than none, because it converts a visible problem into an
  // invisible one.
  //
  // A cue word supplies the evidence that capitalization otherwise would, so
  // no capital is required after one. The cue itself is NOT part of
  // matchedText: "patient" is not an identifier, and masking it away would
  // damage the sentence for no privacy gain.
  const cuedSeen = new Map<string, number>();
  for (const m of text.matchAll(NAME_CUE)) {
    // Group indices moved down by one when the cue became a lookbehind: the
    // cue and its whitespace are no longer captured, because they are no
    // longer consumed.
    const given = m[1];
    const trailing = m[2] ?? "";
    if (!GIVEN_NAMES.has(given.toLowerCase())) continue;
    // The institution filter has to apply here too. Without it "Referred to
    // Christian Dental Clinic" reads as a patient — the cue announces a name,
    // and "Christian" is one, but the word after it says the referral went to
    // an organization. Caught by the existing cry-wolf test before this
    // shipped, which is the test doing exactly its job.
    const nextWord = trailing.trim().split(/[\s.]+/)[0]?.toLowerCase() ?? "";
    if (nextWord && INSTITUTION_WORDS.has(nextWord)) continue;
    const matched = given + trailing;
    // Skip anything the capitalized rules already reported, so one name is one
    // finding rather than two rows saying the same thing.
    if (pairSeen.has(matched) || commaSeen.has(matched)) continue;
    cuedSeen.set(matched, (cuedSeen.get(matched) ?? 0) + 1);
  }
  pushCounted(
    findings,
    cuedSeen,
    "phi.name-cued",
    "A name follows a word that announces one. " + BARE_NAME_MESSAGE
  );

  return findings;
}

export function runPhiRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const p of PHI_PATTERNS) {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(p.pattern)) {
      // The identifier, not the whole match — see PhiPattern.captureGroup. A
      // present-but-empty group falls back to the full match so a bare
      // "Patient name:" prompt still stops the line.
      const captured = p.captureGroup ? m[p.captureGroup]?.trim() : "";
      const identifier = captured && captured.length > 0 ? captured : m[0];
      // See PhiPattern.suppressClinicalCapture: "MS Contin" is a drug, not a
      // person, and blocking it costs more than the flag was ever worth.
      if (p.suppressClinicalCapture && INSTITUTION_WORDS.has(identifier.toLowerCase())) continue;
      seen.set(identifier, (seen.get(identifier) ?? 0) + 1);
    }
    for (const [matched, count] of seen) {
      findings.push({
        ruleId: p.id,
        category: "phi",
        severity: p.severity,
        message: p.message,
        matchedText: matched,
        occurrences: count
      });
    }
  }
  findings.push(...runBareNameRules(text));
  return findings;
}
