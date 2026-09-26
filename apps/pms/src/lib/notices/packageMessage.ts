import type { Message } from "./message";

/**
 * The month closed, told to the accountant (Increment 1.66).
 *
 * **What this message is for.** The outside accountant's seat reaches the
 * month-end package and nothing else (Increment 1.49), and until now learned
 * that a month had closed only by signing in to look. The practice closes a
 * month; the person whose whole work begins at that moment is not told. This
 * tells them.
 *
 * **What it carries, and the line it draws.** The month, the package hash and
 * the shape that hash was taken under, how many entries the month held, and
 * whether each tie-out holds. **No money.**
 *
 * That line is not the digest's line repeated for its own sake. The package
 * *is* money — it exists to carry the practice's figures to their accountant,
 * and the accountant may already export the whole thing as CSV or JSON. But an
 * export is **the accountant taking the figures while signed in**, and a
 * message is **the product pushing them into a mailbox** it has only proved
 * reaches somebody. Those are different acts with different blast radii, and
 * the practice's month of revenue is the single most commercially sensitive
 * number this product holds. A link costs nothing.
 *
 * **The hash is the point of sending anything at all.** A fingerprint that
 * travels by a different channel from the artefact it describes is the oldest
 * integrity check there is: the accountant can compare what they later
 * download against what was closed, and catch a package that moved in between
 * without having to trust the channel it arrived on. Sending it is strictly
 * more useful than not, and it reveals nothing — a hash of figures is not the
 * figures.
 *
 * **It names nobody.** Not even who closed the month. The close row carries
 * that, and the screen shows it; a message that leaves the product says the
 * practice did it, for the same reason the digest counts without naming.
 */

export type PackageFacts = {
  practiceName: string;
  month: string;
  packageHash: string;
  packageSchema: string;
  entryCount: number;
  closedAt: string;
  appUrl: string;
  /** Label and whether it holds. The detail carries figures, so it stays behind the guard. */
  tieOuts: { label: string; holds: boolean }[];
};

export function renderPackageMessage(facts: PackageFacts): Message {
  const failed = facts.tieOuts.filter((t) => !t.holds);
  return {
    subject: `${facts.practiceName}: ${facts.month} is closed`,
    body: [
      `${facts.practiceName} closed ${facts.month} on ${facts.closedAt.slice(0, 10)}. The month-end package is ready.`,
      "",
      `Entries in the month: ${facts.entryCount}`,
      `Package fingerprint (${facts.packageSchema}):`,
      `  ${facts.packageHash}`,
      "",
      "Compare that fingerprint against the package you download. If the two differ, the month moved after it was closed and the screen will say so.",
      "",
      failed.length === 0
        ? `All ${facts.tieOuts.length} tie-outs hold.`
        : `${failed.length} of ${facts.tieOuts.length} tie-outs do not hold:`,
      ...failed.map((t) => `  ${t.label}`),
      "",
      `Sign in at ${facts.appUrl} to read the package or export it.`,
      "",
      "No figure from the month is in this message, and no person is named. The package itself names no patient.",
    ].join("\n"),
  };
}
