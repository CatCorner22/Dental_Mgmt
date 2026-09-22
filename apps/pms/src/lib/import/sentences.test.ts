import { describe, expect, it } from "vitest";
import { IMPORT_REPORT_KINDS, REPORT_KIND_LABEL, appliedSentence, checkedSentence } from "./sentences";
import { CURVE_HERO_REPORT_KINDS } from "@pms/import";

describe("the report kinds the screen offers", () => {
  /**
   * The screen cannot import `@pms/import` — its entry point reaches
   * `node:crypto` and webpack refuses it in a client component — so the list
   * is declared app-side and pinned here, where the package can be imported.
   */
  it("is the list the import package accepts, exactly", () => {
    expect([...IMPORT_REPORT_KINDS].sort()).toEqual([...CURVE_HERO_REPORT_KINDS].sort());
  });

  it("names every one of them", () => {
    // A kind the screen could not name would be a kind nobody could choose.
    for (const kind of IMPORT_REPORT_KINDS) {
      expect(REPORT_KIND_LABEL[kind]).toBeTruthy();
    }
    expect(Object.keys(REPORT_KIND_LABEL).sort()).toEqual([...IMPORT_REPORT_KINDS].sort());
  });
});

describe("checkedSentence", () => {
  it("says what was read and that nothing has posted yet", () => {
    const said = checkedSentence({ status: "validated", rowCount: 12, errorCount: 0 });
    expect(said).toContain("Read 12 rows");
    expect(said).toContain("Nothing has reached the ledger");
  });

  it("counts one row in the singular", () => {
    expect(checkedSentence({ status: "validated", rowCount: 1, errorCount: 0 })).toContain("Read 1 row,");
  });

  /** A refused file is an answer, not a fault, and it says how much it could not read. */
  it("says how many rows it could not read, and that nothing posted", () => {
    const said = checkedSentence({ status: "failed", rowCount: 9, errorCount: 2 });
    expect(said).toContain("could not read 2 rows");
    expect(said).toContain("Nothing has reached the ledger");
  });
});

describe("appliedSentence", () => {
  it("counts only what happened", () => {
    expect(appliedSentence({ posted: 3, skipped: 0, duplicates: 0, errors: [] })).toBe("Posted 3 entries.");
    expect(appliedSentence({ posted: 1, skipped: 0, duplicates: 0, errors: [] })).toBe("Posted 1 entry.");
  });

  it("separates a row already in the ledger from one it had no use for", () => {
    const said = appliedSentence({ posted: 2, skipped: 1, duplicates: 4, errors: ["x"] });
    expect(said).toContain("4 already in the ledger and left alone");
    expect(said).toContain("1 this import had no use for");
    expect(said).toContain("1 refused");
  });
});
