import { afterEach, describe, expect, it, vi } from "vitest";
import { getGuarded, isSignInEnded, refuseIfSignInEnded, SignInEnded } from "./guardedFetch";

function answers(status: number, body: unknown, parses = true): void {
  vi.stubGlobal("fetch", async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (!parses) throw new SyntaxError("not json");
      return body;
    },
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getGuarded", () => {
  it("returns what the route answered", async () => {
    answers(200, { items: [1, 2] });
    await expect(getGuarded<{ items: number[] }>("/api/ledger/accounts")).resolves.toEqual({ items: [1, 2] });
  });

  it("raises a sign-in that ended on a 401", async () => {
    // The whole of this module's reason to exist. Every screen used to turn
    // this into `new Error("This session timed out. Sign in again.")` and show
    // it as a paragraph with nothing to press (Increment 1.82).
    answers(401, { error: "This session timed out. Sign in again." });
    await expect(getGuarded("/api/ledger/accounts")).rejects.toBeInstanceOf(SignInEnded);
  });

  it("classifies on the status, not on the sentence", async () => {
    // `requireAccess` has four sentences for a 401 and may gain a fifth. A
    // screen that matched words would tie itself to strings it does not own.
    for (const said of [
      "This session was ended. Sign in again.",
      "This session has expired. Sign in again.",
      "Not signed in.",
      "",
    ]) {
      answers(401, said ? { error: said } : {});
      await expect(getGuarded("/api/me")).rejects.toBeInstanceOf(SignInEnded);
    }
  });

  it("leaves a refusal about the seat exactly where it was", async () => {
    answers(403, { error: "You do not have access to this action." });
    await expect(getGuarded("/api/controls/ranks")).rejects.toThrow("You do not have access to this action.");
    answers(403, { error: "You do not have access to this action." });
    await expect(getGuarded("/api/controls/ranks")).rejects.not.toBeInstanceOf(SignInEnded);
  });

  it("uses the caller's words when the route gave none", async () => {
    answers(500, {});
    await expect(getGuarded("/api/x", "Could not load accounts.")).rejects.toThrow("Could not load accounts.");
  });

  it("names the route when nobody gave any words", async () => {
    answers(500, {});
    await expect(getGuarded("/api/x")).rejects.toThrow("Could not load /api/x.");
  });

  it("reads the status even when the body is not JSON", async () => {
    answers(401, null, false);
    await expect(getGuarded("/api/x")).rejects.toBeInstanceOf(SignInEnded);
    answers(502, null, false);
    await expect(getGuarded("/api/x", "Could not load the run.")).rejects.toThrow("Could not load the run.");
  });
});

describe("refuseIfSignInEnded", () => {
  it("raises on a 401 and says nothing otherwise", () => {
    expect(() => refuseIfSignInEnded({ status: 401 })).toThrow(SignInEnded);
    for (const status of [200, 201, 400, 403, 409, 500]) {
      expect(() => refuseIfSignInEnded({ status })).not.toThrow();
    }
  });
});

describe("isSignInEnded", () => {
  it("tells the two kinds apart", () => {
    expect(isSignInEnded(new SignInEnded())).toBe(true);
    expect(isSignInEnded(new Error("Could not load accounts."))).toBe(false);
    expect(isSignInEnded("This session timed out. Sign in again.")).toBe(false);
    expect(isSignInEnded(null)).toBe(false);
  });
});
