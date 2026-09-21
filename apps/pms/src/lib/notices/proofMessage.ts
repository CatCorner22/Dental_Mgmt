import { STOP_LIFE_DAYS } from "./stopLink";
import type { Message } from "./message";

/**
 * The message that carries a code (Increment 1.61).
 *
 * Pure, and its own module for the two reasons this codebase keeps giving:
 * the screen quotes its wording, and a client component that reached the module
 * writing rows would drag `pg` into the browser bundle.
 *
 * **The code is not in the subject.** Increment 1.58 settled that a subject is
 * the part a person sees without choosing to look — on a lock screen, in a
 * preview pane, over a shoulder. A code in a subject is a bearer secret shown
 * to whoever glances, which would leave the proof measuring who can see the
 * phone rather than who can open the mailbox.
 *
 * **The message names nobody and carries nothing else.** It is the same rule
 * the notices message holds, and it is easier to hold here: this message has
 * one job, and the practice name and the code are the whole of it.
 *
 * **It now carries a way to say no** (Increment 1.67). The line it used to end
 * on told a reader who had not asked for this to ignore it, which is advice
 * that works for the product and not for the reader: ignoring it stops
 * nothing, and the next one arrives anyway. The link is a second secret with
 * the opposite power — it can stop this practice writing to the mailbox and it
 * can prove nothing — so putting it in a URL costs what the code could not
 * afford to.
 *
 * **It names the screen the reader can open** (Increment 1.74). It used to say
 * "Practice Risk", which is the screen the practice's own seats open and the
 * one screen the outside accountant's seat may not. A message telling a person
 * to go where their seat refuses them is worse than one that says nothing: it
 * reads as the product working and the reader failing. The caller supplies the
 * name, and `deliveryPlace` derives it from the same list the header draws the
 * links from.
 */

/** How long a code is good for, said in the message rather than left to be discovered. */
export const CODE_WINDOW_HOURS = 24;

export function renderProofMessage(input: {
  practiceName: string;
  code: string;
  appUrl: string;
  /** The screen this reader opens to type the code, named as the header names it. Increment 1.74. */
  place: string;
  /** Where the reader says they did not ask for this. Increment 1.67. */
  stopUrl: string;
}): Message {
  return {
    subject: `${input.practiceName}: confirm where your messages go`,
    body: [
      `Somebody asked ${input.practiceName} to send its reminders to this address.`,
      "",
      `Your code is ${input.code}`,
      "",
      `Sign in at ${input.appUrl}, open ${input.place}, and type it beside your address.`,
      `The code works once and stops working after ${CODE_WINDOW_HOURS} hours.`,
      "",
      "Until somebody brings this code back, nothing else will be sent to this address.",
      "",
      "If that was not you, say so here:",
      input.stopUrl,
      `That link needs no account and works for ${STOP_LIFE_DAYS} days. ${input.practiceName} will then send nothing further to this address, and will not be able to save it again.`,
      "",
      "This message names no patient and quotes nobody's words.",
    ].join("\n"),
  };
}
