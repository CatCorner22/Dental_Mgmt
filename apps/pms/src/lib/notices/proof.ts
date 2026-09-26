import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { noticeAddressChallenges, noticeAddressProofs, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { currentAddress } from "./addresses";
import { deliveryPlace } from "./deliveryPlace";
import { deliverMessage, type Delivered } from "./send";
import type { NoticeSeat } from "./outstanding";
import { CODE_WINDOW_HOURS, renderProofMessage } from "./proofMessage";
import { addressRefusal, hashStop, mintStop } from "./stop";
import { stopUrl } from "./stopLink";
import type { Transport } from "./transport";

/**
 * Proving that an address reaches the person who typed it (Increment 1.61).
 *
 * Increment 1.58 stopped one person redirecting another's notices: the database
 * refuses an address row naming anybody but the caller. It did not stop a
 * person redirecting their own into a typo, and the typo is the likelier
 * accident. `riley@ridgeveiw.example` passes every shape check there is and
 * reaches either nobody or a stranger — and Increment 1.59's guarantee does not
 * help, because a message a stranger's mailbox accepts **does not fail**. It
 * succeeds, silently, which is the one outcome this arc exists to prevent.
 *
 * So the product stops taking the practice's word for it. A code goes to the
 * address; the person brings it back; the coming back is the proof.
 *
 * **A code, not a link.** A link is a state-changing GET, and it puts a bearer
 * secret in a URL that a browser keeps, a proxy logs, and a referrer leaks. A
 * code carried from the inbox to a screen the person is already signed into
 * proves both halves at once — the token proves who can open the mailbox, and
 * the session proves who is asking — and neither proof is written down
 * anywhere a third party sees.
 *
 * **Proved, not verified.** `packages/verifier` verifies the hash chain, which
 * is a different thing entirely, and one word for two concepts is how a reader
 * ends up believing a claim nobody made.
 *
 * **The proof belongs to the address row.** Changing an address writes a new
 * row with a new id, which no proof points at, so a changed address is unproved
 * by the shape rather than by anything remembering to clear a flag. A signal
 * that never clears is not a signal; this one cannot fail to clear.
 *
 * **A limit on asking, and deliberately none on guessing** (Increment 1.63).
 * Increment 1.61 left a throttle on guessing codes as work to come. It is not
 * built, because on inspection it protects nothing: the lookup is scoped to
 * the caller's own rows, the only address anybody can prove is their own, and
 * a person who wants that outcome can simply press the button and be sent a
 * code. Guessing buys nobody anything they cannot have for the asking, and a
 * throttle there would be a thing that looks like protection.
 *
 * The real abuse is the other half. A signed-in person can point this
 * product's mail at **somebody else's address** by typing it, and ask again
 * and again — so the thing worth limiting is how often the product can be made
 * to send. Five asks an hour, per person rather than per address row, because
 * a per-row limit is escaped by changing one character and starting a fresh
 * allowance.
 *
 * The count comes from the challenges themselves, which are append-only and
 * already record every ask. No counter, nothing to reset, and nothing that can
 * disagree with the rows — which is why this does not reuse `auth_throttle`,
 * whose mutable `fail_count` earns its keep against unauthenticated traffic
 * that must not be allowed to write a row per attempt.
 */

/**
 * No I, L, O, 0 or 1: the code is read off a screen and typed into another one,
 * and a person who mistakes O for 0 gets told their code is wrong when it was
 * the alphabet that was wrong.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

/** How many codes one person may have sent in `ASK_WINDOW_MS`, whatever address they aim at. */
export const ASKS_PER_WINDOW = 5;
export const ASK_WINDOW_MS = 60 * 60 * 1000;

/**
 * How long a proof stands before it must be given again (Increment 1.65).
 *
 * A proof was forever, which quietly reintroduced the failure Increment 1.61
 * exists to prevent. A mailbox somebody loses access to — they leave, the
 * provider changes, a shared inbox is reassigned — stays proved, and the
 * notices keep arriving somewhere nobody reads. That is the same silent
 * success as a typo, only delayed.
 *
 * A year is a decision about the practice rather than about the code, and this
 * is the product's default rather than a law: long enough that nobody is
 * nagged, short enough that a mailbox nobody holds any more is caught within a
 * plausible turn of staff.
 *
 * It is **derived, never stored**. `notice_address_proofs` already dates every
 * proof and never changes one, so when a proof lapses is arithmetic on a row
 * that cannot drift — no expiry column, nothing to keep in step, and no job
 * that has to remember to run.
 */
export const PROOF_LIFE_MS = 365 * 24 * 60 * 60 * 1000;

/** How long before a proof lapses the product starts asking for a new code. */
export const REPROVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Where a proof stands right now.
 *
 * Pure, so the rule can be read without a transaction, and four states rather
 * than a boolean because the interesting one is `expiring`: a product that
 * only knew proved-or-not would have nothing to say until the day it stopped
 * sending, and stopping without warning is the silence this arc refuses.
 */
export type ProofStanding = "none" | "good" | "expiring" | "lapsed";

export function proofStanding(proof: { provedAt: string } | null, at: Date): ProofStanding {
  if (proof === null) return "none";
  const lapsesAt = new Date(proof.provedAt).getTime() + PROOF_LIFE_MS;
  if (at.getTime() >= lapsesAt) return "lapsed";
  return at.getTime() >= lapsesAt - REPROVE_WINDOW_MS ? "expiring" : "good";
}

/** When this proof lapses, as an ISO timestamp. */
export function proofLapsesAt(proof: { provedAt: string }): string {
  return new Date(new Date(proof.provedAt).getTime() + PROOF_LIFE_MS).toISOString();
}

export type ProofState = {
  /** Which address row was proved. */
  addressId: string;
  /** ISO timestamp. */
  provedAt: string;
};

export type ProofRefusal = {
  ok: false;
  status: 400 | 409;
  code:
    | "malformed"
    | "unknown"
    | "expired"
    | "already_proved"
    | "no_address"
    | "asked_too_often"
    /** Somebody reading that mailbox said they did not ask for this (Increment 1.67). */
    | "refused";
  verb: string;
  why: string;
};

export type ProofResult = { ok: true; proof: ProofState } | ProofRefusal;
export type ChallengeResult = { ok: true; delivered: Delivered; expiresAt: string } | ProofRefusal;

/** A fresh code, from the system's own randomness rather than anything derived from the row. */
export function mintCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/**
 * What a person typed, as the code they were sent.
 *
 * People retype a code with the spaces and hyphens they saw, and in whatever
 * case their keyboard was in. Refusing that would be refusing a correct answer
 * for being punctuated, so the reading is normalised and the comparison stays
 * exact.
 */
export function normaliseCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function hashCode(code: string): string {
  return createHash("sha256").update(normaliseCode(code)).digest("hex");
}

const isWellFormed = (code: string) => code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));

