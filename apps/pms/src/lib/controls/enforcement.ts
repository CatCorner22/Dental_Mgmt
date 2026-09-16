import type { EnforcementByChannel } from "@pms/controls-engine";

/**
 * What this build of the product can enforce, per dual-release channel.
 *
 * enforced : evaluateRelease runs inside the ledger posting transaction for
 *            the kinds the channel describes, and a refusal rolls the
 *            posting back. Write-offs and adjustments are exactly that.
 * partial  : evaluateRelease runs inside the posting transaction, but only
 *            for patient-ledger kinds (refunds map to "check", transfers to
 *            "ach"). The product holds no vendor payments, so these two
 *            channels mitigate no SoD rule and earn no dual-control credit;
 *            crediting the vendor-fraud controls from patient refunds would
 *            be the false green docs/05 forbids.
 *            Deposits: freezing a day close is the seal on the bag, and
 *            freezeDayClose refuses unless a different, role-eligible
 *            person counts (or the owner alone, recorded as a finding).
 * external : the product does not yet hold the data for this channel. It is
 *            shown as attested, never as enforced, and never lowers a score.
 *            Vendors arrive with a later Phase 1 increment; payroll stays
 *            external until the payroll-provider integration.
 *
 * Move a channel up only in the same change that makes the evaluator run
 * inside that channel's own write path.
 */
export const ENFORCEMENT: EnforcementByChannel = {
  ach: "partial",
  check: "partial",
  writeoff: "enforced",
  deposit: "enforced",
  vendor_new: "external",
  payroll: "external",
};
