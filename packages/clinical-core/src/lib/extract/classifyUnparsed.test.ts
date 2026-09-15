import { describe, expect, it } from "vitest";
import { classifyUnparsedClause, classifyUnparsedSpans } from "./classifyUnparsed";

describe("classifyUnparsedClause", () => {
  it("routes medication-like unread phrases", () => {
    expect(classifyUnparsedClause("gave 2 carpules mystery-drug 2%").category).toBe("medication");
  });

  it("routes imaging-like unread phrases", () => {
    expect(classifyUnparsedClause("mystery BW series acquired").category).toBe("imaging");
  });

  it("routes consent-like unread phrases", () => {
    expect(classifyUnparsedClause("risks reviewed; follow-up unclear").category).toBe(
      "consent-or-instructions"
    );
  });

  it("falls back to other without inventing a clinical fact", () => {
    const r = classifyUnparsedClause("asdf qwerty zxcv");
    expect(r.category).toBe("other");
    expect(r.ask).toMatch(/could not read/i);
  });

  it("classifies spans against source offsets", () => {
    const source = "AAA mystery BW series BBB";
    const start = source.indexOf("mystery");
    const end = start + "mystery BW series".length;
    const [row] = classifyUnparsedSpans(source, [{ start, end }]);
    expect(row.category).toBe("imaging");
  });
});