/**
 * The newest proof of this exact address row, or null where it has never been
 * proved.
 *
 * Newest wins, because a proof stands for a year and an address is proved
 * again before it lapses (Increment 1.65). Ordering is explicit: an unordered
 * limit over rows that now accumulate would return whichever the planner chose,
 * which is a coin toss rather than an answer.
 */
export async function currentProof(db: AppDb, tenantId: string, addressId: string): Promise<ProofState | null> {
  const rows = await db
    .select()
    .from(noticeAddressProofs)
    .where(and(eq(noticeAddressProofs.tenantId, tenantId), eq(noticeAddressProofs.addressId, addressId)))
    .orderBy(desc(noticeAddressProofs.provedAt), desc(noticeAddressProofs.id))
    .limit(1);
  const row = rows[0];
  return row ? { addressId: row.addressId, provedAt: row.provedAt.toISOString() } : null;
}

/**
 * When this person may next ask for a code, or null where they may ask now.
 *
 * Counted from the challenges themselves rather than from a tally kept beside
 * them: every ask is already an append-only row, so the rows are the count and
 * there is nothing to reset, nothing to drift, and nothing a reader must trust
 * over what actually happened.
 *
 * Per person, not per address row. A limit tied to the row would be escaped by
 * changing one character of the address, which writes a new row and hands the
 * asker a fresh allowance — and typing a slightly different stranger's address
 * is exactly the thing being limited.
 */
export async function nextAskAllowedAt(
  db: AppDb,
  tenantId: string,
  userId: string,
  at: Date = new Date()
): Promise<Date | null> {
  const since = new Date(at.getTime() - ASK_WINDOW_MS);
  const recent = await db
    .select({ issuedAt: noticeAddressChallenges.issuedAt })
    .from(noticeAddressChallenges)
    .where(
      and(
        eq(noticeAddressChallenges.tenantId, tenantId),
        eq(noticeAddressChallenges.userId, userId),
        gt(noticeAddressChallenges.issuedAt, since)
      )
    )
    .orderBy(desc(noticeAddressChallenges.issuedAt))
    .limit(ASKS_PER_WINDOW);
  if (recent.length < ASKS_PER_WINDOW) return null;
  // The window frees up when the oldest of these leaves it.
  const oldest = recent[recent.length - 1]!.issuedAt;
  return new Date(oldest.getTime() + ASK_WINDOW_MS);
}

