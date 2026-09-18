import type { DualReleasePolicy } from "@pms/controls-engine";

/**
 * A reason code's own dual-release threshold (Increment 1.46).
 *
 * `reason_codes.requires_approval_over_cents` says what the practice decided
 * about one reason, in three distinguishable states:
 *
 *   null   no rule for this reason; the channel's threshold governs
 *   0      every posting under this reason waits for a second person
 *   N      a second person above N cents
 *
 * It only ever tightens. A reason that could loosen would let a practice undo
 * dual release by inventing one, which is the control this whole path exists
 * to hold, so the effective threshold is the lesser of the two.
 *
 * The database enforces the same rule in `ledger_entries_requires_approval`.
 * Both must agree: where the service evaluates against the channel alone and
 * the trigger against the tightened figure, the practice meets a crash instead
 * of a hold — the shape of defect Increment 1.39 found in the reason column.
 */

/** The figure that governs this row: the channel's, tightened by the reason's. */
export function effectiveThresholdCents(channelCents: number, reasonCents: number | null): number {
  return reasonCents === null ? channelCents : Math.min(channelCents, reasonCents);
}

/**
 * The policy as it applies to one posting: the same policy, with this channel's
 * threshold tightened by the reason. Handing the engine a tightened policy keeps
 * the engine's contract untouched and makes its refusal name the figure that
 * actually governed, rather than the channel's.
 */
export function tightenPolicyForReason(
  policy: DualReleasePolicy,
  channel: string,
  reasonCents: number | null
): DualReleasePolicy {
  if (reasonCents === null) return policy;
  const rule = policy.rules.find((r) => r.channel === channel);
  if (!rule) return policy;

  const channelCents = Math.round(rule.thresholdUsd * 100);
  const effective = effectiveThresholdCents(channelCents, reasonCents);
  if (effective === channelCents) return policy;

  return {
    ...policy,
    rules: policy.rules.map((r) => (r.channel === channel ? { ...r, thresholdUsd: effective / 100 } : r)),
  };
}
