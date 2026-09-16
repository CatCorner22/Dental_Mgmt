// CLINICAL FINDINGS, MATERIALS AND DOSE UNITS — the rest of what a note says.
//
// Used only by the read-only extractor. Nothing here is ever substituted into a
// note; these literals let the parser recognise the three things that made up
// most of its blind spot when coverage was first measured against real
// shorthand (26.2% of clauses):
//
//   FINDINGS   "no caries", "no BOP", "PARL", "WNL" — most of a dental exam is
//              findings, and most of those are NEGATED. This is where the
//              assertion layer earns its keep: half a hygiene note is the
//              clinician saying what is NOT there, and an extractor that read
//              those as present would be actively dangerous.
//
//   MATERIALS  "rubber dam", "CaOH", "Cavit", "3-0 chromic gut". These are what
//              a note is audited on years later — an insurer asking whether
//              isolation was used, an attorney asking what was placed.
//
//   DOSE UNITS "2 carp", "600 mg", "1.8 mL". The gateway to dose arithmetic:
//              you cannot check a maximum until you can read an amount.
//
// AMBIGUOUS TERMS ARE ABSENT, on the same rule as everywhere else. Left out
// deliberately: GP (gutta-percha / general practitioner), IRM (a brand and an
// initialism), MTA (mineral trioxide aggregate / medication therapy assessment),
// CR (composite resin / centric relation).

export interface ClinicalTerm {
  id: string;
  /** Lowercased token sequence, matched in order. */
  literal: string[];
  /** Canonical name. Reported in facts, never written into the note. */
  display: string;
  /**
   * The term IS an absence, so the fact it produces is negated regardless of
   * surrounding cues.
   *
   * "NKA" does not mean "allergies" modified by something; it means there are
   * none. Without this the extractor would report an allergy finding on every
   * note that recorded the absence of one — which is the single most
   * safety-relevant field in a dental chart, inverted.
   */
  impliesNegation?: boolean;
}

const term = (id: string, literal: string, display: string, impliesNegation = false): ClinicalTerm => ({
  id,
  literal: literal.split(" "),
  display,
  ...(impliesNegation ? { impliesNegation: true } : {})
});

/**
 * Things a clinician observes, as opposed to things they do.
 *
 * The split from PROCEDURE_TERMS matters downstream: a finding can be negated
 * and routinely is ("no caries"), whereas a negated procedure is rare and means
 * something quite different ("extraction declined").
 */
export const FINDING_TERMS: ClinicalTerm[] = [
  term("find.caries", "caries", "caries"),
  term("find.caries.recurrent", "recurrent caries", "recurrent caries"),
  term("find.decay", "decay", "caries"),
  term("find.bop", "bop", "bleeding on probing"),
  term("find.bleeding", "bleeding on probing", "bleeding on probing"),
  term("find.calculus", "calculus", "calculus"),
  term("find.plaque", "plaque", "plaque"),
  term("find.swelling", "swelling", "swelling"),
  term("find.parl", "parl", "periapical radiolucency"),
  term("find.parl.full", "periapical radiolucency", "periapical radiolucency"),
  term("find.pulp.exposure", "pulp exposure", "pulp exposure"),
  term("find.dry.socket", "dry socket", "dry socket"),
  term("find.lesion", "lesion", "lesion"),
  term("find.lesions", "lesions", "lesion"),
  term("find.mobility", "mobility", "mobility"),
  term("find.recession", "recession", "gingival recession"),
  term("find.pocket", "pocket", "periodontal pocket"),
  term("find.pockets", "pockets", "periodontal pocket"),
  term("find.fracture", "fracture", "fracture"),
  term("find.fractured", "fractured", "fracture"),
  term("find.abscess", "abscess", "abscess"),
  term("find.sensitivity", "sensitivity", "sensitivity"),
  term("find.inflammation", "inflammation", "inflammation"),
  term("find.erythema", "erythema", "erythema"),
  term("find.ulceration", "ulceration", "ulceration"),
  term("find.clicking", "clicking", "joint clicking"),
  term("find.tenderness", "tenderness", "tenderness"),
  term("find.pain", "pain", "pain"),
  term("find.soreness", "soreness", "soreness"),
  term("find.wnl", "wnl", "within normal limits"),
  term("find.wnl.full", "within normal limits", "within normal limits"),
  term("find.pulpitis", "pulpitis", "pulpitis"),
  term("find.pulpitis.irrev", "irrev pulpitis", "irreversible pulpitis"),
  term("find.pulpitis.irrev.full", "irreversible pulpitis", "irreversible pulpitis"),

  // --- Medical history that changes whether treatment is safe today. --------
  // The highest-consequence findings in the file. An extractor that missed
  // "NKDA" would leave the allergy question unanswered on the chart; one that
  // read it as an allergy PRESENT would be worse still, which is what
  // impliesNegation exists to prevent.
  term("find.allergy", "allergy", "allergy"),
  term("find.allergies", "allergies", "allergy"),
  term("find.allergic", "allergic", "allergy"),
  term("find.nka", "nka", "drug allergy", true),
  term("find.nkda", "nkda", "drug allergy", true),
  term("find.nkma", "nkma", "medication allergy", true),
  term("find.htn", "htn", "hypertension"),
  term("find.hypertension", "hypertension", "hypertension"),
  term("find.dm", "dm", "diabetes mellitus"),
  term("find.diabetes", "diabetes", "diabetes mellitus"),
  term("find.anticoagulant", "anticoagulant", "anticoagulant therapy"),
  term("find.premed", "premed", "antibiotic premedication"),
  term("find.premedication", "premedication", "antibiotic premedication"),
  term("find.pregnant", "pregnant", "pregnancy"),
  term("find.pregnancy", "pregnancy", "pregnancy"),

  // --- Pulp testing and other diagnostic responses. -------------------------
  term("find.perc", "perc", "percussion response"),
  term("find.percussion", "percussion", "percussion response"),
  term("find.palpation", "palpation", "palpation response"),
  term("find.cold.test", "cold", "cold test response"),
  term("find.exposure", "exposure", "pulp exposure")
];

