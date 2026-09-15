// BYTESTAR MODE ROUTER — deterministic strictness routing for the pioneer.
//
// The router classifies the DRAFT (staff never prompt SuperByte) into risk
// modes and resolves a strictness profile. Everything here is regex over the
// input text: the model is never asked to classify its own risk.
//
// Escalation is max-conservatism: a draft spanning more than one high-risk
// mode is read under the LEGAL profile, the strictest cage configuration.
// "Confidence" plays no part — routing is a fact about the text.

export type ByteStarMode = "documentation" | "sedation" | "imaging" | "legal";

export type ByteStarProfileId = "documentation" | "high-risk" | "legal";

export interface ModeProfile {
  id: ByteStarProfileId;
  /** Floor on independent reads (still capped by a later service ceiling). */
  minReads: number;
  /** Unanimous consensus instead of simple majority. */
  unanimous: boolean;
  /** Model-proposed rewrites are refused outright. */
  forbidRewrites: boolean;
  /** Every suggestion must cite a regulatory / named-authority source. */
  regulatorySourcesOnly: boolean;
}

// Cues are intentionally narrower than retrieval cues: routine operative
// local anesthetic ("2 carpules lidocaine") must NOT flip every filling note
// into sedation-strict. Sedation mode is for cognition-altering medication,
// general anesthesia, weight-based dosing, and perioperative assessment.
const SEDATION_CUE =
  /\b(?:sedat\w+|general\s+an[ae]sthes\w+|deep\s+sedation|conscious\s+sedation|moderate\s+sedation|midazolam|triazolam|halcion|fentanyl|ketamine|propofol|nitrous\s+oxide|N2O|mg\s*\/\s*kg|NPO\b|airway\s+assess\w*|ASA\s+(?:physical\s+status|I{1,3}\b|IV\b))/i;

const IMAGING_CUE =
  /\b(?:radiograph\w*|x-?rays?|CBCT|cone-?beam|panoramic|pano\b|bitewings?|periapicals?|FMX|MRI|radiolucen\w+|radiopa\w+)\b/i;

const LEGAL_CUE =
  /\b(?:licens\w+|board\s+of\s+dentistry|scope\s+of\s+practice|supervis\w+|statutes?|liabilit\w+|legal|law\b|laws\b|malpractice|TCA\b|Tenn\.?\s*(?:Code|Comp)|rule\s+0460)\b/i;

/** All modes the draft touches. Documentation is always present as the base. */
export function resolveModes(text: string): ByteStarMode[] {
  const modes: ByteStarMode[] = ["documentation"];
  if (SEDATION_CUE.test(text)) modes.push("sedation");
  if (IMAGING_CUE.test(text)) modes.push("imaging");
  if (LEGAL_CUE.test(text)) modes.push("legal");
  return modes;
}

/**
 * Strictest applicable profile. Legal wins outright; two high-risk modes
 * together also escalate to legal (the spec's max-conservatism rule).
 */
export function resolveProfile(modes: ByteStarMode[]): ModeProfile {
  const highRisk = modes.filter((m) => m !== "documentation");
  const legal = modes.includes("legal") || highRisk.length >= 2;
  if (legal) {
    return {
      id: "legal",
      minReads: 3,
      unanimous: true,
      forbidRewrites: true,
      regulatorySourcesOnly: true
    };
  }
  if (highRisk.length === 1) {
    return {
      id: "high-risk",
      minReads: 3,
      unanimous: true,
      forbidRewrites: true,
      regulatorySourcesOnly: false
    };
  }
  return {
    id: "documentation",
    minReads: 1,
    unanimous: false,
    forbidRewrites: false,
    regulatorySourcesOnly: false
  };
}

const NON_TN_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
  "Puerto Rico"
] as const;

const NON_TN_STATE_RE = new RegExp(`\\b(${NON_TN_STATES.join("|")})\\b`, "i");

/**
 * Name of a non-Tennessee jurisdiction when the draft discusses law or
 * licensure in it; null otherwise.
 */
export function detectForeignJurisdiction(text: string): string | null {
  if (!LEGAL_CUE.test(text)) return null;
  const m = text.match(NON_TN_STATE_RE);
  return m ? m[1]! : null;
}

/** Copy shown by the panel when TN-law observations were withheld. */
export function jurisdictionNoticeFor(state: string): string {
  return `This draft references ${state}. SuperByte's law observations are Tennessee-only and were withheld — verify ${state} requirements with that state's board.`;
}

const STRONG_CLAIM_RE =
  /\b(?:must\b|required?\b|requires\b|violat\w+|illegal|prohibited?\b|not\s+permitted|never\s+allowed|mandat\w+)/i;

export function hasStrongClaim(say: string, why: string): boolean {
  return STRONG_CLAIM_RE.test(say) || STRONG_CLAIM_RE.test(why);
}

const REGULATORY_PREFIXES = [
  "tn board",
  "tennessee board",
  "public chapter",
  "des-12",
  "ruleset",
  "malamed",
  "ada ",
  "american dental association",
  "cdc",
  "fda",
  "aapd",
  "ismp",
  "joint commission"
] as const;

export function isRegulatorySource(source: string): boolean {
  const lower = source.trim().toLowerCase();
  return REGULATORY_PREFIXES.some((p) => lower.startsWith(p));
}

/** True when a source cites Tennessee authority specifically. */
export function isTennesseeSource(source: string): boolean {
  const lower = source.trim().toLowerCase();
  return (
    lower.startsWith("tn board") ||
    lower.startsWith("tennessee board") ||
    lower.startsWith("public chapter") ||
    lower.startsWith("des-12")
  );
}

/** Prompt addendum for strict profiles — asks; the verifier enforces. */
export function strictPromptAddendum(profile: ModeProfile, modes: ByteStarMode[]): string {
  if (profile.id === "documentation") return "";
  const domain = modes.filter((m) => m !== "documentation").join(" + ");
  return `STRICT READ (${domain}): prefer neutral questions over assertions. Do not propose rewrites. Every claim needs a named authority in "source"${
    profile.regulatorySourcesOnly ? " — Tennessee Board, DES-12, or a named national body" : ""
  }. If unsure, ask.`;
}
