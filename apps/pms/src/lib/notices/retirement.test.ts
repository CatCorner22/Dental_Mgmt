import { describe, expect, it } from "vitest";
import { ASK_AGAIN_EVERY_MS, RETIRE_ASKS, afterLapse, readCodesFrom } from "./retirement";
import { REPROVE_WINDOW_MS } from "./proof";

/**
 * What becomes of an address nobody re-proves (Increment 1.68).
 *
 * The rule under test is the one Increment 1.65 left open: after a proof
 * lapsed, the round stopped asking forever, and the only thing that would have
 * told the person to fetch a code was the notices being withheld. Everything
 * here is arithmetic over the append-only sends, which is why it is testable
 * without a database and why no column records any of it.
 */

const lapsedAt = "2026-03-01T00:00:00.000Z";
const lapsed = new Date(lapsedAt).getTime();
const day = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(lapsed + ms);

describe("a lapse nobody answers", () => {
  it("asks at once when not one code has gone out", () => {
    // Increment 1.65 owed a code inside the reprove window and none went. The
    // person is already past the point where a warning would have helped, so
    // the next ask is owed now rather than a month from now.
    const now = at(5 * day);
    const state = afterLapse(lapsedAt, [], now);
    expect(state.retired).toBe(false);
    if (state.retired) throw new Error("unreachable");
    expect(state.asked).toBe(0);
    expect(state.askDue).toBe(now.toISOString());
  });

  it("counts from the last code sent, so the window's ask and the ones after it are one cadence", () => {
    // The code Increment 1.65 sent ten days before the lapse is the last one
    // this person received. Asking again the moment the proof lapses would be
    // a second code inside a fortnight, which is the product talking to itself.
    const beforeTheLapse = new Date(lapsed - 10 * day);
    const state = afterLapse(lapsedAt, [beforeTheLapse], at(1 * day));
    expect(state.retired).toBe(false);
    if (state.retired) throw new Error("unreachable");
    // Nothing has gone out *since* the lapse, so none of the allowance is spent.
    expect(state.asked).toBe(0);
    expect(state.askDue).toBe(new Date(beforeTheLapse.getTime() + ASK_AGAIN_EVERY_MS).toISOString());
  });

  it("spaces the asks a month apart and spends the allowance one at a time", () => {
    const first = at(0);
    expect(afterLapse(lapsedAt, [first], at(29 * day))).toMatchObject({
      retired: false,
      asked: 1,
      askDue: new Date(first.getTime() + ASK_AGAIN_EVERY_MS).toISOString(),
    });
    const second = at(30 * day);
    expect(afterLapse(lapsedAt, [first, second], at(31 * day))).toMatchObject({ retired: false, asked: 2 });
  });

  it("stops asking once the allowance is spent, and says when it lets go", () => {
    // The third code still has its month: a code answered on its twenty-ninth
    // day is answered, so the address is let go when that month runs out rather
    // than the instant the last code leaves.
    const asks = [at(0), at(30 * day), at(60 * day)];
    const state = afterLapse(lapsedAt, asks, at(75 * day));
    expect(state.retired).toBe(false);
    if (state.retired) throw new Error("unreachable");
    expect(state.asked).toBe(RETIRE_ASKS);
    expect(state.askDue).toBeNull();
    expect(state.retiresAt).toBe(at(90 * day).toISOString());
  });

  it("retires the address when the last code's month runs out", () => {
    const asks = [at(0), at(30 * day), at(60 * day)];
    const state = afterLapse(lapsedAt, asks, at(90 * day));
    expect(state.retired).toBe(true);
    if (!state.retired) throw new Error("unreachable");
    expect(state.asked).toBe(RETIRE_ASKS);
    expect(state.retiredAt).toBe(at(90 * day).toISOString());
  });

  it("names a retirement date that does not move while the practice keeps asking", () => {
    // The date is the answer to "when does this stop", so a reader who checks
    // twice should not be told two different things for the same history.
    const asks = [at(0), at(30 * day), at(60 * day)];
    const early = afterLapse(lapsedAt, asks, at(61 * day));
    const late = afterLapse(lapsedAt, asks, at(89 * day));
    expect(early.retired).toBe(false);
    expect(late.retired).toBe(false);
    if (early.retired || late.retired) throw new Error("unreachable");
    expect(early.retiresAt).toBe(late.retiresAt);
  });

  it("projects the same end date from the first ask as from the last", () => {
    // Three asks a month apart, then a month to answer the last: the date a
    // reader is given on day one is the date it actually happens.
    const first = at(0);
    const projected = afterLapse(lapsedAt, [first], at(1 * day));
    if (projected.retired) throw new Error("unreachable");
    const asks = [first, at(30 * day), at(60 * day)];
    const actual = afterLapse(lapsedAt, asks, at(90 * day));
    if (!actual.retired) throw new Error("unreachable");
    expect(projected.retiresAt).toBe(actual.retiredAt);
  });

  it("does not care what order the sends arrive in", () => {
    // The caller reads rows; a read is not a promise about order, and a rule
    // that quietly depended on one would be a coin toss wearing an assertion.
    const asks = [at(60 * day), at(0), at(30 * day)];
    expect(afterLapse(lapsedAt, asks, at(90 * day))).toEqual(
      afterLapse(lapsedAt, [at(0), at(30 * day), at(60 * day)], at(90 * day))
    );
  });

  it("reads the sends from the reprove window, not from the lapse", () => {
    // The code sent inside Increment 1.65's window sets the cadence, so a read
    // starting at the lapse would miss it and ask again too soon.
    expect(readCodesFrom(lapsedAt).toISOString()).toBe(new Date(lapsed - REPROVE_WINDOW_MS).toISOString());
  });
});
