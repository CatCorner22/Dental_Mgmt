import { and, desc, eq, sql } from "drizzle-orm";
import { domainEvent, users } from "@pms/db";
import type { AppDb } from "../db/client";

/** The chain kind `revokeAllSessionsForTenant` writes. */
export const REVOKE_ALL_KIND = "auth.sessions_revoked_all";

/**
 * How many of the practice's sign-out-everybody acts the screen reads back.
 *
 * Five, because this act belongs to an incident and an incident is read in
 * one sitting: the practice wants the one that just happened and enough
 * before it to tell whether this is the first time. A full history belongs to
 * the chain, which keeps every one of them and is the record a verifier reads.
 */
export const REVOKE_HISTORY_LIMIT = 5;

export type RevokeAllRecord = {
  /** ISO timestamp the act was recorded. */
  at: string;
  /** The administrator who pressed, by display name; null once their seat is gone. */
  byName: string | null;
  /** How many live sign-ins the act ended. */
  revoked: number;
  /** What that administrator typed. */
  reason: string;
};

/**
 * The practice's recent sign-out-everybody acts, read back (Increment 1.102).
 *
 * Increment 1.90 made the reason typed rather than hardcoded and told the
 * person pressing that it "is what the practice reads afterwards" — and then
 * nothing read it. The reason reached the chain and stopped there: the only
 * thing in the repository that ever selected it was a browser test going
 * round the product to Postgres.
 *
 * The join to `users` is a left join on purpose. An administrator can leave
 * the practice, and the act they took does not leave with them; a row with no
 * name still carries when, how many, and why, which is the part an incident
 * is read for.
 */
export async function listRevokeAllHistory(db: AppDb, tenantId: string): Promise<RevokeAllRecord[]> {
  const rows = await db
    .select({
      at: domainEvent.occurredAt,
      byName: users.displayName,
      reason: sql<string | null>`${domainEvent.payload}->>'reason'`,
      revoked: sql<number>`coalesce((${domainEvent.payload}->>'revoked')::int, 0)`,
    })
    .from(domainEvent)
    .leftJoin(users, eq(users.id, domainEvent.actorUserId))
    .where(and(eq(domainEvent.tenantId, tenantId), eq(domainEvent.kind, REVOKE_ALL_KIND)))
    .orderBy(desc(domainEvent.seq))
    .limit(REVOKE_HISTORY_LIMIT);
  return rows.map((r) => ({
    at: r.at.toISOString(),
    byName: r.byName ?? null,
    revoked: Number(r.revoked),
    /**
     * A reason of `null` is a row the route wrote before Increment 1.90 typed
     * it — the hardcoded `admin_revoke_all` carried no reason at all. It reads
     * as what it is rather than as an empty string, which would read as
     * somebody having typed nothing.
     */
    reason: r.reason ?? "",
  }));
}
