import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import {
  authThrottle,
  disclosures,
  domainEvent,
  GENESIS_HASH,
  hashDomainEvent,
  phiAccessLog,
  recoveryCeremonies,
  sessions,
  userEntitlements,
  users,
  uuidv7,
} from "@pms/db";
import type { EncryptedBlob } from "@pms/db/crypto";
import { getDb, getPool, withTenantAppendTransaction, withTenantTransaction } from "../db/client";
import { ABSOLUTE_MS, IDLE_MS } from "./ports";
import { isRole } from "./roles";
import { parseRecoveryHashes } from "./recovery";
import type { AuthStore, StoredUser } from "./store";
import type { SessionRow } from "./types";

/** Transaction-scoped advisory lock keyed on the tenant; released at COMMIT/ROLLBACK. */
export const TENANT_CHAIN_LOCK_SQL = (tenantId: string) =>
  sql`SELECT pg_advisory_xact_lock(hashtext('domain_event'), hashtext(${tenantId}))`;

interface LookupUserRow {
  id: string;
  tenant_id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: string;
  clinical_role: string;
  active: boolean;
  mfa_secret_enc: EncryptedBlob | null;
  mfa_enrolled_at: Date | null;
  recovery_codes_hash: string | null;
  password_changed_at: Date;
}

async function entitlementsFor(
  userId: string,
  tenantId: string,
  env: Record<string, string | undefined>
): Promise<string[]> {
  return withTenantTransaction(
    tenantId,
    userId,
    async (db) => {
      const rows = await db
        .select({ entitlement: userEntitlements.entitlement })
        .from(userEntitlements)
        .where(eq(userEntitlements.userId, userId));
      return rows.map((r) => r.entitlement);
    },
    env
  );
}

function mapUser(row: LookupUserRow, entitlements: string[]): StoredUser {
  if (!isRole(row.role)) throw new Error("Stored role is not a known rank.");
  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    clinicalRole: row.clinical_role,
    active: row.active,
    passwordHash: row.password_hash,
    mfaSecretEnc: row.mfa_secret_enc,
    mfaEnrolledAt: row.mfa_enrolled_at,
    recoveryCodeHashes: parseRecoveryHashes(row.recovery_codes_hash),
    passwordChangedAt: row.password_changed_at,
    entitlements,
  };
}

