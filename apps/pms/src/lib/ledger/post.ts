import { and, eq, sql } from "drizzle-orm";
import type { ReleaseEvaluation } from "@pms/controls-engine";
import { ledgerEntries, locations, paymentAllocations, patients, users, userEntitlements } from "@pms/db";
import {
  CHANNEL_BY_KIND,
  createPostEntry,
  postGuarded,
  type AfterHoursFacts,
  type LedgerEntry,
  type LedgerWriter,
  type PostEntryInput,
  type PostResult,
} from "@pms/ledger";
import { createApprovalRequest } from "../controls/approvals";
import { staffToPeople } from "../controls/people";
import { loadActivePolicy } from "../controls/policy";
import type { AppDb } from "../db/client";
import { loadReasonThresholdCents } from "./reasonCodes";
import { tightenPolicyForReason } from "./reasonThreshold";
import { hoursPhrase, isOutsideHours, localClock, WEEKDAY_LABEL, type WeekHours } from "../locations/hours";

import { POSTABLE_KINDS, type PostableKind } from "./types";

export { POSTABLE_KINDS, type PostableKind };

export type PostLedgerInput = {
  accountId: string;
  patientId: string;
  kind: PostableKind;
  amountCents: number;
  effectiveDate: string;
  reasonCode?: string | null;
  memo?: string | null;
  procedureId?: string | null;
  tender?: LedgerEntry["tender"];
};

export type PostLedgerSuccess = {
  ok: true;
  status: "posted";
  entryId: string;
  duplicate?: boolean;
};

export type PostLedgerHeld = {
  ok: false;
  status: "needs_second";
  approvalRequestId: string;
  verb: string;
  control: string;
  why: string;
};

export type PostLedgerRefusal = {
  ok: false;
  status: "refused";
  code: string;
  verb: string;
  control: string;
  why: string;
};

export type PostLedgerResult = PostLedgerSuccess | PostLedgerHeld | PostLedgerRefusal;

/** Staff enter positive amounts; ledger stores charge positive and credits negative. */
export function normalizeAmountCents(kind: PostableKind, amountCents: number): number {
  const abs = Math.abs(amountCents);
  if (!abs) throw new Error("Amount must be non-zero.");
  if (kind === "charge") return abs;
  return -abs;
}

export function glBucketForKind(_kind: PostableKind): "patient_ar" {
  return "patient_ar";
}

export function mapPostRefusal(result: PostResult): PostLedgerRefusal | null {
  if (result.ok) return null;
  return {
    ok: false,
    status: "refused",
    code: result.code,
    verb: result.verb,
    control: result.control,
    why: result.why,
  };
}

async function loadStaff(db: AppDb, tenantId: string) {
  const staff = await db.select().from(users).where(eq(users.tenantId, tenantId));
  const out = [];
  for (const row of staff) {
    const ents = await db
      .select({ entitlement: userEntitlements.entitlement })
      .from(userEntitlements)
      .where(eq(userEntitlements.userId, row.id));
    out.push({
      id: row.id,
      displayName: row.displayName,
      role: row.role,
      clinicalRole: row.clinicalRole,
      entitlements: ents.map((e) => e.entitlement),
    });
  }
  return staffToPeople(out);
}

function mapLedgerRow(row: typeof ledgerEntries.$inferSelect): LedgerEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    accountId: row.accountId,
    patientId: row.patientId,
    locationId: row.locationId,
    kind: row.kind as LedgerEntry["kind"],
    glBucket: row.glBucket as LedgerEntry["glBucket"],
    amountCents: row.amountCents,
    currency: row.currency,
    reasonCode: row.reasonCode,
    effectiveDate: String(row.effectiveDate).slice(0, 10),
    postedAt: row.postedAt.toISOString(),
    createdById: row.createdById,
    createdByName: row.createdByName,
    procedureId: row.procedureId,
    claimId: row.claimId,
    coverageId: row.coverageId,
    reversesEntryId: row.reversesEntryId,
    approvalRequestId: row.approvalRequestId,
    tender: row.tender as LedgerEntry["tender"],
    memo: row.memo,
    idempotencyKey: row.idempotencyKey,
    insuranceExpectedCents: row.insuranceExpectedCents,
  };
}

