// BYTE'S BRAIN — the advisory knowledge base.
//
// Byte is the practice's knowledge, compiled: Tennessee dental-record law, the
// pharmacy safety literature, claim-file documentation patterns, and the
// practice's own writing standards — evaluated deterministically against the
// note being drafted.
//
// Byte is READ-ONLY AND ADVISE-ONLY. There is no code path from this module
// to a note. Byte never blocks anything, ever.
//
// EVERY ENTRY CITES ITS SOURCE.
//
// CORE_KNOWLEDGE is the original 23 Smile Notes entries. KNOWLEDGE_EXPANSION
// (Increment 0.1) is concatenated so consumers see one versioned list.

import type { ClinicalFact } from "@/lib/extract/facts";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { KNOWLEDGE_EXPANSION } from "./knowledge-expansion";

/** Which author licenses an entry is written for. Omit = every role. */
export type AdvisorAuthorScope =
  | "any"
  | "hygienist"
  | "assistant"
  | "dentist"
  | "auxiliary"; // hygienist or assistant

export interface AdvisorContext {
  /** The note text, as typed so far. */
  text: string;
  /** Lower-cased text, computed once for the many entries that scan it. */
  lower: string;
  /** The deterministic parser's reading of the note. */
  facts: ClinicalFact[];
  /** Fact kinds present, for cheap membership checks. */
  kinds: Set<ClinicalFact["kind"]>;
  /** Writer clinical role when known — scopes which entries may fire. */
  clinicalRole?: ClinicalRole;
}

export interface KnowledgeEntry {
  id: string;
  /** Short, glanceable. What Byte says in the speech bubble. */
  say: string;
  /** The teaching: why this matters, in cold logic with warmth allowed. */
  why: string;
  /** Where this comes from. Always present, always specific. */
  source: string;
  /**
   * Higher fires first when several entries match. Safety beats law beats
   * craft — a dose question outranks a style question every time.
   */
  priority: number;
  /** Pure predicate over the drafting context. Never throws. */
  when: (ctx: AdvisorContext) => boolean;
  /** One concrete next step the writer can take — advice only, never applied. */
  nextAction?: string;
  /**
   * When set, the entry only fires for matching author scopes. Safety entries
   * stay `any` (or omit). Judgement-coaching entries target `dentist`.
   */
  authorScope?: AdvisorAuthorScope;
}

export function entryMatchesAuthorScope(
  entry: KnowledgeEntry,
  role: ClinicalRole | undefined
): boolean {
  const scope = entry.authorScope ?? "any";
  if (scope === "any") return true;
  if (role === "smilenotes") return true;
  if (!role || role === "unset") return scope === "dentist";
  if (scope === "auxiliary") return role === "hygienist" || role === "assistant";
  return scope === role;
}

const hasProcedureCategory = (ctx: AdvisorContext, category: string): boolean =>
  ctx.facts.some((f) => f.kind === "procedure" && f.category === category && f.assertion.polarity === "affirmed");

const hasCareEvent = (ctx: AdvisorContext, needle: string): boolean =>
  ctx.facts.some((f) => f.kind === "care-event" && f.event.includes(needle));

const mentions = (ctx: AdvisorContext, ...needles: string[]): boolean =>
  needles.some((n) => ctx.lower.includes(n));

