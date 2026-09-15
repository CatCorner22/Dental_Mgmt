// THE CLEAN CORPUS: notes that are correct, against which any block is a defect.
//
// Every other corpus in this repository is made of BROKEN notes. The persona
// notes in src/lib/training/ are defective by construction and answer "does the
// promised rule fire". SHORTHAND_CORPUS in src/lib/extract/ is deliberately
// telegraphic — "Pt c/o pain UR quad", "irrev pulpitis" — because it exists to
// measure what the parser can survive. Neither can answer the question this file
// exists for, which is the one that decides whether staff keep reading the audit
// panel at all:
//
//   How often does the tool stop a note that was already fine?
//
// That number was never measured. Clean-note testing exists and is taken
// seriously — phi-names.test.ts says its false-positive suite is "the longer one
// on purpose" — but every case is a hand-picked string with a boolean assertion.
// There was no denominator, so there was no rate, so there was nothing to hold.
//
// WHY THIS MATTERS MORE THAN CATCHING EVERYTHING. A false stop is not a small
// cost paid for thoroughness. It is the mechanism by which the audit stops
// working: a clinician blocked on a correct note learns the panel is noise, and
// after that it can catch every defect in the ruleset and change nothing,
// because nobody is reading it. Recall degrades gracefully. Precision does not.
//
// HOW THESE NOTES ARE WRITTEN. Expanded, standard vocabulary, complete — the way
// this tool asks people to write. They are not tidy in the sense of being easy;
// each one is deliberately loaded with the specific hazards that break the
// riskiest rules, because a corpus of bland notes would score perfectly and mean
// nothing. The `hazards` tag is what the anti-vacuity test asserts against, so
// the corpus cannot be quietly narrowed until it passes.
//
// NO REAL PATIENT CONTENT. Every note is synthetic and written for this file.
// No names, no dates, no identifiers — it is committed to the repository and
// must be safe for anyone who can read the repository to read.

/**
 * The linguistic traps a correct clinical note legitimately contains.
 *
 * Each names a real collision between ordinary dental writing and a rule's
 * pattern, found by reading the rules rather than imagined.
 */
export type Hazard =
  /** Proper nouns that are classification systems, not people: "Angle Class II". */
  | "eponym"
  /** Organizations whose names contain given names: county health departments. */
  | "institution"
  /** Suppliers with person-shaped names: "Henry Schein", "Patterson Dental". */
  | "vendor"
  /** Ordinary words that are also given names: mark, bill, grace, frank, ray. */
  | "given-name-word"
  /** Anatomy and procedures that read as slurs: buccal fat pad, gross debridement. */
  | "anatomy-word"
  /** Tooth ranges that parse as dates: "#12-13-14" is month 12, day 13, year 14. */
  | "tooth-run"
  /** Nine-digit lot and serial numbers that look like a social security number. */
  | "long-number"
  /** Doses and units whose arithmetic must reconcile. */
  | "measurement"
  /** Drug names near enough to a lexicon entry to attract a close match. */
  | "drug-name"
  /** Divider runs and pasted whitespace that read as keyboard mash. */
  | "punctuation"
  /** Bur, file, and blade numbers introduced by "#", which reads as a tooth. */
  | "instrument-number"
  /** A drug interaction the clinician identified and documented avoiding. */
  | "interaction-handled";

export interface CleanNote {
  id: string;
  noteType: string;
  /**
   * Written to be correct. Any BLOCKING finding (S0 or S1) on this text is a
   * false positive by definition — that is the whole contract of this file.
   */
  text: string;
  hazards: Hazard[];
  /** Why this note is in the corpus, for whoever is reading a failure. */
  why: string;
}

