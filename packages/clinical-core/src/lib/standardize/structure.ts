// DETERMINISTIC SOAP STRUCTURING — sorting a note into sections with no model.
//
// WHY THIS EXISTS. The app already has a `soap` capability and it is AI-only, and
// AI is OFF BY DEFAULT (`ASSIST_ENABLED` unset, two switches required). So for the
// deployment a practice actually gets on day one, the transformer expanded
// vocabulary and did nothing about structure — and structure is most of what makes
// a note readable to the next person. A hygienist typing between patients writes
// in the order things happened, not in the order a reader needs them.
//
// THE ONE THING THIS DOES, stated so it cannot drift: it MOVES SENTENCES. It does
// not reword them, merge them, split them, drop them, or add any text except the
// section headings themselves. Every sentence of the input appears in the output
// exactly once and byte-identical, which is an invariant a test can check and
// structure.test.ts does check, on every case.
//
// That constraint is what makes reordering safe on a legal record. The AI soap
// capability has the same contract and needs a verifier to enforce it, because a
// model can silently reword while reorganising. This cannot: it is a partition of
// a list.
//
// WHY IT IS NOT PART OF standardize(). Two reasons. The inline builder button
// standardizes ONE FIELD, and sectioning a single field's value would be absurd.
// And reordering is a bigger claim than substituting a word, so it is a separate,
// named action a person chooses — "Structure as SOAP" — rather than something that
// happens to a note while they were asking for spellings.

export const SOAP_SECTIONS = ["Safety", "Subjective", "Objective", "Assessment", "Plan"] as const;
export type SoapSection = (typeof SOAP_SECTIONS)[number];

export interface StructureResult {
  text: string;
  /** Which sections got content, in canonical order. */
  sections: SoapSection[];
  /** Sentences placed by inheriting the previous sentence's section. */
  inherited: number;
  /** True when the input already looked sectioned and was left alone. */
  alreadyStructured: boolean;
  /** True when the note was too short or too uniform to be worth sectioning. */
  declined: boolean;
}

/**
 * Cue words, per section, most specific first.
 *
 * These are the words a dental note actually uses to signal what a sentence is
 * doing. They are matched case-insensitively on word boundaries, and a sentence is
 * scored against every section rather than assigned by the first hit — so "the
 * patient reports the radiograph was taken elsewhere" is weighed rather than
 * grabbed by whichever list happened to be checked first.
 *
 * DECISIVE cues are labels: a sentence beginning "Diagnosis:" is an assessment
 * whatever else it contains, and one beginning "Plan:" is a plan. Those outrank
 * any number of ordinary cues, because the writer has said outright what the
 * sentence is.
 */
const DECISIVE: Partial<Record<SoapSection, RegExp>> = {
  Subjective: /^\s*(?:chief complaint|subjective)\s*:/i,
  Objective: /^\s*objective\s*:/i,
  Assessment: /^\s*(?:diagnosis|assessment|impression)\s*:/i,
  Plan: /^\s*(?:plan|treatment plan|recommendation)\s*:/i,
  Safety: /^\s*(?:safety|alert|allergies|medical history)\s*:/i
};

