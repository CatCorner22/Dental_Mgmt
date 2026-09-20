import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  seatInvitationClaims,
  seatInvitations,
  tenants,
  userEntitlements,
  users,
  uuidv7,
} from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { CPA_SEAT_ENTITLEMENT } from "./seats";
import { hashPassword, passwordPolicyError } from "./password";
import { INVITE_LIFE_MS, usernameProblem } from "./inviteLink";

/**
 * The practice invites the seat it cannot otherwise create (Increment 1.71).
 *
 * The question was asked as "an address for somebody who is not a user",
 * because a firm's shared mailbox is not a person and `notice_addresses`
 * points at one. The answer is no, and the foreign key is not the reason.
 *
 * A destination with no person behind it would be a **second kind of
 * recipient** standing beside the seat: it would need its own proof that the
 * mailbox consents (Increment 1.61), its own way for a stranger to refuse
 * (1.67), and its own place in both readings of who the practice can reach
 * (1.69, 1.70). That is four second answers to questions the seat already
 * answers, and two notions of "recipient" would eventually disagree about who
 * was told what.
 *
 * What a shared mailbox wants is to **be** the recipient, and this product's
 * word for a recipient is a seat. Nothing stopped `accounting@firm.example`
 * holding the outside accountant's seat — except that the practice had no way
 * to create one. `users` was written by the seed and by nothing else, so
 * Increment 1.70's card could name an accountant who never said where, and a
 * practice without an accountant could not get one.
 *
 * **The practice names the seat; the person supplies the secret.** That is
 * Increment 1.58's rule read the other way round, and it is the same rule. An
 * address is set by the person it belongs to; so is a password. The row this
 * creates carries a hash of bytes nobody kept, so the account exists and no
 * password opens it until its holder chooses one.
 *
 * **Only the outside accountant's seat, and only by the owner.** The seat is
 * the one this product can add without asking anything of its rulebook: 1.49
 * settled that it pairs with no duty in the SoD matrix, so inviting it creates
 * no conflict, and it reaches the month-end package and no other screen. A
 * general "invite anybody to any role" would be a grant path that bypasses
 * `evaluateGrant`, which is the check every other new duty goes through.
 */

/** 32 bytes of system randomness, base64url, 43 characters — the same size as a stop secret. */
export function mintInvite(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvite(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export type InviteRefusal = {
  ok: false;
  status: 400 | 404 | 409;
  code: "malformed" | "taken" | "unknown" | "expired" | "claimed" | "weak";
  why: string;
};

export type InvitedSeat = {
  invitationId: string;
  userId: string;
  username: string;
  displayName: string;
  /** Handed to the practice once, so it can pass the link on. Never stored. */
  secret: string;
  invitedAt: string;
  expiresAt: string;
};

export type InviteResult = { ok: true; seat: InvitedSeat } | InviteRefusal;

/**
 * Creates the outside accountant's seat and the one secret that opens it.
 *
 * Everything here happens in the caller's transaction, so a practice never
 * ends up with a seat nobody can claim or an invitation naming no seat.
 *
 * The chain event names the seat and who invited it, and never an address:
 * there is no address yet, and by Increment 1.58's rule there would be nothing
 * to say about one if there were.
 */
export async function inviteAccountant(
  db: AppDb,
  tenantId: string,
  actor: { id: string; name: string },
  seat: { username: string; displayName: string },
  at: Date = new Date()
): Promise<InviteResult> {
  const username = seat.username.trim();
  const displayName = seat.displayName.trim();
  const badUsername = usernameProblem(username);
  if (badUsername !== null) {
    return { ok: false, status: 400, code: "malformed", why: badUsername };
  }
  if (displayName.length < 2 || displayName.length > 120) {
    return {
      ok: false,
      status: 400,
      code: "malformed",
      why: "A display name is 2 to 120 characters. It is what the practice's own screens will call this seat.",
    };
  }

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.username, username)))
    .limit(1);
  if (taken.length > 0) {
    return {
      ok: false,
      status: 409,
      code: "taken",
      why: `This practice already has somebody signing in as ${username}. Choose another username.`,
    };
  }

  const userId = uuidv7();
  // A hash of bytes nobody kept. The account exists and no password opens it
  // until its holder sets one, which is what makes "the practice never learns
  // the secret" a property of the rows rather than a promise about the code.
  const unopenable = await hashPassword(randomBytes(32).toString("base64url"));
  await db.insert(users).values({
    id: userId,
    tenantId,
    username,
    displayName,
    passwordHash: unopenable,
    // The lowest rank the product has, which is what makes the seat a seat
    // rather than a member of the practice holding a reporting grant (1.49).
    role: "readonly",
    clinicalRole: "unset",
    active: true,
    passwordChangedAt: at,
    createdAt: at,
  });
  await db.insert(userEntitlements).values({
    id: uuidv7(),
    tenantId,
    userId,
    entitlement: CPA_SEAT_ENTITLEMENT,
    grantedBy: actor.id,
    effectiveFrom: at,
    effectiveTo: null,
    reason: "The outside accountant's seat, invited by the practice.",
  });

  const secret = mintInvite();
  const invitationId = uuidv7();
  const expiresAt = new Date(at.getTime() + INVITE_LIFE_MS);
  await db.insert(seatInvitations).values({
    id: invitationId,
    tenantId,
    userId,
    tokenHash: hashInvite(secret),
    invitedBy: actor.id,
    invitedAt: at,
    expiresAt,
  });
  await appendControlEvent(
    db,
    tenantId,
    actor.id,
    "seat.invited",
    { seat: "accountant", user: userId, username, by: actor.name },
    at
  );

  return {
    ok: true,
    seat: {
      invitationId,
      userId,
      username,
      displayName,
      secret,
      invitedAt: at.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
}

export type InviteTarget = {
  invitationId: string;
  userId: string;
  practiceName: string;
  username: string;
  displayName: string;
  expiresAt: string;
};

export type InviteLookup = { ok: true; target: InviteTarget } | InviteRefusal;

/**
 * What an invitation link points at, or why it points at nothing.
 *
 * A secret naming no row and a secret belonging to another practice are
 * answered in the same words, for Increment 1.67's reason: they are one fact
 * from the reader's side, and telling them apart would make the page an oracle
 * for which practice a secret belongs to.
 */
export async function lookUpInvite(
  db: AppDb,
  tenantId: string,
  secret: string,
  at: Date = new Date()
): Promise<InviteLookup> {
  const rows = await db
    .select({
      invitationId: seatInvitations.id,
      userId: seatInvitations.userId,
      expiresAt: seatInvitations.expiresAt,
      username: users.username,
      displayName: users.displayName,
      active: users.active,
    })
    .from(seatInvitations)
    .innerJoin(users, eq(users.id, seatInvitations.userId))
    .where(and(eq(seatInvitations.tenantId, tenantId), eq(seatInvitations.tokenHash, hashInvite(secret))))
    .limit(1);
  const row = rows[0];
  const unknown: InviteRefusal = {
    ok: false,
    status: 404,
    code: "unknown",
    why: "This link is not one we recognise. It may have been copied incompletely, or it may never have been ours.",
  };
  // A seat somebody has since deactivated is answered as unknown rather than
  // as a seat that cannot be claimed: the practice withdrew it, and saying so
  // would tell a holder of the link something about a person.
  if (!row || !row.active) return unknown;

  const claimed = await db
    .select({ id: seatInvitationClaims.id })
    .from(seatInvitationClaims)
    .where(eq(seatInvitationClaims.invitationId, row.invitationId))
    .limit(1);
  if (claimed.length > 0) {
    return {
      ok: false,
      status: 409,
      code: "claimed",
      why: "This invitation has already been used. If you set a password and cannot sign in, ask the practice to invite you again.",
    };
  }

  if (at >= row.expiresAt) {
    return {
      ok: false,
      status: 409,
      code: "expired",
      why: `This invitation stopped working on ${row.expiresAt.toISOString().slice(0, 10)}. Ask the practice to send a new one.`,
    };
  }

  const practiceName =
    (await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1))[0]?.name ??
    "This practice";

  return {
    ok: true,
    target: {
      invitationId: row.invitationId,
      userId: row.userId,
      practiceName,
      username: row.username,
      displayName: row.displayName,
      expiresAt: row.expiresAt.toISOString(),
    },
  };
}

