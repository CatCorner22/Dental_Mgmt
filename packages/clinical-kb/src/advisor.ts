// THE ADVISOR ENGINE — Byte's read of a note in progress.
//
// Deterministic, client-side, and fast enough to run on every pause in typing:
// one extraction pass plus table lookups. No network, no model, no storage —
// the note never leaves the keyboard it is being typed on.
//
// The engine returns three things and the UI may not add a fourth:
//   ADVICE  — the highest-priority knowledge entries whose predicates match.
//   GAUGES  — live numbers a drafting screen can draw. Presence-only for
//             pillars; parser coverage and density are counts, never a
//             confidence percentage.
//   MOOD    — which face Byte makes. Derived from the same numbers.

import { extractFacts } from "@/lib/extract/extract";
import { coverage as parseCoverage } from "@/lib/extract/extract";
import type { ClinicalFact } from "@/lib/extract/facts";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { ANAESTHETIC_LIMITS, milligramsFrom } from "@/lib/audit/rules/anesthetic-dose";
import {
  entryMatchesAuthorScope,
  KNOWLEDGE,
  type AdvisorContext,
  type KnowledgeEntry
} from "./knowledge";

export interface Advice {
  id: string;
  say: string;
  why: string;
  source: string;
  /** Concrete next step — never applied to the note. */
  nextAction?: string;
}

/**
 * The four questions a later reader asks of a treatment note when nobody
 * disputes the dentistry itself: was the decision consented, what happened, what
 * was the patient told to do, and what happens next.
 *
 * Presence-only — never a score, because a percentage invites gaming and a
 * checklist invites completion.
 */
export interface ReaderPillars {
  consent: boolean;
  outcome: boolean;
  instructions: boolean;
  followUp: boolean;
  /** Pillars only apply once the note documents treatment. */
  applicable: boolean;
}

export interface DoseGauge {
  drug: string;
  /** Milligrams documented so far. */
  mg: number;
  /** The absolute published ceiling (weight-based needs a documented weight). */
  maxMg: number;
  /** mg / maxMg, capped at 1 for drawing. Not a confidence figure. */
  fraction: number;
}

export interface GaugeNote {
  /** Why this gauge sits where it does right now. */
  why: string;
  /** Optional next move if the gauge is short of target. */
  next?: string;
}

export interface AdvisorGauges {
  /** Share of clauses the deterministic parser could read, 0..1. */
  readCoverage: number;
  /** Clinical facts per 100 words — the density/bloat measure. */
  density: number;
  words: number;
  facts: number;
  pillars: ReaderPillars;
  /** Present only when a computable anesthetic dose is on the note. */
  dose?: DoseGauge;
  /** Plain explanations for each live gauge. */
  notes: {
    read: GaugeNote;
    density: GaugeNote;
    pillars: GaugeNote;
    dose: GaugeNote;
  };
}

export type ByteMood = "idle" | "happy" | "thinking" | "concerned";

export interface AdvisorReport {
  advice: Advice[];
  gauges: AdvisorGauges;
  mood: ByteMood;
}

const MAX_ADVICE = 3;

function pillarsOf(facts: ClinicalFact[], lower: string): ReaderPillars {
  const treated = facts.some(
    (f) =>
      f.kind === "procedure" &&
      f.assertion.polarity === "affirmed" &&
      !f.assertion.temporalityHint &&
      f.category !== "diagnostic"
  );
  const care = (needle: string) =>
    facts.some((f) => f.kind === "care-event" && f.event.includes(needle));
  return {
    applicable: treated,
    consent: care("consent") || lower.includes("consent"),
    outcome:
      lower.includes("complication") ||
      facts.some((f) => f.kind === "care-event" && f.event.includes("tolerated")),
    instructions:
      care("instruction") || care("post-operative") || lower.includes("post-op"),
    followUp: care("return-to-clinic") || care("recall") || care("referral") || lower.includes("follow-up")
  };
}

function doseGauge(facts: ClinicalFact[]): DoseGauge | undefined {
  let best: DoseGauge | undefined;
  for (const limit of ANAESTHETIC_LIMITS) {
    let mg = 0;
    for (const f of facts) {
      if (f.kind !== "medication" || f.drug !== limit.drug) continue;
      if (f.assertion.polarity !== "affirmed" || f.assertion.temporalityHint) continue;
      if (f.volumeMl === undefined || f.concentrationPercent === undefined) continue;
      mg += milligramsFrom(f.volumeMl, f.concentrationPercent);
    }
    if (mg <= 0) continue;
    const gauge: DoseGauge = {
      drug: limit.drug,
      mg: Math.round(mg * 10) / 10,
      maxMg: limit.absoluteMaxMg,
      fraction: Math.min(1, mg / limit.absoluteMaxMg)
    };
    if (!best || gauge.fraction > best.fraction) best = gauge;
  }
  return best;
}

