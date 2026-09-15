import { describe, expect, it } from "vitest";
import { diffReadback, extractReadback } from "./readbackClass";

describe("extractReadback — storm", () => {
  it("pulls teeth, surfaces, sites, drugs, doses, and units", () => {
    const tokens = extractReadback(
      "Tooth 19 MOD restored on the left with 2 carpules lidocaine 2%."
    );
    expect(tokens.map((t) => `${t.kind}:${t.label}`)).toEqual([
      "tooth:tooth 19",
      "surface:MOD",
      "site:left",
      "drug:lidocaine",
      "dose:2 carpules",
      "dose:2%"
    ]);
  });

  it("is case-insensitive for the same tooth", () => {
    const a = extractReadback("tooth 19 restored.").map((t) => t.key).sort();
    const b = extractReadback("Tooth 19 restored.").map((t) => t.key).sort();
    expect(a).toEqual(b);
  });

  it("treats carpule / carpules as the same unit family in keys", () => {
    const a = extractReadback("1 carpule lidocaine.").filter((t) => t.kind === "dose");
    const b = extractReadback("1 carpules lidocaine.").filter((t) => t.kind === "dose");
    expect(a[0]?.key).toBe(b[0]?.key);
  });

  it("does not invent teeth from medical-history NKA prose", () => {
    const tokens = extractReadback("NKA. No known drug allergies. Soft tissue WNL.");
    expect(tokens.filter((t) => t.kind === "tooth")).toEqual([]);
  });

  it("is idempotent ×3", () => {
    const text = "Lower right tooth 30 MO, 1.8 mL articaine.";
    const once = extractReadback(text).map((t) => t.key);
    expect(extractReadback(text).map((t) => t.key)).toEqual(once);
    expect(extractReadback(text).map((t) => t.key)).toEqual(once);
    expect(extractReadback(text).map((t) => t.key)).toEqual(once);
  });
});

describe("diffReadback — Accept gate", () => {
  it("requires confirm when laterality flips", () => {
    const d = diffReadback(
      "Lower left first molar restored.",
      "Lower right first molar restored."
    );
    expect(d.requiresConfirm).toBe(true);
    expect(d.changes.some((c) => /left|right/i.test(c.token.label))).toBe(true);
  });

  it("requires confirm when tooth number changes", () => {
    const d = diffReadback("Tooth 19 restored.", "Tooth 18 restored.");
    expect(d.requiresConfirm).toBe(true);
    expect(d.changes.map((c) => c.token.label).join(" ")).toMatch(/19|18/);
  });

  it("requires confirm when carpule count changes", () => {
    const d = diffReadback("2 carpules lidocaine used.", "3 carpules lidocaine used.");
    expect(d.requiresConfirm).toBe(true);
  });

  it("does not require confirm for pt → patient wording only", () => {
    const d = diffReadback(
      "pt tolerated the procedure well.",
      "The patient tolerated the procedure well."
    );
    expect(d.requiresConfirm).toBe(false);
    expect(d.confirmItems).toEqual([]);
  });

  it("skips formatting-only spacing of a glued dose", () => {
    // 400mg → 400 mg is the standardizer's spacing fix, not a clinical change.
    const d = diffReadback("ibuprofen 400mg given.", "ibuprofen 400 mg given.");
    expect(d.requiresConfirm).toBe(false);
  });

  it("lists after-side changed tokens for the checklist, capped", () => {
    const d = diffReadback(
      "Tooth 3 MOD left, 1 carpule lidocaine.",
      "Tooth 14 DOL right, 4 carpules articaine 4%."
    );
    expect(d.requiresConfirm).toBe(true);
    expect(d.confirmItems.length).toBeGreaterThan(0);
    expect(d.confirmItems.length).toBeLessThanOrEqual(8);
  });
});
