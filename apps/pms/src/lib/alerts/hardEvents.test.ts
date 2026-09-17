import { describe, expect, it } from "vitest";
import { afterHoursSentence, countByKind, isOutsideHours, localClock, newDeviceCandidates, type HardEvent, type WeekHours } from "./hardEvents";

const hours: WeekHours = { mon: ["07:00", "19:00"], tue: ["07:00", "19:00"], fri: ["07:00", "17:00"], sat: null, sun: null };

describe("localClock and isOutsideHours", () => {
  it("reads the weekday and wall clock in the location's timezone, from the server", () => {
    // 02:30 UTC on Wednesday the 16th is 21:30 on Tuesday the 15th in Chicago (CDT).
    expect(localClock(new Date("2026-09-16T02:30:00Z"), "America/Chicago")).toEqual({ weekday: "tue", hhmm: "21:30", date: "2026-09-15" });
    expect(localClock(new Date("2026-09-16T14:00:00Z"), "America/Chicago")).toEqual({ weekday: "wed", hhmm: "09:00", date: "2026-09-16" });
    expect(localClock(new Date("2026-09-19T15:00:00Z"), "America/New_York").weekday).toBe("sat");
  });

  it("is outside before opening, at or after closing, and all day when closed", () => {
    expect(isOutsideHours(hours, "tue", "21:30")).toEqual({ outside: true, window: ["07:00", "19:00"] });
    expect(isOutsideHours(hours, "tue", "06:59")).toMatchObject({ outside: true });
    expect(isOutsideHours(hours, "tue", "07:00")).toMatchObject({ outside: false });
    expect(isOutsideHours(hours, "tue", "18:59")).toMatchObject({ outside: false });
    expect(isOutsideHours(hours, "tue", "19:00")).toMatchObject({ outside: true });
    expect(isOutsideHours(hours, "fri", "17:30")).toMatchObject({ outside: true, window: ["07:00", "17:00"] });
    expect(isOutsideHours(hours, "sat", "10:00")).toEqual({ outside: true, window: null });
    expect(isOutsideHours({}, "mon", "10:00")).toEqual({ outside: true, window: null });
  });

  it("words the refund about the row, the place, and the clock", () => {
    expect(afterHoursSentence({ amountCents: 12_000, locationName: "Main", weekday: "tue", date: "2026-09-15", hhmm: "21:30", window: ["07:00", "19:00"] })).toBe(
      "A $120.00 refund was posted on Tuesday 2026-09-15 at 21:30 local time; Main is open 07:00 to 19:00 that day."
    );
    expect(afterHoursSentence({ amountCents: -500, locationName: "Main", weekday: "sat", date: "2026-09-19", hhmm: "10:00", window: null })).toMatch(
      /^A \$5\.00 refund was posted on Saturday 2026-09-19 at 10:00 local time; Main is closed that day\.$/
    );
  });
});

describe("newDeviceCandidates", () => {
  const since = new Date("2026-09-10T00:00:00Z");
  it("pages the first session from a signature the account has not presented, for holders of a critical duty only", () => {
    const rows = [
      { id: "s-old", userId: "u-owner", userAgent: "A", createdAt: new Date("2026-08-01T10:00:00Z") },
      { id: "s-same", userId: "u-owner", userAgent: "A", createdAt: new Date("2026-09-16T10:00:00Z") },
      { id: "s-new", userId: "u-owner", userAgent: "B", createdAt: new Date("2026-09-16T13:00:00Z") },
      { id: "s-front", userId: "u-front", userAgent: "B", createdAt: new Date("2026-09-16T14:00:00Z") },
      { id: "s-first", userId: "u-om", userAgent: "C", createdAt: new Date("2026-09-17T08:00:00Z") },
    ];
    const holders = new Set(["u-owner", "u-om"]);
    expect(newDeviceCandidates(rows, holders, since).map((r) => r.id)).toEqual(["s-new", "s-first"]);
    // Order in does not matter: the earliest session with a signature is the one that marks it seen.
    expect(newDeviceCandidates([...rows].reverse(), holders, since).map((r) => r.id)).toEqual(["s-new", "s-first"]);
  });
});

describe("countByKind", () => {
  it("counts every kind, zeros included", () => {
    const item = (kind: HardEvent["kind"]): HardEvent => ({ kind, label: kind, at: "2026-09-16T00:00:00Z", subjectKind: "x", subjectId: "1", sentence: "", href: null });
    expect(countByKind([item("deposit_variance"), item("deposit_variance"), item("chain_failure")])).toEqual({
      after_hours_refund: 0,
      retroactive_entry: 0,
      waived_dual_control: 0,
      deposit_variance: 2,
      chain_failure: 1,
      new_device_financial_role: 0,
    });
  });
});
