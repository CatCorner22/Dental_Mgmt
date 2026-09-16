// CLINICAL FACTS — what a note SAYS, as structure rather than prose.
//
// ===========================================================================
// THE INVARIANT THAT GOVERNS THIS ENTIRE DIRECTORY
//
//   EXTRACTION IS READ-ONLY. Nothing here returns text. Nothing here edits a
//   note. Every value below is either a span pointing INTO the input or a
//   value derived from a controlled table.
//
// That is not a style preference, it is the reason this layer is allowed to
// exist at all. `standardize.ts` carries a hard contract — a rewrite is either
// deterministic-language-only or it is handed back to a human — and the fastest
// way to break it would be a component that "understands" a note and helpfully
// rewrites it. So this component cannot rewrite anything. It reads, and it
// hands back an index.
//
// Everything downstream (the odontogram, the consistency rules, the coverage
// meter) is therefore a VIEW of the note. If the view is wrong, the note is
// unchanged and the worst case is a wrong picture next to correct text. If we
// had let extraction write, the worst case would be a wrong legal record.
// ===========================================================================
//
// WHY THIS EXISTS. Until now the transformer was text-to-text: it substituted
// words, reordered sentences, and flagged problems. That is a real ceiling.
// A text-to-text engine cannot answer "which teeth did this visit treat?",
// which means it cannot draw a chart, cannot notice that tooth 14 was both
// extracted and restored, and cannot check that the prose agrees with the
// structured fields. Every one of those is downstream of having FACTS.
//
// REFUSAL IS THE DEFAULT. A clause that does not parse produces nothing. There
// is no repair, no guess, no partial-credit interpretation. The measured parse
// rate is allowed to be low and to grow; what is not allowed is a fact the note
// did not state. This mirrors the vocabulary tables' refusal to expand an
// ambiguous abbreviation, and it is the same reasoning.

import type { Surface, ToothId } from "@/lib/schema/types";

/** A half-open character range in the ORIGINAL, unmodified note text. */
export interface Span {
  start: number;
  end: number;
}

/**
 * Whether the note ASSERTED this fact or denied it, and who it is about.
 *
 * Modelled on ConText (Chapman, Chu & Dowling 2007; Harkema et al. 2009), the
 * standard rule-based algorithm for this. Two deliberate departures:
 *
 * 1. TEMPORALITY IS A HINT, NEVER AN ASSIGNMENT. ConText's published recall on
 *    "historical" is 67.4% and its precision 74.2% — the authors say plainly
 *    that doing it properly "requires knowledge above and beyond the surface
 *    clues" the algorithm sees. In a dental note the historical/current line is
 *    the line between charting someone else's old crown and billing for a new
 *    one, so a 67%-recall guess is worse than no guess. We surface the cue and
 *    let a human decide.
 *
 * 2. NEGATION IS ASSIGNED, because there the same algorithm measures 97%/97%,
 *    and because the failure it prevents is the one that matters most here: an
 *    extractor that reads "no caries #14" as a caries finding would paint a
 *    tooth the note explicitly called clean.
 */
export interface Assertion {
  polarity: "affirmed" | "negated";
  /** Present only when a cue was found. Never defaulted, never inferred. */
  temporalityHint?: "historical" | "hypothetical";
  experiencer: "patient" | "other";
  /** The exact cue that decided this, so a finding can cite it. */
  trigger?: Trigger;
}

export interface Trigger {
  /** The literal text as written in the note. */
  text: string;
  span: Span;
  /** The term-table entry responsible, e.g. "negation.denies". */
  ruleId: string;
}

export const AFFIRMED: Assertion = { polarity: "affirmed", experiencer: "patient" };

/**
 * A tooth, optionally with the surfaces named for it.
 *
 * `surfaces` is empty when the note named a tooth without naming a surface,
 * which is normal and is NOT an error — an extraction has no surfaces and a
 * whole-tooth exam finding has none either.
 */
export interface ToothSite {
  toothId: ToothId;
  surfaces: Surface[];
  /** Covers the tooth reference and its surface string, if any. */
  span: Span;
  /**
   * True when the surface string named a surface that cannot exist on this
   * tooth — an occlusal surface on an incisor, say.
   *
   * Recorded rather than dropped. The audit engine owns the decision about
   * what an impossible surface MEANS; this layer's job is to report faithfully
   * what the note said, including when what it said is wrong.
   */
  impossibleSurfaces: string[];
}

export type FactKind =
  | "tooth-site"
  | "procedure"
  | "medication"
  | "measurement"
  | "finding"
  | "material"
  | "care-event";

/** ADA quadrant codes, as the practice's own shorthand table spells them. */
export type Quadrant = "UR" | "UL" | "LL" | "LR";

interface FactBase {
  kind: FactKind;
  span: Span;
  assertion: Assertion;
  /** Which parse rule produced this. Provenance for the ledger. */
  ruleId: string;
  /** Index of the sentence this came from, for scoping consistency checks. */
  sentenceIndex: number;
  /**
   * Quadrants the clause named, as REGIONS — never expanded into teeth.
   *
   * "SRP UR and LR quads" says scaling was done in two quadrants. It does NOT
   * say which of the sixteen teeth were instrumented, and turning a quadrant
   * into eight tooth facts would put a claim in the chart that the note never
   * made — the precise thing this layer exists not to do.
   *
   * So a region stays a region all the way to the chart, where it is drawn as
   * a band rather than as filled teeth. Half a mouth of perio treatment
   * becomes visible, and it stays visibly different from named teeth.
   */
  regions?: Quadrant[];
}

