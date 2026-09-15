// THE CLAUSE PARSER — shorthand in, structured clinical facts out.
//
// Read the header of facts.ts first; the read-only invariant stated there is
// what makes this file safe to have at all.
//
// ===========================================================================
// THE GRAMMAR, in EBNF. Written down because a grammar that lives only in the
// control flow is a grammar nobody can review.
//
//   Clause      := Segment*
//   Segment     := SiteGroup | Procedure | <ignored>
//   SiteGroup   := ToothIntro ToothList Surfaces?
//   ToothIntro  := "#" | "tooth" | "teeth" | "no" "."
//   ToothList   := ToothRef ( ("," | "and" | "&") ToothRef )*
//                | ToothRef "-" ToothRef                     (* inclusive range *)
//   ToothRef    := UniversalNumber | PrimaryLetter
//   Surfaces    := UPPERCASE [MOIDBFL]+
//   Procedure   := <literal from vocab/procedures.ts, longest match>
//
// ===========================================================================
// THREE RULES THAT KEEP THIS HONEST
//
// 1. A BARE NUMBER IS NEVER A TOOTH. It must be introduced by "#", "tooth",
//    "teeth" or "no.", or continue a list that was. "2 carpules", "3 mm",
//    "16 units" and every date, count and measurement in a note are numbers in
//    exactly the same range as tooth designators, and the only thing that
//    distinguishes them is the word in front. This is the single most important
//    rule in the file.
//
// 2. AN INTRODUCER IS NOT ENOUGH EITHER. "Lot #4432", "Op #2", "chair #3" all
//    carry a hash. The negative-context list is shared with notation.ts, which
//    learned it the hard way.
//
// 3. SURFACES MUST BE UPPERCASE. "MOD" is a surface string; "mod" is a word,
//    and so are "do", "of", "bill", "lid" and "old" — every one of them a
//    plausible letter-run over {M,O,I,D,B,F,L}. Requiring the case the writer
//    used to signal notation costs us the writer who types lowercase, and the
//    alternative costs us a chart drawn from the word "do". The lowercase case
//    is recoverable later by ASKING; a wrong surface on a legal record is not.
//
// REFUSAL IS FREE AND IS THE DEFAULT. A clause that matches nothing contributes
// a span to `unparsed` and no facts. Nothing is repaired, nothing is guessed.

import { getTooth, allowedSurfaces } from "@/lib/vocab/teeth";
import { PROCEDURE_TERMS_BY_LENGTH, type ProcedureTerm } from "@/lib/vocab/procedures";
import {
  CARE_EVENT_TERMS_BY_LENGTH,
  DOSE_UNITS,
  DRUG_SHORTHAND,
  FINDING_TERMS_BY_LENGTH,
  MATERIAL_TERMS_BY_LENGTH,
  MEASURE_UNITS
} from "@/lib/vocab/clinical-terms";
import { MEDICATION_WORDS } from "@/lib/vocab/misspellings";
import type { Surface } from "@/lib/schema/types";
import { assertionFor, findMatches, type Match } from "./context";
import { clauseRanges, tokenize, type Token } from "./tokenize";
import type {
  CareEventFact,
  ClinicalFact,
  Quadrant,
  ExtractionResult,
  FindingFact,
  MaterialFact,
  MeasurementFact,
  MedicationFact,
  ProcedureFact,
  Span,
  ToothSite,
  ToothSiteFact
} from "./facts";

/**
 * Words that make a following "#N" something other than a tooth.
 *
 * Kept in step with NOT_A_TOOTH_CONTEXT in standardize/notation.ts. Both lists
 * exist because operatory numbers, lot numbers and claim numbers live in the
 * same numeric range as tooth designators and read identically.
 */
const NOT_A_TOOTH_CONTEXT = new Set([
  "op",
  "operatory",
  "room",
  "chair",
  "lot",
  "batch",
  "ref",
  "reference",
  "invoice",
  "claim",
  "acct",
  "account",
  "order",
  "item",
  "serial",
  "model",
  "shade",
  "unit",
  "page",
  "box",
  "code"
]);

