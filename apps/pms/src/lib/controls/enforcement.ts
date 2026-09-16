import type { EnforcementByChannel } from "@pms/controls-engine";

/**
 * What this build of the product can enforce, per dual-release channel.
 *
 * enforced : evaluateRelease runs inside the ledger posting transaction
 *            (postGuarded maps ledger kinds to these channels) and a
 *            refusal rolls the posting back.
 * external : the product does not yet hold the data for this channel.
 *            It is shown as attested, never as enforced, and it never
 *            lowers a score. Deposits and vendors arrive with later
 *            Phase 1 increments; payroll stays external until the
 *            Phase 4 payroll-provider integration.
 *
 * Move a channel to "enforced" only in the same change that makes the
 * evaluator run inside that channel's write path.
 */
export const ENFORCEMENT: EnforcementByChannel = {
  ach: "enforced",
  check: "enforced",
  writeoff: "enforced",
  deposit: "external",
  vendor_new: "external",
  payroll: "external",
};
