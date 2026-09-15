import { SHORTHAND } from "@/lib/vocab/shorthand";
import {
  heuristicProposeReading,
  type ProposeReadingFn
} from "./readingProposer";

// FROZEN DISAMBIGUATION EVAL — charter §4.1 gate.
//
// Measures a ProposeReadingFn (default: deterministic heuristic) against gold
// readings. An encoder earns a product slot only if it beats this baseline on
// the same frozen set — inject it via runDisambiguationEval(cases, encoderFn).
// Cases are synthetic and de-identified by construction. Product path never
// calls an encoder; see readingProposer.ts.

export interface DisambiguationCase {
  id: string;
  display: string;
  text: string;
  /** Expected alternative substring (matched case-insensitively). */
  expectSuggested: string | null;
}

export const DISAMBIGUATION_CASES: readonly DisambiguationCase[] = [
  {
    id: "cr.restorative",
    display: "CR",
    text: "Tooth 14 MOD CR placed after etch and bond. Shade A2.",
    expectSuggested: "composite resin"
  },
  {
    id: "cr.occlusion",
    display: "CR",
    text: "Bite recorded in CR with the articulator; occlusion verified.",
    expectSuggested: "centric relation"
  },
  {
    id: "cr.ambiguous",
    display: "CR",
    text: "Patient presents for evaluation. CR discussed.",
    expectSuggested: null
  },
  {
    id: "gp.endo",
    display: "GP",
    text: "RCT completed; GP and sealer placed in the canal.",
    expectSuggested: "gutta-percha"
  },
  {
    id: "gp.referral",
    display: "GP",
    text: "Referred back to the medical GP for clearance before surgery.",
    expectSuggested: "general practitioner"
  },
  {
    id: "ext.surgical",
    display: "EXT",
    text: "Tooth 32 extracted with forceps. Hemostasis achieved in the socket.",
    expectSuggested: "extraction"
  },
  {
    id: "ext.prosthetic",
    display: "EXT",
    text: "Temporary bridge margin EXT adjusted; pontic seating verified.",
    expectSuggested: "extension"
  },
  {
    id: "fms.radiograph",
    display: "FMS",
    text: "FMS radiographic series acquired; pano compared.",
    expectSuggested: "full-mouth radiographic"
  },
  {
    id: "fms.medical",
    display: "FMS",
    text: "Medical history includes chronic FMS / fibromyalgia pain syndrome.",
    expectSuggested: "fibromyalgia"
  },
  {
    id: "pd.periodontal",
    display: "PD",
    text: "Generalized PD 2-3 mm, no bleeding on probing.",
    expectSuggested: "probing depth"
  },
  {
    id: "pd.prosthetic",
    display: "PD",
    text: "Partial denture (PD) framework try-in; retention checked.",
    expectSuggested: "partial denture"
  },
  {
    id: "mi.dental",
    display: "MI",
    text: "Occlusion verified in MI; no interferences on excursions.",
    expectSuggested: "maximum intercuspation"
  },
  {
    id: "mi.cardiac",
    display: "MI",
    text: "Medical history: MI two years ago; cleared by cardiology.",
    expectSuggested: "myocardial infarction"
  },
  {
    id: "ra.medical",
    display: "RA",
    text: "History of rheumatoid arthritis (RA); joints stable.",
    expectSuggested: "rheumatoid arthritis"
  },
  {
    id: "ra.nitrous",
    display: "RA",
    text: "Nitrous oxide relative analgesia (RA) at 30%; recovered on 100% oxygen.",
    expectSuggested: "relative analgesia"
  },
  {
    id: "cc.complaint",
    display: "CC",
    text: "CC: throbbing pain tooth 19 since Saturday.",
    expectSuggested: "chief complaint"
  },
  {
    id: "cc.volume",
    display: "CC",
    text: "Administered 2 CC of lidocaine; volume recorded in mL next.",
    expectSuggested: "cubic centimetres"
  },
  {
    id: "gi.restorative",
    display: "GI",
    text: "Tooth 3 GI liner placed under the amalgam; Fuji IX used.",
    expectSuggested: "glass ionomer"
  },
  {
    id: "gi.medical",
    display: "GI",
    text: "Medical history: chronic GI upset and GERD; stomach stable today.",
    expectSuggested: "gastrointestinal"
  },
  {
    id: "asa.block",
    display: "ASA",
    text: "ASA nerve block administered; infiltration at the anterior maxilla.",
    expectSuggested: "anterior superior alveolar"
  },
  {
    id: "cad.cam",
    display: "CAD",
    text: "CAD/CAM ceramic crown milled from the lab scan; try-in next.",
    expectSuggested: "computer-aided design"
  }
] as const;

export interface DisambiguationResult {
  id: string;
  pass: boolean;
  suggested: string | null;
  expectSuggested: string | null;
}

export interface DisambiguationReport {
  results: DisambiguationResult[];
  passed: number;
  total: number;
  /** Share correct, including correct silence. */
  accuracy: number;
}

function alternativesFor(display: string): string[] {
  const entry = SHORTHAND.find((s) => s.display.toLowerCase() === display.toLowerCase());
  return entry?.alternatives ?? [];
}

export function runDisambiguationEval(
  cases: readonly DisambiguationCase[] = DISAMBIGUATION_CASES,
  proposeFn: ProposeReadingFn = heuristicProposeReading
): DisambiguationReport {
  const results: DisambiguationResult[] = cases.map((c) => {
    const alts = alternativesFor(c.display);
    const proposal = proposeFn(c.display, alts, c.text);
    const suggested = proposal?.suggested ?? null;
    let pass: boolean;
    if (c.expectSuggested === null) {
      pass = suggested === null;
    } else {
      pass = !!suggested && new RegExp(c.expectSuggested, "i").test(suggested);
    }
    return {
      id: c.id,
      pass,
      suggested,
      expectSuggested: c.expectSuggested
    };
  });
  const passed = results.filter((r) => r.pass).length;
  return {
    results,
    passed,
    total: results.length,
    accuracy: results.length === 0 ? 0 : passed / results.length
  };
}