/**
 * Sends a code to the address on file, and records the attempt like any other.
 *
 * The message goes through `deliverMessage`, so it meets the same transport,
 * the same retry rule, and the same row per attempt as a message of notices —
 * which means a code that could not be delivered is as visible as anything
 * else, and a person is never left waiting for something that never left.
 *
 * The row it writes carries `noticeCount: 0`. That is not a placeholder: a
 * message of no notices is never sent, because nothing owed writes no row at
 * all, so a zero there means exactly "this message carried no notices" and
 * names this one message in the whole table.
 */
export async function sendProofCode(
  db: AppDb,
  input: {
    tenantId: string;
    userId: string;
    userName: string;
    seat: NoticeSeat;
    practiceName: string;
    appUrl: string;
    transport: Transport;
    at?: Date;
    pause?: (ms: number) => Promise<void>;
    /** The round asking on the product's behalf rather than a person pressing a button (Increment 1.65). */
    unlimited?: boolean;
  }
): Promise<ChallengeResult> {
  const at = input.at ?? new Date();
  const held = await currentAddress(db, input.tenantId, input.userId);
  if (held === null || held.address === null) {
    return {
      ok: false,
      status: 409,
      code: "no_address",
      verb: "send a code",
      why:
        held === null
          ? "There is no address to prove. Save one first, and a code will go to it."
          : `You asked on ${held.setAt.slice(0, 10)} not to receive messages, so there is nowhere to send a code.`,
    };
  }
  // Checked before anything else about the address, because it is the one
  // fact that outranks every other: a mailbox whose reader said they did not
  // ask is not a destination, whatever the practice believes about it
  // (Increment 1.67). The database holds the same rule against a *new* address
  // row; this holds it against the row already on file, which is the row every
  // refusal is about.
  const refused = await addressRefusal(db, input.tenantId, held.address);
  if (refused !== null) {
    return {
      ok: false,
      status: 409,
      code: "refused",
      verb: "send a code",
      why: `Somebody reading ${held.address} said on ${refused.refusedAt.slice(0, 10)} that they did not ask for this practice's messages. Nothing further goes there. Save a different address.`,
    };
  }

  const already = await currentProof(db, input.tenantId, held.id);
  // A proof that still stands comfortably needs no code. One inside its last
  // thirty days does: refusing there would mean the only way to re-prove an
  // address is to wait for it to lapse and for the notices to stop, which is
  // exactly the silence this increment removes.
  if (already !== null && proofStanding(already, at) === "good") {
    return {
      ok: false,
      status: 409,
      code: "already_proved",
      verb: "send a code",
      why: `${held.address} was proved on ${already.provedAt.slice(0, 10)} and stands until ${proofLapsesAt(already).slice(0, 10)}. Change the address if it is wrong; a new one is proved again.`,
    };
  }

  // A limit on asking (Increment 1.63), checked before anything is minted or
  // written: a refused ask must leave no trace, or the refusal would itself
  // spend part of the next window.
  //
  // The round does not count against it (Increment 1.65). That limit exists
  // because a person can type a stranger's address and press the button; the
  // round acts for nobody and only ever writes to an address that this person
  // already proved, so there is no stranger it could reach. A round is reached
  // from the command line and from no route, so nothing a caller does can turn
  // this into a way around the limit.
  const waitUntil = input.unlimited === true ? null : await nextAskAllowedAt(db, input.tenantId, input.userId, at);
  if (waitUntil !== null) {
    return {
      ok: false,
      status: 409,
      code: "asked_too_often",
      verb: "send a code",
      why: `That is ${ASKS_PER_WINDOW} codes in an hour, which is as many as this practice will send. You may ask again after ${waitUntil.toISOString().slice(11, 16)} UTC.`,
    };
  }

  const code = mintCode();
  // The second secret, minted beside the first and carried in the same message
  // (Increment 1.67). Its hash is stamped on the challenge, so a refusal points
  // back at the one message that provoked it.
  const stopSecret = mintStop();
  const expiresAt = new Date(at.getTime() + CODE_WINDOW_HOURS * 60 * 60 * 1000);
  const challengeId = uuidv7();
  // The challenge is written before the message goes, so a code that reaches
  // somebody is always a code this database can recognise. Written after, a
  // send that succeeded while the write failed would leave a person holding a
  // code nothing accepts.
  await db.insert(noticeAddressChallenges).values({
    id: challengeId,
    tenantId: input.tenantId,
    userId: input.userId,
    addressId: held.id,
    tokenHash: hashCode(code),
    stopHash: hashStop(stopSecret),
    issuedAt: at,
    expiresAt,
  });

  const delivered = await deliverMessage(db, {
    tenantId: input.tenantId,
    kind: "proof_code",
    recipientId: input.userId,
    recipientName: input.userName,
    seat: input.seat,
    message: renderProofMessage({
      practiceName: input.practiceName,
      code,
      appUrl: input.appUrl,
      // The screen this seat can open, rather than the one the practice's own
      // seats open (Increment 1.74).
      place: deliveryPlace(input.seat).label,
      stopUrl: stopUrl(input.appUrl, { tenantId: input.tenantId, secret: stopSecret }),
    }),
    noticeCount: 0,
    address: held.address,
    why: null,
    transport: input.transport,
    at: input.at,
    pause: input.pause,
  });

  // The chain names the act and never the code or the address: a code on the
  // chain would be a bearer secret readable by everyone who may govern this
  // practice, which is the opposite of what it is for.
  await appendControlEvent(
    db,
    input.tenantId,
    input.userId,
    "notice.address_code_sent",
    { by: input.userName, outcome: delivered.record.outcome, attempts: delivered.attempts },
    at
  );

  return { ok: true, delivered, expiresAt: expiresAt.toISOString() };
}

