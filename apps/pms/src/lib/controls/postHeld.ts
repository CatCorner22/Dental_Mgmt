import type { DualReleasePolicy, Person } from "@pms/controls-engine";
import { ledgerEntries, paymentAllocations } from "@pms/db";
import { createPostEntry, makeInMemoryWriter, postGuarded } from "@pms/ledger";
import type { PostResult } from "@pms/ledger";
import { uuidv7 } from "@pms/db";
import { withTenantAppendTransaction, withTenantTransaction } from "../db/client";
import { loadActivePolicy } from "./policy";
import { loadStaff } from "./staff";
import type { ApprovalRow } from "./approvals";

/**
 * Executes a held ledger posting after dual approval.
 *
 * Two connections, two roles: the runtime role (app_rw) reads the policy and
 * the staff, because the append role may read neither users nor grants; the
 * append role (app_append) then evaluates and inserts. The database trigger
 * re-reads the cited approval request on insert as the append role, which
 * holds SELECT on approval_requests and control_policies for exactly that.
 *
 * A held correction (Increment 1.38) carries its repost beside the reversal.
 * Both halves insert here, in one transaction, under the one approval; the
 * result names the reversal, and the repost is found through its link.
 */
export async function executeHeldPosting(
  tenantId: string,
  userId: string,
  request: ApprovalRow,
  approverId: string,
  env: Record<string, string | undefined> = process.env
): Promise<PostResult> {
  const context = await withTenantTransaction(
    tenantId,
    userId,
    async (db) => {
      const active = await loadActivePolicy(db, tenantId);
      if (!active) throw new Error("No control policy configured for tenant.");
      const { people } = await loadStaff(db, tenantId);
      return { policy: active.policy as DualReleasePolicy, people: people as Person[] };
    },
    env
  );

  return withTenantAppendTransaction(
    tenantId,
    userId,
    async (db) => {
      const payload = { ...request.heldPayload, approvalRequestId: request.id };

      const store = { entries: [], allocations: [] };
      const post = createPostEntry(makeInMemoryWriter(store));
      const result = await postGuarded(post, {
        ...payload,
        secondPersonId: approverId,
        policy: context.policy,
        people: context.people,
        // The hold was made on the clock at request time; the approval re-evaluates on the same fact.
        outsideBusinessHours: payload.afterHours != null,
      });

      if (!result.ok) return result;

      const postedAt = new Date(result.entry.postedAt);
      const correction = payload.correction;
      await db.insert(ledgerEntries).values({
        id: result.entry.id,
        tenantId: result.entry.tenantId,
        accountId: result.entry.accountId,
        patientId: result.entry.patientId,
        locationId: result.entry.locationId,
        kind: result.entry.kind,
        glBucket: result.entry.glBucket,
        amountCents: result.entry.amountCents,
        currency: result.entry.currency,
        reasonCode: result.entry.reasonCode ?? null,
        effectiveDate: result.entry.effectiveDate,
        postedAt,
        createdById: result.entry.createdById,
        createdByName: result.entry.createdByName,
        procedureId: result.entry.procedureId ?? null,
        claimId: result.entry.claimId ?? null,
        coverageId: result.entry.coverageId ?? null,
        reversesEntryId: result.entry.reversesEntryId ?? null,
        correctsEntryId: correction?.correctsEntryId ?? null,
        approvalRequestId: result.entry.approvalRequestId ?? null,
        appliedExceptionId: result.entry.appliedExceptionId ?? null,
        tender: result.entry.tender ?? null,
        memo: result.entry.memo ?? null,
        idempotencyKey: result.entry.idempotencyKey,
        insuranceExpectedCents: result.entry.insuranceExpectedCents ?? null,
        createdAt: postedAt,
      });

      // The repost, written behind the reversal the database has just admitted.
      if (correction) {
        await db.insert(ledgerEntries).values({
          id: uuidv7(postedAt.getTime() + 1),
          tenantId: result.entry.tenantId,
          accountId: result.entry.accountId,
          patientId: result.entry.patientId,
          locationId: result.entry.locationId,
          kind: correction.repostKind,
          glBucket: result.entry.glBucket,
          amountCents: correction.repostAmountCents,
          currency: result.entry.currency,
          reasonCode: result.entry.reasonCode ?? null,
          effectiveDate: result.entry.effectiveDate,
          postedAt,
          createdById: result.entry.createdById,
          createdByName: result.entry.createdByName,
          procedureId: result.entry.procedureId ?? null,
          claimId: result.entry.claimId ?? null,
          coverageId: result.entry.coverageId ?? null,
          correctsEntryId: correction.correctsEntryId,
          approvalRequestId: result.entry.approvalRequestId ?? null,
          appliedExceptionId: result.entry.appliedExceptionId ?? null,
          tender: correction.repostTender,
          memo: result.entry.memo ?? null,
          idempotencyKey: `correct-repost-${correction.correctsEntryId}`,
          insuranceExpectedCents: null,
          createdAt: postedAt,
        });
      }

      if (result.allocations.length) {
        await db.insert(paymentAllocations).values(
          result.allocations.map((row) => ({
            id: row.id,
            tenantId: row.tenantId,
            paymentEntryId: row.paymentEntryId,
            chargeEntryId: row.chargeEntryId,
            amountCents: row.amountCents,
            createdAt: postedAt,
          }))
        );
      }

      return result;
    },
    env
  );
}
