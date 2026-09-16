// Dental and medical shorthand, initialisms, and acronyms.
//
// THE CONVENTION THIS TABLE EXISTS TO ENFORCE: a term of art is written out in
// full the FIRST time it appears, with the shorthand in parentheses after it,
// and the shorthand alone thereafter.
//
//     "Root canal therapy (RCT) was started. The RCT was completed at the
//      second visit."
//
// That is how a note stays readable to someone who was not in the operatory —
// an insurer, a specialist, an attorney, a colleague covering a shift — without
// forcing the writer to spell out the same phrase six times. It is the standard
// convention in medical and legal writing, and it is what makes a note survive
// being read years later by someone who does not share your habits.
//
// AMBIGUOUS ENTRIES ARE NEVER EXPANDED. Several of these initialisms mean more
// than one real thing in a dental chart: GP is gutta-percha and general
// practitioner; CR is composite resin and centric relation; ASA is a nerve
// block and an anesthesia risk classification. Guessing would put a clinical
// claim in the note that the writer never made, so those carry `alternatives`
// and are surfaced for the writer to resolve.
//
// DOSING FREQUENCIES follow the ISMP error-prone abbreviation list. The ones
// with a single unambiguous reading are expanded; "qd" and "qod" are NOT,
// because they are confused with each other and with "qid" in real handwriting
// and that confusion has caused real dosing errors.

export interface Shorthand {
  id: string;
  /** Matches the shorthand as written. Must carry the g flag. */
  pattern: RegExp;
  /** Canonical form shown in parentheses and in the word map. */
  display: string;
  /** The full term of art. */
  expansion: string;
  /**
   * The correct plural of the expansion, for patterns that match a plural
   * token ("SSCs", "4 BWs", "TMJs").
   *
   * This field exists because of a counting bug: the first-use expansion
   * replaced "SSCs placed on teeth A and B" with the SINGULAR "stainless
   * steel crown (SSC) placed on teeth A and B" — one crown documented for two
   * teeth. applyPlural() deliberately refuses to pluralise a multi-word
   * replacement (it can only append an "s", and "scaling and root planings"
   * would be worse than the bug), so multi-word expansions silently dropped
   * the plural instead. A count is a billing and legal fact; the only safe
   * plural is one a human wrote out in full, which is what this field is.
   *
   * When a plural token is matched and this field is absent, the token is
   * left as shorthand rather than expanded — an unexpanded initialism is a
   * style miss, a changed count is a falsified record.
   */
  pluralExpansion?: string;
  /** Present when the shorthand has more than one real reading in a dental chart. */
  alternatives?: string[];
  domain: "dental" | "medical" | "dosing";
}

