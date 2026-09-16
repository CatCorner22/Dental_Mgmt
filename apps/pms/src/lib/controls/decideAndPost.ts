import { withTenantTransaction } from "../db/client";
import {
  attachResultingEntry,
  cancelApprovedRequest,
  decideApprovalRequest,
  getApprovalRequest,
} from "./approvals";
import { executeHeldPosting } from "./postHeld";

export type ApproveAndPostResult =
  | { ok: true; requestId: string; entryId: string }
  | {
      ok: false;
      status: 403 | 404 | 409;
      code: string;
      why: string;
      verb?: string;
      control?: string;
      /** True when the approval was recorded and then cancelled because the ledger refused. */
      cancelled?: boolean;
    };

/**
 * A refusal raised by the database itself (the dual-release trigger, a
 * unique index, a CHECK). Drizzle wraps the pg error, so the code and the
 * message sit on `cause`; both layers are inspected.
 */
function databaseRefusal(error: unknown): { code: string; message: string } | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const e = current as { code?: string; message?: string; cause?: unknown };
    if (
      typeof e.code === "string" &&
      typeof e.message === "string" &&
      (e.code === "P0001" || e.code === "23505" || e.code === "23514")
    ) {
      return { code: e.code, message: e.message };
    }
    current = e.cause;
  }
  return null;
}

/**
 * The second person's decision, then the posting, in that order.
 *
 * 1. Approve the request in the runtime transaction: status approved,
 *    second approver recorded, requester re-checked to be a different
 *    person. This is the decision; it stands on its own.
 * 2. Execute the held posting in the append transaction. The database
 *    trigger (migration 0014) re-reads the request and refuses an insert
 *    that does not cite an approved request decided by someone else.
 * 3. Attach the entry id to the request.
 *
 * If step 2 refuses, the approval is cancelled with the refusal as its
 * reason, so no approval stands without the entry it was for.
 */
export async function approveAndPost(
  tenantId: string,
  approver: { id: string; name: string },
  requestId: string,
  env: Record<string, string | undefined> = process.env
): Promise<ApproveAndPostResult> {
  const existing = await withTenantTransaction(tenantId, approver.id, (db) => getApprovalRequest(db, tenantId, requestId), env);
  if (!existing) return { ok: false, status: 404, code: "not_found", why: "Approval request not found." };
  if (existing.requesterId === approver.id) {
    return { ok: false, status: 403, code: "same_person", why: "Requester cannot approve their own request." };
  }

  const decided = await withTenantTransaction(
    tenantId,
    approver.id,
    (db) =>
      decideApprovalRequest(db, {
        tenantId,
        requestId,
        approverId: approver.id,
        approverName: approver.name,
        decision: "approved",
      }),
    env
  );
  if (!decided.ok) {
    return { ok: false, status: 409, code: decided.reason, why: "Approval request is no longer pending." };
  }

  let refusal: { code: string; why: string; verb?: string; control?: string } | null = null;
  let entryId: string | null = null;
  try {
    const posted = await executeHeldPosting(tenantId, approver.id, decided.request, approver.id, env);
    if (posted.ok) entryId = posted.entry.id;
    else refusal = { code: posted.code, why: posted.why, verb: posted.verb, control: posted.control };
  } catch (error) {
    const dbRefusal = databaseRefusal(error);
    if (!dbRefusal) {
      await withTenantTransaction(
        tenantId,
        approver.id,
        (db) =>
          cancelApprovedRequest(db, {
            tenantId,
            requestId,
            actorId: approver.id,
            actorName: approver.name,
            reason: `Posting failed: ${error instanceof Error ? error.message : String(error)}`,
          }),
        env
      );
      throw error;
    }
    refusal = { code: "ledger_refused", why: dbRefusal.message, verb: "Cannot post", control: "Ledger" };
  }

  if (refusal) {
    await withTenantTransaction(
      tenantId,
      approver.id,
      (db) =>
        cancelApprovedRequest(db, {
          tenantId,
          requestId,
          actorId: approver.id,
          actorName: approver.name,
          reason: refusal!.why,
        }),
      env
    );
    return { ok: false, status: 403, ...refusal, cancelled: true };
  }

  await withTenantTransaction(tenantId, approver.id, (db) => attachResultingEntry(db, { tenantId, requestId, entryId: entryId! }), env);
  return { ok: true, requestId, entryId: entryId! };
}
