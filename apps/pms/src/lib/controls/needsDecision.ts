/**
 * One refusal for one condition (Increment 1.48).
 *
 * Two paths ask the same question of the practice: switching a tightening
 * exception off (`retireException`, Increment 1.31) and moving a reason code's
 * threshold the loose way (`setReasonThreshold`, Increment 1.47). Both are a
 * change that lets through what used to wait, asked for without the decision
 * that licenses it. Both already reuse `decisionPermitsRetirement` so the rule
 * cannot drift; until this increment the two refusals still drifted around it,
 * answering different statuses in different words for one condition.
 *
 * **409, not 400.** Nothing is wrong with the figure or the request: it is well
 * formed, and the same request succeeds the moment a decision stands beside it.
 * The practice's current state is what refuses it, which is what 409 says. The
 * browser harness makes the same distinction — it fails a suite on a 400 from
 * an API route, on the reasoning that the product's own screens should not send
 * malformed requests — so a 400 here reads as a defect in the screen rather
 * than as an answer to the person using it.
 */

/** The status a loosening asked for without its decision answers. */
export const NEEDS_DECISION_STATUS = 409 as const;

/** The refusal code both paths return, so a caller may branch on one value. */
export const NEEDS_DECISION_CODE = "needs_decision" as const;

/**
 * What the owner supplies, in the words both paths use. The first sentence
 * names the particular change; this one names what ends the refusal, and says
 * the same thing wherever the refusal comes from.
 */
export const RECORD_THE_DECISION =
  "Accept the residual or name what compensates, say why, and set the day the practice looks at this again.";
