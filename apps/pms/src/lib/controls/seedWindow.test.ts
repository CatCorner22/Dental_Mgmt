import { describe, expect, it } from "vitest";
import { BACKDATE_DAYS } from "./detectors";
import { DEMO_AS_OF_DATE, DEMO_EFFECTIVE_DATE } from "../demo/dates";
import {
  DEPOSIT_DAYS_AGO,
  SEEDED_STORY_WEEK,
  addDaysIso,
  issuedDayRefusal,
  readSeedWindow,
  seedWeekRefusal,
  todayIso,
} from "./seedWindow";

const WEEK = { effective: "2026-09-19", issued: "2026-09-21" };

describe("readSeedWindow", () => {
  it("calls a week inside the window live, and says how much of it is left", () => {
    const w = readSeedWindow("2026-09-19", "2026-09-22");
    expect(w).toEqual({ state: "live", daysBack: 3, daysLeft: 4, expiresOn: "2026-09-27" });
  });

  it("keeps the last day of the window live, with nothing left", () => {
    const w = readSeedWindow("2026-09-19", "2026-09-26");
    expect(w).toEqual({ state: "live", daysBack: BACKDATE_DAYS, daysLeft: 0, expiresOn: "2026-09-27" });
  });

  it("calls the next day expired, and names it as the day of expiry", () => {
    const w = readSeedWindow("2026-09-19", "2026-09-27");
    expect(w).toEqual({ state: "expired", daysBack: 8, expiredOn: "2026-09-27" });
  });

  it("calls a week ahead of the clock ahead, whatever the window would say", () => {
    expect(readSeedWindow("2026-09-19", "2026-09-18")).toEqual({ state: "ahead", daysAhead: 1 });
  });

  it("calls the money-desk deposit day a collision rather than a live day", () => {
    expect(readSeedWindow("2026-09-19", "2026-09-21")).toEqual({ state: "collides", daysBack: DEPOSIT_DAYS_AGO });
  });

  it("measures the window against the backdate rule it is handed", () => {
    expect(readSeedWindow("2026-09-19", "2026-09-23", 3).state).toBe("expired");
    expect(readSeedWindow("2026-09-19", "2026-09-23", 30).state).toBe("live");
  });
});

describe("addDaysIso", () => {
  it("crosses a month boundary on the UTC clock", () => {
    expect(addDaysIso("2026-09-28", 5)).toBe("2026-10-03");
    expect(addDaysIso("2026-10-03", -5)).toBe("2026-09-28");
  });
});

describe("seedWeekRefusal", () => {
  it("says nothing while the week is live", () => {
    expect(seedWeekRefusal(WEEK, "2026-09-22")).toBeNull();
  });

  it("names the constant, the arithmetic and the two ways forward once the week expires", () => {
    const said = seedWeekRefusal(WEEK, "2026-09-28") ?? "";
    expect(said).toContain("expired on 2026-09-27");
    expect(said).toContain("SEED_STORY_WEEK.effective is 2026-09-19");
    expect(said).toContain("today is 2026-09-28, which is");
    expect(said).toContain(`BACKDATE_DAYS is ${BACKDATE_DAYS}`);
    expect(said).toContain("Anchor the seeded dates to the seed run");
    expect(said).toContain("packages/db/src/seed-data.ts");
  });

  it("says why the owner board is about to fail, rather than leaving it to be inferred", () => {
    const said = seedWeekRefusal(WEEK, "2026-09-28") ?? "";
    expect(said).toContain("retroactive_entry");
    expect(said).toContain("owner board and weekly digest");
  });

  it("names the deposit collision on the one day it lands", () => {
    const said = seedWeekRefusal(WEEK, "2026-09-21") ?? "";
    expect(said).toContain("money-desk suite's deposit day");
    expect(said).toContain("holds four");
  });

  it("refuses a week that runs ahead of the clock", () => {
    const said = seedWeekRefusal(WEEK, "2026-09-18") ?? "";
    expect(said).toContain("ahead of the clock");
    expect(said).toContain("may not be effective on a day that has not happened");
  });
});

describe("issuedDayRefusal", () => {
  it("says nothing when the statement is issued inside the week and behind the clock", () => {
    expect(issuedDayRefusal(WEEK, "2026-09-22")).toBeNull();
  });

  it("refuses a statement issued before the charges it reports", () => {
    const said = issuedDayRefusal({ effective: "2026-09-19", issued: "2026-09-18" }, "2026-09-22") ?? "";
    expect(said).toContain("issued before the week it reports");
  });

  it("refuses a statement issued on a day that has not happened", () => {
    const said = issuedDayRefusal({ effective: "2026-09-19", issued: "2026-09-25" }, "2026-09-22") ?? "";
    expect(said).toContain("a day that has not happened");
  });
});

/**
 * The gate itself (Increment 1.85). Every case above is a fixture with its own
 * `today`; this one reads the constant the seed writes and the clock the run
 * happens on, so it is the case that fails on the day the story week expires —
 * and the sentence it fails with is the whole of its value.
 */
describe("the seed's story week, against today", () => {
  it("is still a week the seeded rows can be dated in", () => {
    expect(seedWeekRefusal(SEEDED_STORY_WEEK, todayIso())).toBeNull();
  });

  it("is the week the three demonstration forms offer", () => {
    expect(DEMO_EFFECTIVE_DATE).toBe(SEEDED_STORY_WEEK.effective);
    expect(DEMO_AS_OF_DATE).toBe(SEEDED_STORY_WEEK.issued);
  });
});
