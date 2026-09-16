import {
  channelCoverage,
  evaluateRelease,
  isReleaseChannel,
  type ChannelCoverageRow,
  type ReleaseEvaluation,
} from "@pms/controls-engine";
import type { AppDb } from "../db/client";
import { ENFORCEMENT } from "./enforcement";
import { appendControlEvent } from "./events";
import { loadActivePolicy } from "./policy";
import { loadStaff } from "./staff";

export type ReleaseAttestInput = {
  tenantId: string;
  actor: { id: string; name: string };
  channel: string;
  amountUsd: number;
  payee?: string;
  memo?: string;
  now?: Date;
};

export type ReleaseAttestResult =
  | { ok: true; evaluation: ReleaseEvaluation; coverage: ChannelCoverageRow; attestedBy: string }
  | {
      ok: false;
      status: 400 | 404;
      code: "unknown_channel" | "ledger_channel" | "bad_amount" | "no_policy";
      why: string;
    };

/**
 * Attests a release on a channel the ledger does not carry (deposit bag, new
 * vendor, payroll file). The actor is always the initiator; no second signer
 * is accepted from the request, so this path can never produce an
 * approved_dual verdict: it says whether a second person is needed and who
 * may second, and it records that the actor attested the release. Channels
 * the ledger enforces refuse here; their evidence comes from postGuarded.
 */
export async function attestChannelRelease(db: AppDb, input: ReleaseAttestInput): Promise<ReleaseAttestResult> {
  const now = input.now ?? new Date();
  if (!isReleaseChannel(input.channel)) {
    return { ok: false, status: 400, code: "unknown_channel", why: `"${input.channel}" is not a dual-release channel.` };
  }
  const level = ENFORCEMENT[input.channel];
  if (level === "enforced" || level === "partial") {
    return {
      ok: false,
      status: 400,
      code: "ledger_channel",
      why: `${input.channel} releases run through the ledger posting path; they cannot be attested by hand.`,
    };
  }
  if (typeof input.amountUsd !== "number" || !Number.isFinite(input.amountUsd) || input.amountUsd < 0) {
    return { ok: false, status: 400, code: "bad_amount", why: "Amount must be a finite, non-negative number of dollars." };
  }
  const active = await loadActivePolicy(db, input.tenantId);
  if (!active) {
    return { ok: false, status: 404, code: "no_policy", why: "No control policy is configured for this practice." };
  }
  const { people } = await loadStaff(db, input.tenantId, now);
  const asOf = now.toISOString().slice(0, 10);
  const evaluation = evaluateRelease(
    active.policy,
    {
      channel: input.channel,
      amountUsd: input.amountUsd,
      initiatorPersonId: input.actor.id,
      payee: input.payee,
      memo: input.memo,
      asOfDate: asOf,
    },
    people
  );
  const coverage = channelCoverage(active.policy, ENFORCEMENT, asOf).find((c) => c.channel === input.channel)!;

  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "control.release_attested",
    {
      channel: input.channel,
      enforcement: coverage.enforcement,
      attestedBy: input.actor.id,
      amountUsd: input.amountUsd,
      status: evaluation.status,
      dualRequired: evaluation.dualRequired,
      thresholdUsd: evaluation.thresholdUsd,
      eligibleSecondIds: evaluation.eligibleSeconds.map((p) => p.id),
      appliedExceptionId: evaluation.appliedException?.id ?? null,
    },
    now
  );
  return { ok: true, evaluation, coverage, attestedBy: input.actor.id };
}
