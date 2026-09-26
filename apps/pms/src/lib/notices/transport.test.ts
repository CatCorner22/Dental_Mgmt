import { describe, expect, it } from "vitest";
import {
  flakyTransport,
  memoryTransport,
  refusingTransport,
  transportFromEnv,
  unconfiguredTransport,
} from "./transport";
import { sendSentence, type SendRecord } from "./sendOutcome";

/**
 * What a practice that has configured nothing gets, how a refusal names its own
 * kind (Increment 1.60), and how an outcome reads (Increment 1.59).
 */

const message = { subject: "Ridgeview Dental: 1 thing is waiting", body: "..." };

describe("the transport a deployment has", () => {
  it("refuses to send when nothing is configured, and names what would change it", async () => {
    // The rule the increment turns on: a practice with no way to send learns so
    // the first time somebody asks, rather than a message vanishing quietly.
    const t = transportFromEnv({} as NodeJS.ProcessEnv);
    expect(t.name).toBe("none");
    expect(await t.send("riley@ridgeview.example", message)).toEqual({
      ok: false,
      kind: "permanent",
      why: "This practice has no way to send messages yet. Nothing was delivered. Set PMS_NOTICE_TRANSPORT to configure one.",
    });
  });

  it("calls an unconfigured deployment permanent, because no retry configures one", async () => {
    // Increment 1.60. Retrying this would spend a person's wait on an outcome
    // nobody can reach by waiting.
    const t = unconfiguredTransport("Nothing is configured.");
    const delivery = await t.send("a@b.example", message);
    expect(delivery).toEqual({ ok: false, kind: "permanent", why: "Nothing is configured." });
  });

  it("refuses an unrecognised setting rather than guessing at one", async () => {
    // A typo in a setting must not quietly become a working transport, nor a
    // silently discarded one.
    const t = transportFromEnv({ PMS_NOTICE_TRANSPORT: "smtp" } as unknown as NodeJS.ProcessEnv);
    expect(t.name).toBe("none");
    expect((await t.send("a@b.example", message)).ok).toBe(false);
  });

  it("hands out no test transport for any setting a deployment could write", async () => {
    // `flakyTransport` exists so a suite can prove the retry rule. No
    // configuration may reach it, or a practice could be given a transport that
    // refuses on purpose.
    for (const value of ["flaky", "refusing", "transient", "none", ""]) {
      const t = transportFromEnv({ PMS_NOTICE_TRANSPORT: value } as unknown as NodeJS.ProcessEnv);
      expect(t.name).toBe("none");
    }
    expect(transportFromEnv({ PMS_NOTICE_TRANSPORT: "memory" } as unknown as NodeJS.ProcessEnv).name).toBe("memory");
  });

  it("holds what it was given and reaches no network", async () => {
    const t = memoryTransport();
    expect(await t.send("riley@ridgeview.example", message)).toEqual({ ok: true });
    expect(t.sent).toEqual([{ to: "riley@ridgeview.example", message }]);
  });

  it("carries the refusal's own words rather than a code", async () => {
    const t = refusingTransport("The provider rejected the address.", "permanent");
    expect(await t.send("a@b.example", message)).toEqual({
      ok: false,
      kind: "permanent",
      why: "The provider rejected the address.",
    });
  });

  it("counts its attempts even when nobody calls it as a method", async () => {
    // The count lives in a closure rather than on `this`: a transport passed
    // around as a bare function would otherwise stop counting, silently, and a
    // count that can silently stop is worse than no count at all.
    const t = refusingTransport("Busy.", "transient");
    const send = t.send;
    await send("a@b.example", message);
    await send("a@b.example", message);
    expect(t.attempts).toBe(2);
  });

  it("comes back after a stated number of transient refusals", async () => {
    const t = flakyTransport(2, "The provider was busy.");
    expect(await t.send("a@b.example", message)).toEqual({ ok: false, kind: "transient", why: "The provider was busy." });
    expect((await t.send("a@b.example", message)).ok).toBe(false);
    expect(await t.send("a@b.example", message)).toEqual({ ok: true });
    expect(t.attempts).toBe(3);
    // Only the attempt that worked carried anything out.
    expect(t.sent).toEqual([{ to: "a@b.example", message }]);
  });
});

describe("how an attempt reads", () => {
  const base: SendRecord = {
    seat: "owner",
    recipientName: "Riley Owner",
    address: "riley@ridgeview.example",
    outcome: "sent",
    detail: null,
    failureKind: null,
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
    const failed: SendRecord = {
      ...base,
      outcome: "failed",
      detail: "The provider refused it.",
      failureKind: "permanent",
    };
    expect(sendSentence(failed)).toBe(
      "The attempt on 2026-09-19 failed and nothing arrived: The provider refused it." +
        " That kind of refusal will not pass, so asking again would fail the same way; something has to change first."
    );
  });

  it("tells a reader to ask again where asking again could work", () => {
    const failed: SendRecord = {
      ...base,
      outcome: "failed",
      detail: "The provider was busy.",
      failureKind: "transient",
    };
    expect(sendSentence(failed)).toBe(
      "The attempt on 2026-09-19 failed and nothing arrived: The provider was busy." +
        " That kind of refusal can pass, so asking again later may get through."
    );
  });

  it("advises nothing about a failure recorded before the distinction existed", () => {
    // A row from before Increment 1.60 does not know its kind. Guessing one
    // would be advice on evidence nobody ever had, so it reads as it did then.
    const old: SendRecord = { ...base, outcome: "failed", detail: "The provider refused it.", failureKind: null };
    expect(sendSentence(old)).toBe("The attempt on 2026-09-19 failed and nothing arrived: The provider refused it.");
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
