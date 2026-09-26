/**
 * What the stop form carries between renders (Increment 1.67).
 *
 * Its own module because a `"use server"` file may export nothing but async
 * functions: a value exported beside an action is a build that succeeds and a
 * page that answers 500 on its first load, which `tsc` and `next build` both
 * accept and only a browser finds. `loginFormState.ts` sits beside
 * `loginAction.ts` for exactly this reason.
 */

export type StopFormState = {
  /** Whether the act has happened. A settled form shows no button. */
  settled: boolean;
  message: string;
};

export const initialStopState: StopFormState = { settled: false, message: "" };
