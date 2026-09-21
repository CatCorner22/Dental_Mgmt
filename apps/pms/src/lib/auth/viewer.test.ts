import { describe, expect, it } from "vitest";
import {
  readViewer,
  SESSION_ENDED_WHY,
  signInHref,
} from "./viewer";

describe("readViewer", () => {
  it("reads a seat", () => {
    expect(
      readViewer(200, {
        ok: true,
        username: "ridgeview-owner",
        displayName: "Riley Owner",
        role: "admin",
        entitlements: ["approve_writeoffs"],
      })
    ).toEqual({
      state: "present",
      username: "ridgeview-owner",
      displayName: "Riley Owner",
      role: "admin",
      entitlements: ["approve_writeoffs"],
    });
  });

  it("reads a revoked session as ended", () => {
    expect(readViewer(401, { error: "This session was ended. Sign in again." })).toEqual({
      state: "ended",
      why: SESSION_ENDED_WHY,
    });
  });

  it("reads a session that timed out the same way", () => {
    // One sentence for every way a sign-in ends, because a person cannot act
    // on the difference between the two and both want the same next step.
    expect(readViewer(401, { error: "This session timed out. Sign in again." })).toEqual({
      state: "ended",
      why: SESSION_ENDED_WHY,
    });
  });

  it("reads no session at all the same way", () => {
    expect(readViewer(401, { error: "Not signed in." })).toEqual({
      state: "ended",
      why: SESSION_ENDED_WHY,
    });
  });

  it("never reads a 403 as a sign-in that ended", () => {
    // The line this increment draws. `/api/me` opens at the lowest rank the
    // product has, so a 403 there is a fact about the account and not about
    // the sign-in, and the reader is told the route's own words.
    expect(readViewer(403, { error: "This account is not active." })).toEqual({
      state: "unknown",
      why: "This account is not active.",
    });
  });

  it("keeps only the entitlements it can use", () => {
    expect(readViewer(200, { ok: true, role: "user", entitlements: ["post_payments", 7, null] })).toMatchObject({
      state: "present",
      entitlements: ["post_payments"],
    });
    expect(readViewer(200, { ok: true, role: "user" })).toMatchObject({ entitlements: [] });
  });

  it("refuses a success that names no seat", () => {
    // A screen that took this for a seat would render the read-only view, so a
    // person who had been an administrator a moment earlier would watch their
    // controls disappear with nothing said — which is what Practice Risk and
    // Reason codes did before Increment 1.81.
    expect(readViewer(200, { ok: true })).toEqual({
      state: "unknown",
      why: "Could not read who is signed in.",
    });
  });

  it("refuses a 200 that does not say ok", () => {
    expect(readViewer(200, { role: "admin" })).toEqual({
      state: "unknown",
      why: "Could not read who is signed in.",
    });
  });

  it("carries the route's own words for any other failure, and falls back when it said nothing", () => {
    expect(readViewer(503, { error: "Authorization ports are not configured." })).toEqual({
      state: "unknown",
      why: "Authorization ports are not configured.",
    });
    expect(readViewer(500, {})).toEqual({ state: "unknown", why: "Could not read who is signed in." });
    expect(readViewer(500, null)).toEqual({ state: "unknown", why: "Could not read who is signed in." });
  });
});

describe("signInHref", () => {
  it("carries the screen the reader was on", () => {
    expect(signInHref("/risk")).toBe(`/signin?callbackUrl=${encodeURIComponent("/risk")}`);
  });

  it("keeps a query the screen was reading", () => {
    expect(signInHref("/digest?ending=2026-09-01")).toBe(
      `/signin?callbackUrl=${encodeURIComponent("/digest?ending=2026-09-01")}`
    );
  });

  it("sends a reader it cannot place to the practice home", () => {
    // The same guard the sign-in page applies to the parameter it receives, so
    // a path this cannot vouch for lands somewhere the product chose.
    for (const raw of [null, undefined, "", "//elsewhere.example/x", "not-a-path"]) {
      expect(signInHref(raw)).toBe(`/signin?callbackUrl=${encodeURIComponent("/home")}`);
    }
  });

  it("sends the root to the practice home rather than to itself", () => {
    expect(signInHref("/")).toBe(`/signin?callbackUrl=${encodeURIComponent("/home")}`);
  });
});
