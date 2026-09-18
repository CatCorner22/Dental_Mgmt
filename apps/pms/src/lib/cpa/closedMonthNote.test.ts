import { describe, expect, it } from "vitest";
import { PRIOR_PERIOD_REASON } from "../ledger/reasons";
import { closedMonthNote } from "./closedMonthNote";

describe("closedMonthNote", () => {
  it("names who closed the month, the day, and what a fix now does", () => {
    const note = closedMonthNote({ month: "2026-08", closedAt: "2026-09-05T16:20:00.000Z", closedByName: "Riley Owner" });
    expect(note).toMatchObject({ month: "2026-08", closedByName: "Riley Owner" });
    expect(note.sentence).toBe(
      "2026-08 was closed by Riley Owner on 2026-09-05, so its figures are frozen and the accountant already has them. " +
        "A correction to this line now posts today with reason prior_period and is reported in the month it posts, not in this one."
    );
  });

  it("cites the reason code the closed-month refusal actually admits, rather than spelling it a second time", () => {
    // The database trigger admits exactly one reason into a closed month. A
    // sentence that named a different string would send the practice to a
    // refusal, so it reads the constant the refusal is enforced from.
    expect(closedMonthNote({ month: "2026-01", closedAt: "2026-02-02T09:00:00.000Z", closedByName: "Dana Lee" }).sentence).toContain(
      `reason ${PRIOR_PERIOD_REASON}`
    );
  });

  it("keeps the timestamp it was given while showing only the day", () => {
    // The thread orders by timestamp and the sentence reads as a date; both
    // come from one value so they can never disagree about which day it was.
    const note = closedMonthNote({ month: "2026-08", closedAt: "2026-09-05T23:59:59.000Z", closedByName: "Riley Owner" });
    expect(note.closedAt).toBe("2026-09-05T23:59:59.000Z");
    expect(note.sentence).toContain("on 2026-09-05,");
  });
});
