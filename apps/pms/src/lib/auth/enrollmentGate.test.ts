import { describe, expect, it } from "vitest";
import {
  enrollmentGateAllows,
  readEnrollmentFinish,
  readEnrollmentStart,
  SESSION_ENDED,
} from "./enrollmentGate";

describe("enrollmentGateAllows", () => {
  it("admits the enrolment screen and the route behind it", () => {
    expect(enrollmentGateAllows("/enroll-mfa")).toBe(true);
    expect(enrollmentGateAllows("/api/enroll-mfa")).toBe(true);
  });

  it("admits NextAuth's own endpoints, which is what lets a session be ended", () => {
    // Without these the screen could neither fetch a CSRF token nor sign
    // anybody out, so the one exit it offers would not work.
    expect(enrollmentGateAllows("/api/auth/csrf")).toBe(true);
    expect(enrollmentGateAllows("/api/auth/signout")).toBe(true);
  });

  it("admits the sign-in page, because a gate may not hold the door shut", () => {
    // Increment 1.80, and the whole of this increment's rule. The claim the
    // middleware reads is minted at sign-in and never rewritten, so it outlives
    // the enrolment that answered it; a gate that also refused `/signin` turned
    // that stale claim into a screen with no way off it.
    expect(enrollmentGateAllows("/signin")).toBe(true);
  });

  it("refuses the application itself, which is the whole point of the gate", () => {
    for (const path of ["/home", "/risk", "/cpa", "/ledger", "/api/controls/ranks"]) {
      expect(enrollmentGateAllows(path)).toBe(false);
    }
  });

  it("matches the two screens exactly rather than by prefix", () => {
    // A prefix test would admit any path somebody later hung off these names,
    // and the gate would open on a spelling rather than on a decision.
    expect(enrollmentGateAllows("/enroll-mfa-archive")).toBe(false);
    expect(enrollmentGateAllows("/signin-as")).toBe(false);
    expect(enrollmentGateAllows("/enroll-mfa/anything")).toBe(false);
  });
});

describe("readEnrollmentStart", () => {
  it("reads a first pairing", () => {
    const read = readEnrollmentStart(200, { ok: true, otpauthUri: "otpauth://totp/x", repairing: false });
    expect(read).toEqual({ state: "ready", otpauthUri: "otpauth://totp/x", repairing: false });
  });

  it("reads a re-pairing, which is a different screen in the same place", () => {
    const read = readEnrollmentStart(200, { ok: true, otpauthUri: "otpauth://totp/x", repairing: true });
    expect(read).toEqual({ state: "ready", otpauthUri: "otpauth://totp/x", repairing: true });
  });

  it("reads 401 as a session that is gone, not as an error beside the field", () => {
    // The reading this increment exists for. `requireAccess` answers 401 both
    // for a session that was revoked and for no session at all, and neither
    // leaves anything on this screen that could work.
    const read = readEnrollmentStart(401, { error: "This session was ended. Sign in again." });
    expect(read).toEqual({ state: "ended", why: SESSION_ENDED });
  });

  it("carries the route's own words for every other failure", () => {
    expect(readEnrollmentStart(503, { error: "Authorization store is not configured." })).toEqual({
      state: "failed",
      why: "Authorization store is not configured.",
    });
  });

  it("falls back to its own words when the route said nothing usable", () => {
    expect(readEnrollmentStart(500, {})).toEqual({ state: "failed", why: "Could not start enrollment." });
    expect(readEnrollmentStart(500, { error: "   " })).toEqual({
      state: "failed",
      why: "Could not start enrollment.",
    });
  });

  it("refuses a success that carries no setup URI", () => {
    // The secret is the only thing this screen exists to hand over. A 200 with
    // nothing in it would otherwise render an empty code block and an enabled
    // button, which is a screen that cannot succeed and does not say so.
    expect(readEnrollmentStart(200, { ok: true })).toEqual({
      state: "failed",
      why: "Could not start enrollment.",
    });
  });
});

describe("readEnrollmentFinish", () => {
  it("reads a finished enrolment, and takes the session's fate from the route", () => {
    const read = readEnrollmentFinish(200, {
      ok: true,
      recoveryCodes: ["aaa", "bbb"],
      repaired: false,
      signOut: true,
    });
    expect(read).toEqual({
      state: "done",
      recoveryCodes: ["aaa", "bbb"],
      repaired: false,
      endSession: true,
    });
  });

  it("does not end the session on its own account", () => {
    // Strict rather than defaulted: the route is the one place that revokes the
    // rows, so the route is the one place that decides the cookie goes too.
    const read = readEnrollmentFinish(200, { ok: true, recoveryCodes: ["aaa"], repaired: true });
    expect(read).toEqual({
      state: "done",
      recoveryCodes: ["aaa"],
      repaired: true,
      endSession: false,
    });
  });

  it("keeps only the codes it can print", () => {
    const read = readEnrollmentFinish(200, { ok: true, recoveryCodes: ["aaa", 7, null, "bbb"] });
    expect(read).toMatchObject({ state: "done", recoveryCodes: ["aaa", "bbb"] });
  });

  it("reads a session that ended mid-form the same way the other route does", () => {
    // One sentence for one state, whichever route reported it.
    expect(readEnrollmentFinish(401, { error: "This session was ended. Sign in again." })).toEqual({
      state: "ended",
      why: SESSION_ENDED,
    });
  });

  it("keeps a wrong code beside the field", () => {
    // A person who mistyped six digits is still on a screen that works, and
    // must not be told their sign-in ended.
    expect(readEnrollmentFinish(400, { ok: false, error: "Could not verify the authenticator code." })).toEqual({
      state: "failed",
      why: "Could not verify the authenticator code.",
    });
  });

  it("falls back to its own words when the route said nothing usable", () => {
    expect(readEnrollmentFinish(400, {})).toEqual({ state: "failed", why: "Could not verify the code." });
  });
});