const TOOTH_INTRO_WORDS = new Set(["tooth", "teeth", "no"]);
const LIST_JOINERS = new Set([",", "&"]);
const SURFACE_LETTERS = new Set(["M", "O", "I", "D", "B", "F", "L"]);

function isToothNumberToken(t: Token): boolean {
  if (t.kind !== "number") return false;
  const digits = t.digits ?? t.text;
  if (!/^\d{1,2}$/.test(digits)) return false;
  const n = Number(digits);
  return n >= 1 && n <= 32;
}

function isPrimaryLetterToken(t: Token): boolean {
  return t.kind === "word" && /^[A-T]$/.test(t.text);
}

function toothIdOf(t: Token): string | undefined {
  if (isToothNumberToken(t)) return String(Number(t.digits ?? t.text));
  if (isPrimaryLetterToken(t)) return t.text.toUpperCase();
  return undefined;
}

/**
 * Read a surface string if the token at `i` is one.
 *
 * Validated against the tooth it attaches to: an occlusal surface on an
 * incisor is anatomically impossible, and so is an incisal surface on a molar.
 * Impossible surfaces are RECORDED, not dropped — the audit engine decides what
 * they mean, and this layer's contract is to report what the note said even
 * when what it said is wrong.
 */
function readSurfaces(
  tokens: Token[],
  i: number,
  toothId: string
): { surfaces: Surface[]; impossible: string[]; end: number } | undefined {
  const t = tokens[i];
  if (!t || t.kind !== "word") return undefined;
  if (t.text !== t.text.toUpperCase()) return undefined; // rule 3
  if (t.text.length < 1 || t.text.length > 5) return undefined;
  const letters = t.text.split("");
  if (!letters.every((c) => SURFACE_LETTERS.has(c))) return undefined;
  // A single letter is too weak a signal on its own: "#14 D" could be a distal
  // surface or an initial. Two or more letters is unambiguous notation.
  if (letters.length < 2) return undefined;
  if (new Set(letters).size !== letters.length) return undefined; // "MMO" is not notation

  const allowed = new Set(allowedSurfaces(toothId));
  const surfaces: Surface[] = [];
  const impossible: string[] = [];
  for (const c of letters) {
    const s = c as Surface;
    if (allowed.has(s)) surfaces.push(s);
    else impossible.push(c);
  }
  return { surfaces, impossible, end: i + 1 };
}

interface ParsedSites {
  sites: ToothSite[];
  /** Token index just past the group. */
  end: number;
  tokenFrom: number;
}

/**
 * Parse a site group starting at token `i`, or return undefined.
 */
