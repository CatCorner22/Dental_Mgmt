import { describe, expect, it, vi } from "vitest";
import {
  everybodySignedOutSentence,
  revokeAllSessionsForTenant,
  revokeReasonProblem,
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
