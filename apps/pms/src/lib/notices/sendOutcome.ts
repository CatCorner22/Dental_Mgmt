import type { NoticeSeat } from "./outstanding";

/**
 * What an attempt to send was, and how it reads (Increment 1.59).
 *
 * Pure, and separate from `send.ts` for the reason this codebase has met
 * before: the Practice Risk page is a client component, and a client component
 * that imports a module reaching `appendControlEvent` drags `pg` into the
 * browser bundle. TypeScript says nothing about it; `next build` refuses. So
 * the shape of an outcome and the sentence that reads it live here, where both
 * the screen and the server can have them, and the writing lives next door.
 */

export type SendOutcome = "sent" | "failed" | "unreachable" | "nothing_owed";

export type SendRecord = {
  seat: NoticeSeat;
  recipientName: string;
  /** Null exactly when nothing reached a transport. */
  address: string | null;
  outcome: Exclude<SendOutcome, "nothing_owed">;
  /** The transport's own words on a failure, or why there was nowhere to send. */
  detail: string | null;
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
 */
export function sendSentence(record: SendRecord): string {
  const day = record.attemptedAt.slice(0, 10);
  switch (record.outcome) {
    case "sent":
      return `Sent to ${record.address} on ${day}.`;
    case "unreachable":
      return `Nothing was sent on ${day}: ${record.detail}`;
    case "failed":
      return `The attempt on ${day} failed and nothing arrived: ${record.detail}`;
  }
}
