import type { NoticeSeat } from "./outstanding";

/**
 * What an attempt to send was, and how it reads (Increments 1.59 and 1.60).
 *
 * Pure, and separate from `send.ts` for the reason this codebase has met
 * before: the Practice Risk page is a client component, and a client component
 * that imports a module reaching `appendControlEvent` drags `pg` into the
 * browser bundle. TypeScript says nothing about it; `next build` refuses. So
 * the shape of an outcome and the sentence that reads it live here, where both
 * the screen and the server can have them, and the writing lives next door.
 */

export type SendOutcome = "sent" | "failed" | "unreachable" | "nothing_owed";

/**
 * Whether a refusal could pass (Increment 1.60).
 *
 * Only the transport knows, so only the transport says. `transient` means the
 * provider was unavailable, busy, or timed out, and asking again may get
 * through. `permanent` means the address does not exist, the provider rejected
 * the message itself, or this deployment has no transport at all — asking again
 * fails the same way.
 *
 * The vocabulary lives in this pure module rather than in the port, so that the
 * record, the sentence, and the transport all take it from one definition.
 */
export type FailureKind = "transient" | "permanent";

export type SendRecord = {
  seat: NoticeSeat;
  recipientName: string;
  /** Null exactly when nothing reached a transport. */
  address: string | null;
  outcome: Exclude<SendOutcome, "nothing_owed">;
  /** The transport's own words on a failure, or why there was nowhere to send. */
  detail: string | null;
  /**
   * Which kind of refusal this was. Null on any outcome but a failure, and on a
   * failure recorded before Increment 1.60 drew the distinction — filling those
   * in would invent a fact nobody had.
   */
  failureKind: FailureKind | null;
  subject: string | null;
  noticeCount: number;
  /** ISO timestamp. */
  attemptedAt: string;
};

/**
 * One sentence a screen can show without deciding for itself what an outcome
 * means.
 *
 * A failure says that **nothing arrived**, not merely that a send failed. What
 * a reader needs to know is the thing they would otherwise assume had happened.
 *
 * Increment 1.60 adds the half that tells them what to do about it. The clause
 * is true of the row on its own, in any position: it reads the kind of refusal,
 * never how many attempts surrounded it. A row with no kind — one recorded
 * before the distinction existed — reads exactly as it read in 1.59, because
 * inventing its clause would be advice on evidence nobody had.
 */
export function sendSentence(record: SendRecord): string {
  const day = record.attemptedAt.slice(0, 10);
  switch (record.outcome) {
    case "sent":
      return `Sent to ${record.address} on ${day}.`;
    case "unreachable":
      return `Nothing was sent on ${day}: ${record.detail}`;
    case "failed":
      return `The attempt on ${day} failed and nothing arrived: ${record.detail}${advice(record.failureKind)}`;
  }
}

function advice(kind: FailureKind | null): string {
  switch (kind) {
    case "transient":
      return " That kind of refusal can pass, so asking again later may get through.";
    case "permanent":
      return " That kind of refusal will not pass, so asking again would fail the same way; something has to change first.";
    case null:
      return "";
  }
}
