import { describe, expect, it } from "vitest";
import { ladderStageForEscape, LADDER_WINDOW_MS } from "./ladder";

describe("escape ladder — warn, reset, perma within one hour", () => {
  const now = Date.parse("2026-08-04T12:00:00.000Z");

  it("first model escape in the window warns", () => {
    expect(ladderStageForEscape([], now)).toBe("warn");
  });

  it("second escape after warn resets", () => {
    const prior = [{ atMs: now - 5 * 60_000, stage: "warn" as const }];
    expect(ladderStageForEscape(prior, now)).toBe("reset");
  });

  it("third escape within an hour of warn permanently kills", () => {
    const prior = [
      { atMs: now - 10 * 60_000, stage: "reset" as const },
      { atMs: now - 20 * 60_000, stage: "warn" as const }
    ];
    expect(ladderStageForEscape(prior, now)).toBe("perma-kill");
  });

  it("after the window expires, the ladder starts fresh at warn", () => {
    const prior = [{ atMs: now - LADDER_WINDOW_MS - 1000, stage: "warn" as const }];
    expect(ladderStageForEscape(prior, now)).toBe("warn");
  });
});
