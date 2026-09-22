import { ENTITLEMENTS } from "@pms/controls-engine";
import type { Viewer } from "./viewer";

/**
 * An act a duty gates, on a screen a rank opens (Increment 1.93).
 *
 * `NAV_LINKS` offers `/statements` and `/day-close` at `user` rank, and
 * `seats.test.ts` checks each link's declared gate against the route that
 * serves the **read**. Nothing checked the write half, and on both screens it
 * is stricter: posting a statement and applying staged deposits need
 * `post_payments`, and freezing the day close needs `bank_reconcile`.
 *
 * Neither page read the viewer's duties, so every act rendered for anybody who
 * could open the screen. The seeded practice shows what that costs: Riley
 * Owner is an administrator holding `approve_writeoffs`, `run_import` and
 * `bank_reconcile` — and **not** `post_payments` — so the practice owner met
 * two buttons that could only refuse, and Finn Front met a third.
 *
 * An act offered where it can only refuse is the shape Increments 1.88 and
 * 1.89 named on the owner board, and this says so before the press for the
 * reason Increment 1.90 gives: the refusal is the same sentence either way,
 * and it is worth more arriving early.
 *
 * The screen is the courtesy and the route is the control. Every one of these
 * routes still refuses a request that reaches it, exactly as before.
 */
export function holdsDuty(viewer: Viewer, entitlement: string): boolean {
  return viewer.state === "present" && viewer.entitlements.includes(entitlement);
}

/** What the duty is called, in the words the rest of the product uses for it. */
export function dutyLabel(entitlement: string): string {
  return ENTITLEMENTS.find((e) => e.id === entitlement)?.label ?? entitlement;
}

/**
 * What to say in the act's place.
 *
 * It names the duty rather than the entitlement id, says who can grant it, and
 * says where — because a person reading this cannot grant it to themselves and
 * the next thing they need is whom to ask.
 */
export function dutyNeededSentence(act: string, entitlement: string): string {
  return `${act} needs the “${dutyLabel(entitlement)}” duty, which you do not hold. An administrator grants it on Practice Risk.`;
}
