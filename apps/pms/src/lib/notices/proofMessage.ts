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
 */

/** How long a code is good for, said in the message rather than left to be discovered. */
export const CODE_WINDOW_HOURS = 24;

export function renderProofMessage(input: { practiceName: string; code: string; appUrl: string }): Message {
  return {
    subject: `${input.practiceName}: confirm where your messages go`,
    body: [
      `Somebody asked ${input.practiceName} to send its reminders to this address.`,
      "",
      `Your code is ${input.code}`,
      "",
      `Sign in at ${input.appUrl}, open Practice Risk, and type it beside your address.`,
      `The code works once and stops working after ${CODE_WINDOW_HOURS} hours.`,
      "",
      "Until somebody brings this code back, nothing else will be sent to this address.",
      "If you were not expecting this, ignore it: an address nobody confirms receives nothing.",
      "",
      "This message names no patient and quotes nobody's words.",
    ].join("\n"),
  };
}
