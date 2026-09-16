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

export type ReleaseEvaluateInput = {
  tenantId: string;
  actor: { id: string; name: string };
  channel: string;
  amountUsd: number;
  initiatorPersonId?: string;
  secondPersonId?: string;
  payee?: string;
  memo?: string;
  now?: Date;
};

export type ReleaseEvaluateResult =
  | { ok: true; evaluation: ReleaseEvaluation; coverage: ChannelCoverageRow; recorded: boolean }
  | { ok: false; status: 400 | 404; code: "unknown_channel" | "bad_amount" | "no_policy"; why: string };

/**
 * Evaluates a release on any of the six channels for a caller outside the
 * ledger (deposit bag, new vendor, payroll file). Ledger kinds go through
 * postGuarded and never call this. The evaluation is appended to the chain
 * as control.release_evaluated so an attested channel leaves a record;
 * the row names the enforcement class so nobody reads it as enforced.
 */
export async function evaluateChannelRelease(db: AppDb, input: ReleaseEvaluateInput): Promise<ReleaseEvaluateResult> {
  const now = input.now ?? new Date();
  if (!isReleaseChannel(input.channel)) {
    return { ok: false, status: 400, code: "unknown_channel", why: `"${input.channel}" is not a dual-release channel.` };
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
      initiatorPersonId: input.initiatorPersonId ?? input.actor.id,
      secondPersonId: input.secondPersonId,
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
    "control.release_evaluated",
    {
      channel: input.channel,
      enforcement: coverage.enforcement,
      amountUsd: input.amountUsd,
      initiatorPersonId: input.initiatorPersonId ?? input.actor.id,
      secondPersonId: input.secondPersonId ?? null,
      status: evaluation.status,
      ok: evaluation.ok,
      dualRequired: evaluation.dualRequired,
      thresholdUsd: evaluation.thresholdUsd,
      appliedExceptionId: evaluation.appliedException?.id ?? null,
    },
    now
  );
  return { ok: true, evaluation, coverage, recorded: true };
}