/**
 * Takes a code back and records the proof, or says in words why it will not.
 *
 * The lookup is scoped to the caller's own rows, so a code issued to somebody
 * else does not match rather than matching and being refused. That is why there
 * is no "this is not your code" refusal to write: the query cannot see one.
 */
export async function proveAddress(
  db: AppDb,
  tenantId: string,
  userId: string,
  userName: string,
  raw: string,
  at: Date = new Date()
): Promise<ProofResult> {
  const code = normaliseCode(raw);
  if (!isWellFormed(code)) {
    return {
      ok: false,
      status: 400,
      code: "malformed",
      verb: "prove this address",
      why: `A code is ${CODE_LENGTH} letters and digits. "${raw.trim()}" is not one, so nothing was checked.`,
    };
  }

  const held = await currentAddress(db, tenantId, userId);
  if (held === null || held.address === null) {
    return {
      ok: false,
      status: 409,
      code: "no_address",
      verb: "prove this address",
      why: "There is no address on file to prove. Save one, ask for a code, and bring it back.",
    };
  }
  // A code minted before the mailbox refused is still a code, and bringing it
  // back would prove an address whose reader has since said no. The refusal is
  // the later statement and the one that stands (Increment 1.67).
  const refused = await addressRefusal(db, tenantId, held.address);
  if (refused !== null) {
    return {
      ok: false,
      status: 409,
      code: "refused",
      verb: "prove this address",
      why: `Somebody reading ${held.address} said on ${refused.refusedAt.slice(0, 10)} that they did not ask for this practice's messages. Nothing further goes there. Save a different address.`,
    };
  }

  const already = await currentProof(db, tenantId, held.id);
  if (already !== null && proofStanding(already, at) === "good") {
    return {
      ok: false,
      status: 409,
      code: "already_proved",
      verb: "prove this address",
      why: `${held.address} was already proved, on ${already.provedAt.slice(0, 10)}, and stands until ${proofLapsesAt(already).slice(0, 10)}.`,
    };
  }

  const rows = await db
    .select()
    .from(noticeAddressChallenges)
    .where(
      and(
        eq(noticeAddressChallenges.tenantId, tenantId),
        eq(noticeAddressChallenges.userId, userId),
        eq(noticeAddressChallenges.tokenHash, hashCode(code))
      )
    )
    .orderBy(desc(noticeAddressChallenges.issuedAt))
    .limit(1);
  const challenge = rows[0];
  // A code for an address that is no longer the one on file is as unknown as a
  // code nobody issued: it proves a row the practice has moved on from.
  if (!challenge || challenge.addressId !== held.id) {
    // 409 rather than 404: this route addresses no resource by name, so nothing
    // here can be missing. What refuses is the practice's state — there is no
    // outstanding code of that shape — which is what 409 says everywhere else
    // in this product. It also leaves a 404 from an API route meaning the one
    // thing it should mean, that the route is not there.
    return {
      ok: false,
      status: 409,
      code: "unknown",
      verb: "prove this address",
      why: "That code does not match one sent to this address. Ask for another, and use the newest one.",
    };
  }
  if (at > challenge.expiresAt) {
    return {
      ok: false,
      status: 409,
      code: "expired",
      verb: "prove this address",
      why: `That code stopped working on ${challenge.expiresAt.toISOString().slice(0, 10)}. Ask for another.`,
    };
  }

  await db.insert(noticeAddressProofs).values({
    id: uuidv7(),
    tenantId,
    userId,
    addressId: held.id,
    challengeId: challenge.id,
    provedAt: at,
  });
  await appendControlEvent(db, tenantId, userId, "notice.address_proved", { by: userName }, at);
  return { ok: true, proof: { addressId: held.id, provedAt: at.toISOString() } };
}
