/**
 * What a month is still missing (Increment 1.52).
 *
 * Increment 1.51 put something behind the word "attested": a dated assertion
 * that somebody reviewed one of the channels this build cannot enforce. It said
 * nothing about the channels nobody spoke for, and silence is exactly the state
 * that matters — an external channel with no attestation is a month of vendor
 * payments or payroll that no person, inside the practice or outside it, has
 * claimed to have looked at.
 *
 * This is the pure reading of that. It takes the channels and what stands
 * against them and says which are covered, which are not, and in one sentence
 * what that means, so the month-end package's tie-out and the owner board say
 * the same thing in the same words.
 */

/**
 * The last month that has ended, as of a date.
 *
 * Every surface that reports an attestation reads this month rather than the
 * one running: "reviewed this month" means a month somebody could have
 * reviewed, and the one still filling is not one. It lives here, in the module
 * both the owner board and the Practice Risk page already depend on, so there
 * is one definition rather than two that could disagree about January.
 */
export function lastCompleteMonth(asOf: string): string {
  const [year, month] = asOf.slice(0, 7).split("-").map(Number);
  return month === 1 ? `${year! - 1}-12` : `${year}-${String(month! - 1).padStart(2, "0")}`;
}

/** The label a reader sees for each channel the product cannot enforce. */
export const EXTERNAL_CHANNEL_LABEL: Record<string, string> = {
  vendor_new: "new vendors",
  payroll: "payroll",
};

export function externalChannelLabel(channel: string): string {
  return EXTERNAL_CHANNEL_LABEL[channel] ?? channel;
}

export type AttestationCoverage = {
  month: string;
  /** Every channel the product cannot enforce, in the order the tab lists them. */
  channels: string[];
  /** Those somebody has vouched for. */
  attested: string[];
  /** Those nobody has. */
  unattested: string[];
  /** True when every external channel carries an attestation for the month. */
  complete: boolean;
  /** One sentence, written the same way wherever it appears. */
  sentence: string;
};

/**
 * Reads the coverage of one month.
 *
 * A practice with no external channels at all is complete rather than empty:
 * there is nothing for anybody to vouch for, and saying "0 of 0 attested" as a
 * failure would be the false red of the same shape docs/05 forbids in green.
 */
export function attestationCoverage(input: {
  month: string;
  channels: string[];
  attested: { channel: string; seat: string; byName: string }[];
}): AttestationCoverage {
  const said = new Set(input.attested.map((a) => a.channel));
  const attested = input.channels.filter((c) => said.has(c));
  const unattested = input.channels.filter((c) => !said.has(c));
  const complete = unattested.length === 0;

  let sentence: string;
  if (input.channels.length === 0) {
    sentence = `This build enforces every release channel, so ${input.month} has nothing to attest.`;
  } else if (complete) {
    const who = input.attested
      .filter((a) => said.has(a.channel))
      .map((a) => `${externalChannelLabel(a.channel)} by ${a.byName}${a.seat === "accountant" ? "" : " (the practice itself)"}`)
      .join("; ");
    sentence = `Every channel the product cannot enforce carries an attestation for ${input.month}: ${who}.`;
  } else {
    const missing = unattested.map(externalChannelLabel).join(" and ");
    sentence = `Nobody has reviewed ${missing} for ${input.month}, so ${unattested.length === 1 ? "that channel is" : "those channels are"} a month the product cannot speak for and no person has.`;
  }

  return { month: input.month, channels: input.channels, attested, unattested, complete, sentence };
}
