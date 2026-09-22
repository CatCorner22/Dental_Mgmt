import { describe, expect, it, vi } from "vitest";
import {
  everybodySignedOutSentence,
  noSignOutActsSentence,
  revokeAllSessionsForTenant,
  revokeReasonProblem,
  signOutActSentence,
  signOutReasonSentence,
} from "./revokeAllSessions";
import type { AuthStore } from "./store";

const AT = new Date("2026-09-22T13:00:00.000Z");

describe("revokeReasonProblem", () => {
  it("accepts a sentence", () => {
    expect(revokeReasonProblem("Lost phone reported by the front desk")).toBeNull();
  });

  /** The same floor a hard-event acknowledgement uses: a sentence, not a keystroke. */
  it("refuses anything under ten characters, trimmed", () => {
    expect(revokeReasonProblem("lost")).toContain("at least ten characters");
    expect(revokeReasonProblem("         ")).toContain("at least ten characters");
    expect(revokeReasonProblem("  lost it  ")).toContain("at least ten characters");
  });

  it("accepts exactly ten", () => {
    expect(revokeReasonProblem("0123456789")).toBeNull();
  });

  it("refuses an essay", () => {
    expect(revokeReasonProblem("x".repeat(201))).toContain("under two hundred characters");
    expect(revokeReasonProblem("x".repeat(200))).toBeNull();
  });
});

describe("everybodySignedOutSentence", () => {
  /** The administrator's own sign-in is one of the ones that ended; the sentence says so. */
  it("says the reader's own sign-in ended too", () => {
    expect(everybodySignedOutSentence(4)).toContain("including your own");
    expect(everybodySignedOutSentence(4)).toContain("Ended 4 sign-ins");
  });

  it("counts one in the singular", () => {
    expect(everybodySignedOutSentence(1)).toContain("Ended 1 sign-in across");
  });

  it("says plainly when nobody was signed in", () => {
    const said = everybodySignedOutSentence(0);
    expect(said).toContain("Nobody was signed in");
    expect(said).not.toContain("Ended 0");
  });
});

describe("revokeAllSessionsForTenant", () => {
  it("records the reason the administrator typed, not a constant", async () => {
    const appendDomainEvent = vi.fn(async () => {});
    const store = {
      revokeSessionsForTenant: async () => 3,
      appendDomainEvent,
    } as unknown as AuthStore;

    const result = await revokeAllSessionsForTenant(store, {
      tenantId: "tenant-a",
      actorUserId: "user-1",
      reason: "Lost phone reported by the front desk",
      at: AT,
    });

    expect(result).toEqual({ revoked: 3 });
    expect(appendDomainEvent).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      actorUserId: "user-1",
      kind: "auth.sessions_revoked_all",
      payload: { reason: "Lost phone reported by the front desk", revoked: 3 },
      at: AT,
    });
  });
});

describe("reading the act back (Increment 1.102)", () => {
  it("names who pressed and how many sign-ins ended", () => {
    expect(signOutActSentence({ byName: "Riley Owner", revoked: 4 })).toBe("Riley Owner ended 4 sign-ins.");
  });

  it("counts one in the singular", () => {
    expect(signOutActSentence({ byName: "Riley Owner", revoked: 1 })).toBe("Riley Owner ended 1 sign-in.");
  });

  /** Nobody signed in is not nothing happened: the act ran and the practice should read that it did. */
  it("says the act ran even when nobody was signed in", () => {
    expect(signOutActSentence({ byName: "Riley Owner", revoked: 0 })).toBe(
      "Riley Owner ended every sign-in, and nobody was signed in."
    );
  });

  /** An administrator can leave; the act they took does not leave with them. */
  it("reads back an act whose administrator has gone", () => {
    expect(signOutActSentence({ byName: null, revoked: 2 })).toBe(
      "An administrator whose seat has since gone ended 2 sign-ins."
    );
  });

  it("gives back what somebody typed, unchanged", () => {
    expect(signOutReasonSentence("Lost phone reported by the front desk")).toBe(
      "Lost phone reported by the front desk"
    );
  });

  /**
   * An empty reason cannot be somebody typing nothing — `revokeReasonProblem`
   * has refused that since Increment 1.90. It is a row written before the
   * reason was asked for, and it reads as that rather than as a blank.
   */
  it("explains an empty reason instead of showing a blank", () => {
    expect(signOutReasonSentence("")).toBe("Recorded before this screen asked why.");
    expect(signOutReasonSentence("   ")).toBe("Recorded before this screen asked why.");
    expect(revokeReasonProblem("")).not.toBeNull();
  });

  it("says plainly that a practice has never done this", () => {
    expect(noSignOutActsSentence()).toContain("never ended every sign-in at once");
  });
});
