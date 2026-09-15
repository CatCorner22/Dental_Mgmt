import { classifyUnparsedClause, type UnparsedCategory } from "./classifyUnparsed";

// FROZEN UNREAD-CLAUSE ROUTING EVAL — charter §4.2 gate.
//
// Labels are questions for the writer, never chart facts. An encoder earns a
// slot only if it beats this heuristic on the same frozen set.

export interface UnparsedRoutingCase {
  id: string;
  text: string;
  expect: UnparsedCategory;
}

export const UNPARSED_ROUTING_CASES: readonly UnparsedRoutingCase[] = [
  {
    id: "med.carpule",
    text: "gave 2 carpules mystery-agent 2%",
    expect: "medication"
  },
  {
    id: "med.rx",
    text: "rx amox mystery pack for infection",
    expect: "medication"
  },
  {
    id: "img.bw",
    text: "mystery BW series acquired chairside",
    expect: "imaging"
  },
  {
    id: "img.pano",
    text: "pano radiograph reviewed with patient",
    expect: "imaging"
  },
  {
    id: "proc.extract",
    text: "difficult extract sequence completed",
    expect: "procedure"
  },
  {
    id: "proc.crown",
    text: "crown prep and temp placed same visit",
    expect: "procedure"
  },
  {
    id: "find.caries",
    text: "occlusal caries noted without tooth id",
    expect: "finding"
  },
  {
    id: "find.pocket",
    text: "bleeding on probing generalized",
    expect: "finding"
  },
  {
    id: "consent.risks",
    text: "risks reviewed; follow-up unclear",
    expect: "consent-or-instructions"
  },
  {
    id: "consent.poi",
    text: "post-op instruction sheet handed at dismiss",
    expect: "consent-or-instructions"
  },
  {
    id: "measure.mm",
    text: "sites measuring 5-6 mm without label",
    expect: "measurement"
  },
  {
    id: "other.noise",
    text: "asdf qwerty zxcv",
    expect: "other"
  }
] as const;

export interface UnparsedRoutingReport {
  passed: number;
  total: number;
  accuracy: number;
  misses: Array<{ id: string; got: UnparsedCategory; expect: UnparsedCategory }>;
}

export function runUnparsedRoutingEval(
  cases: readonly UnparsedRoutingCase[] = UNPARSED_ROUTING_CASES
): UnparsedRoutingReport {
  const misses: UnparsedRoutingReport["misses"] = [];
  let passed = 0;
  for (const c of cases) {
    const got = classifyUnparsedClause(c.text).category;
    if (got === c.expect) passed += 1;
    else misses.push({ id: c.id, got, expect: c.expect });
  }
  return {
    passed,
    total: cases.length,
    accuracy: cases.length === 0 ? 0 : passed / cases.length,
    misses
  };
}
