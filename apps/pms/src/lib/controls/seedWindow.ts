import { SEED_STORY_WEEK } from "@pms/db/seed-data";
import { BACKDATE_DAYS } from "./detectors";
import { daysBetween } from "./matchingMeasure";

/**
 * The rules that keep the seed's written story week usable, held in one place
 * so the gate can state them (Increment 1.85).
 *
 * Nothing here runs in a screen or a route. It exists because the seed dates
 * its demo rows with a literal while the clock keeps moving, so the fixture
 * goes stale on a day nobody chose — and when it does, the failure surfaces
 * through two owner-board assertions about retroactive entries, which name
 * neither the constant nor the arithmetic. `seedWindow.test.ts` runs these
 * rules against the real clock so the day arrives with its own sentence.
 */

/**
 * The money-desk suite banks its deposits this many days before the run
 * (`DEPOSIT_DAY` in `apps/pms/src/e2e/money-desk.e2e.test.ts`, which reads this
 * constant). A story week landing on that same day puts four deposits on a day
 * close the suite expects to hold two — the collision Increment 1.84 hit on its
 * first attempt, at a week anchored six days back rather than five.
 */
export const DEPOSIT_DAYS_AGO = 2;

export type StoryWeek = { effective: string; issued: string };

export type SeedWindow =
  /** Today is inside the window and clear of the deposit day. */
  | { state: "live"; daysBack: number; daysLeft: number; expiresOn: string }
  /** The gap has passed `BACKDATE_DAYS`, so every seeded row now reads as retroactive. */
  | { state: "expired"; daysBack: number; expiredOn: string }
  /** The week runs ahead of the clock, which no posted row may do. */
  | { state: "ahead"; daysAhead: number }
  /** The week is the money-desk suite's deposit day, so the day close holds four rows rather than two. */
  | { state: "collides"; daysBack: number };

/** YYYY-MM-DD, `days` days after `iso`, on the UTC clock `daysBetween` measures with. */
export function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Where today stands against a written story week. The order of the tests is
 * the order the failures matter in: a week ahead of the clock is wrong on every
 * day, an expired week is wrong from its expiry onward, and a collision is
 * wrong on exactly one day but breaks four cases when it lands.
 */
export function readSeedWindow(effective: string, today: string, backdateDays: number = BACKDATE_DAYS): SeedWindow {
  const daysBack = daysBetween(effective, today);
  if (daysBack < 0) return { state: "ahead", daysAhead: -daysBack };
  if (daysBack > backdateDays) {
    return { state: "expired", daysBack, expiredOn: addDaysIso(effective, backdateDays + 1) };
  }
  if (daysBack === DEPOSIT_DAYS_AGO) return { state: "collides", daysBack };
  return {
    state: "live",
    daysBack,
    daysLeft: backdateDays - daysBack,
    expiresOn: addDaysIso(effective, backdateDays + 1),
  };
}

/** The two ways forward Increment 1.84 recorded, quoted wherever the week fails. */
const WAYS_FORWARD = [
  "Two ways forward, as Increment 1.84 recorded:",
  "  1. Anchor the seeded dates to the seed run. This ends the drift for good and",
  "     moves every assertion that quotes them.",
  "  2. Move SEED_STORY_WEEK forward in packages/db/src/seed-data.ts. An effective",
  `     date may not run ahead of today and may not sit more than ${BACKDATE_DAYS} days back, so`,
  "     any written date buys at most seven days; it also may not sit exactly",
  `     ${DEPOSIT_DAYS_AGO} days back, which is the day the money-desk suite banks its deposits.`,
].join("\n");

/**
 * What is wrong with the story week today, or null when nothing is. The
 * sentence is the whole point of this module: it names the constant, the
 * arithmetic and the decision, so the day the fixture expires reads as a
 * message rather than as a mystery about why `main` went red overnight.
 */
export function seedWeekRefusal(week: StoryWeek, today: string, backdateDays: number = BACKDATE_DAYS): string | null {
  const w = readSeedWindow(week.effective, today, backdateDays);
  if (w.state === "ahead") {
    return [
      `The seed's story week runs ${w.daysAhead} day(s) ahead of the clock.`,
      "",
      `SEED_STORY_WEEK.effective is ${week.effective} and today is ${today}. A seeded`,
      "row may not be effective on a day that has not happened, so move the constant",
      "back to today or earlier.",
      "",
      WAYS_FORWARD,
    ].join("\n");
  }
  if (w.state === "expired") {
    return [
      `The seed's story week expired on ${w.expiredOn}.`,
      "",
      `SEED_STORY_WEEK.effective is ${week.effective} and today is ${today}, which is`,
      `${w.daysBack} days. BACKDATE_DAYS is ${backdateDays}, so every seeded ledger row now raises a`,
      "`retroactive_entry`, and the owner board and weekly digest cases that assert",
      "those rows raise nothing will fail too. This case fails first so that the",
      "reason is not left to be inferred from them.",
      "",
      WAYS_FORWARD,
    ].join("\n");
  }
  if (w.state === "collides") {
    return [
      "The seed's story week is today the money-desk suite's deposit day.",
      "",
      `SEED_STORY_WEEK.effective is ${week.effective} and today is ${today}, which is`,
      `${DEPOSIT_DAYS_AGO} days back — the offset money-desk.e2e.test.ts banks its two deposits at.`,
      "The seeded day close already holds two, so the sealed day holds four and the",
      "cases that pin the count fail.",
      "",
      WAYS_FORWARD,
    ].join("\n");
  }
  return issuedDayRefusal(week, today);
}

/**
 * The statement's as-of and issued day carries no backdating rule, and two
 * rules all the same: a statement may not be issued before the charges it
 * reports, nor on a day that has not happened.
 */
export function issuedDayRefusal(week: StoryWeek, today: string): string | null {
  if (daysBetween(week.effective, week.issued) < 0) {
    return [
      "The seed's statement is issued before the week it reports.",
      "",
      `SEED_STORY_WEEK.issued is ${week.issued} and SEED_STORY_WEEK.effective is`,
      `${week.effective}. Move the issued day to the effective day or later.`,
    ].join("\n");
  }
  if (daysBetween(week.issued, today) < 0) {
    return [
      "The seed's statement is issued on a day that has not happened.",
      "",
      `SEED_STORY_WEEK.issued is ${week.issued} and today is ${today}. Move the issued`,
      "day back to today or earlier.",
    ].join("\n");
  }
  return null;
}

/** Today on the UTC clock, which is the clock the server measures effective dates with. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The week the seed actually writes, so the gate reads the same constant the rows carry. */
export const SEEDED_STORY_WEEK: StoryWeek = SEED_STORY_WEEK;
