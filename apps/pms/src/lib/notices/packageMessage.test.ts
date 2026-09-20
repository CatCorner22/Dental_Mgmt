import { describe, expect, it } from "vitest";
import { renderPackageMessage, type PackageFacts } from "./packageMessage";

/**
 * What the accountant is told when a month closes (Increment 1.66), and the
 * line between telling somebody the month is ready and pushing its figures
 * into a mailbox.
 */

const facts: PackageFacts = {
  practiceName: "Ridgeview Dental",
  month: "2026-08",
  packageHash: "a".repeat(64),
  packageSchema: "package-v3",
  entryCount: 412,
  closedAt: "2026-09-03T14:20:00.000Z",
  appUrl: "https://app.example",
  tieOuts: [
    { label: "Journal lines tie to the deposit register", holds: true },
    { label: "Every journal line is mapped to an account", holds: true },
  ],
};

describe("the message that says a month closed", () => {
  it("names the month in the subject, and nothing else", () => {
    expect(renderPackageMessage(facts).subject).toBe("Ridgeview Dental: 2026-08 is closed");
  });

  it("carries the fingerprint and the shape it was taken under", () => {
    // A fingerprint travelling by a different channel from the artefact it
    // describes is the oldest integrity check there is: the accountant can
    // compare what they download against what was closed, without having to
    // trust the channel it arrived on.
    const body = renderPackageMessage(facts).body;
    expect(body).toContain("a".repeat(64));
    expect(body).toContain("package-v3");
    expect(body).toContain("Compare that fingerprint against the package you download");
  });

  it("carries no money at all", () => {
    // The package is money — it exists to carry the practice's figures to
    // their accountant, who may already export the whole thing. But an export
    // is the accountant taking the figures while signed in, and a message is
    // the product pushing them into a mailbox it has only proved reaches
    // somebody. A link costs nothing.
    const body = renderPackageMessage(facts).body;
    expect(body).not.toMatch(/\$|\bcents\b|[0-9]+\.[0-9]{2}/);
    expect(body).toContain("No figure from the month is in this message");
  });

  it("says how many tie-outs hold, and names only the ones that do not", () => {
    expect(renderPackageMessage(facts).body).toContain("All 2 tie-outs hold.");
    const broken = renderPackageMessage({
      ...facts,
      tieOuts: [facts.tieOuts[0]!, { label: "Every journal line is mapped to an account", holds: false }],
    });
    expect(broken.body).toContain("1 of 2 tie-outs do not hold:");
    expect(broken.body).toContain("Every journal line is mapped to an account");
    // The tie-out's own detail carries figures, so it stays behind the guard.
    expect(broken.body).not.toContain("412 of");
  });

  it("names nobody, not even who closed the month", () => {
    // The close row carries that and the screen shows it. A message that
    // leaves the product says the practice did it, for the same reason the
    // digest counts without naming.
    expect(renderPackageMessage(facts).body).toContain("No figure from the month is in this message, and no person is named.");
    expect(renderPackageMessage(facts).body).toContain("Ridgeview Dental closed 2026-08 on 2026-09-03");
  });
});
