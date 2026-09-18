import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONFLICT_RULES } from "@pms/controls-engine";
import { CPA_SEAT_ENTITLEMENT, NAV_LINKS, isCpaSeat, navLinksFor } from "./seats";

const appDir = fileURLToPath(new URL("../../app/", import.meta.url));

const owner = { role: "admin" as const, entitlements: ["approve_writeoffs", "run_import", "bank_reconcile"] };
const front = { role: "user" as const, entitlements: ["post_payments", "run_import"] };
const cpa = { role: "readonly" as const, entitlements: [CPA_SEAT_ENTITLEMENT] };

describe("the outside accountant's seat", () => {
  it("is the reporting grant below every rank the practice's own screens need", () => {
    expect(isCpaSeat(cpa)).toBe(true);
    // An owner holding the same grant is a member of the practice, not a seat.
    expect(isCpaSeat({ role: "admin", entitlements: [CPA_SEAT_ENTITLEMENT] })).toBe(false);
    expect(isCpaSeat({ role: "readonly", entitlements: [] })).toBe(false);
    expect(isCpaSeat(null)).toBe(false);
  });

  it("holds a duty no conflict rule names, so granting it creates no conflict", () => {
    // This is the claim docs/13 makes about inviting the seat. It holds only
    // because the rulebook pairs no other duty with the reporting one; a rule
    // added later that does would make an invited seat a finding on arrival.
    const paired = CONFLICT_RULES.filter((r) => r.a === CPA_SEAT_ENTITLEMENT || r.b === CPA_SEAT_ENTITLEMENT);
    expect(paired).toEqual([]);
  });

  it("reaches the month-end package and no other screen", () => {
    expect(navLinksFor(cpa).map((l) => l.href)).toEqual(["/cpa"]);
  });
});

describe("the links a viewer is offered", () => {
  it("offers each viewer what its rank and its grants open, and nothing else", () => {
    // Not `/ledger/post`: posting opens on the `post_payments` grant, which the
    // owner does not hold — the practice's front desk posts and the owner
    // approves. The header offered that link to the owner until this increment,
    // and the route had refused it all along.
    expect(navLinksFor(owner).map((l) => l.href)).toEqual([
      "/home",
      "/ledger",
      "/reconciliation",
      "/day-close",
      "/statements",
      "/approvals",
      "/risk",
      "/digest",
      "/locations",
      "/cpa",
    ]);
    expect(navLinksFor(front).map((l) => l.href)).toEqual([
      "/ledger",
      "/ledger/post",
      "/day-close",
      "/statements",
    ]);
  });

  it("offers nothing to a viewer the layout could not resolve", () => {
    expect(navLinksFor(null)).toEqual([]);
    expect(navLinksFor({ role: "readonly", entitlements: [] })).toEqual([]);
  });

  it("declares for each link what that screen's own route enforces", () => {
    // The filter is a courtesy, never the control — but a link whose declared
    // gate drifts from its route would offer a person a screen that refuses
    // them, so each catalog entry is read back against the guard it names.
    for (const link of NAV_LINKS) {
      const source = readFileSync(`${appDir}${link.gate}`, "utf8");
      const rank = source.match(/minRank:\s*"([a-z]+)"/)?.[1];
      const grants = source.match(/entitlements:\s*\[([^\]]*)\]/)?.[1] ?? "";
      const orGrant = source.match(/orEntitlement:\s*([A-Za-z_]+|"[a-z_]+")/)?.[1];

      expect({ href: link.href, rank }).toEqual({ href: link.href, rank: link.minRank });
      if (link.entitlement && !link.minRank) {
        expect({ href: link.href, has: grants.includes(`"${link.entitlement}"`) }).toEqual({
          href: link.href,
          has: true,
        });
      }
      // Where a link opens on both, the route has to say so with orEntitlement.
      if (link.entitlement && link.minRank) {
        expect({ href: link.href, orGrant: Boolean(orGrant) }).toEqual({ href: link.href, orGrant: true });
      }
    }
  });
});
