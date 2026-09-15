import { describe, expect, it } from "vitest";
import { staffToPeople } from "./people";

describe("staffToPeople", () => {
  it("maps admin users to Owner / Dentist", () => {
    const people = staffToPeople([
      {
        id: "u1",
        displayName: "Riley Owner",
        role: "admin",
        clinicalRole: "dentist",
        entitlements: ["approve_writeoffs"],
      },
    ]);
    expect(people[0]?.role).toBe("Owner / Dentist");
  });

  it("maps billing staff to Billing Specialist", () => {
    const people = staffToPeople([
      {
        id: "u2",
        displayName: "Finn Front",
        role: "user",
        clinicalRole: "unset",
        entitlements: ["post_payments"],
      },
    ]);
    expect(people[0]?.role).toBe("Billing Specialist");
  });
});
