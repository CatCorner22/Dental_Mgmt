// AMBIGUITY PROPOSALS — suggest a reading; never write it into the note.
//
// The transformer refuses to expand ambiguous shorthand. That is correct.
// Friction drops when the tool proposes the most likely reading from
// surrounding cues, and the writer still has to type the words they mean.
//
// A proposal is advice. Wrong proposals that staff decline are the same worst
// case as today's always-ask prompt. Auto-apply is forbidden.

export interface ReadingProposal {
  /** Suggested expansion / wording, from the table's alternatives. */
  suggested: string;
  /** One-line why this reading fits the surrounding text. */
  rationale: string;
  /** Heuristic strength 0..1 — never shown as a "confidence %" in the UI. */
  strength: number;
}

interface AltCues {
  /** Matches one alternative (or distinctive words in it). */
  alt: RegExp;
  cues: RegExp[];
}

/** Per-display-family cue sets. Kept small and dental-operatory-specific. */
const FAMILIES: Array<{ displays: RegExp; alts: AltCues[] }> = [
  {
    displays: /^CR$/i,
    alts: [
      { alt: /composite resin/i, cues: [/\b(?:MOD|MO|DO|filling|restor|etch|bond|shade|composite)\b/i] },
      { alt: /centric relation/i, cues: [/\b(?:occlusion|bite|MIP|jaw|articulat|centric)\b/i] }
    ]
  },
  {
    displays: /^GP$/i,
    alts: [
      { alt: /gutta-percha/i, cues: [/\b(?:RCT|root canal|obtura|canal|endo|sealer)\b/i] },
      { alt: /general practitioner/i, cues: [/\b(?:referral|referred|physician|medical)\b/i] }
    ]
  },
  {
    displays: /^GI$/i,
    alts: [
      { alt: /glass ionomer/i, cues: [/\b(?:cement|liner|restor|filling|base|Fuji|#\d)\b/i] },
      {
        alt: /gastrointestinal/i,
        cues: [/\b(?:stomach|nausea|GERD|digest|upset|medical history)\b/i]
      }
    ]
  },
  {
    displays: /^EXT$/i,
    alts: [
      { alt: /^extraction$/i, cues: [/\b(?:forceps|socket|hemostasis|extracted|#\d|tooth\s*\d)\b/i] },
      { alt: /^extension$/i, cues: [/\b(?:temp|temporary|margin|bridge|pontic)\b/i] }
    ]
  },
  {
    displays: /^(?:FMS|FMX)$/i,
    alts: [
      { alt: /full-mouth radiographic/i, cues: [/\b(?:radiograph|x-?ray|pano|BW|PA|series)\b/i] },
      { alt: /fibromyalgia/i, cues: [/\b(?:chronic|joint|muscle|fibro|pain syndrome)\b/i] }
    ]
  },
  {
    displays: /^NKA$/i,
    alts: [
      { alt: /no known drug allergies/i, cues: [/\b(?:drug|medication|NKDA|penicillin|latex)\b/i] },
      { alt: /no known allergies/i, cues: [/\b(?:allerg)\b/i] }
    ]
  },
  {
    displays: /^LA$/i,
    alts: [
      { alt: /local anesth/i, cues: [/\b(?:lido|articaine|carpule|infiltrat|block|mg|mL)\b/i] }
    ]
  },
  {
    displays: /^CC$/i,
    alts: [
      { alt: /chief complaint/i, cues: [/\b(?:presents|c\/o|pain|complaint|CC:)\b/i] },
      { alt: /cubic centimetres|mL/i, cues: [/\b(?:mL|cc of|volume)\b/i] }
    ]
  },
  {
    displays: /^CAL$/i,
    alts: [
      { alt: /clinical attachment/i, cues: [/\b(?:probing|periodont|mm|attachment)\b/i] },
      { alt: /calcium/i, cues: [/\b(?:supplement|serum|lab)\b/i] }
    ]
  },
  {
    displays: /^PSA$/i,
    alts: [
      { alt: /posterior superior alveolar/i, cues: [/\b(?:block|anesthet|maxillary|molar)\b/i] },
      { alt: /prostate-specific/i, cues: [/\b(?:lab|ng\/mL|prostate|PSA level)\b/i] }
    ]
  },
  {
    displays: /^PD$/i,
    alts: [
      {
        alt: /probing depth|pocket depth/i,
        cues: [/\b(?:mm|probing|BOP|bleeding on probing|periodont|pockets?)\b/i]
      },
      {
        alt: /partial denture/i,
        cues: [/\b(?:denture|framework|clasp|try-?in|retention|acrylic)\b/i]
      },
      {
        alt: /periodontal disease/i,
        cues: [/\b(?:periodontal disease|periodontitis|stage|grade)\b/i]
      }
    ]
  },
  {
    displays: /^PPD$/i,
    alts: [
      { alt: /probing pocket depth/i, cues: [/\b(?:mm|probing|periodont|pocket)\b/i] },
      {
        alt: /purified protein derivative|tuberculin/i,
        cues: [/\b(?:TB|tuberculin|PPD skin|latent|quantiferon)\b/i]
      }
    ]
  },
  {
    displays: /^MI$/i,
    alts: [
      {
        alt: /maximum intercuspation/i,
        cues: [/\b(?:occlusion|bite|excursions?|intercusp|articulat|MIP)\b/i]
      },
      {
        alt: /myocardial infarction/i,
        cues: [/\b(?:cardiac|cardiology|heart attack|chest pain|history of MI|hx of MI)\b/i]
      }
    ]
  },
  {
    displays: /^CAD$/i,
    alts: [
      {
        alt: /coronary artery disease/i,
        cues: [/\b(?:cardiac|heart|medical history|cardiology|stent)\b/i]
      },
      {
        alt: /computer-aided design|CAD\/CAM/i,
        cues: [/\b(?:CAD\/CAM|milled|ceramic|crown design|lab scan)\b/i]
      }
    ]
  },
  {
    displays: /^RA$/i,
    alts: [
      {
        alt: /rheumatoid arthritis/i,
        cues: [/\b(?:arthritis|joints?|autoimmune|methotrexate|medical history)\b/i]
      },
      {
        alt: /relative analgesia/i,
        cues: [/\b(?:nitrous|N2O|oxygen|sedation)\b|\d+\s*%/i]
      }
    ]
  },
  {
    displays: /^cap$/i,
    alts: [
      { alt: /capsule/i, cues: [/\b(?:mg|dose|take|rx|capsule|po)\b/i] },
      { alt: /crown/i, cues: [/\b(?:tooth|#\d|prep|temp|cement|crown)\b/i] }
    ]
  },
  {
    displays: /^ASA$/i,
    alts: [
      {
        alt: /anterior superior alveolar/i,
        cues: [/\b(?:block|anesthet|infiltrat|nerve)\b/i]
      },
      {
        alt: /American Society of Anesthesiologists|physical status/i,
        cues: [/\b(?:ASA\s*[IV]+|physical status|sedation consult|medical risk)\b/i]
      },
      {
        alt: /acetylsalicylic|aspirin/i,
        cues: [/\b(?:aspirin|81\s*mg|blood thinner|antiplatelet)\b/i]
      }
    ]
  },
  {
    displays: /^qd$/i,
    alts: [
      { alt: /^daily$/i, cues: [/\b(?:once\s+a\s+day|every\s+day|daily|q\.?\s*d\.?)\b/i] },
      {
        alt: /four times daily|qid/i,
        cues: [/\b(?:four\s+times|qid|q\.?\s*i\.?\s*d\.?)\b/i]
      },
      {
        alt: /every other day|qod/i,
        cues: [/\b(?:every\s+other\s+day|qod|q\.?\s*o\.?\s*d\.?)\b/i]
      }
    ]
  },
  {
    displays: /^qod$/i,
    alts: [
      {
        alt: /every other day/i,
        cues: [/\b(?:every\s+other|alternate\s+day|q\.?\s*o\.?\s*d\.?)\b/i]
      },
      { alt: /^daily$/i, cues: [/\b(?:once\s+a\s+day|every\s+day|daily)\b/i] }
    ]
  },
  {
    displays: /^ac\s*\/\s*pc$/i,
    alts: [
      { alt: /before meals/i, cues: [/\b(?:before\s+meals?|a\.?\s*c\.?|preprandial)\b/i] },
      { alt: /after meals/i, cues: [/\b(?:after\s+meals?|p\.?\s*c\.?|postprandial)\b/i] }
    ]
  }
];

/** Tooth-number / surface cues tilt restorative readings without claiming facts. */
const RESTORATIVE_CONTEXT = /\b(?:#?\d{1,2}|tooth\s*\d{1,2}|MOD|MO|DO|OL|OB)\b/i;

/**
 * Propose the best-fitting alternative for an ambiguous display token,
 * using only surrounding note text. Returns undefined when cues do not
 * clearly favor one reading (safer to ask without a hint).
 */
export function proposeReading(
  display: string,
  alternatives: string[],
  surroundingText: string
): ReadingProposal | undefined {
  if (alternatives.length < 2) return undefined;
  const family = FAMILIES.find((f) => f.displays.test(display));
  const restorativeBoost =
    RESTORATIVE_CONTEXT.test(surroundingText) &&
    /^(?:CR|GI|EXT|cap)$/i.test(display);

  const scores = alternatives.map((alt) => {
    let score = 0;
    if (family) {
      for (const row of family.alts) {
        if (!row.alt.test(alt)) continue;
        for (const cue of row.cues) {
          if (cue.test(surroundingText)) score += 0.45;
        }
      }
    } else {
      // Generic fallback: distinctive words from the alternative appear nearby.
      const words = alt
        .replace(/\([^)]*\)/g, "")
        .split(/[^a-zA-Z]+/)
        .filter((w) => w.length > 4);
      for (const w of words) {
        if (new RegExp(`\\b${w}\\b`, "i").test(surroundingText)) score += 0.2;
      }
    }
    if (restorativeBoost) {
      if (/^(?:CR|GI)$/i.test(display) && /(?:composite resin|glass ionomer)/i.test(alt)) {
        score += 0.2;
      } else if (/^EXT$/i.test(display) && /^extraction$/i.test(alt)) {
        score += 0.2;
      } else if (/^cap$/i.test(display) && /\bcrown\b/i.test(alt)) {
        score += 0.2;
      }
    }
    return { alt, score };
  });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];
  if (!best || best.score < 0.4) return undefined;
  if (second && best.score - second.score < 0.15) return undefined;

  return {
    suggested: best.alt,
    rationale: `Nearby wording fits "${best.alt}" better than the other listed meanings. Write that out if it is what you mean — do not leave the shorthand.`,
    strength: Math.min(1, best.score)
  };
}
