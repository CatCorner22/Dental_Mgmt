import type { Span } from "./facts";

// UNREAD-CLAUSE ROUTER — labels phrases the grammar could not parse.
//
// Labels a QUESTION for the writer and a growth cue for the grammar queue.
// Never promotes a label into a chart fact. Encoder-class models may later
// replace the heuristics; the contract stays the same.

export type UnparsedCategory =
  | "medication"
  | "procedure"
  | "finding"
  | "imaging"
  | "consent-or-instructions"
  | "measurement"
  | "other";

export interface ClassifiedUnparsed {
  span: Span;
  category: UnparsedCategory;
  /** Short staff-facing prompt. */
  ask: string;
}

const RULES: Array<{ category: UnparsedCategory; re: RegExp; ask: string }> = [
  {
    category: "medication",
    re: /\b(?:mg|mL|mcg|tab|capsules?|rx|prescribe|amox|ibuprofen|tylenol|acetaminophen|penicillin|lido|articaine|carpules?|N2O|nitrous)\b|\d+\s*%/i,
    ask: "This looks like a medication or dose line the tool could not fully read. Write the drug, amount, and strength in plain words."
  },
  {
    category: "imaging",
    re: /\b(?:x-?ray|radiograph|BW|BWs|PA|FMX|FMS|PANO|CBCT|image)\b/i,
    ask: "This looks like imaging. Name the type and who will read it (or the finding)."
  },
  {
    category: "procedure",
    re: /\b(?:extract|resto|fill|crown|SRP|scale|prophy|sealant|RCT|implant|surgery|placed|cement)\b/i,
    ask: "This looks like a procedure phrase. Name the act and the tooth or site in full words."
  },
  {
    category: "finding",
    re: /\b(?:caries|decay|pocket|BOP|bleeding|inflamm|abscess|fracture|mobility|pain|tender)\b/i,
    ask: "This looks like a clinical finding. State what was seen or denied in plain words."
  },
  {
    category: "consent-or-instructions",
    re: /\b(?:consent|risk|alternative|post-?op|instruction|return|follow-?up|recall|dismiss)\b/i,
    ask: "This looks like consent, instructions, or follow-up. Write who decided what, and the next step."
  },
  {
    category: "measurement",
    re: /\b(?:mm|bp|\/\d{2,3}|\d+\s*-\s*\d+)\b/i,
    ask: "This looks like a measurement. Write the number with its unit (for example, 4 mm probing depth)."
  }
];

export function classifyUnparsedClause(text: string): { category: UnparsedCategory; ask: string } {
  for (const rule of RULES) {
    if (rule.re.test(text)) return { category: rule.category, ask: rule.ask };
  }
  return {
    category: "other",
    ask: "The tool could not read this phrase. Rewrite it in short, plain clinical words."
  };
}

export function classifyUnparsedSpans(
  source: string,
  unparsed: Span[]
): ClassifiedUnparsed[] {
  return unparsed.map((span) => {
    const slice = source.slice(span.start, span.end);
    const { category, ask } = classifyUnparsedClause(slice);
    return { span, category, ask };
  });
}

export const UNPARSED_CATEGORY_LABEL: Record<UnparsedCategory, string> = {
  medication: "Medication / dose",
  procedure: "Procedure",
  finding: "Finding",
  imaging: "Imaging",
  "consent-or-instructions": "Consent / instructions",
  measurement: "Measurement",
  other: "Unclear phrase"
};
