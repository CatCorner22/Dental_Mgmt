/**
 * Channel coverage: which dual-release channels the product enforces in
 * its own transaction, which it only records, and which are external to
 * the data it holds. An external channel is shown as attested and never
 * counts toward a score, so the table can never show a false green.
 */
import {
  type DualReleasePolicy,
  type ReleaseChannel,
  DEFAULT_DUAL_RELEASE_RULES,
} from "./controls/dual-release";

export const RELEASE_CHANNELS: ReleaseChannel[] = DEFAULT_DUAL_RELEASE_RULES.map(
  (r) => r.channel,
);

export type Enforcement = "enforced" | "recorded" | "external";
export type EnforcementByChannel = Record<ReleaseChannel, Enforcement>;

export type CoverageStatus = "enforced" | "recorded" | "external" | "off";

export interface ChannelCoverageRow {
  channel: ReleaseChannel;
  label: string;
  enforcement: Enforcement;
  /** Policy master switch and the channel rule are both on. */
  policyEnabled: boolean;
  thresholdUsd: number;
  mitigatesRuleIds: string[];
  activeExceptions: number;
  /** Enabled and not external: the channel may lower a linked SoD score. */
  countsTowardScores: boolean;
  status: CoverageStatus;
  note: string;
}

const NOTE: Record<Enforcement, string> = {
  enforced: "Evaluated inside the posting transaction; a refusal rolls the posting back.",
  recorded: "Evaluated and logged on request; the release itself happens outside this system.",
  external:
    "This system does not yet hold the data for this channel. Shown as attested, never as enforced; excluded from scores.",
};

export function isReleaseChannel(value: string): value is ReleaseChannel {
  return (RELEASE_CHANNELS as string[]).includes(value);
}

function isActiveOn(
  ex: DualReleasePolicy["exceptions"][number],
  channel: ReleaseChannel,
  asOf: string,
): boolean {
  if (!ex.enabled) return false;
  if (ex.effectiveFrom && asOf < ex.effectiveFrom) return false;
  if (ex.effectiveTo && asOf > ex.effectiveTo) return false;
  return ex.channels.length === 0 || ex.channels.includes(channel);
}

/** One row per channel, in rulebook order. `asOf` is an ISO date. */
export function channelCoverage(
  policy: DualReleasePolicy,
  enforcement: EnforcementByChannel,
  asOf: string,
): ChannelCoverageRow[] {
  return policy.rules.map((rule) => {
    const level = enforcement[rule.channel] ?? "external";
    const policyEnabled = policy.enabled && rule.enabled;
    const countsTowardScores = policyEnabled && level !== "external";
    const status: CoverageStatus =
      level === "external" ? "external" : policyEnabled ? level : "off";
    return {
      channel: rule.channel,
      label: rule.label,
      enforcement: level,
      policyEnabled,
      thresholdUsd: rule.thresholdUsd,
      mitigatesRuleIds: [...rule.mitigatesRuleIds],
      activeExceptions: (policy.exceptions ?? []).filter((e) => isActiveOn(e, rule.channel, asOf))
        .length,
      countsTowardScores,
      status,
      note: NOTE[level],
    };
  });
}

/**
 * SoD rule ids that an enabled, non-external channel mitigates. This is the
 * set the detector and the residual engine may credit; `mitigatedSodRuleIds`
 * in dual-release.ts credits every enabled channel and is kept for policy
 * display only.
 */
export function mitigatedRuleIdsForScoring(
  policy: DualReleasePolicy,
  enforcement: EnforcementByChannel,
  asOf: string,
): Set<string> {
  const ids = new Set<string>();
  for (const row of channelCoverage(policy, enforcement, asOf)) {
    if (!row.countsTowardScores) continue;
    for (const id of row.mitigatesRuleIds) ids.add(id);
  }
  return ids;
}

/**
 * Dual control on payments, for staff composition: true only when a
 * payment-moving channel (ACH or deposit) is enabled and counts.
 */
export function dualControlPaymentsFromCoverage(rows: ChannelCoverageRow[]): boolean {
  return rows.some(
    (r) => (r.channel === "ach" || r.channel === "deposit") && r.countsTowardScores,
  );
}
