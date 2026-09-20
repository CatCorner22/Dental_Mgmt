import { REPROVE_WINDOW_MS } from "./proof";

/**
 * What becomes of an address nobody re-proves (Increment 1.68).
 *
 * Increment 1.65 gave a proof a life and had the round ask for a new code
 * inside its last thirty days, so that nothing would stop in silence. It then
 * left a trap nobody had walked into yet: **once the proof lapsed, the round
 * stopped asking.** Forever.
 *
 * Read that from the person's side. They missed one message — leave, a busy
 * month, a mailbox they read on a phone they replaced. The notices stop. The
 * product never asks again. The only thing that would tell them to open the
 * screen and fetch a code is the notices, which is precisely what is being
 * withheld. The one signal that would break the silence is the one the silence
 * suppresses, and nothing in the product ever gets them out of it.
 *
 * So the round keeps asking after a lapse — and then, having asked, stops.
 *
 * **Monthly, not weekly.** A person who has not answered in a month will not
 * answer faster for being asked more often; past that, asking again is the
 * product talking to itself. The spacing counts from the last code that
 * actually reached the transport, whether that code went before the lapse or
 * after, so the ask inside Increment 1.65's window and the asks after it are
 * one unbroken cadence rather than two rules meeting at a cliff.
 *
 * **Three times, and the count is the rows.** Sent codes are already
 * append-only, so the allowance is read from them exactly as Increment 1.63
 * reads its hourly limit. Nothing to reset, nothing to drift, and nothing a
 * reader must trust over what actually happened. Only codes that were **sent**
 * count: a code the transport refused never reached anybody, and charging a
 * person for it would spend their allowance on the practice's own outage.
 *
 * **Retirement is derived, never stored.** When an address stops being a
 * destination is arithmetic over rows that cannot change — the proof that
 * lapsed and the codes that went unanswered. A column would be a status the
 * rows under it could contradict, and a job that had to remember to run. This
 * is the same argument Increment 1.65 made for a proof's life, and it is why
 * this increment adds no migration at all.
 *
 * **Increment 1.67 is what makes asking again safe.** The worry about mailing
 * an address that has quietly changed hands is that a stranger receives it —
 * and every one of these codes now carries that stranger a one-click way to
 * stop it, which also stops the asking here, because a refused address is
 * refused before a code is minted. The increment that gave strangers a way out
 * is what licenses the product to keep trying.
 */

/** How many codes go out after a proof lapses before the address is let go. */
export const RETIRE_ASKS = 3;

/** How long each of those codes is given to be answered. */
export const ASK_AGAIN_EVERY_MS = 30 * 24 * 60 * 60 * 1000;

export type AfterLapse =
  | {
      retired: false;
      /** Codes sent since the proof lapsed. */
      asked: number;
      /** When the next code may go, or null where the allowance is spent. ISO. */
      askDue: string | null;
      /** When this address stops being a destination if nothing changes. ISO. */
      retiresAt: string;
    }
  | { retired: true; asked: number; retiredAt: string };

/**
 * Where a lapsed address stands, from the proof that lapsed and the codes
 * since.
 *
 * Pure, so the rule reads without a transaction and every caller — the round
 * deciding whether to ask, the send deciding what to say, the route answering
 * the screen — reaches one answer rather than three. (The module itself is
 * server-side: it shares `REPROVE_WINDOW_MS` with `proof.ts` rather than
 * keeping a second copy of one number, and the screen receives what this
 * returns rather than importing it.) `sentAt` carries every code that reached
 * the transport from the reprove window onward — the one Increment 1.65 sent before the lapse
 * included, because the cadence counts from the last code sent rather than
 * from the lapse.
 */
export function afterLapse(lapsedAt: string, sentAt: readonly Date[], at: Date): AfterLapse {
  const lapsed = new Date(lapsedAt).getTime();
  const times = [...sentAt].map((d) => d.getTime()).sort((a, b) => a - b);
  const asked = times.filter((t) => t >= lapsed).length;
  const last = times.length === 0 ? null : times[times.length - 1]!;

  // Nothing has gone out at all — including the ask Increment 1.65 owed inside
  // the window. Then the next one is owed now: the person is already past the
  // point where a warning would have helped.
  const dueAt = last === null ? at.getTime() : last + ASK_AGAIN_EVERY_MS;

  if (asked >= RETIRE_ASKS) {
    // The allowance is spent. The last code still has its month, and the
    // address is let go when that month runs out rather than the instant the
    // third code leaves — a code answered on its twenty-ninth day is answered.
    const retiresAt = new Date(dueAt).toISOString();
    return at.getTime() >= dueAt
      ? { retired: true, asked, retiredAt: retiresAt }
      : { retired: false, asked, askDue: null, retiresAt };
  }

  // Every remaining ask gets its own month, and the last of them gets one more.
  const retiresAt = new Date(dueAt + (RETIRE_ASKS - asked - 1) * ASK_AGAIN_EVERY_MS + ASK_AGAIN_EVERY_MS);
  return { retired: false, asked, askDue: new Date(dueAt).toISOString(), retiresAt: retiresAt.toISOString() };
}

/**
 * How far back the round must read the sent codes to answer the question.
 *
 * The reprove window before the lapse, because the code Increment 1.65 sent
 * inside it sets the cadence, and everything after. Reading further back would
 * pull in codes belonging to a proof that has since been given and lapsed
 * again, which are somebody else's arithmetic.
 */
export function readCodesFrom(lapsedAt: string): Date {
  return new Date(new Date(lapsedAt).getTime() - REPROVE_WINDOW_MS);
}