const CUES: Record<SoapSection, RegExp[]> = {
  // Anything that changes whether treatment is safe to give today.
  Safety: [
    /\ballerg(?:y|ies|ic)\b/i,
    /\bNK[AD]A?\b/i,
    /\bmedical history\b/i,
    /\bmedication(?:s)?\b/i,
    /\bpremedicat/i,
    /\bantibiotic prophylaxis\b/i,
    /\bblood pressure\b/i,
    /\bvitals?\b/i,
    /\bpregnan/i,
    /\banticoagul/i,
    /\bbisphosphonate/i,
    /\blatex\b/i,
    /\bASA\s?[IV]+\b/,
    /\bcontraindicat/i,
    /\bpast medical history\b/i
  ],
  // What the patient or caregiver said. Attribution is the signal.
  Subjective: [
    /\b(?:patient|pt|parent|guardian|caregiver)\s+(?:reports?|states?|stated|denies|denied|describes?|says?|complains?\s+of)\b/i,
    /\bc\/o\b/i,
    /\bcomplains? of\b/i,
    /\bchief complaint\b/i,
    /\breports?\b/i,
    /\bper (?:the )?(?:patient|parent|guardian)\b/i,
    /\bhistory of present illness\b/i,
    /\brecall (?:patient|pt|visit)\b/i,
    /\bpresent(?:ed|s) (?:for|with)\b/i
  ],
  // What was examined, measured, imaged, or done.
  Objective: [
    /\b(?:examin|palpat|percuss|prob)\w*\b/i,
    /\bradiograph|bitewing|periapical|panoramic|CBCT\b/i,
    /\bprobing depths?\b/i,
    /\bmobility\b/i,
    /\bcaries\b/i,
    /\bcalculus|plaque\b/i,
    /\bocclusion\b/i,
    /\btissue\b/i,
    /\b(?:placed|completed|administered|delivered|seated|cemented|removed|extracted|restored|irrigated|sutured)\b/i,
    /\bcarpules?\b/i,
    /\banesthe(?:tic|sia)\b/i,
    /\bisolation\b/i,
    /\bhemostasis\b/i,
    /\bprophylaxis\b/i,
    /\bscaling and root planing\b/i,
    /\bno (?:new )?caries\b/i,
    /\bmm\b/
  ],
  // Diagnoses and clinical conclusions the note already contains.
  Assessment: [
    /\bdiagnosis\b/i,
    /\bdx\b/i,
    /\bimpression\b/i,
    /\b(?:ir)?reversible pulpitis\b/i,
    /\bpericoronitis|periodontitis|gingivitis|abscess|necrosis\b/i,
    /\bconsistent with\b/i,
    /\bstage [I-V]+|grade [A-C]\b/,
    /\bprognosis\b/i
  ],
  // Planned treatment, instructions, follow-up, referrals.
  Plan: [
    /\bplan\b/i,
    /\brecommend/i,
    /\brefer(?:red|ral)?\b/i,
    /\breappoint\b/i,
    /\bfollow[- ]?up\b/i,
    /\bf\/u\b/i,
    /\bprescription|prescribed\b/i,
    /\brx\b/i,
    /\binstructions?\b/i,
    /\badvised\b/i,
    /\bschedul/i,
    /\bnext visit\b/i,
    /\bmonitor\b/i,
    /\bcontinuing care\b/i,
    /\boral hygiene instruction/i,
    /\bpostoperative instructions?\b/i
  ]
};

/** How much a decisive label outweighs ordinary cues. */
const DECISIVE_WEIGHT = 100;

/**
 * Priority for breaking a genuine tie.
 *
 * Safety first because a missed allergy is the worst outcome on this list, and a
 * safety sentence filed under Objective is a safety sentence a reader skims past.
 * Assessment and Plan next because they are the sections a later reader goes
 * looking for. Objective last because it is the natural home of narrative and
 * therefore the least informative match.
 */
const TIE_BREAK: SoapSection[] = ["Safety", "Assessment", "Plan", "Subjective", "Objective"];

function classify(sentence: string): { section: SoapSection | null; score: number } {
  let best: SoapSection | null = null;
  let bestScore = 0;
  for (const section of SOAP_SECTIONS) {
    const decisive = DECISIVE[section];
    let score = decisive?.test(sentence) ? DECISIVE_WEIGHT : 0;
    for (const cue of CUES[section]) if (cue.test(sentence)) score++;
    if (score === 0) continue;
    if (
      score > bestScore ||
      (score === bestScore && best !== null && TIE_BREAK.indexOf(section) < TIE_BREAK.indexOf(best))
    ) {
      best = section;
      bestScore = score;
    }
  }
  return { section: best, score: bestScore };
}

/**
 * Split into sentences WITHOUT losing a character.
 *
 * The terminator stays attached to its sentence, and the whitespace between
 * sentences is dropped only because the output rebuilds it as one space per line.
 * A dotted abbreviation is not a boundary — "p.r.n. pain" is one instruction, and
 * splitting there would file half a prescription in a different section.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buffer = "";
  const tokens = text.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^\s+$/.test(token)) {
      if (buffer) buffer += " ";
      continue;
    }
    buffer += token;
    const endsSentence =
      /[.!?]["')\]]?$/.test(token) &&
      // Not an abbreviation's own period: "p.r.n.", "b.i.d.", "Dr."
      !/(?:\b[A-Za-z]\.){2,}["')\]]?$/.test(token) &&
      !/\b(?:Dr|Mr|Mrs|Ms|St|vs|approx|etc|no)\.$/i.test(token);
    if (endsSentence) {
      out.push(buffer.trim());
      buffer = "";
    }
  }
  if (buffer.trim()) out.push(buffer.trim());
  return out;
}

/** Already sectioned? Then leave it entirely alone. */
function looksStructured(text: string): boolean {
  const headed = SOAP_SECTIONS.filter((s) =>
    new RegExp(`^\\s*(?:#{1,4}\\s*)?${s}\\s*:?\\s*$`, "im").test(text)
  );
  return headed.length >= 2;
}

