// ENCODER CANDIDATE GATE — charter §4.1, as an executable decision.
//
// A learned disambiguation model earns a product slot ONLY by beating the
// deterministic heuristic on the frozen eval. This module is that sentence as
// code: hand it a candidate (any ProposeReadingFn — an ONNX classifier, a
// distilled model, a better heuristic) and it returns a verdict computed from
// the same frozen cases CI ratchets on.
//
// Passing the gate does NOT wire the candidate into the product. Product
// wiring is a code change with a RULESET_VERSION bump and a human decision —
// the gate's verdict is the evidence for that review, never a bypass of it.

import {
  DISAMBIGUATION_CASES,
  runDisambiguationEval,
  type DisambiguationCase
} from "./disambiguation-eval";
import { heuristicProposeReading, type ProposeReadingFn } from "./readingProposer";

/** The CI ratchet the heuristic itself must clear (kept in sync with the eval test). */
export const GATE_FLOOR = 0.8;

export interface CandidateGateReport {
  baselineAccuracy: number;
  candidateAccuracy: number;
  /** Strictly better than the heuristic on the same frozen set. */
  beatsBaseline: boolean;
  /** Clears the absolute CI floor as well — beating a broken baseline is not a pass. */
  clearsFloor: boolean;
  /** The only field a decision should read. */
  pass: boolean;
  /** Case ids the candidate got wrong, for the review that follows a pass. */
  candidateFailures: string[];
  verdict: string;
}

export function gateEncoderCandidate(
  candidate: ProposeReadingFn,
  cases: readonly DisambiguationCase[] = DISAMBIGUATION_CASES
): CandidateGateReport {
  const baseline = runDisambiguationEval(cases, heuristicProposeReading);
  const trial = runDisambiguationEval(cases, candidate);
  const beatsBaseline = trial.accuracy > baseline.accuracy;
  const clearsFloor = trial.accuracy >= GATE_FLOOR;
  const pass = beatsBaseline && clearsFloor;
  return {
    baselineAccuracy: baseline.accuracy,
    candidateAccuracy: trial.accuracy,
    beatsBaseline,
    clearsFloor,
    pass,
    candidateFailures: trial.results.filter((r) => !r.pass).map((r) => r.id),
    verdict: pass
      ? `PASS: candidate ${(trial.accuracy * 100).toFixed(1)}% beats heuristic ${(baseline.accuracy * 100).toFixed(1)}% on the frozen set. Product wiring still requires charter review and a RULESET_VERSION bump.`
      : `REFUSED: candidate ${(trial.accuracy * 100).toFixed(1)}% vs heuristic ${(baseline.accuracy * 100).toFixed(1)}% (floor ${(GATE_FLOOR * 100).toFixed(0)}%). The heuristic holds its slot.`
  };
}