export function makePostgresWriter(db: AppDb, tenantId: string): LedgerWriter {
  return {
    async findByIdempotencyKey(tenant, key) {
      const rows = await db
        .select()
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.tenantId, tenant), eq(ledgerEntries.idempotencyKey, key)))
        .limit(1);
      const row = rows[0];
      return row ? mapLedgerRow(row) : null;
    },
    async insertEntry(entry) {
      const postedAt = new Date(entry.postedAt);
      await db.insert(ledgerEntries).values({
        id: entry.id,
        tenantId: entry.tenantId,
        accountId: entry.accountId,
        patientId: entry.patientId,
        locationId: entry.locationId,
        kind: entry.kind,
        glBucket: entry.glBucket,
        amountCents: entry.amountCents,
        currency: entry.currency,
        reasonCode: entry.reasonCode ?? null,
        effectiveDate: entry.effectiveDate,
        postedAt,
        createdById: entry.createdById,
        createdByName: entry.createdByName,
        procedureId: entry.procedureId ?? null,
        claimId: entry.claimId ?? null,
        coverageId: entry.coverageId ?? null,
        reversesEntryId: entry.reversesEntryId ?? null,
        approvalRequestId: entry.approvalRequestId ?? null,
        tender: entry.tender ?? null,
        memo: entry.memo ?? null,
        idempotencyKey: entry.idempotencyKey,
        insuranceExpectedCents: entry.insuranceExpectedCents ?? null,
        createdAt: postedAt,
      });
      return entry;
    },
    async insertAllocations(rows) {
      if (!rows.length) return;
      const postedAt = new Date();
      await db.insert(paymentAllocations).values(
        rows.map((row) => ({
          id: row.id,
          tenantId: row.tenantId,
          paymentEntryId: row.paymentEntryId,
          chargeEntryId: row.chargeEntryId,
          amountCents: row.amountCents,
          createdAt: postedAt,
        }))
      );
    },
    async listPatientEntries(patientId) {
      const rows = await db
        .select()
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.tenantId, tenantId), eq(ledgerEntries.patientId, patientId)));
      return rows.map(mapLedgerRow);
    },
  };
}

async function assertAccountPatient(
  db: AppDb,
  tenantId: string,
  accountId: string,
  patientId: string
): Promise<{ locationId: string } | null> {
  const membership = await db.execute<{ patient_id: string }>(sql`
    SELECT am.patient_id
    FROM account_members am
    WHERE am.tenant_id = ${tenantId}
      AND am.account_id = ${accountId}
      AND am.patient_id = ${patientId}
      AND am.effective_to IS NULL
    LIMIT 1
  `);
  if (!membership.rows[0]) return null;

  const patientRows = await db
    .select({ locationId: patients.primaryLocationId })
    .from(patients)
    .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)))
    .limit(1);
  const patient = patientRows[0];
  if (!patient) return null;
  return { locationId: patient.locationId };
}

/**
 * Whether a posting at `at` falls outside the location's business hours,
 * read from the location's stored week and the server clock (Increment
 * 1.30). Null when the location is open at that moment or is unknown.
 */
export async function afterHoursFactsFor(db: AppDb, tenantId: string, locationId: string, at: Date): Promise<AfterHoursFacts | null> {
  const rows = await db
    .select({ name: locations.name, timezone: locations.timezone, hours: locations.hours })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId)))
    .limit(1);
  const site = rows[0];
  if (!site) return null;
  const clock = localClock(at, site.timezone);
  const check = isOutsideHours((site.hours ?? {}) as WeekHours, clock.weekday, clock.hhmm);
  if (!check.outside) return null;
  return { locationName: site.name, weekday: clock.weekday, date: clock.date, hhmm: clock.hhmm, window: check.window };
}

/** "Posted at 21:30 local time on Tuesday 2026-09-15; Main is open 07:00 to 19:00 that day." */
export function afterHoursLine(facts: AfterHoursFacts): string {
  const day = WEEKDAY_LABEL[facts.weekday as keyof typeof WEEKDAY_LABEL] ?? facts.weekday;
  return `Posted at ${facts.hhmm} local time on ${day} ${facts.date}; ${hoursPhrase(facts.locationName, facts.window)}.`;
}

