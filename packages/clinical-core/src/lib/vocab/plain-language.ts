// Words the record needs and the patient cannot use.
//
// This list runs ONLY against fields marked `audience: "patient"`. That scoping
// is the whole design, because this table and BANNED_ABBREVIATIONS pull in
// opposite directions on purpose: the abbreviation rule replaces "x-ray" with
// "radiograph" so the legal record is precise, and this rule replaces
// "radiograph" with "x-ray" so the person who had it taken knows what happened.
// Both are right about their own audience. Running either one on the other's
// text would make the tool argue with itself in front of a clinician.
//
// Every entry is STYLE severity and nothing here is ever applied
// automatically. Swapping a clinical term for a plainer one can change what the
// sentence claims — "lesion" is not "sore" — and choosing that trade is the
// clinician's judgement, not a find-and-replace.
//
// The 21st Century Cures Act is why this exists: patients now read their own
// notes by default, and a summary written for a colleague is not a summary the
// patient can act on.

export interface PlainWord {
  id: string;
  pattern: RegExp; // global, case-insensitive
  display: string; // as it appears in the staff table
  replacement: string; // plain-word guidance, never auto-applied
}

export const PLAIN_WORDS: PlainWord[] = [
  // --- what the clinician looked at ---
  {
    id: "radiograph",
    pattern: /\bradiographs?\b/gi,
    display: "radiograph",
    replacement: "x-ray"
  },
  {
    id: "caries",
    pattern: /\bcaries\b/gi,
    display: "caries",
    replacement: "tooth decay, or a cavity"
  },
  {
    id: "periodontitis",
    pattern: /\bperiodontitis\b/gi,
    display: "periodontitis",
    replacement: "gum disease that has reached the bone"
  },
  {
    id: "gingivitis",
    pattern: /\bgingivitis\b/gi,
    display: "gingivitis",
    replacement: "swollen, bleeding gums"
  },
  {
    id: "calculus",
    pattern: /\bcalculus\b/gi,
    display: "calculus",
    replacement: "tartar — the hard deposit on the teeth"
  },
  {
    id: "lesion",
    pattern: /\blesions?\b/gi,
    display: "lesion",
    replacement: "say what it is and where — a sore, a patch, an area of decay"
  },
  {
    id: "abscess",
    pattern: /\babscess(?:es)?\b/gi,
    display: "abscess",
    replacement: "a pocket of infection"
  },
  {
    id: "edema",
    pattern: /\b(?:edema|oedema)\b/gi,
    display: "edema / oedema",
    replacement: "swelling"
  },
  {
    id: "erythema",
    pattern: /\berythema\b/gi,
    display: "erythema",
    replacement: "redness"
  },
  {
    id: "exudate",
    pattern: /\bexudate\b/gi,
    display: "exudate",
    replacement: "fluid or pus"
  },
  {
    id: "necrotic",
    pattern: /\bnecro(?:tic|sis)\b/gi,
    display: "necrotic / necrosis",
    replacement: "the nerve inside the tooth has died"
  },
  {
    id: "pulp",
    pattern: /\bpulp(?:al|itis)?\b/gi,
    display: "pulp / pulpal / pulpitis",
    replacement: "the nerve and blood vessels inside the tooth"
  },

  // --- what the clinician did ---
  {
    id: "extraction",
    pattern: /\bextractions?\b/gi,
    display: "extraction",
    replacement: "taking the tooth out"
  },
  {
    id: "restoration",
    pattern: /\brestorations?\b/gi,
    display: "restoration",
    replacement: "a filling"
  },
  {
    id: "prophylaxis",
    pattern: /\bprophylaxis\b/gi,
    display: "prophylaxis",
    replacement: "a cleaning"
  },
  {
    id: "scaling-root-planing",
    pattern: /\bscaling and root planing\b/gi,
    display: "scaling and root planing",
    replacement: "a deep cleaning below the gumline"
  },
  {
    id: "endodontic",
    pattern: /\bendodontics?\b/gi,
    display: "endodontic",
    replacement: "root canal treatment"
  },
  {
    id: "anesthetic",
    pattern: /\ban(?:a)?esthe(?:tic|sia)\b/gi,
    display: "anesthetic / anesthesia",
    replacement: "numbing medicine"
  },
  {
    id: "analgesic",
    pattern: /\banalgesics?\b/gi,
    display: "analgesic",
    replacement: "pain medicine"
  },
  {
    id: "suture",
    pattern: /\bsutur(?:e|es|ed|ing)\b/gi,
    display: "suture",
    replacement: "stitches"
  },
  {
    id: "palpation",
    pattern: /\bpalpat(?:e|ed|ion)\b/gi,
    display: "palpation / palpate",
    replacement: "pressing with the fingers to check"
  },
  {
    id: "percussion",
    pattern: /\bpercussion\b/gi,
    display: "percussion",
    replacement: "tapping the tooth to check it"
  },

  // --- what goes in the mouth ---
  {
    id: "pontic",
    pattern: /\bpontics?\b/gi,
    display: "pontic",
    replacement: "the replacement tooth in a bridge"
  },
  {
    id: "abutment",
    pattern: /\babutments?\b/gi,
    display: "abutment",
    replacement: "the tooth or implant that holds the bridge"
  },
  {
    id: "prosthesis",
    pattern: /\bprosthes(?:is|es)\b/gi,
    display: "prosthesis",
    replacement: "a replacement for missing teeth — say denture, bridge, or implant"
  },
  {
    id: "edentulous",
    pattern: /\bedentulous\b/gi,
    display: "edentulous",
    replacement: "no natural teeth left in that area"
  },
  {
    id: "occlusion",
    pattern: /\bocclusion\b|\bocclusal\b/gi,
    display: "occlusion / occlusal",
    replacement: "the way the teeth meet when you bite"
  },
  {
    id: "dentition",
    pattern: /\bdentition\b/gi,
    display: "dentition",
    replacement: "your teeth"
  },

  // --- where in the mouth ---
  {
    id: "maxillary",
    pattern: /\bmaxillary\b|\bmaxilla\b/gi,
    display: "maxillary / maxilla",
    replacement: "upper jaw"
  },
  {
    id: "mandibular",
    pattern: /\bmandibular\b|\bmandible\b/gi,
    display: "mandibular / mandible",
    replacement: "lower jaw"
  },
  {
    id: "anterior",
    pattern: /\banterior\b/gi,
    display: "anterior",
    replacement: "front"
  },
  {
    id: "posterior",
    pattern: /\bposterior\b/gi,
    display: "posterior",
    replacement: "back"
  },
  {
    id: "bilateral",
    pattern: /\bbilateral(?:ly)?\b/gi,
    display: "bilateral",
    replacement: "both sides"
  },
  {
    id: "unilateral",
    pattern: /\bunilateral(?:ly)?\b/gi,
    display: "unilateral",
    replacement: "one side — say which"
  },
  {
    id: "interproximal",
    pattern: /\binterproximal(?:ly)?\b/gi,
    display: "interproximal",
    replacement: "between the teeth"
  },

  // --- how it is described ---
  {
    id: "asymptomatic",
    pattern: /\basymptomatic\b/gi,
    display: "asymptomatic",
    replacement: "nothing you would feel"
  },
  {
    id: "etiology",
    pattern: /\b(?:etiology|aetiology)\b/gi,
    display: "etiology / aetiology",
    replacement: "the cause"
  },
  {
    id: "sequelae",
    pattern: /\bsequelae?\b/gi,
    display: "sequelae",
    replacement: "what can happen next"
  },
  {
    id: "contraindicated",
    pattern: /\bcontraindicated\b/gi,
    display: "contraindicated",
    replacement: "not safe for you — and say why"
  },
  {
    id: "exacerbate",
    pattern: /\bexacerbat(?:e|es|ed|ing)\b/gi,
    display: "exacerbate",
    replacement: "make worse"
  },

  // --- long words with short twins ---
  {
    id: "utilize",
    pattern: /\butiliz(?:e|es|ed|ing)\b/gi,
    display: "utilize",
    replacement: "use"
  },
  {
    id: "prior-to",
    pattern: /\bprior to\b/gi,
    display: "prior to",
    replacement: "before"
  },
  {
    id: "subsequent-to",
    pattern: /\bsubsequent to\b/gi,
    display: "subsequent to",
    replacement: "after"
  },
  {
    id: "administer",
    pattern: /\badminister(?:ed|s|ing)?\b/gi,
    display: "administer",
    replacement: "give, or gave"
  },
  {
    id: "discontinue",
    pattern: /\bdiscontinu(?:e|ed|es|ing)\b/gi,
    display: "discontinue",
    replacement: "stop"
  },
  {
    id: "initiate",
    pattern: /\binitiat(?:e|ed|es|ing)\b|\bcommenc(?:e|ed|es|ing)\b/gi,
    display: "initiate / commence",
    replacement: "start"
  },
  {
    id: "in-the-event-that",
    pattern: /\bin the event that\b/gi,
    display: "in the event that",
    replacement: "if"
  },
  {
    id: "at-this-point-in-time",
    pattern: /\bat this (?:point in time|time)\b/gi,
    display: "at this point in time / at this time",
    replacement: "now"
  }
];
