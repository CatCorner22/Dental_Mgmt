import type { Message } from "./message";

/**
 * The week's digest, as a message (Increment 1.64).
 *
 * **This is not a second digest.** Increment 1.28 built one: seven days of the
 * practice's counts, computed from rows, stamped once by the owner. It is
 * already weekly and it is already the practice's retrospective. What was
 * missing was that reading it required somebody to remember to look — the same
 * gap the whole notices arc exists to close. So this carries that digest out;
 * it does not compute a different one.
 *
 * **It is safe to send for a reason the product already proved.** Every count
 * in the digest is practice-wide: the queries carry no person dimension, so no
 * row in it names anyone. That was settled in Increment 1.28 for a different
 * purpose — the owner stamps a hash of exactly those figures, and a figure
 * about one person would make the stamp mean something else — and it is
 * exactly the property Increment 1.58 requires of anything that leaves.
 *
 * **What it deliberately does not carry.** No money. The digest screen shows
 * amounts beside some counts, and an amount in an inbox is the one number a
 * person who should not have it would find worth reading. Counts say whether a
 * week needs attention, which is all a message has to do; the screen holds the
 * rest, behind the guard.
 */

export type DigestFacts = {
  practiceName: string;
  period: { start: string; end: string };
  appUrl: string;
  postings: number;
  approvalsRequested: number;
  afterHoursHolds: number;
  findingsOpened: number;
  findingsOpenNow: number;
  decisionsOverdueNow: number;
  postingsIntoSealedDays: number;
  acknowledged: boolean;
};

const line = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function renderDigestMessage(facts: DigestFacts): Message {
  const rows = [
    line(facts.postings, "posting", "postings"),
    line(facts.approvalsRequested, "approval asked for", "approvals asked for"),
    line(facts.afterHoursHolds, "posting held after hours", "postings held after hours"),
    line(facts.findingsOpened, "finding opened", "findings opened"),
    line(facts.postingsIntoSealedDays, "row posted against a sealed day", "rows posted against sealed days"),
  ];
  const standing = [
    line(facts.findingsOpenNow, "finding is open now", "findings are open now"),
    line(facts.decisionsOverdueNow, "decision is past its review date", "decisions are past their review date"),
  ];
  return {
    subject: `${facts.practiceName}: your week, ${facts.period.start} to ${facts.period.end}`,
    body: [
      `What happened at ${facts.practiceName} in the seven days ending ${facts.period.end}:`,
      "",
      ...rows.map((r) => `  ${r}`),
      "",
      "Where things stand:",
      "",
      ...standing.map((r) => `  ${r}`),
      "",
      facts.acknowledged
        ? "Somebody has already stamped this week on the digest screen."
        : "Nobody has stamped this week yet. Reading this is not stamping it: the stamp is an act, and it happens on the digest screen.",
      "",
      `Sign in at ${facts.appUrl} to see the figures behind these counts.`,
      "",
      "Every count here is the practice's over those seven days. No count names a person, and no amount of money is in this message.",
    ].join("\n"),
  };
}