export async function postLedgerEntry(
  db: AppDb,
  input: {
    tenantId: string;
    actorId: string;
    actorName: string;
    post: PostLedgerInput;
    /** The server's clock; injectable for tests. */
    now?: Date;
  }
): Promise<PostLedgerResult> {
  const { tenantId, actorId, actorName, post } = input;
  const now = input.now ?? new Date();
  const amountCents = normalizeAmountCents(post.kind, post.amountCents);

  if (post.kind === "charge" && !post.procedureId) {
    return {
      ok: false,
      status: "refused",
      code: "missing_procedure",
      verb: "Select a procedure",
      control: "Charge",
      why: "Charges require a procedure on the patient chart.",
    };
  }

  if (
    (post.kind === "adjustment" || post.kind === "write_off") &&
    !post.reasonCode?.trim()
  ) {
    return {
      ok: false,
      status: "refused",
      code: "missing_reason",
      verb: "Select a reason",
      control: "Reason code",
      why: "Adjustments and write-offs require a reason code.",
    };
  }

  const context = await assertAccountPatient(db, tenantId, post.accountId, post.patientId);
  if (!context) {
    return {
      ok: false,
      status: "refused",
      code: "invalid_account_patient",
      verb: "Choose a patient",
      control: "Account",
      why: "Patient is not an active member of the selected guarantor account.",
    };
  }

  const active = await loadActivePolicy(db, tenantId);
  if (!active) {
    return {
      ok: false,
      status: "refused",
      code: "no_policy",
      verb: "Cannot post",
      control: "Controls",
      why: "No control policy configured for tenant.",
    };
  }

  const people = await loadStaff(db, tenantId);
  // The after-hours hold reads the location's stored week and the server clock, never the browser.
  const afterHours = await afterHoursFactsFor(db, tenantId, context.locationId, now);
  const payload: PostEntryInput = {
    tenantId,
    accountId: post.accountId,
    patientId: post.patientId,
    locationId: context.locationId,
    kind: post.kind,
    glBucket: glBucketForKind(post.kind),
    amountCents,
    reasonCode: post.reasonCode ?? null,
    effectiveDate: post.effectiveDate,
    postedAt: now.toISOString(),
    createdById: actorId,
    createdByName: actorName,
    procedureId: post.procedureId ?? null,
    tender: post.tender ?? null,
    memo: post.memo ?? null,
    afterHours,
  };

  const writer = makePostgresWriter(db, tenantId);
  const postEntry = createPostEntry(writer);
  // The reason's own threshold tightens this channel's before the engine sees it
  // (Increment 1.46), so the service reaches the same figure the database trigger
  // will; where the two disagree the practice meets a crash instead of a hold.
  const reasonThresholdCents = await loadReasonThresholdCents(db, tenantId, payload.reasonCode ?? null);
  const channel = CHANNEL_BY_KIND[post.kind];
  const policy = channel ? tightenPolicyForReason(active.policy, channel, reasonThresholdCents) : active.policy;

  const result = await postGuarded(postEntry, {
    ...payload,
    policy,
    people,
    outsideBusinessHours: afterHours != null,
  });

  if (!result.ok && result.code === "needs_second" && result.held && result.evaluation) {
    const channel = CHANNEL_BY_KIND[payload.kind];
    if (!channel) {
      return {
        ok: false,
        status: "refused",
        code: "unsupported_channel",
        verb: "Cannot post",
        control: "Controls",
        why: `No dual-release channel mapped for kind ${payload.kind}.`,
      };
    }

    const request = await createApprovalRequest(db, {
      tenantId,
      channel,
      amountCents: Math.abs(amountCents),
      heldPayload: payload,
      evaluation: result.evaluation as ReleaseEvaluation,
      requesterId: actorId,
      requesterName: actorName,
      subjectId: post.patientId,
    });

    return {
      ok: false,
      status: "needs_second",
      approvalRequestId: request.id,
      verb: result.verb,
      control: result.control,
      // The held card says when and where, so the poster learns the rule from the refusal itself.
      why: afterHours ? `${result.why} ${afterHoursLine(afterHours)}` : result.why,
    };
  }

  const refusal = mapPostRefusal(result);
  if (refusal) return refusal;

  if (!result.ok) {
    return {
      ok: false,
      status: "refused",
      code: "unknown_refusal",
      verb: "Cannot post",
      control: "Ledger",
      why: "Posting refused.",
    };
  }

  return {
    ok: true,
    status: "posted",
    entryId: result.entry.id,
    duplicate: result.duplicate,
  };
}