export const SHORTHAND: Shorthand[] = [
  // ---- Radiographs and imaging
  {
    id: "bw",
    // NOT after a weight unit. "BW" is a bitewing here nine times in ten, but
    // the tenth is "50 mg/kg BW" — body weight — and expanding that turns the
    // BASIS of a paediatric dose into a radiograph. Losing the basis of a dose
    // is worse than any convenience this rule buys, so the dosing context is
    // carved out rather than the whole rule being given up.
    pattern: /(?<!\b(?:kg|kgs|lb|lbs)\s)\bBWX?s?\b/gi,
    display: "BW",
    expansion: "bitewing radiograph",
    pluralExpansion: "bitewing radiographs",
    domain: "dental"
  },
  {
    id: "pan",
    // "pano"/"panos" in any case, or PAN shouted in capitals — but never the
    // ordinary English "pan"/"pans". /\bpans?\b/i turned "Pans of ice water
    // tested." into "Panoramic radiograph (PAN) of ice water tested."
    pattern: /\b[Pp][Aa][Nn][Oo]s?\b|\bPANs?\b/g,
    display: "PANO",
    expansion: "panoramic radiograph",
    pluralExpansion: "panoramic radiographs",
    domain: "dental"
  },
  {
    id: "fmx",
    // FMX only. The character class [XS] also matched FMS — fibromyalgia
    // syndrome — so a diagnosis in the medical history was deleted and a
    // radiographic series invented in its place.
    pattern: /\bFMX\b/gi,
    display: "FMX",
    expansion: "full-mouth radiographic series",
    domain: "dental"
  },
  {
    id: "fms",
    // Flagged, never expanded. The old table folded FMS in with FMX as one
    // entry, so "Medical history: FMS, hypertension, and asthma." came out as
    // "full-mouth radiographic series, hypertension, and asthma" — a diagnosis
    // deleted and an imaging study invented in its place. In a dental note FMS
    // is usually a typo for FMX; in a medical history it is fibromyalgia
    // syndrome. Only the person who took the history knows which, so the tool
    // asks instead of choosing.
    pattern: /\bFMS\b/g,
    display: "FMS",
    expansion: "full-mouth radiographic series",
    alternatives: ["full-mouth radiographic series (FMX)", "fibromyalgia syndrome"],
    domain: "dental"
  },
  // No pluralExpansion: "CBCTs" means multiple SCANS, and writing "cone-beam
  // computed tomography scans" would add a noun the writer never typed. A
  // plural CBCTs is left as shorthand rather than miscounted.
  { id: "cbct", pattern: /\bCBCTs?\b/gi, display: "CBCT", expansion: "cone-beam computed tomography", domain: "dental" },
  { id: "parl", pattern: /\bPARLs?\b/gi, display: "PARL", expansion: "periapical radiolucency", pluralExpansion: "periapical radiolucencies", domain: "dental" },

  // ---- Procedures
  { id: "rct", pattern: /\bRCTs?\b/gi, display: "RCT", expansion: "root canal therapy", pluralExpansion: "root canal therapies", domain: "dental" },
  { id: "srp", pattern: /\bSRP\b/gi, display: "SRP", expansion: "scaling and root planing", domain: "dental" },

  // ---- Sedation and anaesthesia monitoring.
  //
  // Added because the filing gate found them, which is the loop working: the
  // app's own sedation module names these monitors, the gate blocked filing on
  // shorthand no table could read, and the route out that its message promises
  // is exactly this — put it in the vocabulary and the next occurrence is free.
  //
  // The alternative would have been to soften the gate, and that is the trade
  // to refuse. A monitoring term nobody can expand in five years is a real
  // problem in a sedation record specifically, which is the note most likely to
  // be read by a stranger under pressure.
  {
    id: "etco2",
    // The digit is part of the term, not a number after it.
    pattern: /\bETCO2\b/gi,
    display: "ETCO2",
    expansion: "end-tidal carbon dioxide",
    domain: "medical"
  },
  {
    id: "spo2",
    pattern: /\bSpO2\b/gi,
    display: "SpO2",
    expansion: "peripheral oxygen saturation",
    domain: "medical"
  },
  {
    id: "ecg",
    // ECG and EKG are the same investigation; both expand to the same words, so
    // there is no ambiguity to ask about.
    pattern: /\bE[CK]G\b/g,
    display: "ECG",
    expansion: "electrocardiography",
    domain: "medical"
  },
  {
    id: "nibp",
    pattern: /\bNIBP\b/gi,
    display: "NIBP",
    expansion: "non-invasive blood pressure",
    domain: "medical"
  },
  {
    // The opioid rule REQUIRES this token in the note ("CSMD reviewed prior to
    // prescribing") while the filing gate blocked any note containing it as
    // unknown shorthand — two rules in direct contradiction, found when Byte's
    // opioid advice failed his own blocking-audit test. The practice cannot
    // demand a word its own vocabulary refuses to read.
    id: "csmd",
    pattern: /\bCSMD\b/g,
    display: "CSMD",
    expansion: "Controlled Substance Monitoring Database",
    domain: "medical"
  },
  {
    id: "pmp",
    pattern: /\bPMP\b/g,
    display: "PMP",
    expansion: "prescription monitoring program",
    domain: "medical"
  },
  { id: "ohi", pattern: /\bOHI\b/gi, display: "OHI", expansion: "oral hygiene instruction", domain: "dental" },
  {
    id: "coe",
    // Capitals only, and never before a hyphen. Case-insensitively this matched
    // the "Coe" of Coe-Pak — one of the commonest periodontal dressings there
    // is — and rewrote "Coe-Pak placed." as "Comprehensive oral evaluation
    // (COE)-Pak placed.", inventing ADA D0150, a billable evaluation that
    // nobody performed, out of a material placement.
    pattern: /\bCOE\b(?!-)/g,
    display: "COE",
    expansion: "comprehensive oral evaluation",
    domain: "dental"
  },
  { id: "loe", pattern: /\bLOE\b/gi, display: "LOE", expansion: "limited oral evaluation", domain: "dental" },
  {
    id: "ext",
    // Case-INSENSITIVE, unlike the quadrant entries below. "ext" is not an
    // English word, so there is no typo for it to fire on, and staff type it in
    // lower case — measured on real notes, where an uppercase-only pattern meant
    // a surgical note's most important abbreviation went unflagged entirely.
    pattern: /\bEXT\b/gi,
    display: "EXT",
    expansion: "extraction",
    alternatives: ["extraction", "extension"],
    domain: "dental"
  },
  { id: "ssc", pattern: /\bSSCs?\b/gi, display: "SSC", expansion: "stainless steel crown", pluralExpansion: "stainless steel crowns", domain: "dental" },
  { id: "sdf", pattern: /\bSDF\b/gi, display: "SDF", expansion: "silver diamine fluoride", domain: "dental" },

  { id: "pfm", pattern: /\bPFM\b/gi, display: "PFM", expansion: "porcelain-fused-to-metal", domain: "dental" },
  { id: "pvs", pattern: /\bPVS\b/gi, display: "PVS", expansion: "polyvinyl siloxane", domain: "dental" },

  // ---- Materials
  { id: "mta", pattern: /\bMTA\b/gi, display: "MTA", expansion: "mineral trioxide aggregate", domain: "dental" },
  { id: "irm", pattern: /\bIRM\b/gi, display: "IRM", expansion: "intermediate restorative material", domain: "dental" },
  // Capitals only: case-insensitively this matched the given name "Zoe", so
  // "Assisted by Zoe." became "Assisted by zinc oxide eugenol (ZOE)."
  { id: "zoe", pattern: /\bZOE\b/g, display: "ZOE", expansion: "zinc oxide eugenol", domain: "dental" },
  { id: "rmgi", pattern: /\bRMGI\b/gi, display: "RMGI", expansion: "resin-modified glass ionomer", domain: "dental" },
  {
    id: "gi",
    pattern: /\bGI\b/gi,
    display: "GI",
    expansion: "glass ionomer",
    alternatives: ["glass ionomer", "gastrointestinal"],
    domain: "dental"
  },
  {
    id: "gp",
    pattern: /\bGP\b/gi,
    display: "GP",
    expansion: "gutta-percha",
    alternatives: ["gutta-percha", "general practitioner"],
    domain: "dental"
  },
  {
    id: "cr",
    pattern: /\bCR\b/gi,
    display: "CR",
    expansion: "composite resin",
    alternatives: ["composite resin", "centric relation"],
    domain: "dental"
  },

  // ---- Periodontal and anatomy
  { id: "bop", pattern: /\bBOP\b/gi, display: "BOP", expansion: "bleeding on probing", domain: "dental" },
  {
    id: "cal",
    pattern: /\bCAL\b/g,
    display: "CAL",
    expansion: "clinical attachment level",
    alternatives: ["clinical attachment level", "calcium"],
    domain: "dental"
  },
  { id: "tmj", pattern: /\bTMJs?\b/gi, display: "TMJ", expansion: "temporomandibular joint", pluralExpansion: "temporomandibular joints", domain: "dental" },
  { id: "tmd", pattern: /\bTMD\b/gi, display: "TMD", expansion: "temporomandibular disorder", domain: "dental" },
  { id: "cej", pattern: /\bCEJ\b/gi, display: "CEJ", expansion: "cementoenamel junction", domain: "dental" },
  {
    id: "mod",
    // Surface combinations. formatSurfaces() already EMITS these, but nothing
    // recognised them when a clinician typed them in prose, so "MOD composite"
    // went through as an unexplained initialism. Uppercase-only and anchored to
    // the real combinations: a case-insensitive /\bmod\b/ would swallow the
    // ordinary English word, and /\b[MODBFLI]+\b/ would swallow "I", "B", and
    // every other stray capital.
    // THREE letters or more, and no two-letter combinations.
    //
    // The first version of this accepted MO, DO, OD, DI, MI, OL and OB, and
    // every one of those collides with something in a medical history:
    //   MI  myocardial infarction        OD  overdose (or right eye)
    //   DI  diabetes insipidus           OB  obstetrician
    //   DO  Doctor of Osteopathy         — and "DO NOT" in a capitalised line
    // So "History of MI in 2019." was flagged as a dental surface combination.
    // Mislabelling a cardiac history as tooth anatomy is the cries-wolf failure
    // the plausibility module warns about, arriving from the other direction.
    //
    // Dropping them costs almost nothing: this entry never expands anything,
    // it only recognises. Under-recognising "MO composite" is invisible;
    // over-recognising "MI" teaches staff to dismiss the flags.
    pattern: /\bMOD[BLP]?\b|\bMODBL\b/g,
    display: "MOD",
    expansion: "surface combination (mesial, occlusal, distal, and so on)",
    // Never expanded: which surfaces a restoration touches is a clinical fact
    // and the letters carry it exactly. Spelling them out would be longer and
    // no clearer, and guessing the order would be wrong.
    alternatives: ["name the surfaces in the standard order — the letters are already correct"],
    domain: "dental"
  },
  {
    id: "pd",
    pattern: /\bPD\b/gi,
    display: "PD",
    expansion: "probing depth",
    alternatives: ["probing depth", "pocket depth", "partial denture", "periodontal disease"],
    domain: "dental"
  },
  {
    id: "ppd",
    // On the practice's own approved list as "probing pocket depth", and NOT
    // matched by the PD entry above. Never expanded, because in a medical
    // history PPD is the tuberculin skin test (purified protein derivative) —
    // and a note that turns a positive TB test into a periodontal measurement
    // has deleted a systemic finding.
    pattern: /\bPPDs?\b/g,
    display: "PPD",
    expansion: "probing pocket depth",
    alternatives: ["probing pocket depth", "purified protein derivative (the tuberculin skin test)"],
    domain: "dental"
  },

  // ---- Prosthodontics
  { id: "fpd", pattern: /\bFPDs?\b/gi, display: "FPD", expansion: "fixed partial denture", pluralExpansion: "fixed partial dentures", domain: "dental" },
  { id: "rpd", pattern: /\bRPDs?\b/gi, display: "RPD", expansion: "removable partial denture", pluralExpansion: "removable partial dentures", domain: "dental" },
  { id: "ovd", pattern: /\b(?:OVD|VDO)\b/gi, display: "OVD", expansion: "occlusal vertical dimension", domain: "dental" },

  // ---- Anesthesia
  { id: "ianb", pattern: /\bIANBs?\b/gi, display: "IANB", expansion: "inferior alveolar nerve block", pluralExpansion: "inferior alveolar nerve blocks", domain: "dental" },
  {
    id: "psa",
    pattern: /\bPSA\b/gi,
    display: "PSA",
    expansion: "posterior superior alveolar nerve block",
    // In a medical history PSA is prostate-specific antigen. Expanding it turns
    // a lab value into a nerve block that was never performed.
    alternatives: ["posterior superior alveolar nerve block", "prostate-specific antigen (a lab value)"],
    domain: "dental"
  },
  { id: "n2o", pattern: /\bN2O\b/gi, display: "N2O", expansion: "nitrous oxide", domain: "dental" },
  {
    id: "asa",
    pattern: /\bASA\b/g,
    display: "ASA",
    expansion: "anterior superior alveolar nerve block",
    alternatives: [
      "anterior superior alveolar nerve block",
      "American Society of Anesthesiologists physical status classification",
      "acetylsalicylic acid (aspirin)"
    ],
    domain: "dental"
  },
  {
    id: "la",
    pattern: /\bLA\b/gi,
    display: "LA",
    expansion: "local anesthetic",
    alternatives: ["local anesthetic", "local anesthesia"],
    domain: "dental"
  },

  // ---- Chart structure and history
  {
    id: "cc",
    // Case-INSENSITIVE, which the uppercase-only version was not. The reading
    // that makes this dangerous is the volume one, and a volume is written
    // lowercase: "2 cc of lidocaine" sailed through untouched while only a
    // shouted "CC" was ever raised. The header of this file says an ambiguous
    // term must be flagged rather than guessed; that promise was only being
    // kept for the harmless casing.
    pattern: /\bCC\b|\bcc\b/g,
    display: "CC",
    expansion: "chief complaint",
    // CC is a VOLUME (cubic centimetre) at least as often as "chief complaint",
    // and is itself on the ISMP do-not-use list. "2 CC of lidocaine" must never
    // become "2 chief complaint of lidocaine".
    alternatives: ["chief complaint", "cubic centimetres (use mL instead)"],
    domain: "medical"
  },
  { id: "hpi", pattern: /\bHPI\b/gi, display: "HPI", expansion: "history of present illness", domain: "medical" },
  { id: "ros", pattern: /\bROS\b/gi, display: "ROS", expansion: "review of systems", domain: "medical" },
  {
    id: "nkda",
    // NKDA only — the optional D also matched NKA, which is a DIFFERENT
    // clinical assertion. NKA is "no known allergies" (any class: latex,
    // foods, environmental); NKDA is "no known DRUG allergies". Rewriting NKA
    // as NKDA silently narrowed a clinician's statement, and — because the
    // change list reported the token as "NKDA" — left no trace that the note
    // had ever said anything else. On a latex-allergic patient that is an
    // affirmative, false, drug-allergy clearance in the record.
    pattern: /\bNKDA\b/gi,
    display: "NKDA",
    expansion: "no known drug allergies",
    domain: "medical"
  },
  {
    id: "nka",
    // Never expanded. Charted "NKA" is used for both readings in the wild, and
    // only the person who examined the patient knows which they meant. The
    // banned-abbreviation rule says the same thing — "only when verified".
    //
    // Case-INSENSITIVE: "nka" is not an English word, so there is no typo for
    // this to fire on, and an uppercase-only pattern meant a lower-case "nka" —
    // which is how it gets typed between patients — was not even flagged. An
    // unflagged NKA is an unverified allergy statement sitting in the record.
    pattern: /\bNKA\b/gi,
    display: "NKA",
    expansion: "no known allergies",
    alternatives: ["no known allergies", "no known drug allergies"],
    domain: "medical"
  },
  { id: "fu", pattern: /\bf\/u\b/gi, display: "f/u", expansion: "follow-up", domain: "medical" },
  { id: "bp", pattern: /\bBP\b/g, display: "BP", expansion: "blood pressure", domain: "medical" },
  { id: "npo", pattern: /\bNPO\b/gi, display: "NPO", expansion: "nothing by mouth", domain: "medical" },

  // ---- Dosing. ISMP error-prone list governs which are expanded.
  {
    id: "bid",
    // The punctuated form in any case, or BID shouted — but not the ordinary
    // English noun. /\bbid\b/i turned "The lab submitted a bid for the case."
    // into "...submitted a twice daily (bid) for the case.". "tid" and "qid"
    // below keep the looser pattern because neither is an English word.
    pattern: /\bb\.?i\.?d\.(?!\w)|\bBID\b/g,
    display: "bid",
    expansion: "twice daily",
    domain: "dosing"
  },
  { id: "tid", pattern: /\bt\.?i\.?d\.(?!\w)|\btid\b/gi, display: "tid", expansion: "three times daily", domain: "dosing" },
  { id: "qid", pattern: /\bq\.?i\.?d\.(?!\w)|\bqid\b/gi, display: "qid", expansion: "four times daily", domain: "dosing" },
  {
    id: "prn",
    // Flagged, never expanded — so it is NOT in SHORTHAND_OWNS and the
    // banned-abbreviation review rule keeps its guidance ("state the condition
    // and action"). Expanding it produced "600 mg as needed (prn) pain": broken
    // grammar, because "prn X" means "as needed FOR X", and the tool then
    // flagged its own output as a vague phrase and asked the clinician to
    // rewrite it. The missing fact here is the trigger condition, and only the
    // prescriber can supply that.
    pattern: /\bp\.?r\.?n\.(?!\w)|\bprn\b/gi,
    display: "prn",
    expansion: "as needed",
    alternatives: ["as needed for <condition> — say which condition and what to do"],
    domain: "dosing"
  },
  {
    // On the ISMP DO-NOT-USE list: "qd" is misread as "qid" and as "qod".
    // Expanding it would be asserting a dosing frequency nobody wrote.
    id: "qd",
    pattern: /\bq\.?d\.(?!\w)|\bqd\b/gi,
    display: "qd",
    expansion: "daily",
    alternatives: ["daily", "four times daily (if qid was intended)", "every other day (if qod was intended)"],
    domain: "dosing"
  },
  {
    id: "qod",
    pattern: /\bq\.?o\.?d\.(?!\w)|\bqod\b/gi,
    display: "qod",
    expansion: "every other day",
    alternatives: ["every other day", "daily (if qd was intended)"],
    domain: "dosing"
  },

  // -------------------------------------------------------------------------
  // PRELOAD BATCH 1 — dental terms of art
  // -------------------------------------------------------------------------
  //
  // Added after measuring the transformer on notes typed the way staff type them
  // and finding it made about two changes each. See
  // knowledge/sources/dental-abbreviation-preload.md for what was consulted and
  // for the classification rule these follow, which is this file's existing one:
  // an unambiguous term of art gets an `expansion` and is defined on first use; a
  // token with more than one real reading in a dental chart gets `alternatives`
  // and is flagged for the writer, never guessed.
  //
  // CASE. Everything here is case-insensitive except where the lower-case form is
  // an English word — see TAD below. collisions.test.ts is the tripwire: it runs
  // every silent expansion against a corpus of already-correct clinical prose and
  // fails if one fires inside a well-written sentence.

  // ---- Endodontics
  { id: "wl", pattern: /\bWL\b/gi, display: "WL", expansion: "working length", domain: "dental" },
  { id: "maf", pattern: /\bMAF\b/gi, display: "MAF", expansion: "master apical file", domain: "dental" },
  {
    // Safety-relevant enough to be worth spelling out every time it is defined:
    // a sodium hypochlorite accident is a recognised endodontic emergency, and a
    // note that records the irrigant as four characters is a note that hides it.
    id: "naocl",
    pattern: /\bNaOCl\b/gi,
    display: "NaOCl",
    expansion: "sodium hypochlorite",
    domain: "dental"
  },
  { id: "edta", pattern: /\bEDTA\b/gi, display: "EDTA", expansion: "ethylenediaminetetraacetic acid", domain: "dental" },

  // ---- Periodontics
  { id: "mgj", pattern: /\bMGJ\b/gi, display: "MGJ", expansion: "mucogingival junction", domain: "dental" },
  { id: "kt", pattern: /\bKT\b/gi, display: "KT", expansion: "keratinized tissue", domain: "dental" },
  { id: "gtr", pattern: /\bGTR\b/gi, display: "GTR", expansion: "guided tissue regeneration", domain: "dental" },
  { id: "gbr", pattern: /\bGBR\b/gi, display: "GBR", expansion: "guided bone regeneration", domain: "dental" },
  { id: "fgg", pattern: /\bFGG\b/gi, display: "FGG", expansion: "free gingival graft", domain: "dental" },
  { id: "ctg", pattern: /\bCTG\b/gi, display: "CTG", expansion: "connective tissue graft", domain: "dental" },
  { id: "spt", pattern: /\bSPT\b/gi, display: "SPT", expansion: "supportive periodontal therapy", domain: "dental" },

  // ---- Oral surgery
  {
    // The reason this one matters: a note that abbreviates osteonecrosis of the
    // jaw is a note where the single most important word for a patient on an
    // antiresorptive is four letters long.
    id: "mronj",
    pattern: /\bMRONJ\b/gi,
    display: "MRONJ",
    expansion: "medication-related osteonecrosis of the jaw",
    domain: "dental"
  },
  { id: "onj", pattern: /\bONJ\b/gi, display: "ONJ", expansion: "osteonecrosis of the jaw", domain: "dental" },
  { id: "oac", pattern: /\bOAC\b/gi, display: "OAC", expansion: "oroantral communication", domain: "dental" },
  { id: "oaf", pattern: /\bOAF\b/gi, display: "OAF", expansion: "oroantral fistula", domain: "dental" },
  { id: "ian", pattern: /\bIAN\b/gi, display: "IAN", expansion: "inferior alveolar nerve", domain: "dental" },

  // ---- Prosthodontics and restorative
  { id: "cd-denture", pattern: /\bCD\b/gi, display: "CD", expansion: "complete denture", domain: "dental" },
  { id: "pfz", pattern: /\bPFZ\b/gi, display: "PFZ", expansion: "porcelain-fused-to-zirconia", domain: "dental" },
  {
    id: "cadcam",
    pattern: /\bCAD\s?\/\s?CAM\b/gi,
    display: "CAD/CAM",
    expansion: "computer-aided design and computer-aided manufacturing",
    domain: "dental"
  },
  {
    // Two readings, and they are not close: a jaw position and a heart attack.
    // Both belong in a dental record and only the writer knows which they meant.
    id: "mi",
    pattern: /\bMI\b/gi,
    display: "MI",
    expansion: "maximum intercuspation",
    alternatives: ["maximum intercuspation (the jaw position)", "myocardial infarction (the cardiac event)"],
    domain: "dental"
  },
  {
    // "CAD" is coronary artery disease in a medical history and computer-aided
    // design in a crown workflow. The bare form is never expanded; CAD/CAM above
    // carries the restorative reading because the slash disambiguates it.
    id: "cad",
    pattern: /\bCAD\b/gi,
    display: "CAD",
    expansion: "coronary artery disease",
    alternatives: ["coronary artery disease", "computer-aided design (write CAD/CAM)"],
    domain: "medical"
  },

  // ---- Paediatric and preventive
  { id: "ecc", pattern: /\bECC\b/gi, display: "ECC", expansion: "early childhood caries", domain: "dental" },
  { id: "prr", pattern: /\bPRR\b/gi, display: "PRR", expansion: "preventive resin restoration", domain: "dental" },
  { id: "fv", pattern: /\bFV\b/gi, display: "FV", expansion: "fluoride varnish", domain: "dental" },
  { id: "tsd", pattern: /\bTSD\b/gi, display: "TSD", expansion: "tell-show-do", domain: "dental" },

  // ---- Orthodontics
  { id: "ipr", pattern: /\bIPR\b/gi, display: "IPR", expansion: "interproximal reduction", domain: "dental" },
  {
    // Case-SENSITIVE, and the tripwire in collisions.test.ts is why. "tad" is an
    // ordinary English word — "a tad sensitive" is a thing a note says — and a
    // case-insensitive expansion would rewrite it as "a temporary anchorage
    // device sensitive". Orthodontic notes write TAD in capitals, so requiring
    // them costs the writer nothing.
    id: "tad",
    pattern: /\bTAD\b/g,
    display: "TAD",
    expansion: "temporary anchorage device",
    domain: "dental"
  },

  // ---- Medical history that changes dental treatment
  { id: "htn", pattern: /\bHTN\b/gi, display: "HTN", expansion: "hypertension", domain: "medical" },
  { id: "dm", pattern: /\bDM\b/gi, display: "DM", expansion: "diabetes mellitus", domain: "medical" },
  { id: "chf", pattern: /\bCHF\b/gi, display: "CHF", expansion: "congestive heart failure", domain: "medical" },
  { id: "copd", pattern: /\bCOPD\b/gi, display: "COPD", expansion: "chronic obstructive pulmonary disease", domain: "medical" },
  { id: "cva", pattern: /\bCVA\b/gi, display: "CVA", expansion: "cerebrovascular accident", domain: "medical" },
  { id: "gerd", pattern: /\bGERD\b/gi, display: "GERD", expansion: "gastroesophageal reflux disease", domain: "medical" },
  { id: "osa", pattern: /\bOSA\b/gi, display: "OSA", expansion: "obstructive sleep apnea", domain: "medical" },
  { id: "sbe", pattern: /\bSBE\b/gi, display: "SBE", expansion: "subacute bacterial endocarditis", domain: "medical" },
  { id: "pmh", pattern: /\bPMH\b/gi, display: "PMH", expansion: "past medical history", domain: "medical" },
  {
    // Same species as NKA above: charted "RA" is rheumatoid arthritis in a
    // history and relative analgesia — nitrous oxide — on a sedation record.
    // Guessing between a systemic disease and an anaesthetic would be inventing
    // clinical content either way.
    id: "ra",
    pattern: /\bRA\b/gi,
    display: "RA",
    expansion: "rheumatoid arthritis",
    alternatives: ["rheumatoid arthritis", "relative analgesia (nitrous oxide)"],
    domain: "medical"
  },

  // -------------------------------------------------------------------------
  // PRELOAD BATCH 2 — pharmacy sig codes that are safe to expand
  // -------------------------------------------------------------------------
  //
  // ONLY the ones with a single reading and no entry on the ISMP error-prone
  // list. Everything Latin and error-prone — hs, qhs, TIW, AD/AS/AU, OD/OS/OU,
  // ss, cc, APAP, D/C — is in BANNED_ABBREVIATIONS as a do-not-use flag instead,
  // because expanding a dangerous abbreviation LAUNDERS it: the note comes out
  // clean and the habit that caused the error survives untouched.
  // NO ROUTE ABBREVIATIONS. IV, IM, PO and SL were here and are deliberately
  // gone: they are among the most universally understood constructs in medicine,
  // read without pause by an insurer, an attorney or the next treating dentist,
  // so defining them adds noise rather than clarity — ".5 mg intravenous (IV)"
  // is worse writing than ".5 mg IV". An existing dose-safety test caught it by
  // asserting the exact output of a sedation line, which was the right alarm for
  // the wrong reason and still the right answer.
  //
  // DOSING INTERVALS (q4h, q6h, q8h, q12h) live in BANNED_ABBREVIATIONS instead,
  // because the first-use convention here appends "(q6h)" after the expansion and
  // the abbreviation CONTAINS A DIGIT. "every 6 hours (q6h)" carries the number 6
  // twice, and the digit-preservation property test caught exactly that: a
  // duplicated number in a dosing instruction. A direct replacement has no
  // parenthetical and no duplicate.
  { id: "disp", pattern: /\bdisp\b/gi, display: "disp", expansion: "dispense", domain: "dosing" },
  { id: "gtt", pattern: /\bgtts?\b/gi, display: "gtt", expansion: "drops", domain: "dosing" },
  { id: "otc", pattern: /\bOTC\b/gi, display: "OTC", expansion: "over the counter", domain: "dosing" },
  { id: "nsaid", pattern: /\bNSAIDs?\b/gi, display: "NSAID", expansion: "nonsteroidal anti-inflammatory drug", pluralExpansion: "nonsteroidal anti-inflammatory drugs", domain: "dosing" },
  { id: "abx", pattern: /\bABX\b/gi, display: "ABX", expansion: "antibiotics", domain: "dosing" },
  { id: "ga", pattern: /\bGA\b/gi, display: "GA", expansion: "general anesthesia", domain: "medical" },
  {
    // "cap" is a crown in a patient's vocabulary and a capsule in a pharmacist's.
    // On a dental note both readings are live, and one of them is a restoration
    // while the other is a dose form.
    id: "cap",
    pattern: /\bcaps?\b/gi,
    display: "cap",
    expansion: "capsule",
    alternatives: ["capsule (the dose form)", "crown (write \"crown\" — \"cap\" is the patient's word)"],
    domain: "dosing"
  },
  {
    // ac / pc are on the ISMP list of abbreviations to spell out. Flagged rather
    // than expanded because a misread meal-timing instruction is a real dosing
    // error, and because "pc" is also how a computer gets written.
    id: "ac-pc",
    pattern: /\b[ap]\.?c\.?(?=[\s,.;:)]|$)/gi,
    display: "ac / pc",
    expansion: "before meals or after meals",
    alternatives: ["before meals (ac)", "after meals (pc)"],
    domain: "dosing"
  },

  // ---- Quadrants
  //
  // Case-SENSITIVE, unlike most of this table. Lower-case "ul" and "ll" turn up
  // inside ordinary typing far more often than they turn up as quadrants, and
  // an expansion that fires on a typo writes an anatomical site nobody meant.
  // Quadrant shorthand is written in capitals in a chart, so requiring capitals
  // costs the writer nothing and closes the whole class of false positive.
  //
  // These four are on the practice's own approved list, and the example in
  // their standardization document uses one directly: "Pain 8/10, LL molar".
  { id: "ur", pattern: /\bUR(?:\s+quad(?:rant)?)?\b/g, display: "UR", expansion: "upper right quadrant", domain: "dental" },
  { id: "ul", pattern: /\bUL(?:\s+quad(?:rant)?)?\b/g, display: "UL", expansion: "upper left quadrant", domain: "dental" },
  { id: "lr", pattern: /\bLR(?:\s+quad(?:rant)?)?\b/g, display: "LR", expansion: "lower right quadrant", domain: "dental" },
  { id: "ll", pattern: /\bLL(?:\s+quad(?:rant)?)?\b/g, display: "LL", expansion: "lower left quadrant", domain: "dental" },

  {
    // From the same example: "s/s of abscess". Expanded, never interpreted —
    // the practice's own transformer draft turned this into "signs and symptoms
    // CONSISTENT WITH an abscess", which is a diagnostic inference the writer
    // did not make. Expanding the shorthand is a vocabulary change; adding
    // "consistent with" is a clinical claim, and this tool does not make those.
    id: "ss",
    pattern: /\bs\/s\b/gi,
    display: "s/s",
    expansion: "signs and symptoms",
    domain: "medical"
  }
];