function readSiteGroup(tokens: Token[], i: number, clauseEnd: number): ParsedSites | undefined {
  const start = i;
  const intro = tokens[i];
  if (!intro) return undefined;

  let cursor = i;
  if (intro.kind === "hash") {
    const prev = tokens[i - 1];
    if (prev && prev.kind === "word" && NOT_A_TOOTH_CONTEXT.has(prev.lower)) return undefined; // rule 2
    cursor = i + 1;
  } else if (intro.kind === "word" && TOOTH_INTRO_WORDS.has(intro.lower)) {
    cursor = i + 1;
    // "no" only introduces a tooth as "no." — bare "no" is the highest-yield
    // negation trigger in the literature and must not be eaten here.
    if (intro.lower === "no") {
      const dot = tokens[cursor];
      if (!dot || dot.kind !== "punct" || dot.text !== ".") return undefined;
      cursor++;
    }
  } else {
    return undefined;
  }

  const ids: Array<{ id: string; from: number; to: number }> = [];
  const readOne = (): boolean => {
    // A hash may repeat inside a list: "#3, #14".
    if (tokens[cursor]?.kind === "hash") cursor++;
    const tok = tokens[cursor];
    if (!tok || cursor >= clauseEnd) return false;
    const id = toothIdOf(tok);
    if (id === undefined) return false;
    ids.push({ id, from: cursor, to: cursor + 1 });
    cursor++;
    return true;
  };

  if (!readOne()) return undefined;

  // Range or list continuation.
  for (;;) {
    const joiner = tokens[cursor];
    if (!joiner || cursor >= clauseEnd) break;

    const isRange = joiner.kind === "punct" && (joiner.text === "-" || joiner.text === "–");
    const isList =
      (joiner.kind === "punct" && LIST_JOINERS.has(joiner.text)) ||
      (joiner.kind === "word" && joiner.lower === "and");
    if (!isRange && !isList) break;

    const save = cursor;
    cursor++;
    const before = ids.length;
    if (!readOne()) {
      cursor = save;
      break;
    }
    if (isRange && before > 0) {
      // Expand an inclusive range, permanent numbering only. Ranges across the
      // letter dentition, and ranges that run backwards, are refused rather
      // than interpreted: "T-C" has no single obvious reading.
      const from = Number(ids[before - 1].id);
      const to = Number(ids[before].id);
      if (Number.isInteger(from) && Number.isInteger(to) && to > from && to - from <= 15) {
        const inserted = ids.pop()!;
        for (let n = from + 1; n <= to; n++) {
          ids.push({ id: String(n), from: inserted.from, to: inserted.to });
        }
      }
    }
  }

  const sites: ToothSite[] = [];
  for (let k = 0; k < ids.length; k++) {
    const entry = ids[k];
    if (!getTooth(entry.id)) continue;
    let span: Span = { start: tokens[entry.from].start, end: tokens[entry.to - 1].end };
    let surfaces: Surface[] = [];
    let impossible: string[] = [];
    // Surfaces attach to the LAST tooth in a list ("#3, 14, 30 MOD" is read as
    // MOD on 30 only) unless the list has one member. That is conservative on
    // purpose: distributing surfaces across a list is a guess about intent.
    if (k === ids.length - 1) {
      const read = readSurfaces(tokens, cursor, entry.id);
      if (read) {
        surfaces = read.surfaces;
        impossible = read.impossible;
        span = { start: span.start, end: tokens[cursor].end };
        cursor = read.end;
      }
    }
    sites.push({ toothId: entry.id, surfaces, span, impossibleSurfaces: impossible });
  }

  if (sites.length === 0) return undefined;
  return { sites, end: cursor, tokenFrom: start };
}

/**
 * Term tables indexed by their FIRST token.
 *
 * The tables are searched at every token position in every clause, and there
 * are about 175 terms across the four of them. Scanning all of them at every
 * position is O(positions x terms), which on a loaded note was a measurable
 * share of an audit that runs on every keystroke.
 *
 * Bucketing by first token turns the common case — a word that begins no term
 * at all, which is most words — into one Map lookup that misses. Buckets stay
 * in longest-literal-first order, so "root canal therapy" still beats "root
 * canal" and the result is byte-identical to the linear scan it replaces.
 *
 * Built lazily and cached: a WeakMap keyed on the table array, so a table is
 * indexed once per process rather than once per call, without this module
 * needing to know how many tables exist.
 */
const literalIndexCache = new WeakMap<object, Map<string, unknown[]>>();

function literalIndex<T extends { literal: string[] }>(table: T[]): Map<string, T[]> {
  const cached = literalIndexCache.get(table);
  if (cached) return cached as Map<string, T[]>;
  const index = new Map<string, T[]>();
  for (const term of table) {
    const key = term.literal[0];
    const bucket = index.get(key);
    if (bucket) bucket.push(term);
    else index.set(key, [term]);
  }
  literalIndexCache.set(table, index as Map<string, unknown[]>);
  return index;
}