export function createPostgresStore(
  env: Record<string, string | undefined> = process.env
): AuthStore {
  return {
    async getUserByUsername(username) {
      const { rows } = await getPool(env).query<LookupUserRow>(
        "SELECT * FROM auth_lookup_user($1)",
        [username]
      );
      const row = rows[0];
      if (!row) return null;
      return mapUser(row, await entitlementsFor(row.id, row.tenant_id, env));
    },
    async getUserById(id) {
      const { rows } = await getPool(env).query<LookupUserRow>(
        "SELECT * FROM auth_lookup_user_by_id($1)",
        [id]
      );
      const row = rows[0];
      if (!row) return null;
      return mapUser(row, await entitlementsFor(row.id, row.tenant_id, env));
    },
    async getSession(id) {
      const { rows } = await getPool(env).query<{
        id: string;
        tenant_id: string;
        user_id: string;
        revoked_at: Date | null;
        idle_expires_at: Date;
        absolute_expires_at: Date;
        last_seen_at: Date;
        device_profile: "desk" | "operatory";
      }>("SELECT * FROM auth_lookup_session($1)", [id]);
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        revokedAt: row.revoked_at,
        idleExpiresAt: row.idle_expires_at,
        absoluteExpiresAt: row.absolute_expires_at,
        lastSeenAt: row.last_seen_at,
        deviceProfile: row.device_profile === "operatory" ? "operatory" : "desk",
      };
    },
    async createSession(input) {
      const idle = IDLE_MS[input.deviceProfile];
      const session: SessionRow = {
        id: uuidv7(input.now.getTime()),
        tenantId: input.tenantId,
        userId: input.userId,
        revokedAt: null,
        idleExpiresAt: new Date(input.now.getTime() + idle),
        absoluteExpiresAt: new Date(input.now.getTime() + ABSOLUTE_MS),
        lastSeenAt: input.now,
        deviceProfile: input.deviceProfile,
      };
      await withTenantTransaction(input.tenantId, input.userId, async (db) => {
        await db.insert(sessions).values({
          id: session.id,
          tenantId: session.tenantId,
          userId: session.userId,
          createdAt: input.now,
          lastSeenAt: session.lastSeenAt,
          absoluteExpiresAt: session.absoluteExpiresAt,
          idleExpiresAt: session.idleExpiresAt,
          deviceProfile: session.deviceProfile,
          userAgent: input.userAgent,
        });
      }, env);
      return session;
    },
    async touchSession(id, lastSeenAt, idleExpiresAt) {
      const session = await this.getSession(id);
      if (!session) return;
      await withTenantTransaction(session.tenantId, session.userId, async (db) => {
        await db
          .update(sessions)
          .set({ lastSeenAt, idleExpiresAt })
          .where(eq(sessions.id, id));
      }, env);
    },
    async revokeSessionsForUser(userId, at) {
      const user = await this.getUserById(userId);
      if (!user) return 0;
      return withTenantTransaction(user.tenantId, userId, async (db) => {
        const updated = await db
          .update(sessions)
          .set({ revokedAt: at })
          .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
          .returning({ id: sessions.id });
        return updated.length;
      }, env);
    },
    async deactivateUser(userId, at) {
      const user = await this.getUserById(userId);
      if (!user) return;
      await withTenantTransaction(user.tenantId, userId, async (db) => {
        await db.update(users).set({ active: false }).where(eq(users.id, userId));
        await db
          .update(sessions)
          .set({ revokedAt: at })
          .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
      }, env);
    },
    async replaceRecoveryHashes(userId, hashes) {
      const user = await this.getUserById(userId);
      if (!user) return;
      await withTenantTransaction(user.tenantId, userId, async (db) => {
        await db
          .update(users)
          .set({ recoveryCodesHash: JSON.stringify(hashes) })
          .where(eq(users.id, userId));
      }, env);
    },
    async setMfaPendingSecret(userId, secretEnc) {
      const user = await this.getUserById(userId);
      if (!user) return;
      await withTenantTransaction(user.tenantId, userId, async (db) => {
        await db.update(users).set({ mfaSecretEnc: secretEnc }).where(eq(users.id, userId));
      }, env);
    },
    async completeMfaEnrollment(userId, input) {
      const user = await this.getUserById(userId);
      if (!user) return;
      await withTenantTransaction(user.tenantId, userId, async (db) => {
        await db
          .update(users)
          .set({
            mfaSecretEnc: input.secretEnc,
            mfaEnrolledAt: input.enrolledAt,
            recoveryCodesHash: JSON.stringify(input.recoveryHashes),
          })
          .where(eq(users.id, userId));
      }, env);
    },
    async logPhiAccess(input) {
      await withTenantAppendTransaction(input.tenantId, input.userId, async (db) => {
        await db.insert(phiAccessLog).values({
          id: uuidv7(input.at.getTime()),
          tenantId: input.tenantId,
          userId: input.userId,
          purpose: input.purpose,
          recordKind: input.recordKind,
          recordIds: input.recordIds,
          at: input.at,
        });
      }, env);
    },
    async appendDomainEvent(input) {
      await withTenantAppendTransaction(input.tenantId, input.actorUserId ?? input.tenantId, async (db) => {
        // Serialize appends per tenant for the rest of this transaction so two
        // writers cannot read the same last row. UNIQUE (tenant_id, seq) stays
        // as the backstop that turns any remaining race into a failed insert
        // rather than a silent fork.
        await db.execute(TENANT_CHAIN_LOCK_SQL(input.tenantId));
        const [last] = await db
          .select({ hash: domainEvent.hash, seq: domainEvent.seq })
          .from(domainEvent)
          .where(eq(domainEvent.tenantId, input.tenantId))
          .orderBy(sql`${domainEvent.seq} desc`)
          .limit(1);
        const prevHash = last?.hash ?? GENESIS_HASH;
        const seq = (last?.seq ?? 0) + 1;
        const occurredAt = input.at;
        const hash = hashDomainEvent({
          prevHash,
          tenantId: input.tenantId,
          kind: input.kind,
          payload: input.payload,
          occurredAt: occurredAt.toISOString(),
        });
        await db.insert(domainEvent).values({
          id: uuidv7(input.at.getTime()),
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          kind: input.kind,
          payload: input.payload as Record<string, unknown>,
          prevHash,
          hash,
          occurredAt,
          seq,
        });
      }, env);
    },
    async getThrottle(key) {
      const db = getDb(env);
      const [row] = await db.select().from(authThrottle).where(eq(authThrottle.key, key)).limit(1);
      if (!row) return null;
      return {
        key: row.key,
        tenantId: row.tenantId,
        failCount: row.failCount,
        firstFailAt: row.firstFailAt,
        lockedUntil: row.lockedUntil,
      };
    },
    async putThrottle(row) {
      const db = getDb(env);
      await db
        .insert(authThrottle)
        .values({
          key: row.key,
          tenantId: row.tenantId,
          failCount: row.failCount,
          firstFailAt: row.firstFailAt,
          lockedUntil: row.lockedUntil,
        })
        .onConflictDoUpdate({
          target: authThrottle.key,
          set: {
            failCount: row.failCount,
            firstFailAt: row.firstFailAt,
            lockedUntil: row.lockedUntil,
            tenantId: row.tenantId,
          },
        });
      return row;
    },
    async applyLock(key, lockedUntil, now) {
      const db = getDb(env);
      const applied = await db
        .update(authThrottle)
        .set({ lockedUntil })
        .where(
          and(
            eq(authThrottle.key, key),
            or(isNull(authThrottle.lockedUntil), lt(authThrottle.lockedUntil, now))
          )
        )
        .returning();
      const row = applied[0];
      if (!row) return null;
      return {
        key: row.key,
        tenantId: row.tenantId,
        failCount: row.failCount,
        firstFailAt: row.firstFailAt,
        lockedUntil: row.lockedUntil,
      };
    },
    async deleteThrottle(key) {
      const db = getDb(env);
      await db.delete(authThrottle).where(eq(authThrottle.key, key));
    },
    async pruneThrottle(now) {
      const db = getDb(env);
      const windowStart = new Date(now.getTime() - 15 * 60 * 1000);
      await db
        .delete(authThrottle)
        .where(
          and(
            lt(authThrottle.firstFailAt, windowStart),
            or(isNull(authThrottle.lockedUntil), lt(authThrottle.lockedUntil, now))
          )
        );
    },
    async recordDisclosure(input) {
      const id = uuidv7(input.at.getTime());
      await withTenantAppendTransaction(input.tenantId, input.actorUserId, async (db) => {
        await db.insert(disclosures).values({
          id,
          tenantId: input.tenantId,
          patientId: input.patientId,
          at: input.at,
          channel: input.channel,
          recipient: input.recipient,
          recordIds: input.recordIds,
          purpose: input.purpose,
          actorUserId: input.actorUserId,
          actorName: input.actorName,
          documentId: input.documentId,
        });
      }, env);
      return id;
    },
    async createRecoveryCeremony(input) {
      const id = uuidv7(input.initiatedAt.getTime());
      await withTenantTransaction(input.tenantId, input.initiatedBy, async (db) => {
        await db.insert(recoveryCeremonies).values({
          id,
          tenantId: input.tenantId,
          targetUserId: input.targetUserId,
          initiatedBy: input.initiatedBy,
          initiatedAt: input.initiatedAt,
          expiresAt: input.expiresAt,
        });
      }, env);
      return id;
    },
    async getRecoveryCeremony(id) {
      const pool = getPool(env);
      const { rows } = await pool.query(
        `SELECT id, tenant_id, target_user_id, initiated_by, approved_by,
                initiated_at, approved_at, expires_at, consumed_at, reset_token_hash
           FROM auth_lookup_recovery_ceremony($1::uuid)`,
        [id]
      );
      return rows[0] ? mapCeremonyRow(rows[0]) : null;
    },
    async getRecoveryCeremonyByTokenHash(resetToken) {
      const dot = resetToken.indexOf(".");
      if (dot <= 0) return null;
      const ceremonyId = resetToken.slice(0, dot);
      const pool = getPool(env);
      const { rows } = await pool.query(
        `SELECT id, tenant_id, target_user_id, initiated_by, approved_by,
                initiated_at, approved_at, expires_at, consumed_at, reset_token_hash
           FROM auth_lookup_recovery_ceremony($1::uuid)`,
        [ceremonyId]
      );
      const row = rows[0];
      if (!row) return null;
      const mapped = mapCeremonyRow(row);
      const { createHash } = await import("node:crypto");
      const digest = createHash("sha256").update(resetToken).digest("hex");
      if (mapped.resetTokenHash !== digest) return null;
      return mapped;
    },
    async approveRecoveryCeremony(input) {
      const ceremony = await this.getRecoveryCeremony(input.id);
      if (!ceremony) return;
      await withTenantTransaction(ceremony.tenantId, input.approvedBy, async (db) => {
        await db
          .update(recoveryCeremonies)
          .set({
            approvedBy: input.approvedBy,
            approvedAt: input.approvedAt,
            resetTokenHash: input.resetTokenHash,
          })
          .where(eq(recoveryCeremonies.id, input.id));
      }, env);
    },
    async consumeRecoveryCeremony(id, consumedAt) {
      const ceremony = await this.getRecoveryCeremony(id);
      if (!ceremony) return;
      await withTenantTransaction(ceremony.tenantId, ceremony.targetUserId, async (db) => {
        await db
          .update(recoveryCeremonies)
          .set({ consumedAt })
          .where(eq(recoveryCeremonies.id, id));
      }, env);
    },
    async setPassword(userId, passwordHash, passwordChangedAt) {
      const user = await this.getUserById(userId);
      if (!user) return;
      await withTenantTransaction(user.tenantId, userId, async (db) => {
        await db
          .update(users)
          .set({ passwordHash, passwordChangedAt })
          .where(eq(users.id, userId));
      }, env);
    },
    async setTenantContext() {
      // Tenant binding is applied inside withTenantTransaction on each write.
    },
  };
}

function mapCeremonyRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    targetUserId: String(row.target_user_id),
    initiatedBy: String(row.initiated_by),
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    initiatedAt: new Date(String(row.initiated_at)),
    approvedAt: row.approved_at ? new Date(String(row.approved_at)) : null,
    expiresAt: new Date(String(row.expires_at)),
    consumedAt: row.consumed_at ? new Date(String(row.consumed_at)) : null,
    resetTokenHash: row.reset_token_hash ? String(row.reset_token_hash) : null,
  };
}
