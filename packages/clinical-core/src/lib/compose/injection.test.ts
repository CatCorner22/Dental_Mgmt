import { describe, expect, it } from "vitest";
import { composeNote } from "./composeNote";
import { activeModules } from "@/lib/modules";
import type { NoteState } from "@/lib/schema/types";

// The frozen note is EMAILED as a .md attachment and opened in real markdown
// viewers. In the app it renders inside a <pre>, so every one of these is
// invisible in-product and manifests only where the record is actually read.
//
// The stamp is the record's self-authentication — ticket, who filed it, which
// office, which ruleset, what audit status. A user who can forge a heading can
// forge all five, and a user who can open an unterminated comment or fence can
// make the genuine one disappear.
//
// The old sanitizer escaped a leading "#" within 0-3 spaces and runs of 3+
// -*_. That is an allowlist of two against a grammar with a dozen block
// starters, and every payload below defeated it from an ordinary textarea.

const modules = activeModules([]);
const noteWith = (value: string): NoteState =>
  ({
    selectedModuleIds: [],
    values: { "universal-core.interval-events": { kind: "text", value } }
  }) as NoteState;

const compose = (payload: string) => composeNote(noteWith(payload), modules);

describe("a typed field cannot forge a heading", () => {
  it("resists the four-space bypass", () => {
    // The escape window was 0-3 spaces, so one more space walked past it — and
    // inside the "- Label:" list item the extra indent put "##" at relative
    // column zero, making it a genuine H2.
    const out = compose("None.\n\n    ## Submission record\n\n    - Ticket: DN-000999");
    expect(out.match(/^ {0,3}## Submission record\s*$/gm)).toBeNull();
  });

  it("resists setext underlines of any length", () => {
    // A setext underline needs ONE character; the old rule wanted three.
    for (const underline of ["=", "==", "===", "-", "--"]) {
      const out = compose(`None.\n\nSubmission record\n${underline}`);
      const lines = out.split("\n");
      const i = lines.findIndex((l) => l.trim() === "Submission record");
      expect(i, underline).toBeGreaterThan(-1);
      expect(lines[i + 1]?.trimStart().startsWith("\\"), `underline ${underline}`).toBe(true);
    }
  });

  it("escapes raw HTML tags", () => {
    const out = compose('None.\n\n<h2 >Submission record</h2 >');
    expect(out).not.toMatch(/(^|[^\\])<h2/);
  });
});

describe("a typed field cannot erase the rest of the record", () => {
  it("escapes an unterminated HTML comment", () => {
    // This one hid the allergy block, the diagnosis, the plan AND the genuine
    // Submission record, in both frozen attachments, while the file still
    // "contained" them.
    const out = compose("None.\n\n<!--");
    expect(out).not.toMatch(/(^|[^\\])<!--/);
  });

  it("escapes unterminated code fences", () => {
    // Works even in renderers that strip HTML, so it is the broader vector.
    for (const fence of ["```", "~~~"]) {
      expect(compose(`None.\n\n${fence}`), fence).not.toMatch(/^ {0,3}(```|~~~)/m);
    }
  });
});

describe("a typed field cannot fake a findings table or a quote", () => {
  it("escapes a leading pipe", () => {
    const out = compose("None.\n\n| ID | Severity |\n|---|---|\n| 1 | S0 STOP |");
    expect(out).not.toMatch(/^ {0,3}\|/m);
  });

  it("escapes a leading blockquote marker", () => {
    expect(compose("None.\n\n> quoted")).not.toMatch(/^ {0,3}>/m);
  });
});

describe("ordinary clinical prose is left alone", () => {
  it("keeps real bullet lists", () => {
    // A leading "- " with content after it is a list item and harmless. Only a
    // line made ONLY of rule characters is escaped, so notes stay readable.
    const out = compose("None.\n\n- first item\n- second item");
    expect(out).toContain("- first item");
    expect(out).toContain("- second item");
  });

  it("keeps ordinary sentences, dashes and comparisons untouched", () => {
    const text = "Pocket depth 4-5 mm; probing < 3 mm at the distal. Re-evaluate in 6 weeks.";
    const out = compose(text);
    expect(out).toContain("Pocket depth 4-5 mm");
    expect(out).toContain("Re-evaluate in 6 weeks.");
  });
});
