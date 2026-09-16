import { describe, expect, it } from "vitest";
import { proposeReading } from "./proposeReading";

describe("proposeReading", () => {
  it("proposes composite resin when restorative cues surround CR", () => {
    const p = proposeReading(
      "CR",
      ["composite resin", "centric relation"],
      "Tooth 14 MOD CR placed after etch and bond."
    );
    expect(p?.suggested).toMatch(/composite resin/i);
  });

  it("proposes gutta-percha when endo cues surround GP", () => {
    const p = proposeReading(
      "GP",
      ["gutta-percha", "general practitioner"],
      "RCT completed; GP and sealer placed in the canal."
    );
    expect(p?.suggested).toMatch(/gutta-percha/i);
  });

  it("stays silent when cues do not favor one reading", () => {
    const p = proposeReading("CR", ["composite resin", "centric relation"], "Patient presents for evaluation.");
    expect(p).toBeUndefined();
  });

  it("never invents an alternative outside the table", () => {
    const alts = ["composite resin", "centric relation"];
    const p = proposeReading("CR", alts, "MOD composite etch bond shade A2");
    expect(p).toBeDefined();
    expect(alts).toContain(p!.suggested);
  });

  it("boosts glass ionomer when a tooth number and liner cues surround GI", () => {
    const p = proposeReading(
      "GI",
      ["glass ionomer", "gastrointestinal"],
      "Tooth 3 GI liner placed; Fuji IX used as a base."
    );
    expect(p?.suggested).toMatch(/glass ionomer/i);
  });
});
