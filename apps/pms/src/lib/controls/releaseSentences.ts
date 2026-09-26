/**
 * What the release screen says (Increment 1.98).
 *
 * `POST /api/controls/release/evaluate` has had no screen since it was built.
 * Increment 1.96 put it on the uncalled list with the reason that it wanted a
 * surface of its own, and Increment 1.97 restated it while making the figure
 * it records readable. This is the surface.
 *
 * The sentences live here rather than in the page so a test can read them
 * without a browser, as Increments 1.90, 1.93 and 1.94 put theirs.
 */

/** The channels this build cannot enforce, which are the only ones attestable by hand. */
export const EXTERNAL_RELEASE_CHANNELS = ["payroll", "vendor_new"] as const;

export type ExternalReleaseChannel = (typeof EXTERNAL_RELEASE_CHANNELS)[number];

export const RELEASE_CHANNEL_LABEL: Record<ExternalReleaseChannel, string> = {
  payroll: "Payroll file",
  vendor_new: "Payment to a new vendor",
};

/**
 * What the practice has just recorded, and what it has not.
 *
 * The distinction is the whole of this screen. Attesting a release records
 * that it happened and what the policy said about it; it does not record that
 * a second person signed, because `attestChannelRelease` accepts no second
 * signer — one person asserting two people's participation is a weaker record
 * than none, and this product does not make it.
 */
export function recordedSentence(input: { dualRequired: boolean; thresholdUsd: number; secondsAvailable: number }): string {
  if (!input.dualRequired) {
    return `Recorded. The policy asks for one pair of hands below $${input.thresholdUsd.toLocaleString()}, and this is below it.`;
  }
  const who =
    input.secondsAvailable === 0
      ? "Nobody in this practice holds a role that may second it, which is itself worth the owner's attention."
      : `${input.secondsAvailable} ${input.secondsAvailable === 1 ? "person" : "people"} here may second it.`;
  return `Recorded, and the policy required a second pair of hands. This product cannot hold that signature — keep it where the channel does, on the payroll file or the bank's own authorisation log. ${who}`;
}

/** How the month-end package will read this channel, said before it is read there. */
export function enforcementSentence(enforcement: string): string {
  if (enforcement === "external") {
    return "This channel is attested, never enforced: the product does not hold its data, so nothing here checks that the release matched what was authorised.";
  }
  return `This channel reads as ${enforcement}, and its evidence comes from the posting path rather than from here.`;
}