export interface ToothSiteFact extends FactBase {
  kind: "tooth-site";
  site: ToothSite;
}

/**
 * A procedure verb, with any tooth sites the same clause bound to it.
 *
 * `sites` is empty when the clause named a procedure and no tooth. That is
 * common ("prophylaxis completed") and legitimate.
 */
export interface ProcedureFact extends FactBase {
  kind: "procedure";
  /** Canonical procedure name from the controlled table, never the raw text. */
  procedure: string;
  /**
   * The coarse class, which is what consistency rules reason over. Two
   * procedures of contradictory class on one tooth in one visit is the
   * cleanest contradiction there is.
   */
  category: ProcedureCategory;
  sites: ToothSite[];
}

export type ProcedureCategory =
  | "restorative"
  | "surgical"
  | "endodontic"
  | "periodontal"
  | "preventive"
  | "prosthodontic"
  | "diagnostic";

export interface MedicationFact extends FactBase {
  kind: "medication";
  /** Canonical drug name from the controlled table. */
  drug: string;
  amount?: number;
  unit?: string;
  /** Percent concentration, where the note gave one ("lidocaine 2%"). */
  concentrationPercent?: number;
  /**
   * Millilitres, derived when the note counted containers.
   *
   * Present only when the arithmetic is exact — a carpule is 1.8 mL by
   * convention, so "2 carp" is 3.6 mL and nothing has been assumed. Absent when
   * the note gave a count with no convention behind it, because a guessed
   * volume feeding a maximum-dose check is worse than no check.
   */
  volumeMl?: number;
}

export interface MeasurementFact extends FactBase {
  kind: "measurement";
  amount: number;
  /** Set when the note gave a range ("4-5 mm"); `amount` is then the low end. */
  amountMax?: number;
  unit: string;
}

/**
 * Something observed, as opposed to something done.
 *
 * Split from ProcedureFact because the two behave differently under negation. A
 * negated finding is the commonest statement in a dental exam ("no caries", "no
 * BOP") and is entirely normal; a negated procedure is rare and means something
 * else. Collapsing them would make "no caries" and "no extraction" the same
 * shape, and they are not.
 */
export interface FindingFact extends FactBase {
  kind: "finding";
  finding: string;
  /** Tooth sites named in the same clause, if any. */
  sites: ToothSite[];
}

export interface MaterialFact extends FactBase {
  kind: "material";
  material: string;
  sites: ToothSite[];
}

/**
 * Something done with or for the patient rather than to a tooth.
 *
 * Instructions given, options discussed, medical history reviewed, how the
 * visit was tolerated. These carry no tooth and never appear on the chart, and
 * they are what a note is judged on when nobody is disputing the dentistry —
 * every completeness rule that protects the practice is really asking whether
 * one of these is present.
 */
export interface CareEventFact extends FactBase {
  kind: "care-event";
  event: string;
}

export type ClinicalFact =
  | ToothSiteFact
  | ProcedureFact
  | MedicationFact
  | MeasurementFact
  | FindingFact
  | MaterialFact
  | CareEventFact;

/**
 * The result of reading a note.
 *
 * `unparsed` is as important as `facts` and is deliberately given equal
 * standing in the type. It is the honest measure of how much of a real note
 * this layer actually understands, it is what the coverage meter shows a user,
 * and it is the only trustworthy signal for where the grammar should grow next
 * — as opposed to where we imagine it should grow.
 */
export interface ExtractionResult {
  facts: ClinicalFact[];
  /** Spans of clauses that produced no facts. */
  unparsed: Span[];
  /** Sentences considered, for the coverage denominator. */
  clauseCount: number;
}

/** Tooth sites carried by any fact kind that can carry them. */
export function sitesOfFact(fact: ClinicalFact): ToothSite[] {
  switch (fact.kind) {
    case "tooth-site":
      return [fact.site];
    case "procedure":
    case "finding":
    case "material":
      return fact.sites;
    default:
      return [];
  }
}

/** Every distinct tooth the note asserts something about, in chart order. */
export function affirmedSites(result: ExtractionResult): ToothSite[] {
  const byTooth = new Map<ToothId, ToothSite>();
  for (const fact of result.facts) {
    if (fact.assertion.polarity !== "affirmed") continue;
    if (fact.assertion.experiencer !== "patient") continue;
    const sites = sitesOfFact(fact);
    for (const site of sites) {
      const existing = byTooth.get(site.toothId);
      if (!existing) {
        byTooth.set(site.toothId, { ...site, surfaces: [...site.surfaces] });
        continue;
      }
      for (const surface of site.surfaces) {
        if (!existing.surfaces.includes(surface)) existing.surfaces.push(surface);
      }
    }
  }
  return [...byTooth.values()];
}
