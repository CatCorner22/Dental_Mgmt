import { describe, expect, it } from "vitest";
import {
  EXTERNAL_RELEASE_CHANNELS,
  RELEASE_CHANNEL_LABEL,
  enforcementSentence,
  recordedSentence,
} from "./releaseSentences";
import { ENFORCEMENT } from "./enforcement";

describe("the channels this screen offers", () => {
  /**
   * Pinned to `ENFORCEMENT` rather than restated (Increment 1.98). A channel
   * that moves up to enforced must leave this screen in the same change, or
   * the screen would offer an act `attestChannelRelease` refuses as a ledger
   * channel — an act that could only fail, which Increments 1.88, 1.89 and
   * 1.93 exist to remove.
   *
   * Increment 1.97's record said payroll was the only external channel this
   * practice can attest. It is not: `vendor_new` is external too. This test
   * is the reason that claim cannot be made again by accident.
   */
  it("is exactly the channels the product cannot enforce", () => {
    const external = Object.entries(ENFORCEMENT)
      .filter(([, level]) => level === "external")
      .map(([channel]) => channel)
      .sort();
    expect([...EXTERNAL_RELEASE_CHANNELS].sort()).toEqual(external);
  });

  it("names every one of them", () => {
    for (const channel of EXTERNAL_RELEASE_CHANNELS) expect(RELEASE_CHANNEL_LABEL[channel]).toBeTruthy();
  });
});

describe("recordedSentence", () => {
  it("says the policy asked for one pair of hands, and names the threshold", () => {
    const said = recordedSentence({ dualRequired: false, thresholdUsd: 2500, secondsAvailable: 3 });
    expect(said).toContain("one pair of hands below $2,500");
  });

  /** The record is of the requirement, never of the signature. */
  it("says the product cannot hold the second signature, and where it belongs", () => {
    const said = recordedSentence({ dualRequired: true, thresholdUsd: 0, secondsAvailable: 2 });
    expect(said).toContain("required a second pair of hands");
    expect(said).toContain("cannot hold that signature");
    expect(said).toContain("2 people here may second it");
  });

  it("says plainly when nobody may second it", () => {
    const said = recordedSentence({ dualRequired: true, thresholdUsd: 0, secondsAvailable: 0 });
    expect(said).toContain("Nobody in this practice holds a role that may second it");
  });

  it("counts one in the singular", () => {
    expect(recordedSentence({ dualRequired: true, thresholdUsd: 0, secondsAvailable: 1 })).toContain("1 person here");
  });
});

describe("enforcementSentence", () => {
  it("says an external channel is attested and never enforced", () => {
    expect(enforcementSentence("external")).toContain("attested, never enforced");
  });

  it("sends a channel the ledger carries back to the posting path", () => {
    expect(enforcementSentence("enforced")).toContain("evidence comes from the posting path");
  });
});
