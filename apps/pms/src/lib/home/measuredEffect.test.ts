import { describe, expect, it } from "vitest";
import { measuredEffectSentence } from "./measuredEffect";

describe("measuredEffectSentence", () => {
  it("reads the counts back practice-wide, pluralised, and labelled directional", () => {
    expect(
      measuredEffectSentence({
        since: "2026-06-01",
        postings: 14,
        guardedWithSecond: 2,
        guardedWithoutSecond: 0,
        runsCleared: 3,
        runsOwnerOnly: 1,
        findingsOpened: 2,
        findingsClosed: 1,
      })
    ).toBe(
      "Since this decision on 2026-06-01: 14 postings; 2 guarded releases with a second approver and 0 without; 3 bank runs cleared, 1 owner-only; 2 detector findings opened, 1 closed. Directional and practice-wide; no one is named."
    );
    expect(
      measuredEffectSentence({
        since: "2026-09-17",
        postings: 1,
        guardedWithSecond: 1,
        guardedWithoutSecond: 0,
        runsCleared: 1,
        runsOwnerOnly: 0,
        findingsOpened: 1,
        findingsClosed: 0,
      })
    ).toMatch(/^Since this decision on 2026-09-17: 1 posting; 1 guarded release with a second approver and 0 without; 1 bank run cleared, 0 owner-only; 1 detector finding opened, 0 closed\./);
  });
});
