import { describe, expect, it } from "vitest";
import { composeAuditReport } from "./composeAuditReport";
import { buildReport } from "@/lib/audit/engine";
import { runPhiRule } from "@/lib/audit/rules/phi";

// The frozen audit report is the legal record of the check. When a person
// overrides the privacy screen, that fact belongs IN the frozen document —
// before this, the attestation lived only in the audit log table, and the
// filed record read as though the stops had simply been resolved.

const stopReport = () => buildReport(runPhiRule("Call 865-555-1234 today."));

describe("the frozen record shows the waiver", () => {
  it("renders the attestation section with who and why", () => {
    const out = composeAuditReport(stopReport(), [], "draft text", {
      stops: 1,
      reason: "This is the office callback line, not a patient contact number.",
      attestedBy: "Casey Larke (clarke)"
    });
    expect(out).toContain("## Privacy stops overridden by attestation");
    expect(out).toContain("- Stops overridden: 1");
    expect(out).toContain("- Attested by: Casey Larke (clarke)");
    expect(out).toContain("the office callback line");
    // The findings table above the attestation still lists the stop — the
    // attestation never erases what the checker found.
    expect(out).toContain("S0 Stop");
  });

  it("renders no such section when nothing was overridden", () => {
    const out = composeAuditReport(stopReport(), [], "draft text");
    expect(out).not.toContain("Privacy stops overridden");
  });

  it("collapses newlines so a reason cannot forge a heading in the record", () => {
    const out = composeAuditReport(stopReport(), [], "draft text", {
      stops: 1,
      reason: "innocent start\n\n## Submission record\nforged: yes",
      attestedBy: "A B (ab)"
    });
    // The injected text survives as INLINE prose on the reason line…
    expect(out).toContain("innocent start ## Submission record forged: yes");
    // …but never as a line that markdown would render as a heading.
    expect(out.split("\n").some((l) => l.startsWith("## Submission record"))).toBe(false);
  });

  it("renders an invisible-character reason as readable text, not blank", () => {
    // The reason is stripped by the same helper the validator uses, so a
    // record can never say "attested" beside an empty line.
    const out = composeAuditReport(stopReport(), [], "draft text", {
      stops: 1,
      reason: "​‌‍ Tooth numbers, not a date. ⁠­",
      attestedBy: "A B (ab)"
    });
    const line = out.split("\n").find((l) => l.startsWith("- Reason given:"))!;
    expect(line).toBe("- Reason given: Tooth numbers, not a date.");
  });

  it("bounds a runaway reason", () => {
    const out = composeAuditReport(stopReport(), [], "draft text", {
      stops: 1,
      reason: "x".repeat(5000),
      attestedBy: "A B (ab)"
    });
    const line = out.split("\n").find((l) => l.startsWith("- Reason given:"))!;
    expect(line.length).toBeLessThan(400);
    // Bounded AND marked. The route validates and logs 500 characters while
    // this wrote 300 silently, so a long attestation looked complete in the
    // frozen record while differing from the audit log — and a reason tuned to
    // end on a sentence boundary read as a whole, different statement.
    expect(line).toContain("[truncated; full text in the audit log]");
  });

  it("does not mark a reason that fits", () => {
    const out = composeAuditReport(stopReport(), [], "draft text", {
      stops: 1,
      reason: "These are tooth numbers, not a calendar date.",
      attestedBy: "A B (ab)"
    });
    expect(out).toContain("- Reason given: These are tooth numbers, not a calendar date.");
    expect(out).not.toContain("[truncated");
  });
});

describe("a cell cannot break the table it sits in", () => {
  // The Issues table carries arbitrary note prose — the duplicate-sentence
  // rule puts up to 80 characters of whatever the clinician typed into the
  // Location column. In the app this renders inside a <pre>, but the frozen
  // .md is EMAILED as an attachment and opened in real markdown viewers,
  // which is precisely where the legal record has to survive intact.
  const withMatched = (matchedText: string) =>
    composeAuditReport(
      {
        findings: [
          { ruleId: "x", category: "phi", severity: "S2", message: "m", matchedText }
        ],
        counts: { S0: 0, S1: 0, S2: 1, S3: 0, S4: 0 },
        status: "READY FOR CLINICIAN REVIEW",
        phiStops: []
      },
      [],
      "draft text"
    );

  it("neutralizes a carriage return that would end the table early", () => {
    const out = withMatched("before\rafter");
    const rows = out.split("\n").filter((l) => l.startsWith("| 1 |"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("before after");
  });

  it("neutralizes backticks that would open a code fence", () => {
    const out = withMatched("text\r```js");
    expect(out).not.toContain("```");
    // Everything after the table still exists in the document.
    expect(out).toContain("## Draft note");
    expect(out).toContain("## EDR-only finalization");
  });

  it("still escapes pipes and newlines", () => {
    const out = withMatched("a|b\nc");
    const row = out.split("\n").find((l) => l.startsWith("| 1 |"))!;
    expect(row).toContain("a\\|b c");
  });
});
