import { describe, expect, it } from "vitest";
import { changedDays, isHHMM, validateWeekHours, windowPhrase, type WeekHoursComplete } from "./hours";

const week: WeekHoursComplete = {
  sun: null,
  mon: ["07:00", "19:00"],
  tue: ["07:00", "19:00"],
  wed: ["07:00", "19:00"],
  thu: ["07:00", "19:00"],
  fri: ["07:00", "17:00"],
  sat: null,
};

describe("validateWeekHours (Increment 1.32)", () => {
  it("accepts a complete week and returns it in week order", () => {
    const r = validateWeekHours({ ...week });
    expect(r).toEqual({ ok: true, hours: week });
    if (r.ok) expect(Object.keys(r.hours)).toEqual(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
  });

  it("refuses a missing day, an unknown key, a malformed time, and a window that closes before it opens", () => {
    const { sun: _sun, ...noSunday } = week;
    expect(validateWeekHours(noSunday)).toEqual({ ok: false, errors: ["Sunday is missing; give a window or mark it closed."] });
    expect(validateWeekHours({ ...week, funday: null })).toEqual({ ok: false, errors: ['Unknown weekday "funday".'] });
    expect(validateWeekHours({ ...week, mon: ["7:00", "19:00"] })).toEqual({
      ok: false,
      errors: ["Monday must be an opening and a closing time as HH:MM on a 24-hour clock, or closed."],
    });
    expect(validateWeekHours({ ...week, fri: ["18:00", "17:00"] })).toEqual({
      ok: false,
      errors: ["Friday must open before it closes (18:00 to 17:00)."],
    });
    expect(validateWeekHours(null)).toEqual({ ok: false, errors: ["Hours must be an object with one entry per weekday."] });
    expect(validateWeekHours([])).toEqual({ ok: false, errors: ["Hours must be an object with one entry per weekday."] });
  });

  it("knows a 24-hour clock", () => {
    expect(isHHMM("00:00")).toBe(true);
    expect(isHHMM("23:59")).toBe(true);
    expect(isHHMM("24:00")).toBe(false);
    expect(isHHMM("7:00")).toBe(false);
    expect(isHHMM("07:60")).toBe(false);
  });

  it("phrases a window and lists the days that changed", () => {
    expect(windowPhrase(["07:00", "17:00"])).toBe("07:00 to 17:00");
    expect(windowPhrase(null)).toBe("closed");
    expect(changedDays(week, { ...week, fri: ["07:00", "18:00"], sat: ["08:00", "12:00"] })).toEqual(["fri", "sat"]);
    expect(changedDays(week, week)).toEqual([]);
    expect(changedDays({}, { sun: null })).toEqual([]);
  });
});