export type ClaimResult =
  | { ok: true; practiceName: string; username: string }
  | InviteRefusal;

/**
 * Sets the password the practice never learns, and spends the invitation.
 *
 * Looks the link up again rather than trusting what the page was rendered
 * with: the page may have sat open while the invitation expired or while
 * somebody else used the same link, and a write authorised by a read that old
 * is a write authorised by nothing.
 *
 * The claim row is inserted before the password is written, so that two
 * requests racing the same link cannot both set one: the unique index on
 * `invitation_id` refuses the second, and its transaction takes the password
 * with it.
 */
export async function claimSeat(
  db: AppDb,
  tenantId: string,
  secret: string,
  password: string,
  at: Date = new Date()
): Promise<ClaimResult> {
  const found = await lookUpInvite(db, tenantId, secret, at);
  if (!found.ok) return found;

  const weak = passwordPolicyError(password);
  if (weak !== null) return { ok: false, status: 400, code: "weak", why: weak };

  await db.insert(seatInvitationClaims).values({
    id: uuidv7(),
    tenantId,
    invitationId: found.target.invitationId,
    claimedAt: at,
  });
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), passwordChangedAt: at })
    .where(and(eq(users.tenantId, tenantId), eq(users.id, found.target.userId)));
  // The act is the invited person's, so the chain names them rather than
  // nobody — this is not Increment 1.67's stranger, who has no account and
  // never will. The event carries no password and no address.
  await appendControlEvent(
    db,
    tenantId,
    found.target.userId,
    "seat.claimed",
    { invitation: found.target.invitationId },
    at
  );

  return { ok: true, practiceName: found.target.practiceName, username: found.target.username };
}

/** Seats this practice has invited and nobody has claimed, newest last. */
export async function unclaimedInvitations(
  db: AppDb,
  tenantId: string
): Promise<{ userId: string; username: string; displayName: string; invitedAt: string; expiresAt: string }[]> {
  const rows = await db
    .select({
      userId: seatInvitations.userId,
      username: users.username,
      displayName: users.displayName,
      invitedAt: seatInvitations.invitedAt,
      expiresAt: seatInvitations.expiresAt,
      claimId: seatInvitationClaims.id,
    })
    .from(seatInvitations)
    .innerJoin(users, eq(users.id, seatInvitations.userId))
    .leftJoin(seatInvitationClaims, eq(seatInvitationClaims.invitationId, seatInvitations.id))
    .where(and(eq(seatInvitations.tenantId, tenantId), isNull(seatInvitationClaims.id)))
    .orderBy(seatInvitations.invitedAt);
  return rows.map((r) => ({
    userId: r.userId,
    username: r.username,
    displayName: r.displayName,
    invitedAt: r.invitedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
  }));
}