/** Match the longest literal from a table at position `i`. */
function readLiteral<T extends { literal: string[] }>(
  table: T[],
  tokens: Token[],
  i: number,
  clauseEnd: number
): { term: T; from: number; to: number } | undefined {
  const candidates = literalIndex(table).get(tokens[i].lower);
  if (!candidates) return undefined;
  for (const term of candidates) {
    const len = term.literal.length;
    if (i + len > clauseEnd) continue;
    let ok = true;
    for (let k = 1; k < len; k++) {
      if (tokens[i + k].lower !== term.literal[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return { term, from: i, to: i + len };
  }
  return undefined;
}

function readProcedure(
  tokens: Token[],
  i: number,
  clauseEnd: number
): { term: ProcedureTerm; from: number; to: number } | undefined {
  return readLiteral(PROCEDURE_TERMS_BY_LENGTH, tokens, i, clauseEnd);
}

/**
 * Quadrant references in a clause.
 *
 * UPPERCASE ONLY for the two-letter codes, matching the discipline the
 * shorthand table already applies to them and for the reason its comment gives:
 * "ur", "ul", "ll" and "lr" turn up inside ordinary typing far more often than
 * they turn up as quadrants. The spelled forms are matched case-insensitively,
 * because there is nothing else "upper right" can mean here.
 */
const QUADRANT_CODES: Record<string, Quadrant> = { UR: "UR", UL: "UL", LL: "LL", LR: "LR" };
const QUADRANT_WORDS: Array<{ words: string[]; quadrant: Quadrant }> = [
  { words: ["upper", "right"], quadrant: "UR" },
  { words: ["upper", "left"], quadrant: "UL" },
  { words: ["lower", "left"], quadrant: "LL" },
  { words: ["lower", "right"], quadrant: "LR" },
  { words: ["maxillary", "right"], quadrant: "UR" },
  { words: ["maxillary", "left"], quadrant: "UL" },
  { words: ["mandibular", "left"], quadrant: "LL" },
  { words: ["mandibular", "right"], quadrant: "LR" }
];

function readQuadrants(tokens: Token[], from: number, to: number): Quadrant[] {
  const found: Quadrant[] = [];
  const add = (q: Quadrant) => {
    if (!found.includes(q)) found.push(q);
  };
  for (let i = from; i < to; i++) {
    const tok = tokens[i];
    if (tok.kind !== "word") continue;
    const code = QUADRANT_CODES[tok.text];
    if (code) {
      add(code);
      continue;
    }
    for (const entry of QUADRANT_WORDS) {
      if (i + entry.words.length > to) continue;
      let ok = true;
      for (let k = 0; k < entry.words.length; k++) {
        if (tokens[i + k].lower !== entry.words[k]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        add(entry.quadrant);
        break;
      }
    }
  }
  return found;
}

const numberOf = (t: Token | undefined): number | undefined => {
  if (!t || t.kind !== "number") return undefined;
  const n = Number(t.digits ?? t.text);
  return Number.isFinite(n) ? n : undefined;
};

const DOSE_UNIT_BY_TOKEN = new Map(DOSE_UNITS.map((u) => [u.token, u]));
const MEASURE_UNIT_BY_TOKEN = new Map(MEASURE_UNITS.map((u) => [u.token, u.unit]));

/**
 * A number followed by a unit, optionally a range ("4-5 mm").
 *
 * THIS ALSO PROTECTS THE TOOTH RULE. "2 carp", "3 mm" and "600 mg" are numbers
 * in tooth range, and consuming them here as measurements means they are gone
 * before anything else can look at them. The rule that a bare number is never a
 * tooth already covered this, but two independent mechanisms agreeing is how
 * that rule stays true when someone edits one of them.
 */
function readQuantity(
  tokens: Token[],
  i: number,
  clauseEnd: number
): { amount: number; amountMax?: number; unitToken: string; from: number; to: number } | undefined {
  const amount = numberOf(tokens[i]);
  if (amount === undefined) return undefined;
  let cursor = i + 1;
  let amountMax: number | undefined;

  // A range: "4-5 mm".
  if (tokens[cursor]?.kind === "punct" && (tokens[cursor].text === "-" || tokens[cursor].text === "–")) {
    const high = numberOf(tokens[cursor + 1]);
    if (high !== undefined && high > amount) {
      amountMax = high;
      cursor += 2;
    }
  }

  const unitTok = tokens[cursor];
  if (!unitTok || cursor >= clauseEnd) return undefined;
  if (unitTok.kind === "punct" && unitTok.text === "%") {
    return { amount, amountMax, unitToken: "%", from: i, to: cursor + 1 };
  }
  if (unitTok.kind !== "word") return undefined;
  const key = unitTok.lower;
  if (!DOSE_UNIT_BY_TOKEN.has(key) && !MEASURE_UNIT_BY_TOKEN.has(key)) return undefined;
  return { amount, amountMax, unitToken: key, from: i, to: cursor + 1 };
}

/**
 * Blood pressure: "BP 128/78".
 *
 * Its own reader because it is the one vital written as two numbers over a
 * slash, which no unit-based reader can see. It earns the special case: blood
 * pressure is the vital that decides whether treatment goes ahead today, and a
 * note that recorded it should not read as a note that did not.
 */
function readBloodPressure(
  tokens: Token[],
  i: number,
  clauseEnd: number
): { systolic: number; diastolic: number; from: number; to: number } | undefined {
  const label = tokens[i];
  if (!label || label.kind !== "word") return undefined;
  if (label.lower !== "bp" && label.lower !== "b/p") return undefined;
  const systolic = numberOf(tokens[i + 1]);
  const slash = tokens[i + 2];
  const diastolic = numberOf(tokens[i + 3]);
  if (systolic === undefined || diastolic === undefined) return undefined;
  if (!slash || slash.kind !== "punct" || slash.text !== "/") return undefined;
  if (i + 4 > clauseEnd) return undefined;
  return { systolic, diastolic, from: i, to: i + 4 };
}

/**
 * A drug, with any amount the clause attached to it.
 *
 * The amount may sit either side — "600 mg ibuprofen" and "ibuprofen 600 mg"
 * are both ordinary — so this looks backward first (the shorthand convention in
 * an anesthetic line, "2 carp lido") and then forward.
 */
function readMedication(
  tokens: Token[],
  i: number,
  clauseEnd: number
):
  | {
      drug: string;
      amount?: number;
      unitToken?: string;
      concentrationPercent?: number;
      from: number;
      to: number;
    }
  | undefined {
  const tok = tokens[i];
  if (!tok || tok.kind !== "word") return undefined;
  const drug = DRUG_SHORTHAND[tok.lower] ?? (MEDICATION_WORDS.has(tok.lower) ? tok.lower : undefined);
  if (!drug) return undefined;

  let from = i;
  let to = i + 1;
  let amount: number | undefined;
  let unitToken: string | undefined;

  // Backward: "2 carp lido", "600 mg ibuprofen".
  for (let back = i - 2; back >= Math.max(0, i - 3); back--) {
    const q = readQuantity(tokens, back, clauseEnd);
    if (q && q.to === i && DOSE_UNIT_BY_TOKEN.has(q.unitToken)) {
      amount = q.amount;
      unitToken = q.unitToken;
      from = q.from;
      break;
    }
  }

  // Forward: "ibuprofen 600 mg".
  if (amount === undefined) {
    const q = readQuantity(tokens, i + 1, clauseEnd);
    if (q && DOSE_UNIT_BY_TOKEN.has(q.unitToken)) {
      amount = q.amount;
      unitToken = q.unitToken;
      to = q.to;
    }
  }

  // Concentration: "lido 2%".
  let concentrationPercent: number | undefined;
  const pct = readQuantity(tokens, to, clauseEnd);
  if (pct && pct.unitToken === "%") {
    concentrationPercent = pct.amount;
    to = pct.to;
  }

  return { drug, amount, unitToken, concentrationPercent, from, to };
}

/**
 * Read a note into facts.
 *
 * Never throws and never returns text. On any input at all — empty, binary,
 * a paste of someone else's spreadsheet — the worst case is zero facts.
 */
export function extractFacts(text: string): ExtractionResult {
  const tokens = tokenize(text);
  const clauses = clauseRanges(tokens);
  const facts: ClinicalFact[] = [];
  const unparsed: Span[] = [];

  clauses.forEach((clause, sentenceIndex) => {
    const factsBefore = facts.length;
    const sites: ToothSite[] = [];
    let siteTokenFrom = -1;
    let siteTokenTo = -1;
    let procedure: { term: ProcedureTerm; from: number; to: number } | undefined;
    const findings: Array<{
      id: string;
      display: string;
      from: number;
      to: number;
      impliesNegation?: boolean;
    }> = [];
    const materials: Array<{ id: string; display: string; from: number; to: number }> = [];
    const careEvents: Array<{ id: string; display: string; from: number; to: number }> = [];
    const medications: Array<NonNullable<ReturnType<typeof readMedication>>> = [];
    const quantities: Array<NonNullable<ReturnType<typeof readQuantity>>> = [];

    let i = clause.from;
    while (i < clause.to) {
      const group = readSiteGroup(tokens, i, clause.to);
      if (group) {
        sites.push(...group.sites);
        if (siteTokenFrom < 0) siteTokenFrom = group.tokenFrom;
        siteTokenTo = group.end;
        i = group.end;
        continue;
      }

      const bp = readBloodPressure(tokens, i, clause.to);
      if (bp) {
        quantities.push({
          amount: bp.systolic,
          amountMax: bp.diastolic,
          unitToken: "mm hg",
          from: bp.from,
          to: bp.to
        });
        i = bp.to;
        continue;
      }

      const med = readMedication(tokens, i, clause.to);
      if (med) {
        medications.push(med);
        i = med.to;
        continue;
      }

      const qty = readQuantity(tokens, i, clause.to);
      if (qty) {
        quantities.push(qty);
        i = qty.to;
        continue;
      }

      if (!procedure) {
        const proc = readProcedure(tokens, i, clause.to);
        if (proc) {
          procedure = proc;
          i = proc.to;
          continue;
        }
      }

      const find = readLiteral(FINDING_TERMS_BY_LENGTH, tokens, i, clause.to);
      if (find) {
        findings.push({
          id: find.term.id,
          display: find.term.display,
          from: find.from,
          to: find.to,
          impliesNegation: find.term.impliesNegation
        });
        i = find.to;
        continue;
      }

      const mat = readLiteral(MATERIAL_TERMS_BY_LENGTH, tokens, i, clause.to);
      if (mat) {
        materials.push({ id: mat.term.id, display: mat.term.display, from: mat.from, to: mat.to });
        i = mat.to;
        continue;
      }

      const care = readLiteral(CARE_EVENT_TERMS_BY_LENGTH, tokens, i, clause.to);
      if (care) {
        careEvents.push({ id: care.term.id, display: care.term.display, from: care.from, to: care.to });
        i = care.to;
        continue;
      }

      i++;
    }

    const spanOf = (from: number, to: number): Span => ({
      start: tokens[from].start,
      end: tokens[to - 1].end
    });

    // ONE scan of the clause's negation and temporality cues, shared by every
    // fact in it. Recomputing per fact made a five-fact clause scan the same
    // tokens against the same ~150 rules five times, and this runs inside the
    // per-keystroke audit.
    const clauseMatches: Match[] = findMatches(tokens, clause.from, clause.to);

    // Clause-scoped, like sites: "SRP UR and LR quads" binds both quadrants to
    // the scaling, and the comma split already stops them leaking into the next
    // assertion.
    const regions = readQuadrants(tokens, clause.from, clause.to);
    const withRegions = regions.length > 0 ? { regions } : {};

    if (procedure) {
      const targetFrom = Math.min(procedure.from, siteTokenFrom < 0 ? procedure.from : siteTokenFrom);
      const targetTo = Math.max(procedure.to, siteTokenTo);
      facts.push({
        kind: "procedure",
        span: spanOf(targetFrom, targetTo),
        assertion: assertionFor(tokens, clause, procedure.from, procedure.to, clauseMatches),
        ruleId: procedure.term.id,
        sentenceIndex,
        procedure: procedure.term.display,
        category: procedure.term.category,
        sites,
        ...withRegions
      } satisfies ProcedureFact);
    }

    for (const find of findings) {
      // A term that IS an absence ("NKA") is negated by its own meaning, and
      // that overrides context rather than combining with it. "No NKA" is not a
      // double negative asserting an allergy; it is a writer being unclear, and
      // reading an allergy out of it would be the most dangerous inference this
      // parser could make.
      const assertion = find.impliesNegation
        ? ({ polarity: "negated", experiencer: "patient" } as const)
        : assertionFor(tokens, clause, find.from, find.to, clauseMatches);
      facts.push({
        kind: "finding",
        span: spanOf(find.from, find.to),
        assertion,
        ruleId: find.id,
        sentenceIndex,
        finding: find.display,
        sites,
        ...withRegions
      } satisfies FindingFact);
    }

    for (const care of careEvents) {
      facts.push({
        kind: "care-event",
        span: spanOf(care.from, care.to),
        assertion: assertionFor(tokens, clause, care.from, care.to, clauseMatches),
        ruleId: care.id,
        sentenceIndex,
        event: care.display
      } satisfies CareEventFact);
    }

    for (const mat of materials) {
      facts.push({
        kind: "material",
        span: spanOf(mat.from, mat.to),
        assertion: assertionFor(tokens, clause, mat.from, mat.to, clauseMatches),
        ruleId: mat.id,
        sentenceIndex,
        material: mat.display,
        sites,
        ...withRegions
      } satisfies MaterialFact);
    }

    for (const med of medications) {
      const doseUnit = med.unitToken ? DOSE_UNITS.find((u) => u.token === med.unitToken) : undefined;
      // Volume only when a convention makes it exact. A carpule is 1.8 mL; a
      // "tablet" is nothing in particular, and inventing a number there would
      // feed a maximum-dose check something the note never said.
      const volumeMl =
        med.amount !== undefined && doseUnit?.mlPerUnit !== undefined
          ? Number((med.amount * doseUnit.mlPerUnit).toFixed(2))
          : doseUnit?.unit === "mL" && med.amount !== undefined
            ? med.amount
            : undefined;
      facts.push({
        kind: "medication",
        span: spanOf(med.from, med.to),
        assertion: assertionFor(tokens, clause, med.from, med.to, clauseMatches),
        ruleId: `med.${med.drug}`,
        sentenceIndex,
        drug: med.drug,
        amount: med.amount,
        unit: doseUnit?.unit,
        concentrationPercent: med.concentrationPercent,
        volumeMl
      } satisfies MedicationFact);
    }

    for (const qty of quantities) {
      // Drop a quantity a medication went back and claimed: "2 carp lido" is
      // one dose statement, not a dose and an unrelated count of two.
      const claimed = medications.some((m) => qty.from >= m.from && qty.to <= m.to);
      if (claimed) continue;
      const unit = MEASURE_UNITS.find((u) => u.token === qty.unitToken)?.unit
        ?? DOSE_UNITS.find((u) => u.token === qty.unitToken)?.unit
        ?? qty.unitToken;
      facts.push({
        kind: "measurement",
        span: spanOf(qty.from, qty.to),
        assertion: assertionFor(tokens, clause, qty.from, qty.to, clauseMatches),
        ruleId: `measure.${unit}`,
        sentenceIndex,
        amount: qty.amount,
        amountMax: qty.amountMax,
        unit
      } satisfies MeasurementFact);
    }

    // Teeth named with nothing else in the clause: still a fact — "#14" alone
    // is a statement about tooth 14 — but the clause did not say what about it,
    // and we do not invent one. Suppressed when something above already carries
    // the sites, so one clause does not produce two facts for one tooth.
    const carried = procedure || findings.length > 0 || materials.length > 0;
    if (!carried) {
      for (const site of sites) {
        facts.push({
          kind: "tooth-site",
          span: site.span,
          assertion: assertionFor(tokens, clause, siteTokenFrom, siteTokenTo, clauseMatches),
          ruleId: "site.bare",
          sentenceIndex,
          site
        } satisfies ToothSiteFact);
      }
    }

    if (facts.length === factsBefore && clause.to > clause.from) {
      unparsed.push({ start: tokens[clause.from].start, end: tokens[clause.to - 1].end });
    }
  });

  return { facts, unparsed, clauseCount: clauses.length };
}

/**
 * How much of this note did we actually understand?
 *
 * Reported to the user as a coverage figure and used by us as the growth
 * signal for the grammar. It is deliberately an honest denominator: clauses we
 * did not even try to parse count against us.
 */
export function coverage(result: ExtractionResult): number {
  if (result.clauseCount === 0) return 0;
  return (result.clauseCount - result.unparsed.length) / result.clauseCount;
}
