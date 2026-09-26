import { PRIOR_PERIOD_REASON } from "../ledger/reasons";

/**
 * What a question about a month that has since been closed has to say
 * (Increment 1.54).
 *
 * Increment 1.50 let the accountant ask about a line of the month and the
 * practice answer it. Increment 1.36 made a month closable, freezing the
 * package hash and refusing any entry effective-dated into it unless the
 * correction carries `prior_period`. Nothing joined the two: a thread about a
 * month the practice has since closed read exactly like a thread about a month
 * still open, and the two call for different answers. "I will fix that figure"
 * is true of an open month and false of a closed one, where the fix posts
 * today, is reported in the month it posts, and leaves the accountant's copy
 * still reading what they received.
 *
 * This is the pure sentence for that state, so the thread on `/cpa` and the
 * card on the owner board say it the same way, and so a client component can
 * render it without reaching the database.
 */

export type ClosedMonthNote = {
  month: string;
  /** ISO timestamp of the close. */
  closedAt: string;
  closedByName: string;
  /** One sentence, written the same way wherever it appears. */
  sentence: string;
};

export function closedMonthNote(input: { month: string; closedAt: string; closedByName: string }): ClosedMonthNote {
  const day = input.closedAt.slice(0, 10);
  return {
    month: input.month,
    closedAt: input.closedAt,
    closedByName: input.closedByName,
    sentence:
      `${input.month} was closed by ${input.closedByName} on ${day}, so its figures are frozen and the accountant already has them. ` +
      `A correction to this line now posts today with reason ${PRIOR_PERIOD_REASON} and is reported in the month it posts, not in this one.`,
  };
}
