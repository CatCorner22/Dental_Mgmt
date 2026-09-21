import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CPA_SEAT_ENTITLEMENT, navLinksFor, type Seat } from "@/lib/auth/seats";
import { DELIVERY_PLACES, deliveryPlace } from "./deliveryPlace";
import type { NoticeSeat } from "./outstanding";

const appDir = fileURLToPath(new URL("../../app/", import.meta.url));

/**
 * Increment 1.74. The delivery panel lived on one screen while its routes
 * admitted two seats, and the seat that could not open that screen was mailed
 * a code telling it to. These cases are what stops that reopening: each seat's
 * named screen must exist, must render the panel, and must open for that seat.
 */
const SEATS: Record<NoticeSeat, Seat> = {
  owner: { role: "admin", entitlements: [] },
  accountant: { role: "readonly", entitlements: [CPA_SEAT_ENTITLEMENT] },
};

describe("the screen each seat opens to say where its notices go", () => {
  it("covers every seat a notice can be owed to", () => {
    expect(Object.keys(DELIVERY_PLACES).sort()).toEqual(Object.keys(SEATS).sort());
  });

  it.each(Object.keys(SEATS) as NoticeSeat[])("renders the panel on the screen it names for %s", (seat) => {
    // `surface` is a claim about a file, checkable like `NavLink.gate`. A
    // constant naming a screen that does not carry the panel would send a
    // reader to a page with nowhere to type the code.
    const source = readFileSync(`${appDir}${DELIVERY_PLACES[seat].surface}`, "utf8");
    expect(source).toContain("<DeliveryPanel");
  });

  it.each(Object.keys(SEATS) as NoticeSeat[])("names a screen %s can open", (seat) => {
    // The whole of the defect: the guards behind the panel were widened for the
    // accountant's seat and the surface was not, so the message named a screen
    // that seat meets a refusal on.
    const opens = navLinksFor(SEATS[seat]).map((link) => link.href);
    expect(opens).toContain(DELIVERY_PLACES[seat].href);
  });

  it.each(Object.keys(SEATS) as NoticeSeat[])("calls %s's screen what the header calls it", (seat) => {
    // Derived from `NAV_LINKS` rather than written a second time: a message
    // naming a screen something the header does not would leave a reader
    // hunting for a link that is not there.
    const link = navLinksFor(SEATS[seat]).find((candidate) => candidate.href === DELIVERY_PLACES[seat].href);
    expect(deliveryPlace(seat)).toEqual({ href: DELIVERY_PLACES[seat].href, label: link?.label });
  });

  it("sends the two seats to different screens", () => {
    // If both resolved to one screen, every case above would pass while the
    // seat that cannot open it was sent there anyway.
    expect(deliveryPlace("owner").href).not.toBe(deliveryPlace("accountant").href);
  });
});