/**
 * Things done WITH or FOR the patient, rather than to a tooth.
 *
 * A third category alongside findings (observed) and procedures (done to
 * teeth), and it is not filler. These are what a note is judged on when nobody
 * is disputing the dentistry: whether post-operative instructions were given,
 * whether options were discussed, whether the medical history was reviewed,
 * how the patient tolerated it. Every completeness rule that protects the
 * practice is really asking whether one of these is present.
 */
export const CARE_EVENT_TERMS: ClinicalTerm[] = [
  // Hyphenated forms are SEPARATE ENTRIES, not a normalisation step. The
  // tokenizer keeps an internal hyphen inside the word (so "post-op" is one
  // token, which is what makes "post-operative" survive intact), and the
  // corpus measurement caught the consequence: "post op instr" as three
  // literals never matched the two tokens a writer actually types.
  term("care.postop.instr", "post-op instr", "post-operative instructions"),
  term("care.postop.instr.spaced", "post op instr", "post-operative instructions"),
  term("care.postop.instructions", "post-op instructions", "post-operative instructions"),
  term("care.postop.instructions.spaced", "post op instructions", "post-operative instructions"),
  term("care.postop.abbr", "postop instructions", "post-operative instructions"),
  term("care.postop.bare", "post-op", "post-operative care"),
  term("care.home.care", "home care instr", "home care instructions"),
  term("care.home.care.full", "home care instructions", "home care instructions"),
  // OHI is deliberately NOT here: PROCEDURE_TERMS already owns it, and a term in
  // two tables is read by whichever reader runs first, which is a coin flip
  // dressed as a rule. term-collisions.test.ts enforces that.
  term("care.floss.demo", "floss demo", "flossing demonstration"),
  term("care.txplan", "tx plan", "treatment plan discussion"),
  term("care.txplan.full", "treatment plan", "treatment plan discussion"),
  term("care.txoptions", "tx options", "treatment options discussion"),
  term("care.consent", "consent", "informed consent"),
  term("care.mh.reviewed", "mh reviewed", "medical history review"),
  term("care.mh", "medical history", "medical history review"),
  term("care.tolerated", "tol well", "patient tolerated the procedure"),
  term("care.tolerated.full", "tolerated well", "patient tolerated the procedure"),
  term("care.tolerated.proc", "tolerated the procedure", "patient tolerated the procedure"),
  term("care.cooperative", "cooperative", "patient cooperative"),
  term("care.rtc", "rtc", "return-to-clinic interval"),
  term("care.recall", "recall", "recall interval"),
  term("care.referral", "referral", "referral"),
  term("care.oral.cancer", "oral cancer screening", "oral cancer screening"),
  term("care.occlusion.checked", "occlusion checked", "occlusion verified"),
  term("care.occlusion.adjusted", "occlusion adjusted", "occlusion adjusted"),
  term("care.occlusion", "occlusion", "occlusion assessed"),
  term("care.shade", "shade", "shade selection")
];

