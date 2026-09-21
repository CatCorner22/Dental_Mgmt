import { and, eq, gt, isNull } from "drizzle-orm";
import { recoveryCeremonies, users } from "@pms/db";
import type { AppDb } from "../db/client";
import { meetsRole, type Role } from "./roles";

/**
 * Who can be brought back in, and who may do it (Increment 1.77).
 *
 * The reading half of the two-administrator recovery ceremony. The acts live
 * in `recoveryCeremony.ts` and take a store; this reads the practice's own
 * rows, so the panel can say what is true of this practice rather than
 * offering a form and discovering the answer on submit.
 *
 * ## Why two administrators, with no way out
 *
 * Increment 1.75 met the same shape — a control needing two people in a
 * product that gives a practice no way to have two — and answered it with a
 * governed exception: the practice records a dated, reviewed decision and the
 * control runs single-person.
 *
 * That answer is wrong here, and the difference is worth stating. The GL
 * mapping control protects a figure; standing down on it lets one person map
 * an account alone, and the month-end package reports that they did. This one
 * protects *every account in the practice*. One administrator who can clear
 * somebody's second factor and set their password can enter that person's
 * account — which means posting as them, approving as them, and defeating
 * every maker-checker rule this product has by being both halves of it. A
 * recorded decision would license exactly that, so this product does not offer
 * one.
 *
 * Nor does a weaker rule work. "One administrator may bring back somebody who
 * ranks below them" sounds safe on the reasoning that an administrator already
 * holds power over that account — but they do not. Today the only route an
 * administrator has against another account revokes its sessions
 * (`api/admin/revoke-all-sessions`); nothing deactivates a user, nothing sets
 * another person's password, and nothing writes `users.role`. Entering a
 * clinician's account would be a new power, not an existing one.
 *
 * So a practice with one administrator cannot do this, and the honest thing is
 * to say so and name what would change it. User administration — the root
 * cause Increment 1.75 also named — now blocks two controls rather than one.
 */

/** A practice member, as this module reads one. */
export type MemberRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  active: boolean;
  mfaSecretEnc: unknown;
  mfaEnrolledAt: Date | null;
  recoveryCodesHash: string | null;
};

/** One person the practice could bring back in. */
export type RegainCandidate = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  /** Whether a second factor stands on the account at all. */
  enrolled: boolean;
  /** Recovery codes still unspent. Zero and no phone is the lockout. */
  codesLeft: number;
};

/** A ceremony somebody started and nobody has approved. */
export type OpenCeremony = {
  id: string;
  targetName: string;
  initiatedByName: string;
  initiatedAt: string;
  expiresAt: string;
  /** This viewer started it, so this viewer may not be the second pair of hands. */
  mine: boolean;
};

/**
 * An administrator who could take one of the two parts: active, ranked
 * `admin`, and carrying a factor they can actually prove. An administrator
 * whose own phone is gone counts for nothing here — `totpOk` in
 * `recoveryCeremony.ts` refuses them, so counting them would promise a second
 * pair of hands that refuses on submit.
 */
export function isEligibleAdmin(row: MemberRow): boolean {
  return row.active && meetsRole(row.role as Role, "admin") && row.mfaSecretEnc != null && row.mfaEnrolledAt != null;
}

export function eligibleAdmins(rows: MemberRow[]): number {
  return rows.filter(isEligibleAdmin).length;
}

function codesLeft(row: MemberRow): number {
  if (!row.recoveryCodesHash) return 0;
  try {
    const parsed: unknown = JSON.parse(row.recoveryCodesHash);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Everybody this viewer could start a recovery for: every active member of the
 * practice except the viewer, whom `initiateRecoveryCeremony` refuses as
 * `same_admin`. Offering yourself would be a row whose only outcome is a
 * refusal.
 */
export function regainCandidates(rows: MemberRow[], viewerId: string): RegainCandidate[] {
  return rows
    .filter((row) => row.active && row.id !== viewerId)
    .map((row) => ({
      userId: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      enrolled: row.mfaSecretEnc != null && row.mfaEnrolledAt != null,
      codesLeft: codesLeft(row),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Why this practice cannot run the ceremony, or null when it can. The
 * sentences say the rule, the practice's own number, and the one thing that
 * would change it — the shape every refusal in this product has held since
 * Increment 1.48.
 */
export function regainRefusal(eligible: number): string[] | null {
  if (eligible >= 2) return null;
  return [
    "Bringing somebody back in takes two administrators, each proving their own second factor: one starts it and a different one approves it.",
    eligible === 1
      ? "This practice has one administrator who could take a part, and the same person cannot take both."
      : "This practice has no administrator who could take a part — an administrator whose own second factor is gone cannot approve anything.",
    "This control has no recorded exception, and will not get one: an administrator who could clear another person's second factor alone could enter that account, post as them and approve as them, which is the whole of what maker-checker prevents. Appoint a second administrator instead.",
  ];
}

/** The sentence the panel shows when the practice can run it. */
export function regainStanding(eligible: number, open: number): string {
  const admins = `${eligible} administrators can take a part in this.`;
  if (open === 0) return `${admins} Nothing is waiting for a second pair of hands.`;
  return open === 1
    ? `${admins} One recovery is waiting for a second pair of hands.`
    : `${admins} ${open} recoveries are waiting for a second pair of hands.`;
}

/** The practice's people, with the columns this module reads. */
export async function loadMembers(db: AppDb, tenantId: string): Promise<MemberRow[]> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      active: users.active,
      mfaSecretEnc: users.mfaSecretEnc,
      mfaEnrolledAt: users.mfaEnrolledAt,
      recoveryCodesHash: users.recoveryCodesHash,
    })
    .from(users)
    .where(eq(users.tenantId, tenantId));
  return rows;
}

/**
 * Ceremonies this practice started, not yet approved, not yet consumed, and
 * not yet expired. An expired one is not shown, because a row a person cannot
 * act on is a signal that never clears.
 */
export async function openCeremonies(
  db: AppDb,
  tenantId: string,
  viewerId: string,
  now: Date
): Promise<OpenCeremony[]> {
  const rows = await db
    .select()
    .from(recoveryCeremonies)
    .where(
      and(
        eq(recoveryCeremonies.tenantId, tenantId),
        isNull(recoveryCeremonies.approvedBy),
        isNull(recoveryCeremonies.consumedAt),
        gt(recoveryCeremonies.expiresAt, now)
      )
    );
  const members = await loadMembers(db, tenantId);
  const nameOf = new Map(members.map((m) => [m.id, m.displayName]));
  return rows
    .map((row) => ({
      id: row.id,
      targetName: nameOf.get(row.targetUserId) ?? "somebody no longer on this practice",
      initiatedByName: nameOf.get(row.initiatedBy) ?? "somebody no longer on this practice",
      initiatedAt: row.initiatedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      mine: row.initiatedBy === viewerId,
    }))
    .sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt));
}