export interface AdviseOptions {
  /** Writer clinical role — scopes coaching to license-appropriate tips. */
  clinicalRole?: ClinicalRole;
}

/**
 * Read a draft and advise. Pure and total: any string in, a report out,
 * nothing thrown, nothing stored, nothing written anywhere.
 */
export function advise(text: string, opts: AdviseOptions = {}): AdvisorReport {
  const trimmed = text.trim();
  const extraction = extractFacts(trimmed);
  const facts = extraction.facts;
  const lower = trimmed.toLowerCase();
  const words = trimmed ? trimmed.split(/\s+/).filter((w) => /[\p{L}\p{Nd}]/u.test(w)).length : 0;

  const ctx: AdvisorContext = {
    text: trimmed,
    lower,
    facts,
    kinds: new Set(facts.map((f) => f.kind)),
    clinicalRole: opts.clinicalRole
  };

  const matched: KnowledgeEntry[] = [];
  for (const entry of KNOWLEDGE) {
    if (!entryMatchesAuthorScope(entry, opts.clinicalRole)) continue;
    let hit = false;
    try {
      hit = entry.when(ctx);
    } catch {
      hit = false;
    }
    if (hit) matched.push(entry);
  }
  matched.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const advice: Advice[] = matched.slice(0, MAX_ADVICE).map((e) => ({
    id: e.id,
    say: e.say,
    why: e.why,
    source: e.source,
    ...(e.nextAction ? { nextAction: e.nextAction } : {})
  }));

  const readCoverage = parseCoverage(extraction);
  const density = words === 0 ? 0 : Math.round(facts.length / words * 100 * 10) / 10;
  const pillars = pillarsOf(facts, lower);
  const dose = doseGauge(facts);
  const unread = extraction.unparsed.length;
  const missingPillars = (
    [
      ["consent", pillars.consent],
      ["outcome", pillars.outcome],
      ["instructions", pillars.instructions],
      ["follow-up", pillars.followUp]
    ] as const
  )
    .filter(([, present]) => !present)
    .map(([name]) => name);

  const gauges: AdvisorGauges = {
    readCoverage,
    density,
    words,
    facts: facts.length,
    pillars,
    ...(dose ? { dose } : {}),
    notes: {
      read: {
        why:
          unread === 0
            ? "Every phrase in this draft was recognized by the practice grammar."
            : `${unread} phrase${unread === 1 ? "" : "s"} still unread — they stay off the chart until rewritten in plain clinical words.`,
        ...(unread > 0
          ? { next: "Tap an unread phrase in the readback panel and rewrite it in full words." }
          : {})
      },
      density: {
        why:
          words === 0
            ? "No words yet."
            : density < 8
              ? "Sparse for this length — add concrete teeth, findings, or doses if they happened."
              : density > 60
                ? "Very dense — check for pasted boilerplate that does not belong to this visit."
                : "Fact density is in a useful band for a clinical note."
      },
      pillars: {
        why: !pillars.applicable
          ? "These apply once the note documents treatment."
          : missingPillars.length === 0
            ? "Consent, outcome, instructions, and follow-up are all visible."
            : `Still missing: ${missingPillars.join(", ")}.`,
        ...(pillars.applicable && missingPillars.length > 0
          ? { next: `Add the missing pillar in one short sentence: ${missingPillars[0]}.` }
          : {})
      },
      dose: {
        why: dose
          ? `${dose.mg} mg ${dose.drug} documented against a ${dose.maxMg} mg absolute ceiling.`
          : "Shows when volume and concentration are both stated.",
        ...(dose && dose.fraction >= 0.8
          ? { next: "Confirm concentration and patient weight if you are near a published ceiling." }
          : {})
      }
    }
  };

  const mood: ByteMood =
    trimmed === ""
      ? "idle"
      : matched.some((e) => e.priority >= 70)
        ? "concerned"
        : facts.length >= 4 && advice.every((a) => a.id === "byte.first-fact" || a.id === "byte.strong-note")
          ? "happy"
          : "thinking";

  return { advice, gauges, mood };
}
