import { describe, expect, it } from "vitest";
import { uuidv7 } from "./ids";

/**
 * That an id orders inside a millisecond, and not only across them.
 *
 * The rule under test is the one `notice_sends` found the hard way: a failed
 * attempt and the success that followed it can land in one millisecond, and
 * every read that asks for "the last one" falls back to the id to break the
 * tie. An id that is random inside its millisecond makes that tiebreak a coin
 * toss, which is the thing this codebase refuses everywhere else.
 */

describe("uuidv7", () => {
  it("carries the millisecond it was given, and the version and variant RFC 9562 names", () => {
    const id = uuidv7(0x0123456789ab);
    expect(id.slice(0, 13).replace("-", "")).toBe("0123456789ab");
    expect(id[14]).toBe("7");
    expect("89ab").toContain(id[19]);
  });

  it("orders consecutive ids minted inside one millisecond", () => {
    // 1,000 rather than a handful: the counter is seeded randomly, so a short
    // run could pass by luck under an implementation that reseeds every call.
    const ids = Array.from({ length: 1_000 }, () => uuidv7(1_700_000_000_000));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("orders ids across milliseconds whatever the counter is doing", () => {
    const first = uuidv7(1_700_000_000_000);
    const second = uuidv7(1_700_000_000_001);
    expect(first < second).toBe(true);
  });

  it("puts an id carrying an earlier millisecond back in that earlier range", () => {
    // A caller may stamp a historical moment. The id belongs where the moment
    // does, so stepping back reseeds rather than continuing to count up.
    const later = uuidv7(1_700_000_000_500);
    const earlier = uuidv7(1_700_000_000_400);
    expect(earlier < later).toBe(true);
  });

  it("still fills the rest with randomness, so an id is not a guess away", () => {
    const a = uuidv7(1_700_000_001_000);
    const b = uuidv7(1_700_000_001_000);
    // Same millisecond and consecutive counters, yet the last 62 bits differ.
    expect(a.slice(19)).not.toBe(b.slice(19));
  });
});
