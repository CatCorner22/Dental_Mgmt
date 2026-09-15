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
  };
}

/**
 * Runs evaluateRelease inside the posting transaction, then appends when allowed.
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

  if (!evaluation.ok) {
    return refusalFromEvaluation(evaluation);
  }

  return postEntry({
    ...input,
    approvalRequestId: input.approvalRequestId ?? evaluation.second?.id ?? null,
  });
}

export { GUARDED_KINDS, CHANNEL_BY_KIND };
