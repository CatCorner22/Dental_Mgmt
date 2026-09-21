import { latestDecisionFor, type ControlDecision } from "@pms/controls-engine";

/**
 * The practice that has only one person who may decide (Increment 1.75).
 *
 * The chart of accounts runs under maker-checker: one person proposes a
 * mapping and a different person decides it (Increment 1.35). Proposing needs
 * manager rank; deciding needs administrator rank and a different pair of
 * hands. A practice whose only rank-bearing person is one administrator can
 * therefore propose a mapping it can never have decided — and since
 * `closeMonth` refuses while any journal line is unmapped, with no waiver,
 * **no month ever closes**. The outside accountant never receives a frozen
 * month, for as long as the practice exists.
 *
 * Nothing in the product gets them out of it. No route writes `users.role`:
 * the only `insert(users)` this product performs hard-codes `readonly` for the
 * outside accountant's seat, and the store updates only `active`, the MFA
 * fields and the password. A practice cannot appoint a second decider, so the
 * control asks for a person the product gives it no way to have.
 *
 * ## The escape is a decision, not a switch
 *
 * Increment 1.31 settled the shape for a control that must sometimes stand
 * down: the owner records a decision carrying a reason, a residual note and a
 * required review date, and the control's new state is **derived from whether
 * that decision stands** rather than from a flag somebody remembered to set.
 * The register already holds everything this needs — `DECISION_SUBJECT_KINDS`
 * carries `"control"`, `DECISION_KINDS` carries `accept_residual`, and
 * `validateDecision` already requires the review date — so this increment adds
 * no exception action, no channel, no column and no table.
 *
 * `ThresholdException` would have been the wrong home: it is channel-scoped
 * (`validateThresholdException` runs every entry through `isReleaseChannel`)
 * and its four actions all govern money release. The chart of accounts is not
 * a release channel, and inventing a pseudo-channel for it would corrupt the
 * vocabulary the six-channel coverage table reads.
 *
 * ## The decision is self-recorded, and must be
 *
 * `recordDecision` refuses self-licensing: nobody accepts or compensates a
 * conflict on their own duties. Here the sole administrator records the
 * decision that licenses the sole administrator, which is self-licensing in
 * substance — and there is no honest way around it, because **requiring a
 * second administrator to record it reproduces the deadlock one level up**:
 * the practice would need two administrators to license the state it is in
 * precisely because it has one.
 *
 * So what makes this safe is not a second pair of hands, which do not exist.
 * It is that the standing-down is dated, reviewed, and **reported to the one
 * independent party this product has**. The month-end package states how many
 * mappings in force were decided by the person who proposed them, so the
 * outside accountant receives the fact whether or not anybody thinks to
 * mention it. A practice that never invited an accountant still records the
 * decision and still closes: reporting to that seat is unconditional, but
 * depending on it would be a new deadlock in place of the old one.
 */

/** The decision subject: the control, not any one mapping or person. */
export const SOLE_DECIDER_CONTROL = "gl_mapping_maker_checker";

/**
 * The decision kinds that license the control standing down. `monitor`,
 * `remediate` and `insure` record an intention about the control and change
 * nothing about who may decide; only accepting the residual, or compensating
 * for it, says the practice has looked at this state and chosen to work in it.
 */
export function licenses(decision: Pick<ControlDecision, "kind">): boolean {
  return decision.kind === "accept_residual" || decision.kind === "compensate";
}

export type SoleDeciderStanding =
  | { standing: "none"; decision: null }
  | { standing: "good" | "overdue"; decision: ControlDecision };

/**
 * Whether one person may decide their own mapping right now, read from the
 * register rather than from anything stored beside it.
 *
 * An overdue review does not revoke the licence, and says so instead: that is
 * Increment 1.31's reading of the after-hours hold, where the board reports
 * "off since, review due" rather than switching the control back on under a
 * practice that is mid-month. A licence that expired by surprise would close
 * the deadlock again on the day somebody was least ready for it.
 */
export function soleDeciderStanding(decisions: ControlDecision[], asOf: string): SoleDeciderStanding {
  const decision = latestDecisionFor(decisions, "control", SOLE_DECIDER_CONTROL);
  if (!decision || !licenses(decision)) return { standing: "none", decision: null };
  if (decision.reviewBy && decision.reviewBy < asOf) return { standing: "overdue", decision };
  return { standing: "good", decision };
}

/**
 * Why this person may not decide this proposal, said to a practice that may
 * have nobody else.
 *
 * The old sentence — "a different person must approve or reject it" — is true
 * and useless where there is no different person: it names an act the reader
 * cannot perform and implies a path the product does not have. So the refusal
 * counts the people who could actually decide, and where that count is zero it
 * says what the practice may do instead, and states plainly that appointing
 * somebody is not yet among its options.
 */
export function soleDeciderRefusal(others: number): string[] {
  if (others > 0) {
    return [
      `You proposed this mapping; a different person must approve or reject it. ${others} other ${
        others === 1 ? "administrator" : "administrators"
      } can.`,
    ];
  }
  return [
    "You proposed this mapping, and this practice has no other administrator who could decide it.",
    "Record an accept-residual decision on the chart-of-accounts control, with a review date, and you may then decide your own proposals. Every mapping so decided is reported to your accountant as having been decided by one person.",
    "This product cannot yet appoint a second administrator, so that decision is the only way forward.",
  ];
}

/**
 * What the month-end package says about the chart of accounts having run
 * single-person, in the accountant's own reading.
 *
 * Counted from the mapping rows rather than from the decision: what the
 * accountant needs is not the practice's policy but how many of the mappings
 * behind this month's figures one person both proposed and decided.
 */
export function soleDeciderSentence(decidedAlone: number, approved: number): string {
  if (decidedAlone === 0) {
    return approved === 0
      ? "No mapping is in force for this month."
      : `Every one of the ${approved} mappings in force was decided by somebody other than the person who proposed it.`;
  }
  return `${decidedAlone} of the ${approved} mappings in force ${
    decidedAlone === 1 ? "was" : "were"
  } decided by the person who proposed ${decidedAlone === 1 ? "it" : "them"}, under a recorded decision that this practice has one administrator. The remaining ${
    approved - decidedAlone
  } had a second pair of hands.`;
}
