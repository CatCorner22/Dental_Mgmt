// READING PROPOSER SEAM — charter §4.1 injection point.
//
// The product path always uses the deterministic heuristic (`proposeReading`).
// An encoder candidate may be passed into the frozen eval harness only. It
// earns a product slot when it beats that eval; until then nothing here
// ships weights, calls a provider, or auto-applies a reading into the note.

import { proposeReading, type ReadingProposal } from "./proposeReading";

export type { ReadingProposal };

/** Same signature the heuristic and any future encoder must share. */
export type ProposeReadingFn = (
  display: string,
  alternatives: string[],
  surroundingText: string
) => ReadingProposal | undefined;

/** Product default — deterministic cue families only. */
export const heuristicProposeReading: ProposeReadingFn = proposeReading;

/**
 * Resolve a proposal through an optional injector. Production callers omit
 * `fn` so the heuristic always runs. Tests and the frozen eval pass a
 * candidate here without touching `standardize()`.
 */
export function resolveReadingProposal(
  display: string,
  alternatives: string[],
  surroundingText: string,
  fn: ProposeReadingFn = heuristicProposeReading
): ReadingProposal | undefined {
  return fn(display, alternatives, surroundingText);
}
