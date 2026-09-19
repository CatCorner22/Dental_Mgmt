import { describe, expect, it } from "vitest";
import { RESEND_AFTER_MS, worthSending } from "./round";

/**
 * The whole rule of Increment 1.62, checkable without reading a transaction.
 */

const now = new Date("2026-09-19T09:00:00.000Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe("whether a round sends", () => {
  it("sends where nobody has ever been told", () => {
    expect(worthSending("two things are waiting", null, now)).toBe(true);
  });

  it("sends where the message says something different", () => {
    // What a seat owes is a state, not a feed, so "different from what they
    // were last told" is the whole of what "new" means here.
    expect(worthSending("three things", { body: "two things", at: daysAgo(1) }, now)).toBe(true);
  });

  it("stays quiet where it would say exactly what it said yesterday", () => {
    // The same sentences every morning is noise, noise gets filtered, and a
    // filtered signal is not a signal.
    expect(worthSending("two things", { body: "two things", at: daysAgo(1) }, now)).toBe(false);
  });

  it("says it again once it has gone stale, so an ignored debt keeps knocking", () => {
    // Change alone would mean a debt nobody acts on is mentioned once and then
    // never again — and silence reads as "nothing owed", so the thing most in
    // need of attention would be the quietest thing on the list.
    expect(worthSending("two things", { body: "two things", at: daysAgo(6) }, now)).toBe(false);
    expect(worthSending("two things", { body: "two things", at: daysAgo(7) }, now)).toBe(true);
    expect(worthSending("two things", { body: "two things", at: daysAgo(30) }, now)).toBe(true);
  });

  it("treats the boundary as reached rather than passed", () => {
    const exactly = new Date(now.getTime() - RESEND_AFTER_MS);
    expect(worthSending("two things", { body: "two things", at: exactly }, now)).toBe(true);
    expect(worthSending("two things", { body: "two things", at: new Date(exactly.getTime() + 1) }, now)).toBe(false);
  });

  it("takes the caller's own interval where one is given", () => {
    const hour = 60 * 60 * 1000;
    expect(worthSending("two things", { body: "two things", at: daysAgo(1) }, now, hour)).toBe(true);
  });

  it("makes a second round a no-op, which is what lets the schedule be wrong", () => {
    // Idempotence falls out of the rule rather than out of a lock: early,
    // late, or doubled by two workers, nobody is told twice.
    const justSent = { body: "two things", at: now };
    expect(worthSending("two things", justSent, now)).toBe(false);
    expect(worthSending("two things", justSent, new Date(now.getTime() + 60_000))).toBe(false);
  });
});
