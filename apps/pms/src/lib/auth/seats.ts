import { meetsRole, type Role } from "./roles";

/**
 * Seats and the links each one may reach (Increment 1.49).
 *
 * A **seat** is what a person may do, not how senior they are. Most of this
 * product's screens open on rank; a few open on a grant, because the duty and
 * not the rank is what the screen is for. The outside accountant is the first
 * seat that is nothing but a grant: the lowest rank the product has, holding
 * one entitlement, reaching the month-end package and no other screen.
 *
 * That shape is what lets the seat exist without a BAA. The package is
 * aggregate and names no patient (Increment 1.34, proved by a live test since
 * this increment), so an accountant reading it receives no protected health
 * information; a seat that could reach the account ledger would receive it on
 * the first click, and would need the countersigned BAA docs/05 describes
 * before the practice could grant it at all.
 */

/** The entitlement the outside accountant's seat carries. */
export const CPA_SEAT_ENTITLEMENT = "view_reports_only";

/** What the SoD rulebook calls the seat. No release rule names this role, so it neither initiates nor seconds. */
export const CPA_SEAT_CONTROL_ROLE = "Outside Accountant";

/** A viewer, as the guards and the navigation both read one. */
export type Seat = { role: Role; entitlements: string[] };

/**
 * Whether this viewer is the outside accountant rather than a member of the
 * practice who happens to hold the reporting grant. The rank carries the
 * distinction: the seat sits below every rank the practice's own screens need,
 * so an owner holding the same grant is not a seat.
 */
export function isCpaSeat(seat: Seat | null | undefined): boolean {
  if (!seat) return false;
  return seat.entitlements.includes(CPA_SEAT_ENTITLEMENT) && !meetsRole(seat.role, "user");
}

/**
 * One header link, with what opens it and the route that enforces the same
 * thing. A link whose declared gate drifts from its route would offer a person
 * a screen that refuses them, so `seats.test.ts` reads each `gate` file and
 * asserts the two still agree.
 */
export type NavLink = {
  href: string;
  label: string;
  /**
   * What the owner's home board calls it, where there is room for more than a
   * header tab (Increment 1.104). It lives on the same entry as `label`
   * because the board used to keep its own list of eleven links, and a second
   * list is a second thing to keep true: that one had no rank or duty filter
   * at all, had never gained `/import` or `/releases`, and offered the seeded
   * owner "Post payment" for a screen whose route has always refused them.
   */
  boardLabel?: string;
  /** This rank or above opens it. */
  minRank?: Role;
  /** Holding this entitlement opens it, whatever the rank. */
  entitlement?: string;
  /** The route file, relative to `src/app`, whose guard enforces the same. */
  gate: string;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/home", label: "Home", minRank: "manager", gate: "api/home/board/route.ts" },
  { href: "/ledger", label: "Ledger", boardLabel: "Open ledger", minRank: "user", gate: "api/ledger/accounts/route.ts" },
  { href: "/ledger/post", label: "Post", boardLabel: "Post payment", entitlement: "post_payments", gate: "api/ledger/post/route.ts" },
  { href: "/reconciliation", label: "Reconciliation", boardLabel: "Bank reconciliation", entitlement: "bank_reconcile", gate: "api/reconciliation/runs/route.ts" },
  { href: "/import", label: "Import", boardLabel: "Import a file", entitlement: "run_import", gate: "api/import/curve/route.ts" },
  { href: "/day-close", label: "Day close", minRank: "user", gate: "api/day-close/route.ts" },
  { href: "/statements", label: "Statements", minRank: "user", gate: "api/statements/route.ts" },
  { href: "/approvals", label: "Approvals", boardLabel: "Approvals inbox", entitlement: "approve_writeoffs", gate: "api/approvals/inbox/route.ts" },
  { href: "/releases", label: "Releases", minRank: "lead", gate: "api/controls/release/evaluate/route.ts" },
  { href: "/risk", label: "Practice Risk", minRank: "manager", gate: "api/controls/risk/route.ts" },
  { href: "/digest", label: "Digest", boardLabel: "Weekly digest", minRank: "manager", gate: "api/digest/route.ts" },
  { href: "/locations", label: "Locations", minRank: "manager", gate: "api/locations/route.ts" },
  /**
   * The one screen the product had that no seat named (Increment 1.104). It
   * was reachable from the owner's home board and nowhere else, so a seat
   * that posts — the seat the list exists for — could not find it. The route
   * opens at `user`, and since Increment 1.103 a seat below `manager` reads
   * the list its forms are built from without the practice's governance of
   * it, which is what makes the seat safe to offer.
   */
  { href: "/reason-codes", label: "Reasons", boardLabel: "Reason codes", minRank: "user", gate: "api/reason-codes/route.ts" },
  {
    href: "/cpa",
    label: "Month-end",
    boardLabel: "Month-end package",
    minRank: "manager",
    entitlement: CPA_SEAT_ENTITLEMENT,
    gate: "api/cpa/package/route.ts",
  },
];

/**
 * The links this viewer may reach: the rank opens it, or the entitlement does.
 *
 * Every screen guards itself, so this filter is never the control — it is the
 * courtesy of not offering a person eleven screens that refuse them, which is
 * what the outside accountant would otherwise meet on the first sign-in.
 */
export function navLinksFor(seat: Seat | null | undefined): NavLink[] {
  if (!seat) return [];
  return NAV_LINKS.filter(
    (link) =>
      (link.minRank !== undefined && meetsRole(seat.role, link.minRank)) ||
      (link.entitlement !== undefined && seat.entitlements.includes(link.entitlement))
  );
}

/**
 * The links the owner's home board offers (Increment 1.104).
 *
 * The same catalog the header filters, minus the board's own screen: a board
 * that links to itself spends a row saying nothing. Everything else about the
 * decision — which rank opens a screen, which duty does — is `navLinksFor`'s,
 * because the board had its own answer to that question and the answer was
 * "everybody".
 */
export function boardLinksFor(seat: Seat | null | undefined): NavLink[] {
  return navLinksFor(seat).filter((link) => link.href !== "/home");
}
