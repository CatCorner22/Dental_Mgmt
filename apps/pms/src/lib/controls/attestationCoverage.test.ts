import { describe, expect, it } from "vitest";
import { attestationCoverage, externalChannelLabel } from "./attestationCoverage";

const CHANNELS = ["vendor_new", "payroll"];

describe("what a month is still missing", () => {
  it("names the channels nobody has vouched for, in words a reader can act on", () => {
    const none = attestationCoverage({ month: "2026-08", channels: CHANNELS, attested: [] });
    expect(none).toMatchObject({ attested: [], unattested: CHANNELS, complete: false });
    expect(none.sentence).toBe(
      "Nobody has reviewed new vendors and payroll for 2026-08, so those channels are a month the product cannot speak for and no person has."
    );

    const half = attestationCoverage({
      month: "2026-08",
      channels: CHANNELS,
      attested: [{ channel: "payroll", seat: "accountant", byName: "Casey Prentice" }],
    });
    expect(half).toMatchObject({ attested: ["payroll"], unattested: ["vendor_new"], complete: false });
    // One channel reads as singular, which is the difference between a sentence
    // a person reads and one they skip.
    expect(half.sentence).toBe(
      "Nobody has reviewed new vendors for 2026-08, so that channel is a month the product cannot speak for and no person has."
    );
  });

  it("names who vouched once every channel is covered, and says when the practice vouched for itself", () => {
    const all = attestationCoverage({
      month: "2026-08",
      channels: CHANNELS,
      attested: [
        { channel: "vendor_new", seat: "accountant", byName: "Casey Prentice" },
        { channel: "payroll", seat: "practice", byName: "Riley Owner" },
      ],
    });
    expect(all).toMatchObject({ unattested: [], complete: true });
    expect(all.sentence).toBe(
      "Every channel the product cannot enforce carries an attestation for 2026-08: new vendors by Casey Prentice; payroll by Riley Owner (the practice itself)."
    );
  });

  it("reads a build that enforces everything as complete, never as nought of nought failing", () => {
    // The false red of the same shape docs/05 forbids in green: a practice with
    // nothing to attest has not failed to attest it.
    const nothing = attestationCoverage({ month: "2026-08", channels: [], attested: [] });
    expect(nothing).toMatchObject({ channels: [], unattested: [], complete: true });
    expect(nothing.sentence).toBe("This build enforces every release channel, so 2026-08 has nothing to attest.");
  });

  it("falls back to the channel's own name where the product has no label for it", () => {
    expect(externalChannelLabel("payroll")).toBe("payroll");
    expect(externalChannelLabel("something_later")).toBe("something_later");
  });
});