export const CLEAN_CORPUS: readonly CleanNote[] = [
  {
    id: "gross-debridement",
    noteType: "periodontal",
    text:
      "Full mouth gross debridement completed today. Heavy supragingival calculus present on " +
      "the mandibular anterior lingual surfaces. Ultrasonic scaler used throughout. Patient " +
      "tolerated the appointment well. Oral hygiene instruction given, including interdental " +
      "brush technique. Return in four weeks for reevaluation and definitive scaling.",
    hazards: ["anatomy-word"],
    why: "\"Gross debridement\" is the literal American Dental Association D4355 description."
  },
  {
    id: "buccal-fat-pad",
    noteType: "surgical",
    text:
      "Surgical exposure of the maxillary left quadrant performed. The buccal fat pad was " +
      "encountered and retracted without herniation. Primary closure achieved with resorbable " +
      "suture. Hemostasis confirmed before the patient was dismissed. Postoperative " +
      "instructions given in writing and reviewed aloud. Return in ten days for suture check.",
    hazards: ["anatomy-word"],
    why: "The buccal fat pad is an anatomical structure; bare \"fat\" reads as a slur to the tone rule."
  },
  {
    id: "lying-supine",
    noteType: "restorative",
    text:
      "Patient positioned lying supine for the duration of the restorative appointment. " +
      "Composite restoration placed on tooth 30, occlusal surface. Rubber dam isolation used. " +
      "Shade selected in natural light before isolation. Occlusion checked and adjusted with " +
      "articulating paper. Patient reported no discomfort on dismissal.",
    hazards: ["anatomy-word"],
    why: "\"Lying supine\" is standard positioning language; the tone rule reads it as dishonesty."
  },
  {
    id: "lesion-lies-distal",
    noteType: "diagnostic",
    text:
      "Radiographic interpretation: a well circumscribed radiolucency lies distal to tooth 14, " +
      "approximately four millimeters in greatest dimension. Borders are corticated. No root " +
      "resorption of the adjacent teeth is evident. Recommend a periapical radiograph in six " +
      "months to confirm stability. Findings discussed with the patient, who agreed to monitor.",
    hazards: ["anatomy-word", "measurement"],
    why: "\"Lies distal\" is positional description, not an accusation."
  },
  {
    id: "angle-class-two",
    noteType: "orthodontic",
    text:
      "Orthodontic assessment completed. The patient presents with an Angle Class II division " +
      "one malocclusion, with an overjet of six millimeters. Molar relationship is Class II " +
      "bilaterally. Midlines are coincident. Panoramic radiograph shows all third molars " +
      "present and unerupted. Referral to an orthodontist discussed and the patient accepted.",
    hazards: ["eponym", "measurement"],
    why: "Angle is a classification eponym, not a person in the record."
  },
  {
    id: "stillman-cleft",
    noteType: "periodontal",
    text:
      "Periodontal examination completed. A Stillman cleft is present on the facial gingiva of " +
      "tooth 6. Probing depths range from two to three millimeters throughout, with no bleeding " +
      "on probing. Recession of one millimeter noted at tooth 6. Brushing technique reviewed, " +
      "with emphasis on reducing lateral pressure. Return in six months.",
    hazards: ["eponym", "measurement"],
    why: "A second eponym, so the hazard is not carried by a single note."
  },
  {
    id: "county-health-department",
    noteType: "administrative",
    text:
      "Records requested from the Bradley County Health Department for continuity of care. " +
      "The patient signed a release authorizing the request. No clinical treatment was rendered " +
      "at this visit. The patient was seen for consultation only and left with a written summary " +
      "of the recommended treatment sequence.",
    hazards: ["institution"],
    why: "Institution names contain capitalized words the name heuristics can read as people."
  },
  {
    id: "regional-medical-center",
    noteType: "referral",
    text:
      "Patient referred to the oral and maxillofacial surgery department at Grace Regional " +
      "Medical Center for evaluation of the impacted mandibular third molars. The referral " +
      "reason, the alternatives, and the option of no treatment were discussed. The patient " +
      "agreed to proceed with the consultation and understood that no date has been arranged.",
    hazards: ["institution", "given-name-word"],
    why: "\"Grace\" is on the curated given-name list and here it is an institution."
  },
  {
    id: "vendor-schein",
    noteType: "materials",
    text:
      "Restorative materials for this appointment were supplied by Henry Schein. The composite " +
      "shade guide was verified against the manufacturer reference before shade selection. " +
      "Bonding agent applied per the manufacturer instructions for use. No material substitution " +
      "was made during the appointment.",
    hazards: ["vendor"],
    why: "\"Henry Schein\" is a supplier; the name heuristic has been patched for it before."
  },
  {
    id: "vendor-patterson",
    noteType: "materials",
    text:
      "Handpiece serviced under the Patterson Dental maintenance agreement before the morning " +
      "session. Sterilization logs reviewed and current. Biological indicator result from the " +
      "most recent cycle was negative. No treatment delay resulted.",
    hazards: ["vendor"],
    why: "A second vendor with a person-shaped name."
  },
  {
    id: "mark-the-midline",
    noteType: "prosthodontic",
    text:
      "Complete denture try in appointment. Used the wax rim to mark the midline, the high lip " +
      "line, and the canine position. Vertical dimension assessed at rest and in occlusion. The " +
      "patient approved the tooth arrangement and the shade. Proceeding to processing. Return " +
      "in two weeks for insertion.",
    hazards: ["given-name-word"],
    why: "\"Mark\" here is a verb and is also on the curated given-name list."
  },
  {
    id: "bill-the-patient",
    noteType: "administrative",
    text:
      "Treatment plan presented and accepted. The front desk will bill the patient's primary " +
      "insurance first and the secondary policy afterward. The patient understood the estimate " +
      "is not a guarantee of coverage. No clinical treatment was rendered at this visit.",
    hazards: ["given-name-word"],
    why: "\"Bill\" as a verb, again a curated given name."
  },
  {
    id: "frank-purulence",
    noteType: "endodontic",
    text:
      "Emergency examination. Frank purulence expressed on palpation of the buccal vestibule " +
      "adjacent to tooth 19. Tooth 19 is tender to percussion and does not respond to cold " +
      "testing. Diagnosis is pulpal necrosis with acute apical abscess. Incision and drainage " +
      "performed. The patient was advised to return tomorrow for reassessment.",
    hazards: ["given-name-word", "anatomy-word"],
    why: "\"Frank\" as a clinical adjective; the PHI rules already carry a patch for this collision."
  },
  {
    id: "ray-of-the-arch",
    noteType: "diagnostic",
    text:
      "Panoramic radiograph reviewed. The right posterior ray of the mandibular arch shows no " +
      "periapical pathology. Condylar heads appear symmetric and well seated. Maxillary sinus " +
      "floors are intact bilaterally. No fractures identified. Interpretation discussed with " +
      "the patient at the chair.",
    hazards: ["given-name-word"],
    why: "\"Ray\" is an anatomical term here and also sits on the curated given-name list."
  },
  {
    id: "tooth-run-low",
    noteType: "restorative",
    text:
      "Restorative treatment planned for teeth 12-13-14 in a single appointment. Each tooth " +
      "requires a two surface composite restoration on the occlusal and mesial surfaces. " +
      "Sequence discussed with the patient, who elected to complete all three at one visit. " +
      "No treatment was rendered today.",
    hazards: ["tooth-run"],
    why: "12-13-14 parses as month 12, day 13, year 14 and hard blocks as a date."
  },
  {
    id: "tooth-run-second",
    noteType: "periodontal",
    text:
      "Scaling and root planing completed in the maxillary right quadrant, teeth 2-3-4. Probing " +
      "depths before treatment ranged from five to six millimeters with bleeding on probing at " +
      "every site. Local anesthesia given. Patient tolerated the appointment. Reevaluation in " +
      "six weeks to confirm tissue response.",
    hazards: ["tooth-run", "measurement"],
    why: "A second low tooth run, so the date collision is not carried by one note."
  },
  {
    id: "implant-lot-number",
    noteType: "surgical",
    text:
      "Implant placed in the site of tooth 30. The fixture lot number 483920174 was recorded " +
      "from the packaging and the sticker retained in the paper chart. Torque achieved at " +
      "thirty five newton centimeters. Cover screw placed and the flap closed primarily. " +
      "Radiograph taken to confirm seating.",
    hazards: ["long-number", "measurement"],
    why: "A nine digit lot number matches the bare social security number pattern exactly."
  },
  {
    id: "device-serial",
    noteType: "equipment",
    text:
      "Intraoral scanner serial 209418773 returned to service after calibration. Verification " +
      "scan performed against the reference model with no deviation beyond tolerance. No patient " +
      "treatment was affected. Log retained with the equipment records.",
    hazards: ["long-number"],
    why: "A second nine digit run that is not an identifier."
  },
  {
    id: "anesthetic-reconciled",
    noteType: "restorative",
    text:
      "Local anesthesia administered: 1.8 milliliters of lidocaine two percent with epinephrine " +
      "1:100,000, delivering thirty six milligrams of lidocaine. Inferior alveolar nerve block " +
      "technique used. Profound anesthesia confirmed before beginning. Composite restoration " +
      "placed on tooth 19, occlusal surface. Patient tolerated the appointment well.",
    hazards: ["measurement", "drug-name"],
    why: "The dose arithmetic reconciles; the medication safety rules must not fire."
  },
  {
    id: "articaine-reconciled",
    noteType: "surgical",
    text:
      "Local anesthesia administered: 3.4 milliliters of articaine four percent with epinephrine " +
      "1:200,000, delivering one hundred thirty six milligrams of articaine. Buccal infiltration " +
      "technique used. Extraction of tooth 1 completed without complication. Hemostasis achieved " +
      "with pressure. Postoperative instructions given in writing.",
    hazards: ["measurement", "drug-name"],
    why: "A second reconciling dose with a drug name close to lexicon neighbours."
  },
  {
    id: "prescription-complete",
    noteType: "pharmacologic",
    text:
      "Prescription given: amoxicillin five hundred milligrams, one capsule three times daily " +
      "for seven days, twenty one capsules dispensed. The patient confirmed no penicillin " +
      "allergy. Instructed to complete the full course. Advised to contact the practice if a " +
      "rash or swelling develops.",
    hazards: ["drug-name", "measurement"],
    why: "A complete prescription; duration and quantity are both stated."
  },
  {
    id: "chlorhexidine-rinse",
    noteType: "periodontal",
    text:
      "Prescription given: chlorhexidine gluconate 0.12 percent oral rinse, fifteen milliliters " +
      "twice daily for fourteen days. The patient was told to expect temporary staining and " +
      "altered taste. Instructed not to rinse with water immediately afterward. Return in two " +
      "weeks for reevaluation.",
    hazards: ["drug-name", "measurement"],
    why: "A second drug name with a decimal concentration."
  },
  {
    id: "divider-run",
    noteType: "hygiene",
    text:
      "Adult prophylaxis completed.\n" +
      "------\n" +
      "Four bitewing radiographs taken and interpreted: no interproximal caries identified. " +
      "Periodontal probing depths two to three millimeters throughout with no bleeding on " +
      "probing. Fluoride varnish applied. Oral hygiene instruction given with flossing " +
      "demonstration. Return in six months.",
    hazards: ["punctuation"],
    why: "A divider run of six hyphens matches the repeated character mash pattern."
  },
  {
    id: "pasted-whitespace",
    noteType: "consultation",
    text:
      "Consultation summary. Treatment options presented: no treatment,      extraction, or " +
      "root canal therapy followed by a crown. Risks and expected outcomes of each were " +
      "described. The patient asked about cost and timing. The patient elected to defer the " +
      "decision and will telephone the practice. No treatment rendered.",
    hazards: ["punctuation"],
    why:
      "A run of spaces surviving a paste from another document. Meaningless, but not filler — " +
      "blocking a correct note over invisible whitespace is a stop nobody can act on."
  },
  // A soft-hyphen paste note lived here and was REMOVED rather than fixed, which
  // is worth recording because the usual direction is the opposite. It tripped
  // phi.hidden-characters at S0, and on reflection the rule is right: an
  // invisible character sitting inside a word in a legal record is a real defect,
  // and the remedy (retype the word) is available to the writer. The note was
  // never clean; keeping it would have pressured a correct rule to loosen.
  //
  // The general danger is the reverse move — editing a corpus note to make a red
  // test green, which quietly redefines "clean" as "whatever the tool accepts"
  // and makes this whole file measure nothing. The rule here: a note may only be
  // changed when it can be justified against how the practice asks people to
  // write, never merely because a rule objected to it.
  {
    id: "instrument-bur-number",
    noteType: "restorative",
    text:
      "Caries excavated with a #557 carbide bur under rubber dam isolation. Remaining dentin " +
      "assessed as firm on tactile examination. Composite restoration placed on tooth 30, " +
      "occlusal surface. Occlusion checked and adjusted. Patient tolerated the appointment.",
    hazards: ["instrument-number"],
    why:
      "A bur is named by its ISO number and \"#\" is how a dental note writes one. No tooth " +
      "557 is being claimed, and #557 is among the commonest tokens in a restorative note."
  },
  {
    id: "instrument-file-number",
    noteType: "endodontic",
    text:
      "Canal negotiated and access refined with a #245 bur, then shaped with rotary " +
      "instruments to working length. Irrigation with sodium hypochlorite throughout. Calcium " +
      "hydroxide placed and the access sealed with a temporary restoration. Return in two " +
      "weeks for obturation of tooth 19.",
    hazards: ["instrument-number"],
    why:
      "A second instrument number above the permanent tooth range, so the collision is not " +
      "carried by one note."
  },
  {
    id: "interaction-handled",
    noteType: "pharmacologic",
    text:
      "Medical history reviewed. Patient takes apixaban for atrial fibrillation. No " +
      "nonsteroidal anti-inflammatory drugs advised; acetaminophen one thousand milligrams " +
      "every six hours as needed was recommended instead. The reason was explained to the " +
      "patient, who understood. Extraction of tooth 4 completed with local pressure for " +
      "hemostasis and no complication.",
    hazards: ["interaction-handled", "drug-name", "measurement"],
    why:
      "The clinician identified the interaction and documented avoiding it. This is the note " +
      "the medication rules exist to encourage, so stopping it inverts the incentive exactly."
  },
  {
    id: "interaction-handled-terse",
    noteType: "pharmacologic",
    text:
      "Patient anticoagulated on warfarin. No ibuprofen given. Acetaminophen recommended for " +
      "postoperative discomfort. International normalized ratio confirmed as current with the " +
      "prescribing physician before treatment. Extraction of tooth 21 completed. Hemostasis " +
      "achieved with pressure and a resorbable dressing.",
    hazards: ["interaction-handled", "drug-name"],
    why:
      "The same correct decision written the short way, which is how it actually appears in " +
      "a chart."
  },
  {
    id: "consent-with-decision",
    noteType: "surgical",
    text:
      "Extraction of tooth 17 discussed. Risks described included bleeding, swelling, infection, " +
      "dry socket, and altered sensation of the lower lip. Alternatives described included no " +
      "treatment and referral for surgical evaluation. The patient asked about recovery time and " +
      "the answer was given. The patient agreed to proceed today and the consent form was signed.",
    hazards: ["anatomy-word"],
    why: "Consent with an explicit decision, which the completeness rules require."
  },
  {
    id: "extraction-with-outcome",
    noteType: "surgical",
    text:
      "Extraction of tooth 32 completed. The tooth was removed intact with no root fracture. " +
      "The socket was curetted and irrigated with sterile saline. Hemostasis achieved with " +
      "gauze pressure after five minutes. No complications occurred. Postoperative instructions " +
      "given in writing and reviewed aloud. Return in one week if pain increases.",
    hazards: ["measurement"],
    why: "An extraction with its outcome stated, which the completeness rules require."
  },
  {
    id: "imaging-with-read",
    noteType: "diagnostic",
    text:
      "Two periapical radiographs taken of the mandibular right posterior region. " +
      "Interpretation: bone levels are within two millimeters of the cementoenamel junction at " +
      "teeth 29 and 30. No periapical radiolucency identified. The existing restoration on tooth " +
      "30 appears intact with no recurrent caries. Findings reviewed with the patient.",
    hazards: ["measurement"],
    why: "Imaging with an interpretation, which the completeness rules require."
  },
  {
    id: "refusal-documented",
    noteType: "consultation",
    text:
      "Radiographs recommended to evaluate the interproximal surfaces. The reason was explained, " +
      "including that caries between the teeth cannot be detected reliably by visual examination " +
      "alone. The patient declined radiographs at this visit and stated a preference to wait. " +
      "The limitation this places on the examination was explained and the patient understood.",
    hazards: ["given-name-word"],
    why: "Informed refusal with the decision recorded, phrased without characterizing the patient."
  },
  {
    id: "pediatric-visit",
    noteType: "pediatric",
    text:
      "Examination completed for a patient in the primary dentition. Teeth A through T present " +
      "and erupted. No caries identified on visual examination. Fluoride varnish applied with " +
      "the parent present and consenting. Diet counseling given, with emphasis on reducing " +
      "between meal sugar exposure. Return in six months.",
    hazards: ["given-name-word"],
    why: "Primary dentition letters must not read as initials or a name."
  },
  {
    id: "emergency-triage",
    noteType: "emergency",
    text:
      "Patient telephoned reporting swelling of the left cheek that began overnight. Advised to " +
      "attend the practice today. On examination the swelling is firm and extends from the " +
      "mandibular border to the zygomatic arch. Temperature taken and recorded as within normal " +
      "range. Referred urgently to the hospital emergency department and the patient departed.",
    hazards: ["anatomy-word", "institution"],
    why: "Urgent presentation described observationally, without judgment language."
  },
  {
    id: "recall-uneventful",
    noteType: "hygiene",
    text:
      "Six month recall examination and adult prophylaxis completed. Soft tissue examination " +
      "performed including the tongue, floor of mouth, and buccal mucosa, with no lesions " +
      "identified. Existing restorations checked and intact. Oral cancer screening completed. " +
      "Return in six months for the next recall appointment.",
    hazards: ["anatomy-word"],
    why: "The ordinary case, which must also come back clean."
  },
  {
    id: "crown-with-rationale",
    noteType: "restorative",
    text:
      "Crown preparation on tooth 3. The rationale is loss of more than half the coronal tooth " +
      "structure following removal of the existing restoration and recurrent caries, leaving " +
      "insufficient structure to retain a direct restoration. Provisional crown cemented with " +
      "temporary cement. Impression taken. Return in three weeks for cementation.",
    hazards: ["measurement"],
    why: "A crown with its indication narrated, which the justification rules require."
  }
];
