import type { Notice, NoticeSeat } from "./outstanding";

/**
 * The message that would be sent, and the rule about what it may contain
 * (Increment 1.58).
 *
 * Increment 1.57 folded what each seat owes into one list. Everything in that
 * list is read rather than sent: nobody learns anything unless they sign in,
 * and the month-end loop therefore runs at the speed of somebody remembering
 * to look. This increment renders the list into a message and records where it
 * would go. It sends nothing.
 *
 * ## What a message may contain
 *
 * A screen sits behind a guard. A message does not: it lands in an inbox
 * outside the product, on a lock screen, in a forward, in whatever a mail
 * provider keeps. So the two are not the same surface and may not carry the
 * same words.
 *
 * Two of the four notice kinds carry a person's typed words verbatim, because
 * Increment 1.50 deliberately put the question's own words on the owner board
 * rather than a resolved label. Nothing constrains what somebody types into a
 * thread. A message that quoted one could carry a patient's name out of the
 * product, and the whole reason the outside accountant's seat needs no BAA is
 * that what that seat can reach names no patient (`seats.ts`, proved by a live
 * case since Increment 1.49).
 *
 * The rule is therefore: **a message carries only sentences the product
 * generated.** It is enforced by the type rather than by care — `Deliverable`
 * omits `sentence`, so nothing in this file can read the typed words even by
 * mistake, and a unit case drives a thread whose body is a distinctive string
 * and asserts the rendered message does not contain it.
 *
 * The subject follows the same reasoning one step further. A subject is the
 * part a person sees without choosing to look, so it carries the practice and
 * a count and nothing else. What is owed goes in the body; what it says goes
 * nowhere but the screen.
 */

/**
 * A notice as the outside sees it. `sentence` is absent by construction: it is
 * the field that may quote a person, and a renderer that cannot read it cannot
 * leak it.
 */
export type Deliverable = Omit<Notice, "sentence">;

export type Message = {
  /** The practice and a count. Never what is owed, and never who said what. */
  subject: string;
  /** Each thing owed, in its generated words, with where to go and read the rest. */
  body: string;
};

export type RenderInput = {
  practiceName: string;
  /** Whose debts this message carries. A message addressed to two seats is a message nobody owns. */
  seat: NoticeSeat;
  /** Already filtered to `seat`; `renderMessage` asserts nothing about the ones it is handed. */
  notices: Deliverable[];
  /** Where the product lives, so a line can say where to go without the reader hunting. */
  appUrl: string;
};

const SEAT_LABEL: Record<NoticeSeat, string> = {
  owner: "the practice",
  accountant: "the accountant",
};

/** "1 thing is" / "3 things are", so the subject reads as English at either end. */
function countPhrase(n: number): string {
  return n === 1 ? "1 thing is waiting" : `${n} things are waiting`;
}

/**
 * Renders the message that would go to one seat, or null when that seat owes
 * nothing.
 *
 * Null rather than a cheerful empty message, for the reason Increment 1.55
 * settled: a signal that arrives whether or not anything happened is not a
 * signal, and an inbox teaches people to ignore whatever arrives every day.
 * The screen is where silence is shown as a state (Increment 1.57); a message
 * is only ever sent because something is owed.
 */
export function renderMessage(input: RenderInput): Message | null {
  const mine = input.notices.filter((n) => n.seat === input.seat);
  if (mine.length === 0) return null;

  const base = input.appUrl.replace(/\/+$/, "");
  const lines: string[] = [
    `${countPhrase(mine.length)} for ${SEAT_LABEL[input.seat]} at ${input.practiceName}.`,
    "",
  ];

  mine.forEach((n, i) => {
    lines.push(`${i + 1}. ${n.subject}`);
    lines.push(`   ${n.outside}`);
    if (n.since) lines.push(`   Owed since ${n.since}.`);
    lines.push(`   ${base}${n.href}`);
    lines.push("");
  });

  // Said plainly, so a reader who expected the words does not read a thin
  // message as a broken one.
  lines.push("This message names no patient and quotes nobody's words. Sign in to read what was said.");

  return {
    subject: `${input.practiceName}: ${countPhrase(mine.length)}`,
    body: lines.join("\n"),
  };
}