const CORE_KNOWLEDGE: KnowledgeEntry[] = [
  // --- Safety and pharmacy -------------------------------------------------
  {
    id: "byte.dose-context",
    say: "Anesthetic on board — I am watching the math.",
    why:
      "A carpule of 2% lidocaine is 36 mg, and the published ceilings are 4.4 mg/kg or 300 mg " +
      "absolute. State the concentration with the count and the arithmetic takes care of itself; " +
      "leave the concentration off and nobody can compute the dose from this note, including you.",
    source: "Malamed dose tables; this practice's anesthetic-dose rule (ruleset 2.13.0)",
    priority: 90,
    nextAction: "Add concentration (%) next to each carpule or mL amount.",
    when: (ctx) =>
      ctx.facts.some(
        (f) => f.kind === "medication" && f.assertion.polarity === "affirmed" && f.volumeMl !== undefined
      )
  },
  {
    id: "byte.weight-for-child",
    say: "Pediatric visit? A weight in kg makes every dose checkable.",
    why:
      "The kilogram rule exists because pound-kilogram confusion is a documented 2.2x overdose " +
      "path, and weight-based ceilings cannot be computed from a note that never states the " +
      "weight. One number turns every dose in this note into checkable arithmetic.",
    source: "Joint Commission Sentinel Event Alert 39; ISMP pediatric dosing guidance",
    priority: 85,
    nextAction: "Write the patient's weight in kilograms on this note.",
    when: (ctx) =>
      mentions(ctx, "pediatric", "child", "pulpotomy", "ssc") &&
      ctx.kinds.has("medication") &&
      !/\b\d+(?:\.\d+)?\s*kg\b/i.test(ctx.text)
  },
  {
    id: "byte.allergy-status",
    say: "A prescription is here — is the allergy status?",
    why:
      "The allergy line is the single most safety-relevant sentence in a dental chart, and it is " +
      "either verified at this visit or it is a rumor from the last one. NKDA when verified, the " +
      "allergy when present — either is defensible, and only silence is not.",
    source: "Tenn. Comp. R. 0460-02-.12 (concise medical history); ISMP",
    priority: 80,
    nextAction: "Add \"NKDA verified today\" or name the allergy verified at this visit.",
    when: (ctx) =>
      ctx.kinds.has("medication") &&
      !mentions(ctx, "allerg", "nkda", "nka")
  },
  {
    id: "byte.opioid-pmp",
    say: "An opioid prescription — the CSMD check belongs in the note.",
    why:
      "Tennessee requires checking the Controlled Substance Monitoring Database before " +
      "prescribing opioids, and a check that is not documented is a check that did not happen, " +
      "as far as any reviewer is concerned. One line — CSMD checked, date, no concerning " +
      "findings or what was found — makes the compliance visible.",
    source: "Tenn. Code Ann. § 53-10-310 (CSMD check); TN Dept. of Health opioid guidance",
    priority: 88,
    nextAction: "Add one line: CSMD checked, date, and what was found.",
    when: (ctx) =>
      mentions(ctx, "hydrocodone", "oxycodone", "codeine", "tramadol", "opioid", "percocet", "lortab", "norco") &&
      !mentions(ctx, "csmd", "pmp", "monitoring database")
  },
  {
    id: "byte.premedication-check",
    say: "This history mentions a joint replacement or cardiac condition — was prophylaxis considered?",
    why:
      "The American Heart Association narrowed antibiotic prophylaxis to specific cardiac " +
      "conditions, and current orthopaedic and dental guidance no longer recommends it " +
      "routinely for most joint replacements. Either way, the note should say what was decided " +
      "and why — \"premedication not indicated per current guidance\" is one sentence and " +
      "settles the question the chart would otherwise ask.",
    source: "American Heart Association endocarditis-prevention guidance; ADA/AAOS appropriate-use criteria",
    priority: 78,
    when: (ctx) =>
      mentions(ctx, "joint replacement", "prosthetic joint", "heart valve", "endocarditis", "prosthetic valve") &&
      !mentions(ctx, "premed", "prophyla", "amoxicillin 2 g", "not indicated")
  },
  {
    id: "byte.nitrous-record",
    say: "Nitrous is on board — the record wants concentration, duration, and recovery.",
    why:
      "A nitrous administration is defensible when the note shows percent concentration, " +
      "duration, and that the patient recovered on 100% oxygen before leaving the chair. " +
      "\"N2O administered\" alone documents that something happened; the three numbers document " +
      "that it happened safely.",
    source: "Tenn. Comp. R. 0460-02-.07 (sedation records); AAPD nitrous oxide guideline",
    priority: 82,
    nextAction: "Add N2O %, duration, and recovery on 100% oxygen.",
    when: (ctx) =>
      mentions(ctx, "nitrous", "n2o") &&
      !(/\d+\s*%/.test(ctx.text) && mentions(ctx, "oxygen", "recover", "100%"))
  },

  // --- Tennessee law and the record ---------------------------------------
  {
    id: "byte.radiograph-interpretation",
    say: "Images taken — Tennessee counts the interpretation as part of the record.",
    why:
      "\"BWs taken\" documents an exposure, not a diagnostic act. Tennessee expressly includes " +
      "radiographs and their interpretations in the dental record, and interpretation is dentist " +
      "work. One line — who read it, what they saw, or interpretation pending with an owner — " +
      "closes the gap.",
    source: "Tenn. Comp. R. 0460-02-.12; Tenn. Code Ann. § 63-5-108",
    priority: 75,
    nextAction: "Name who read the images and what they saw (or \"interpretation pending\" with an owner).",
    when: (ctx) =>
      ctx.facts.some(
        (f) =>
          f.kind === "procedure" &&
          f.category === "diagnostic" &&
          f.procedure.includes("radiograph") &&
          f.assertion.polarity === "affirmed"
      ) && !mentions(ctx, "interpret", "reviewed by", "read by", "impression")
  },
  {
    id: "byte.extraction-aftercare",
    say: "An extraction without documented aftercare is the Schwarcz gap.",
    why:
      "In Schwarcz, the procedure itself was found clinically acceptable — the discipline stood " +
      "on the missing documentation of the complication and the disclosure. Post-operative " +
      "instructions, complication status, and follow-up are what make an extraction note " +
      "defensible three years from now.",
    source: "Bureau of Health Care Servs. v. Schwarcz (Mich. Ct. App. 2015); MedPro/WSDA sparse-chart case study",
    priority: 70,
    nextAction: "Add post-op instructions, complication status, and a follow-up plan.",
    when: (ctx) =>
      hasProcedureCategory(ctx, "surgical") &&
      !hasCareEvent(ctx, "post-operative") &&
      !mentions(ctx, "post-op", "postoperative")
  },
  {
    id: "byte.soft-tissue-close-the-loop",
    say: "A soft-tissue finding needs a disposition, not just a mention.",
    why:
      "D'Amour lost on exactly this: a lesion observed, not documented, not discussed. A finding " +
      "plus its disposition — described, measured where possible, disclosed, referred or " +
      "scheduled for review — is a closed loop. A finding alone is an open one, and open loops " +
      "are what records get judged on.",
    source:
      "D'Amour v. Bd. of Registration in Dentistry, 409 Mass. 572 (1991); " +
      "documentation-integrity-deep-research.md; complete.finding-no-disposition",
    priority: 72,
    nextAction: "Add disposition: disclosed, referred, biopsied, or scheduled for recheck.",
    when: (ctx) =>
      ctx.facts.some(
        (f) => f.kind === "finding" && f.assertion.polarity === "affirmed" && ["lesion", "ulceration"].some((n) => f.finding.includes(n))
      ) && !mentions(ctx, "refer", "biopsy", "monitor", "recheck", "disclosed", "discussed")
  },
  {
    id: "byte.rx-indication",
    say: "A prescription needs a why, not only a dose and a day count.",
    why:
      "Drug name, strength, and duration reconstruct the order; the indication reconstructs the " +
      "clinical judgment. \"Prescribed amoxicillin for 7 days\" leaves the later reader guessing " +
      "whether this was infection, prophylaxis, or habit — and medication-information gaps are a " +
      "documented documentation-integrity pattern.",
    source: "documentation-integrity-deep-research.md; complete.rx-no-indication; ISMP patient-information guidance",
    priority: 76,
    nextAction: "Add the indication in one phrase (infection, post-operative pain, prophylaxis, etc.).",
    when: (ctx) =>
      /\b(?:prescribed|prescription|dispensed?)\b/i.test(ctx.text) &&
      /\b(?:amoxicillin|penicillin|clindamycin|azithromycin|metronidazole|ibuprofen|hydrocodone|oxycodone)\b/i.test(
        ctx.text
      ) &&
      !/\b(?:to\s+treat|indicated|due\s+to|infection|abscess|pain|prophylaxis|prophylactic|swelling)\b/i.test(
        ctx.text
      )
  },
  {
    id: "byte.bounded-negatives",
    say: "Absolute negatives overclaim. Bound them to what was asked or observed.",
    why:
      "\"No problems\" and \"no complications\" imply knowledge beyond the encounter. Prefer " +
      "patient-reported (\"denies swelling today\"), clinician-observed (\"no swelling on exam\"), " +
      "or procedure-bounded (\"no immediate complication observed before discharge\"). A record " +
      "cannot prove every conceivable negative; it can document the scope of inquiry.",
    source: "documentation-integrity-deep-research.md (bounded-negative distinction); CMS/ADA documentation integrity",
    priority: 55,
    nextAction: "Rewrite the absolute negative with a time frame and what was actually assessed.",
    when: (ctx) =>
      /\b(?:no complications|without(?:\s+any)?\s+complications|no problems|no issues)\b/i.test(ctx.text) &&
      !/\b(?:observed|during|before\s+discharge|on\s+(?:today'?s\s+)?(?:exam|examination)|denies)\b/i.test(
        ctx.text
      )
  },
  {
    id: "byte.clinical-rationale",
    say: "A procedure code names what you did. The note still owes why.",
    why:
      "Clinical rationale was the third-most-common documentation gap in The Doctors Company's " +
      "closed dental claims (51 of 172 insufficient-documentation items). A crown, SRP, or " +
      "extraction without the finding or diagnosis it addresses reads as billing narrative — " +
      "another dentist cannot see the decision path years later.",
    source: "The Doctors Company (1,185 dental claims, 2010–2020); complete.clinical-rationale rule",
    priority: 66,
    authorScope: "dentist",
    nextAction: "Add one sentence: the finding, diagnosis, or symptom that made this treatment indicated.",
    when: (ctx) =>
      /\b(?:crown(?:\s+prep)?|root\s+canal|RCT|SRP|extraction|extracted|implant|build-?up|pulpotomy)\b/i.test(
        ctx.text
      ) &&
      !/\b(?:because|due\s+to|indicated|recommended\s+for|diagnosed|diagnosis|caries|fracture|infection|periodont|bone\s+loss|pain|symptom|recurrent\s+decay)\b/i.test(
        ctx.text
      )
  },
  {
    id: "byte.hygiene-findings-loop",
    say: "Probing or bleeding without sites leaves the next hygienist guessing.",
    why:
      "A hygienist records clinical findings and measurements for diagnosis by the dentist " +
      "(Tenn. Code Ann. § 63-5-108(c)). Pocket depths, bleeding points, and calculus extent " +
      "are the facts that make that handoff usable — \"periodontal findings noted\" is not.",
    source: "Tenn. Code Ann. § 63-5-108(c); Tenn. Comp. R. & Regs. 0460-03-.09",
    priority: 70,
    authorScope: "hygienist",
    nextAction: "Add probing depths with sites, bleeding locations, and what hygiene service you performed.",
    when: (ctx) =>
      mentions(ctx, "proph", "scaling", "root planing", "srp", "periodont", "probing", "bleeding") &&
      !(/\b\d\s*mm\b/i.test(ctx.text) || mentions(ctx, "tooth", "#", "site", "quad"))
  },
  {
    id: "byte.hygiene-dentist-handoff",
    say: "Findings are yours to record. Diagnosis stays with the dentist.",
    why:
      "Tennessee does not authorize a hygienist to perform a comprehensive examination, " +
      "diagnosis, or treatment planning. Document what you measured and did; leave Assessment " +
      "and Plan empty for the dentist, then transfer when they are ready to file.",
    source: "Tenn. Code Ann. § 63-5-108(c)(3); Tenn. Comp. R. & Regs. 0460-03-.09(7)(a)",
    priority: 60,
    authorScope: "hygienist",
    nextAction: "Keep Assessment/Plan clear; transfer the draft when the dentist will diagnose.",
    when: (ctx) =>
      ctx.facts.length >= 2 &&
      (mentions(ctx, "proph", "scaling", "fluoride", "sealant", "periodont") ||
        ctx.kinds.has("measurement"))
  },
  {
    id: "byte.assistant-attribution",
    say: "Name who performed each act — \"was placed\" hides the hands.",
    why:
      "An assistant documents what they performed and observed under dentist direction. " +
      "Active voice with a role or credential (\"the treating dentist placed…\", \"I assisted with…\") " +
      "keeps the record honest about scope and responsibility.",
    source: "Tenn. Code Ann. § 63-5-108(d); practice writing standard (active voice)",
    priority: 68,
    authorScope: "assistant",
    nextAction: "Rewrite passive procedure lines with who did the act (treating dentist vs assistant).",
    when: (ctx) =>
      ctx.kinds.has("procedure") &&
      /\b(?:was|were)\s+(?:placed|administered|performed|completed|given)\b/i.test(ctx.text)
  },
  {
    id: "byte.consent-is-a-conversation",
    say: "A signed form proves a signature. The note proves the conversation.",
    why:
      "The Doctors Company found absent or limited informed consent in 55 of 172 " +
      "insufficient-documentation items in closed dental claims (2010–2020). Cases turn on " +
      "what was discussed — risks, alternatives, the option of doing nothing, patient " +
      "questions. Two sentences recording that conversation outweigh any stack of signed boilerplate.",
    source: "The Doctors Company (1,185 dental claims, 2010–2020); Sanders (Tenn. Ct. App. 1997)",
    priority: 65,
    nextAction: "Name risks, alternatives (including no treatment), and the patient's decision.",
    when: (ctx) =>
      mentions(ctx, "consent") && !mentions(ctx, "risk", "alternative", "question", "declined", "option")
  },
  {
    id: "byte.informed-refusal",
    say: "A declined recommendation deserves the same documentation as an accepted one.",
    why:
      "Refusal cases are lost on silence: the chart shows the recommendation and then nothing. " +
      "What was recommended, what the patient was told could happen without it, and their " +
      "decision in their own words — that is informed refusal, and it protects the patient's " +
      "autonomy and the practice in the same three sentences.",
    source: "CNA/Dentist's Advantage informed-refusal guidance; The Doctors Company referral documentation guidance",
    priority: 68,
    when: (ctx) =>
      mentions(ctx, "refused", "declined", "does not want", "deferred treatment") &&
      !mentions(ctx, "explained", "informed of", "advised of", "understands", "consequence")
  },
  {
    id: "byte.referral-loop",
    say: "A referral is documented — the loop closes when the note says to whom and why.",
    why:
      "\"Referred to oral surgery\" leaves three questions the record should answer: to whom, " +
      "for what, and with what urgency. Named recipient, stated reason, and a timeframe turn a " +
      "referral from a hand-off into a traceable act of care — and unfollowed referrals are a " +
      "recurring theme in delayed-diagnosis claims.",
    source: "D'Amour (Mass. 1991) delayed-diagnosis lesson; CNA referral documentation guidance",
    priority: 60,
    when: (ctx) =>
      hasCareEvent(ctx, "referral") &&
      !mentions(ctx, " dr", "oral surge", "endodontist", "periodontist", "orthodont", "specialist for")
  },
  {
    id: "byte.amendment-not-erasure",
    say: "Correcting the record? Tennessee wants an addendum, never an erasure.",
    why:
      "A dental record is corrected by adding a dated, signed addendum that identifies what it " +
      "corrects — never by rewriting the original. An altered record is treated as consciousness " +
      "of wrongdoing in litigation even when the underlying care was fine. The addendum template " +
      "in verified blocks does this correctly.",
    source: "Tenn. Comp. R. 0460-02-.12; spoliation doctrine (see litigation-documentation-research.md)",
    priority: 74,
    when: (ctx) =>
      mentions(ctx, "correction", "corrected note", "amend", "addendum", "revise the note") &&
      !mentions(ctx, "original entry remains", "not backdated")
  },

  // --- Craft: the writing itself -------------------------------------------
  {
    id: "byte.active-voice",
    say: "Who did it? Active voice puts the actor in the sentence.",
    why:
      "\"2 carpules were administered\" hides the one fact a reviewer always wants: by whom. " +
      "\"The dentist administered 2 carpules\" is shorter, clearer, and attribution is the " +
      "difference between a record and a mystery. Passive voice is not wrong — it is just " +
      "where actors go to disappear.",
    source: "Adams, A Manual of Style for Contract Drafting (5th ed.); this practice's writing standard",
    priority: 40,
    nextAction: "Rewrite one passive line with the actor first (dentist, hygienist, or assistant).",
    when: (ctx) => detectPassive(ctx.text).length > 0
  },
  {
    id: "byte.specifics-beat-adjectives",
    say: "Numbers age better than adjectives.",
    why:
      "\"Deep pocket\" is an argument; \"6 mm pocket, distal of tooth 30\" is a fact. The reader " +
      "in three years — a colleague, an insurer, an attorney — can act on a measurement and can " +
      "only shrug at an adjective.",
    source: "CNA/Dentist's Advantage: factual, objective, professionally worded entries",
    priority: 35,
    when: (ctx) =>
      mentions(ctx, "deep pocket", "large caries", "significant bone loss", "severe decay") &&
      !ctx.kinds.has("measurement")
  },
  {
    id: "byte.first-fact",
    say: "Hi! I read as you type — teeth, doses, findings — and coach, never block.",
    why:
      "Everything Byte says is advice with a source under it: Tennessee record rules, pharmacy " +
      "safety literature, and the lessons of real disciplinary cases. The audit panel is the " +
      "referee; Byte is the trainer. Nothing here can touch your note.",
    source: "This practice's advisor charter: read-only, advise-only, source-cited",
    priority: 1,
    when: (ctx) => ctx.facts.length > 0
  },

  // --- Momentum: earned, specific encouragement ----------------------------
  {
    id: "byte.strong-note",
    say: "This note answers the questions before a reader asks them.",
    why:
      "Teeth named, doses computable, aftercare documented — this is what \"the record alone " +
      "shows what happened and why\" looks like in practice. The next reader of this chart, " +
      "whoever they are, will not need to call you.",
    source: "Tenn. Comp. R. 0460-02-.12's continuity standard, met",
    priority: 5,
    when: (ctx) =>
      ctx.facts.length >= 6 &&
      ctx.kinds.has("care-event") &&
      detectPassive(ctx.text).length === 0
  }
];

/**
 * Passive-voice detection, scoped to the clinical verbs that matter.
 *
 * A general passive detector over English is a research project; a detector
 * over the twenty verbs dental notes actually use is a table. Deliberately
 * NARROW: it looks for be-forms attached to the specific participles whose
 * hidden actor a reviewer will someday ask about ("was administered" — by
 * whom?), and it accepts the construction when a by-phrase follows, because
 * "was administered by Dr. M" names the actor and the coaching point
 * disappears.
 */
const PASSIVE_PARTICIPLES =
  "administered|placed|given|taken|reviewed|discussed|obtained|performed|completed|noted|observed|advised|prescribed|recorded|extracted|restored|applied|removed|adjusted|delivered|provided";

const PASSIVE_PATTERN = new RegExp(
  `\\b(?:was|were|is|are|has been|have been|being)\\s+(?:${PASSIVE_PARTICIPLES})\\b(?!\\s+by\\s+\\S)`,
  "gi"
);

export function detectPassive(text: string): string[] {
  const found: string[] = [];
  PASSIVE_PATTERN.lastIndex = 0;
  for (const m of text.matchAll(PASSIVE_PATTERN)) {
    found.push(m[0]);
    if (found.length >= 5) break;
  }
  return found;
}

export const KNOWLEDGE: KnowledgeEntry[] = [...CORE_KNOWLEDGE, ...KNOWLEDGE_EXPANSION];