/**
 * Sort a note into SOAP sections.
 *
 * An unclassifiable sentence INHERITS the previous sentence's section, which is
 * not a fudge — it is how notes are actually written. People write in runs: a few
 * sentences about what the patient said, then a few about what they found, then
 * the plan. A sentence with no cue of its own almost always continues the thought
 * before it, and inheriting keeps a run together instead of scattering its middle
 * into Objective.
 *
 * A leading run with no cues goes to Subjective, because that is what opens a
 * note: the reason the person is in the chair.
 */
export function structureIntoSoap(input: string): StructureResult {
  const source = input.trim();
  if (looksStructured(source)) {
    return {
      text: input,
      sections: [],
      inherited: 0,
      alreadyStructured: true,
      declined: false
    };
  }

  const { partitions, inherited } = partition(source);
  if (partitions.length < 2) {
    return { text: input, sections: [], inherited, alreadyStructured: false, declined: true };
  }

  const text = partitions.map((p) => `${p.section}\n${p.text}`).join("\n\n");

  return {
    text,
    sections: partitions.map((p) => p.section),
    inherited,
    alreadyStructured: false,
    declined: false
  };
}

/** One SOAP section's worth of the input, in the order the sentences arrived. */
export interface SoapPartition {
  section: SoapSection;
  /** The sentences of this section, joined — byte-identical to the input's. */
  text: string;
  sentences: string[];
}

/**
 * The same sort, handed back as parts rather than as one re-headed string.
 *
 * structureIntoSoap answers "what does this note look like sectioned", which is
 * the right answer when the destination is a textarea. The note builder's
 * destination is FIELDS, and it needs to know which sentences belong to which
 * one so a person can send them there — a joined string with headings in it
 * would have to be re-split by whoever received it, and a second splitter is a
 * second thing to disagree with this one.
 *
 * Same guarantee as structureIntoSoap, and the same test enforces it on both:
 * this MOVES sentences. It does not reword, merge, split, drop, or add. Every
 * sentence of the input appears in exactly one partition, byte-identical.
 *
 * Returns [] where structureIntoSoap would decline — already sectioned, under
 * three sentences, or everything landing in one section. An empty result means
 * "there is no sorting to offer here", and the caller should show the writer
 * their text as they typed it rather than an empty panel.
 */
export function partitionIntoSoap(input: string): SoapPartition[] {
  const source = input.trim();
  if (looksStructured(source)) return [];
  const { partitions } = partition(source);
  return partitions.length < 2 ? [] : partitions;
}

function partition(source: string): { partitions: SoapPartition[]; inherited: number } {
  const sentences = splitSentences(source);
  // Below three sentences there is nothing to sort, and a two-line note under five
  // headings reads worse than the two lines did.
  if (sentences.length < 3) return { partitions: [], inherited: 0 };

  const buckets = new Map<SoapSection, string[]>();
  let previous: SoapSection | null = null;
  let inherited = 0;

  for (const sentence of sentences) {
    const { section } = classify(sentence);
    let placed = section;
    if (placed === null) {
      placed = previous ?? "Subjective";
      inherited++;
    }
    const list = buckets.get(placed) ?? [];
    list.push(sentence);
    buckets.set(placed, list);
    previous = placed;
  }

  // Canonical section order, not first-appearance order: a reader expects
  // Safety before Subjective before Objective whatever order they were written.
  const partitions = SOAP_SECTIONS.filter((s) => (buckets.get(s)?.length ?? 0) > 0).map((s) => {
    const sentences = buckets.get(s)!;
    return { section: s, sentences, text: sentences.join(" ") };
  });

  return { partitions, inherited };
}
