import { describe, expect, it } from "vitest";
import { PROCEDURE_TERMS } from "./procedures";
import { CARE_EVENT_TERMS, FINDING_TERMS, MATERIAL_TERMS, DRUG_SHORTHAND } from "./clinical-terms";
import { BANNED_ABBREVIATIONS } from "./abbreviations";

// ONE LITERAL, ONE TABLE.
//
// The extractor tries its readers in a fixed order, so a literal appearing in
// two tables is resolved by whichever reader happens to run first. That is a
// coin flip dressed as a rule, and it changes silently the day someone reorders
// the readers for an unrelated reason.
//
// Caught in practice: "OHI" was in both PROCEDURE_TERMS and CARE_EVENT_TERMS,
// and only ever came out as a procedure. Harmless there. Not harmless the day
// the two entries disagree about what the term means.

const tables = {
  procedures: PROCEDURE_TERMS.map((t) => t.literal.join(" ")),
  findings: FINDING_TERMS.map((t) => t.literal.join(" ")),
  materials: MATERIAL_TERMS.map((t) => t.literal.join(" ")),
  careEvents: CARE_EVENT_TERMS.map((t) => t.literal.join(" "))
};

describe("no literal appears in two extractor tables", () => {
  const names = Object.keys(tables) as Array<keyof typeof tables>;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      it(`${names[i]} and ${names[j]} do not overlap`, () => {
        const a = new Set(tables[names[i]]);
        const overlap = tables[names[j]].filter((literal) => a.has(literal));
        expect(overlap).toEqual([]);
      });
    }
  }
});

describe("no table contradicts the practice's own safety vocabulary", () => {
  it("no extractor literal is a banned abbreviation", () => {
    // Recognising a do-not-use abbreviation well enough to chart from it is a
    // way of making it usable, which is the exact opposite of banning it.
    const banned = new Set([...BANNED_ABBREVIATIONS].map((b) => String(b).toLowerCase()));
    for (const [name, literals] of Object.entries(tables)) {
      for (const literal of literals) {
        expect(banned.has(literal), `${name} defines the banned abbreviation "${literal}"`).toBe(false);
      }
    }
  });

  it("no drug shorthand collides with a term literal", () => {
    const all = new Set(Object.values(tables).flat());
    for (const key of Object.keys(DRUG_SHORTHAND)) {
      expect(all.has(key), `"${key}" is both drug shorthand and a term literal`).toBe(false);
    }
  });
});

describe("tables are internally well formed", () => {
  it.each(Object.entries(tables))("%s has no duplicate literal", (_name, literals) => {
    expect(new Set(literals).size).toBe(literals.length);
  });

  it.each(Object.entries(tables))("%s has no empty literal", (_name, literals) => {
    for (const literal of literals) expect(literal.trim().length).toBeGreaterThan(0);
  });

  it("every id is unique across all tables", () => {
    const ids = [
      ...PROCEDURE_TERMS.map((t) => t.id),
      ...FINDING_TERMS.map((t) => t.id),
      ...MATERIAL_TERMS.map((t) => t.id),
      ...CARE_EVENT_TERMS.map((t) => t.id)
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
