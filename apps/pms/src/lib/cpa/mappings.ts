import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import type { ControlDecision } from "@pms/controls-engine";
import { glMappings, users, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { listDecisions } from "../controls/decisions";
import { soleDeciderRefusal, soleDeciderStanding } from "./soleDecider";
import { ANY_REASON, GL_BUCKETS, GL_KINDS, GL_SIDES, mappingKey, type GlMapping, type GlSide, type MappingStatus } from "./types";

export { ANY_REASON, GL_BUCKETS, GL_KINDS, GL_SIDES, mappingKey };
export type { GlMapping, GlSide, MappingStatus } from "./types";

/**
 * The tenant's chart-of-accounts mapping under maker-checker (docs/13 item
 * 22, Increment 1.35): which account a journal line belongs to, keyed by the
 * ledger bucket, the posting kind, and the reason code. One person proposes;
 * a different person approves or rejects. The table is append-only but for
 * that one decision, so a change is a new proposal and the history of who
 * mapped what, and who agreed, stays readable.
 */

function mapRow(row: typeof glMappings.$inferSelect): GlMapping {
  return {
    id: row.id,
    glBucket: row.glBucket,
    kind: row.kind,
    reasonCode: row.reasonCode,
    accountCode: row.accountCode,
    accountName: row.accountName,
    side: row.side as GlSide,
    note: row.note,
    status: row.status as MappingStatus,
    proposedById: row.proposedById,
    proposedByName: row.proposedByName,
    proposedAt: row.proposedAt.toISOString(),
    decidedById: row.decidedById,
    decidedByName: row.decidedByName,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    supersedesId: row.supersedesId,
  };
}

/** Every mapping row of the practice: proposals first, then the decided history. */
export async function listMappings(db: AppDb, tenantId: string): Promise<GlMapping[]> {
  const rows = await db
    .select()
    .from(glMappings)
    .where(eq(glMappings.tenantId, tenantId))
    .orderBy(asc(glMappings.glBucket), asc(glMappings.kind), asc(glMappings.reasonCode), desc(glMappings.proposedAt));
  return rows.map(mapRow);
}

/** The approved mappings in force: the newest decision per key. */
export async function activeMappings(db: AppDb, tenantId: string): Promise<Map<string, GlMapping>> {
  const rows = await db
    .select()
    .from(glMappings)
    .where(and(eq(glMappings.tenantId, tenantId), eq(glMappings.status, "approved")))
    .orderBy(asc(glMappings.decidedAt));
  const out = new Map<string, GlMapping>();
  for (const row of rows) {
    const m = mapRow(row);
    out.set(mappingKey(m.glBucket, m.kind, m.reasonCode), m);
  }
  return out;
}

/**
 * The account for a journal line: the mapping for its exact reason code, or
 * the one covering every reason code on that bucket and kind, or none.
 */
export function resolveMapping(active: Map<string, GlMapping>, glBucket: string, kind: string, reasonCode: string | null): GlMapping | null {
  if (reasonCode) {
    const exact = active.get(mappingKey(glBucket, kind, reasonCode));
    if (exact) return exact;
  }
  return active.get(mappingKey(glBucket, kind, ANY_REASON)) ?? null;
}

export type MappingResult =
  | { ok: true; mapping: GlMapping }
  | { ok: false; status: 400 | 403 | 404 | 409; errors: string[] };

export type ProposeInput = {
  tenantId: string;
  actor: { id: string; name: string };
  glBucket: string;
  kind: string;
  reasonCode?: string;
  accountCode: string;
  accountName: string;
  side: string;
  note?: string;
  now?: Date;
};

/**
 * Proposes a mapping. Refuses an unknown bucket, kind, or side, an empty
 * account, and a second proposal on a key that already has one pending. A
 * proposal on a key that already has an approved mapping supersedes it once
 * approved; until then the old one stands.
 */
export async function proposeMapping(db: AppDb, input: ProposeInput): Promise<MappingResult> {
  const now = input.now ?? new Date();
  const reasonCode = input.reasonCode?.trim() || ANY_REASON;
  const errors: string[] = [];
  if (!(GL_BUCKETS as readonly string[]).includes(input.glBucket)) errors.push(`The ledger bucket must be one of: ${GL_BUCKETS.join(", ")}.`);
  if (!(GL_KINDS as readonly string[]).includes(input.kind)) errors.push(`The posting kind must be one of: ${GL_KINDS.join(", ")}.`);
  if (!(GL_SIDES as readonly string[]).includes(input.side)) errors.push("The side must be debit or credit.");
  if (!input.accountCode?.trim()) errors.push("The mapping needs an account code.");
  if (!input.accountName?.trim()) errors.push("The mapping needs an account name.");
  if (errors.length) return { ok: false, status: 400, errors };

  const pending = await db
    .select({ id: glMappings.id, proposedByName: glMappings.proposedByName })
    .from(glMappings)
    .where(
      and(
        eq(glMappings.tenantId, input.tenantId),
        eq(glMappings.glBucket, input.glBucket),
        eq(glMappings.kind, input.kind),
        eq(glMappings.reasonCode, reasonCode),
        eq(glMappings.status, "proposed")
      )
    );
  if (pending.length) {
    return { ok: false, status: 409, errors: [`${pending[0]!.proposedByName} has already proposed a mapping for this line; that proposal needs a decision first.`] };
  }

  const current = (await activeMappings(db, input.tenantId)).get(mappingKey(input.glBucket, input.kind, reasonCode));
  const id = uuidv7(now.getTime());
  await db.insert(glMappings).values({
    id,
    tenantId: input.tenantId,
    glBucket: input.glBucket,
    kind: input.kind,
    reasonCode,
    accountCode: input.accountCode.trim(),
    accountName: input.accountName.trim(),
    side: input.side,
    note: input.note?.trim() ?? "",
    status: "proposed",
    proposedById: input.actor.id,
    proposedByName: input.actor.name,
    proposedAt: now,
    supersedesId: current?.id ?? null,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "gl_mapping.proposed",
    { mappingId: id, glBucket: input.glBucket, kind: input.kind, reasonCode, accountCode: input.accountCode.trim(), side: input.side, supersedesId: current?.id ?? null },
    now
  );
  const rows = await db.select().from(glMappings).where(eq(glMappings.id, id));
  return { ok: true, mapping: mapRow(rows[0]!) };
}

/**
 * Approves or rejects a proposal. The proposer may not decide their own
 * (maker-checker); a decided proposal cannot be decided twice. The decision
 * is the one update the table permits, and it is a chain event too.
 */
export async function decideMapping(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; mappingId: string; decision: "approved" | "rejected"; now?: Date }
): Promise<MappingResult> {
  const now = input.now ?? new Date();
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return { ok: false, status: 400, errors: ["The decision must be approved or rejected."] };
  }
  const rows = await db
    .select()
    .from(glMappings)
    .where(and(eq(glMappings.tenantId, input.tenantId), eq(glMappings.id, input.mappingId)));
  const row = rows[0];
  if (!row) return { ok: false, status: 404, errors: ["The mapping proposal was not found."] };
  if (row.status !== "proposed") {
    return { ok: false, status: 409, errors: [`This proposal was already ${row.status} by ${row.decidedByName ?? "someone"}.`] };
  }
  let licensedBy: ControlDecision | null = null;
  if (row.proposedById === input.actor.id) {
    // A practice with one administrator can propose a mapping nobody may
    // decide, and then close no month ever (Increment 1.75). The control
    // stands down only while a decision says so — read from the register, so
    // nothing here can disagree with the rows a reader would check.
    const standing = soleDeciderStanding(await listDecisions(db, input.tenantId), now.toISOString().slice(0, 10));
    if (standing.standing === "none") {
      return { ok: false, status: 403, errors: soleDeciderRefusal(await otherDeciders(db, input.tenantId, input.actor.id)) };
    }
    licensedBy = standing.decision;
  }

  await db
    .update(glMappings)
    .set({ status: input.decision, decidedById: input.actor.id, decidedByName: input.actor.name, decidedAt: now })
    .where(and(eq(glMappings.tenantId, input.tenantId), eq(glMappings.id, input.mappingId)));
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "gl_mapping.decided",
    {
      mappingId: row.id,
      decision: input.decision,
      glBucket: row.glBucket,
      kind: row.kind,
      reasonCode: row.reasonCode,
      accountCode: row.accountCode,
      proposedById: row.proposedById,
      // Whether one pair of hands did both, and what licensed it. Neither is
      // stored on the mapping: the row already carries both ids, so "decided
      // alone" is `decidedById === proposedById` wherever anybody reads it,
      // and a column repeating that could only ever disagree with it.
      decidedAlone: row.proposedById === input.actor.id,
      licensedBy: licensedBy?.id ?? null,
    },
    now
  );
  const after = await db.select().from(glMappings).where(eq(glMappings.id, input.mappingId));
  return { ok: true, mapping: mapRow(after[0]!) };
}

/**
 * How many other people could decide this proposal: active administrators of
 * this practice who are not the caller (Increment 1.75).
 *
 * The refusal counts them rather than asserting that somebody exists, because
 * the sentence it replaces named an act the reader might have no way to ask
 * anybody to perform. Rank is read here the way `withGuard` reads it, so the
 * count cannot promise a person the decide route would then turn away.
 */
async function otherDeciders(db: AppDb, tenantId: string, actorId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.active, true), eq(users.role, "admin"), ne(users.id, actorId)));
  return rows[0]?.n ?? 0;
}

/** Proposals waiting for a second person. */
export async function pendingMappings(db: AppDb, tenantId: string): Promise<GlMapping[]> {
  const rows = await db
    .select()
    .from(glMappings)
    .where(and(eq(glMappings.tenantId, tenantId), eq(glMappings.status, "proposed")))
    .orderBy(asc(glMappings.proposedAt));
  return rows.map(mapRow);
}
