import { describe, expect, it } from "vitest";
import { AFTER_CLOSE_WINDOW_DAYS, afterCloseCard, type AfterCloseCount } from "./afterClose";

const none: AfterCloseCount = { rows: 0, netCents: 0, daysTouched: 0, firstPostings: 0 };

function count(over: Partial<AfterCloseCount>): AfterCloseCount {
  return { ...none, ...over };
}

describe("the after-close card", () => {
  it("says the quiet state out loud rather than hiding it", () => {
    // An owner who never sees the card cannot tell clean from broken.
    const card = afterCloseCard({ yesterday: none, window: none });
    expect(card.headline).toBe("Nothing posted into a sealed day");
    expect(card.why).toMatch(/last 30 days/);
    expect(card.why).toMatch(/still reads as the practice counted it/);
    expect(card.action).toBeNull();
    expect(card.windowDays).toBe(AFTER_CLOSE_WINDOW_DAYS);
  });

  it("leads with yesterday when yesterday moved, and still gives the window", () => {
    const card = afterCloseCard({
      yesterday: count({ rows: 3, netCents: 1_000, daysTouched: 1, firstPostings: 1 }),
      window: count({ rows: 9, netCents: -4_000, daysTouched: 4, firstPostings: 5 }),
    });
    expect(card.headline).toBe("Yesterday changed after close: 3 rows");
    expect(card.why).toMatch(/3 rows posted into yesterday's sealed day/);
    expect(card.why).toMatch(/one a first posting, the rest corrections/);
    expect(card.why).toMatch(/The sealed figures do not move/);
    // The window is the question a single clean day cannot answer.
    expect(card.why).toMatch(/last 30 days, 9 rows across 4 sealed days/);
    expect(card.action).toEqual({ label: "Open the sealed day", href: "/day-close" });
  });

  it("names more than one sealed day yesterday, because locations seal apart", () => {
    const card = afterCloseCard({
      yesterday: count({ rows: 2, netCents: 500, daysTouched: 2, firstPostings: 0 }),
      window: count({ rows: 2, netCents: 500, daysTouched: 2, firstPostings: 0 }),
    });
    expect(card.why).toMatch(/yesterday's sealed days \(2\)/);
    expect(card.why).toMatch(/all of them corrections/);
  });

  it("falls back to the window where yesterday's seals hold", () => {
    const card = afterCloseCard({
      yesterday: none,
      window: count({ rows: 1, netCents: 2_500, daysTouched: 1, firstPostings: 1 }),
    });
    expect(card.headline).toBe("Postings into closed days: 1 row");
    expect(card.why).toMatch(/^Yesterday's seals hold\./);
    expect(card.why).toMatch(/1 row landed behind a seal across 1 sealed day \u2014 a first posting\./);
    // The distinction is the point of counting the two apart.
    expect(card.why).toMatch(/a first posting names nothing/);
    expect(card.action).toEqual({ label: "Open the day close", href: "/day-close" });
  });

  it("says so plainly where every row is a first posting, the worst shape of all", () => {
    const card = afterCloseCard({
      yesterday: none,
      window: count({ rows: 4, netCents: 12_000, daysTouched: 3, firstPostings: 4 }),
    });
    expect(card.why).toMatch(/4 rows landed behind a seal across 3 sealed days \u2014 all of them first postings\./);
  });

  it("reads a lone correction as one, not as plural", () => {
    const card = afterCloseCard({
      yesterday: none,
      window: count({ rows: 1, netCents: -100, daysTouched: 1, firstPostings: 0 }),
    });
    expect(card.why).toMatch(/all of it a correction/);
  });

  it("takes a window other than the default", () => {
    const card = afterCloseCard({ yesterday: none, window: none }, 7);
    expect(card.windowDays).toBe(7);
    expect(card.why).toMatch(/last 7 days/);
  });
});