export const SHORTHAND_BY_ID: ReadonlyMap<string, Shorthand> = new Map(
  SHORTHAND.map((s) => [s.id, s])
);

// Ids in BANNED_ABBREVIATIONS that this table now OWNS.
//
// The two tables overlap because they were written under different policies.
// The old one said "never write this shorthand" and replaced every occurrence.
// The new rule is the standard convention: define the term of art once, then
// the shorthand is not only allowed but preferable — a note that says "scaling
// and root planing" six times is worse writing, not better.
//
// For these ids the first-use expansion wins and the blanket replacement is
// skipped, so a single abbreviation can never be processed by both passes.
// Everything NOT listed here (pt, tx, hx, dx, rx, prophy, x-ray) is shorthand
// for an ordinary word rather than a term of art, and is still replaced
// everywhere — "diagnosis (Dx)" would be absurd.
export const SHORTHAND_OWNS: ReadonlySet<string> = new Set([
  "bw",
  "pano",
  "fmx",
  "rct",
  "srp",
  "ohi",
  "nkda",
  "la",
  "n2o",
  "fu"
  // "prn" is deliberately NOT here. It is flagged rather than expanded, so the
  // banned-abbreviation rule must keep its review guidance instead of being
  // suppressed by an expansion that never happens.
]);
