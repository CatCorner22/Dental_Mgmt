import { describe, expect, it } from "vitest";
import { staffToPeople, tenureYearsFrom } from "./people";

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
    expect(people[0]?.active).toBe(true);
    expect(people[0]?.tenureYears).toBe(3);
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

  it("keeps the active flag and derives tenure from the row's creation date", () => {
    const now = new Date("2026-09-16T00:00:00Z");
    const people = staffToPeople(
      [
        {
          id: "u3",
          displayName: "Nora Newhire",
          role: "user",
          clinicalRole: "unset",
          entitlements: [],
          active: false,
          createdAt: new Date("2024-03-16T00:00:00Z"),
        },
      ],
      now
    );
    expect(people[0]?.active).toBe(false);
    expect(people[0]?.tenureYears).toBe(2.5);
    expect(tenureYearsFrom(new Date("2026-09-17T00:00:00Z"), now)).toBe(0);
    expect(tenureYearsFrom(null, now)).toBe(3);
  });
});