/** Materials and adjuncts placed, used, or removed. */
export const MATERIAL_TERMS: ClinicalTerm[] = [
  term("mat.rubber.dam", "rubber dam", "rubber dam isolation"),
  term("mat.caoh", "caoh", "calcium hydroxide"),
  term("mat.caoh.full", "calcium hydroxide", "calcium hydroxide"),
  term("mat.cavit", "cavit", "temporary restorative material"),
  term("mat.formocresol", "formocresol", "formocresol"),
  term("mat.ssc", "ssc", "stainless steel crown"),
  term("mat.ssc.full", "stainless steel crown", "stainless steel crown"),
  term("mat.pvs", "pvs", "polyvinyl siloxane impression material"),
  term("mat.cord", "retraction cord", "retraction cord"),
  term("mat.etchant", "etchant", "etchant"),
  term("mat.bonding", "bonding agent", "bonding agent"),
  term("mat.varnish", "varnish", "fluoride varnish"),
  term("mat.sutures", "sutures", "sutures"),
  term("mat.suture", "suture", "sutures"),
  term("mat.chromic", "chromic gut", "chromic gut suture"),
  term("mat.silk", "silk suture", "silk suture"),
  term("mat.glass.ionomer", "glass ionomer", "glass ionomer"),
  term("mat.sealer", "sealer", "root canal sealer"),
  term("mat.gutta.percha", "gutta percha", "gutta-percha"),
  term("mat.nitrous", "nitrous oxide", "nitrous oxide"),
  term("mat.nitrous.abbr", "n2o", "nitrous oxide")
];

/**
 * Shorthand that names a drug.
 *
 * Only entries with one reading in a dental chart. The full generic names come
 * from MEDICATION_WORDS, which the parser consults directly.
 */
export const DRUG_SHORTHAND: Record<string, string> = {
  lido: "lidocaine",
  epi: "epinephrine",
  articaine: "articaine",
  septo: "articaine",
  marcaine: "bupivacaine",
  amox: "amoxicillin",
  clinda: "clindamycin",
  apap: "acetaminophen",
  ibu: "ibuprofen",
  chx: "chlorhexidine"
};

export interface DoseUnit {
  /** Lowercased token as written. */
  token: string;
  /** Canonical unit symbol. */
  unit: string;
  /**
   * Millilitres per unit, where the unit is a container rather than a measure.
   *
   * A dental carpule is 1.8 mL by convention, and that constant is what turns
   * "2 carp lido 2%" into 72 mg of lidocaine — the arithmetic a maximum-dose
   * check needs and the reason a container counts as a dose unit at all.
   */
  mlPerUnit?: number;
}

export const DOSE_UNITS: DoseUnit[] = [
  { token: "mg", unit: "mg" },
  { token: "mcg", unit: "mcg" },
  { token: "g", unit: "g" },
  { token: "ml", unit: "mL" },
  { token: "cc", unit: "mL" },
  { token: "carp", unit: "carpule", mlPerUnit: 1.8 },
  { token: "carps", unit: "carpule", mlPerUnit: 1.8 },
  { token: "carpule", unit: "carpule", mlPerUnit: 1.8 },
  { token: "carpules", unit: "carpule", mlPerUnit: 1.8 },
  { token: "cartridge", unit: "carpule", mlPerUnit: 1.8 },
  { token: "cartridges", unit: "carpule", mlPerUnit: 1.8 },
  { token: "tab", unit: "tablet" },
  { token: "tabs", unit: "tablet" }
];

/** Units of measurement that are not doses. */
export const MEASURE_UNITS: Array<{ token: string; unit: string }> = [
  { token: "mm", unit: "mm" },
  { token: "cm", unit: "cm" },
  { token: "kg", unit: "kg" },
  { token: "lb", unit: "lb" },
  { token: "lbs", unit: "lb" },
  { token: "min", unit: "min" },
  { token: "mins", unit: "min" },
  { token: "wk", unit: "week" },
  { token: "wks", unit: "week" },
  { token: "week", unit: "week" },
  { token: "weeks", unit: "week" },
  { token: "mo", unit: "month" },
  { token: "mos", unit: "month" },
  { token: "month", unit: "month" },
  { token: "months", unit: "month" },
  { token: "day", unit: "day" },
  { token: "days", unit: "day" },
  { token: "yr", unit: "year" },
  { token: "yrs", unit: "year" }
];

const byLength = <T extends { literal: string[] }>(terms: T[]): T[] =>
  [...terms].sort((a, b) => b.literal.length - a.literal.length);

export const FINDING_TERMS_BY_LENGTH = byLength(FINDING_TERMS);
export const MATERIAL_TERMS_BY_LENGTH = byLength(MATERIAL_TERMS);
export const CARE_EVENT_TERMS_BY_LENGTH = byLength(CARE_EVENT_TERMS);
