import { describe, expect, it } from "vitest";
import { memoryTransport, transportFromEnv, unconfiguredTransport } from "./transport";
import { sendSentence, type SendRecord } from "./sendOutcome";

/**
 * What a practice that has configured nothing gets, and how an outcome reads
 * (Increment 1.59).
 */

const message = { subject: "Ridgeview Dental: 1 thing is waiting", body: "..." };

describe("the transport a deployment has", () => {
  it("refuses to send when nothing is configured, and names what would change it", () => {
    // The rule the increment turns on: a practice with no way to send learns so
    // the first time somebody asks, rather than a message vanishing quietly.
    const t = transportFromEnv({} as NodeJS.ProcessEnv);
    expect(t.name).toBe("none");
    return expect(t.send("riley@ridgeview.example", message)).resolves.toEqual({
      ok: false,
      why: "This practice has no way to send messages yet. Nothing was delivered. Set PMS_NOTICE_TRANSPORT to configure one.",
    });
  });

  it("refuses an unrecognised setting rather than guessing at one", async () => {
    // A typo in a setting must not quietly become a working transport, nor a
    // silently discarded one.
    const t = transportFromEnv({ PMS_NOTICE_TRANSPORT: "smtp" } as unknown as NodeJS.ProcessEnv);
    expect(t.name).toBe("none");
    expect((await t.send("a@b.example", message)).ok).toBe(false);
  });

  it("holds what it was given and reaches no network", async () => {
    const t = memoryTransport();
    expect(await t.send("riley@ridgeview.example", message)).toEqual({ ok: true });
    expect(t.sent).toEqual([{ to: "riley@ridgeview.example", message }]);
  });

  it("carries the refusal's own words rather than a code", async () => {
    const t = unconfiguredTransport("The provider rejected the address.");
    expect(await t.send("a@b.example", message)).toEqual({ ok: false, why: "The provider rejected the address." });
  });
});

describe("how an attempt reads", () => {
  const base: SendRecord = {
    seat: "owner",
    recipientName: "Riley Owner",
    address: "riley@ridgeview.example",
    outcome: "sent",
    detail: null,
    subject: "Ridgeview Dental: 1 thing is waiting",
    noticeCount: 1,
    attemptedAt: "2026-09-19T09:30:00.000Z",
  };

  it("says where it went on a send", () => {
    expect(sendSentence(base)).toBe("Sent to riley@ridgeview.example on 2026-09-19.");
  });

  it("says that nothing arrived on a failure, and why", () => {
    // Not "the send failed" alone: what a reader needs to know is that the
    // message did not reach them, which is the thing they would otherwise
    // assume had happened.
    const failed: SendRecord = { ...base, outcome: "failed", address: "riley@ridgeview.example", detail: "The provider refused it." };
    expect(sendSentence(failed)).toBe("The attempt on 2026-09-19 failed and nothing arrived: The provider refused it.");
  });

  it("says that nothing was sent when there was nowhere to send", () => {
    const nowhere: SendRecord = {
      ...base,
      outcome: "unreachable",
      address: null,
      detail: "Nobody has said where to send these, so there was nowhere to send them.",
    };
    expect(sendSentence(nowhere)).toBe(
      "Nothing was sent on 2026-09-19: Nobody has said where to send these, so there was nowhere to send them."
    );
  });
});
