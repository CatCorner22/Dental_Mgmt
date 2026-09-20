/**
 * What the claim form carries between renders (Increment 1.71).
 *
 * Its own module because a `"use server"` file may export nothing but async
 * functions: a value exported beside an action is a build that succeeds and a
 * page that answers 500 on its first load, which `tsc` and `next build` both
 * accept and only a browser finds. `loginFormState.ts` and `stopFormState.ts`
 * sit beside their actions for exactly this reason.
 */

export type InviteFormState = {
  /** Whether the seat is claimed. A settled form shows no fields. */
  settled: boolean;
  message: string;
};

export const initialInviteState: InviteFormState = { settled: false, message: "" };
