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
 * external : the product does not yet hold the data for this channel. It is
 *            shown as attested, never as enforced, and never lowers a score.
 *            Deposits and vendors arrive with later Phase 1 increments;
 *            payroll stays external until the payroll-provider integration.
 *
 * Move a channel up only in the same change that makes the evaluator run
 * inside that channel's own write path.
 */
export const ENFORCEMENT: EnforcementByChannel = {
  ach: "partial",
  check: "partial",
  writeoff: "enforced",
  deposit: "external",
  vendor_new: "external",
  payroll: "external",
};
