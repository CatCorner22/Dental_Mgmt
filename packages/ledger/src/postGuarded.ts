import {
  type DualReleasePolicy,
  type Person,
  type ReleaseChannel,
  type ReleaseEvaluation,
  evaluateRelease,
} from "@pms/controls-engine";
import type { LedgerKind, PostRefusal, PostResult } from "./types";
import type { PostEntryInput, PostEntryFn } from "./post";

const GUARDED_KINDS: LedgerKind[] = [
  "adjustment",
  "write_off",
  "refund",
  "reversal",
  "transfer_out",
  "transfer_in",
];

/** Mirrors ledger_release_channel() in migration 0014; change both together. */
const CHANNEL_BY_KIND: Partial<Record<LedgerKind, ReleaseChannel>> = {
  adjustment: "writeoff",
  write_off: "writeoff",
  refund: "check",
  reversal: "writeoff",
  transfer_out: "ach",
  transfer_in: "ach",
};

export type GuardedPostInput = PostEntryInput & {
  secondPersonId?: string;
  policy: DualReleasePolicy;
  people: Person[];
};

function refusalFromEvaluation(evaluation: ReleaseEvaluation): PostRefusal {
  const verb =
    evaluation.status === "needs_second"
      ? "Request approval"
      : evaluation.status === "blocked_same_person"
        ? "Choose a different approver"
        : "Cannot post";
  return {
    ok: false,
    code: evaluation.status,
    verb,
    control: evaluation.eligibleSeconds[0]?.name ?? "Controls",
    why: evaluation.reasons[0] ?? "Posting refused by dual-release policy.",
    evaluation,
    held: evaluation.status === "needs_second",
  };
}

/**
 * Runs evaluateRelease inside the posting transaction, then appends when
 * allowed. A release that needs two people posts only with an approved
 * request id: the second person decides in their own session through the
 * approvals inbox, and the database trigger (migration 0014) re-checks the
 * request on insert. Naming a second person inline never substitutes for
 * that decision. A single release licensed by an exception carries the
 * exception id so the trigger can verify it against the policy.
 */
export async function postGuarded(
  postEntry: PostEntryFn,
  input: GuardedPostInput
): Promise<PostResult> {
  if (!GUARDED_KINDS.includes(input.kind)) {
    return postEntry(input);
  }

  const channel = CHANNEL_BY_KIND[input.kind];
  if (!channel) {
    return {
      ok: false,
      code: "unsupported_channel",
      verb: "Cannot post",
      control: "Controls",
      why: `No dual-release channel mapped for kind ${input.kind}.`,
    };
  }

  const evaluation = evaluateRelease(
    input.policy,
    {
      channel,
      amountUsd: Math.abs(input.amountCents) / 100,
      initiatorPersonId: input.createdById,
      secondPersonId: input.secondPersonId,
      memo: input.memo ?? undefined,
    },
    input.people
  );

  if (!evaluation.ok || evaluation.status === "needs_second") {
    return refusalFromEvaluation(evaluation);
  }

  if (evaluation.dualRequired && !input.approvalRequestId) {
    return {
      ok: false,
      code: "approval_request_required",
      verb: "Request approval",
      control: evaluation.eligibleSeconds[0]?.name ?? "Controls",
      why: "Two people must release this amount. The second person decides the request in their own session; a name on the posting is not a decision.",
      evaluation,
      held: false,
    };
  }

  const appliedExceptionId =
    !evaluation.dualRequired && evaluation.appliedException ? evaluation.appliedException.id : null;

  return postEntry({
    ...input,
    approvalRequestId: input.approvalRequestId ?? null,
    appliedExceptionId: input.appliedExceptionId ?? appliedExceptionId,
  });
}

export { GUARDED_KINDS, CHANNEL_BY_KIND };
