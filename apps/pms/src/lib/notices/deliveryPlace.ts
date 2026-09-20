import { NAV_LINKS } from "@/lib/auth/seats";
import type { NoticeSeat } from "./outstanding";

/**
 * Where each seat says where its notices go (Increment 1.74).
 *
 * The delivery panel — the address, the proof, the message that would go —
 * began on Practice Risk, which every seat that could act on a notice could
 * open. The outside accountant's seat cannot open it: `/risk` is manager rank
 * and the seat is `readonly` by construction (Increment 1.49). The three
 * routes behind the panel were nonetheless widened to admit that seat, so the
 * product would mail it a code and tell it to open a screen it cannot open.
 *
 * That is the shape Increment 1.72 found on the enrolment route: a guard
 * opened for a seat and a surface that was not. Here the answer is the panel
 * on the seat's own screen rather than a second copy of the act, and this
 * record is what stops the two drifting apart.
 *
 * `surface` names the file that renders the panel, for the same reason
 * `NavLink.gate` names the route file that enforces a link: a constant that
 * claims a place must be checkable against the place. `deliveryPlace.test.ts`
 * reads each `surface`, asserts it renders `DeliveryPanel`, and asserts the
 * seat can open the `href` under the guards the navigation reads.
 */
export const DELIVERY_PLACES: Record<NoticeSeat, { href: string; surface: string }> = {
  owner: { href: "/risk", surface: "(app)/risk/page.tsx" },
  accountant: { href: "/cpa", surface: "(app)/cpa/package-view.tsx" },
};

/**
 * The screen this seat opens to say where its notices go, named as the header
 * names it. Derived rather than written a second time: a message that called
 * the screen something the header does not would send a reader looking for a
 * link that is not there.
 */
export function deliveryPlace(seat: NoticeSeat): { href: string; label: string } {
  const { href } = DELIVERY_PLACES[seat];
  const link = NAV_LINKS.find((candidate) => candidate.href === href);
  if (!link) throw new Error(`No screen is named ${href}.`);
  return { href, label: link.label };
}
