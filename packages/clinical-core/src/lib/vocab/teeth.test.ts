import { describe, expect, it } from "vitest";
import {
  TOOTH_TABLE,
  allowedSurfaces,
  baseOfSupernumerary,
  describeTeeth,
  getTooth,
  isValidToothId,
  teethForDentition,
  toSupernumerary
} from "./teeth";
import { formatSurfaces } from "./surfaces";

describe("tooth table", () => {
  it("contains 32 permanent, 20 primary, and their supernumeraries", () => {
    const byDentition = (d: string) =>
      [...TOOTH_TABLE.values()].filter((t) => t.dentition === d).length;
    expect(byDentition("permanent")).toBe(32);
    expect(byDentition("primary")).toBe(20);
    expect(byDentition("supernumerary-permanent")).toBe(32);
    expect(byDentition("supernumerary-primary")).toBe(20);
    expect(TOOTH_TABLE.size).toBe(104);
  });

  it("places permanent teeth correctly", () => {
    expect(getTooth("1")?.name).toBe("permanent maxillary right third molar");
    expect(getTooth("8")?.name).toBe("permanent maxillary right central incisor");
    expect(getTooth("9")?.name).toBe("permanent maxillary left central incisor");
    expect(getTooth("16")?.name).toBe("permanent maxillary left third molar");
    expect(getTooth("17")?.name).toBe("permanent mandibular left third molar");
    expect(getTooth("24")?.name).toBe("permanent mandibular left central incisor");
    expect(getTooth("25")?.name).toBe("permanent mandibular right central incisor");
    expect(getTooth("32")?.name).toBe("permanent mandibular right third molar");
    expect(getTooth("3")?.toothClass).toBe("molar");
    expect(getTooth("4")?.toothClass).toBe("premolar");
    expect(getTooth("6")?.toothClass).toBe("canine");
    expect(getTooth("14")?.name).toBe("permanent maxillary left first molar");
    expect(getTooth("19")?.name).toBe("permanent mandibular left first molar");
    expect(getTooth("30")?.name).toBe("permanent mandibular right first molar");
  });

  it("places primary teeth correctly", () => {
    expect(getTooth("A")?.name).toBe("primary maxillary right second molar");
    expect(getTooth("E")?.name).toBe("primary maxillary right central incisor");
    expect(getTooth("F")?.name).toBe("primary maxillary left central incisor");
    expect(getTooth("J")?.name).toBe("primary maxillary left second molar");
    expect(getTooth("K")?.name).toBe("primary mandibular left second molar");
    expect(getTooth("O")?.name).toBe("primary mandibular left central incisor");
    expect(getTooth("P")?.name).toBe("primary mandibular right central incisor");
    expect(getTooth("T")?.name).toBe("primary mandibular right second molar");
    expect(getTooth("C")?.toothClass).toBe("canine");
    expect(getTooth("B")?.toothClass).toBe("molar");
  });

  it("marks anterior teeth: permanent 6-11 and 22-27, primary C-H and M-R", () => {
    const anteriorPermanent = [6, 7, 8, 9, 10, 11, 22, 23, 24, 25, 26, 27].map(String);
    for (let n = 1; n <= 32; n++) {
      expect(getTooth(String(n))?.isAnterior).toBe(anteriorPermanent.includes(String(n)));
    }
    const anteriorPrimary = ["C", "D", "E", "F", "G", "H", "M", "N", "O", "P", "Q", "R"];
    for (const id of "ABCDEFGHIJKLMNOPQRST") {
      expect(getTooth(id)?.isAnterior).toBe(anteriorPrimary.includes(id));
    }
  });

  it("maps supernumerary designations both ways", () => {
    expect(toSupernumerary("8")).toBe("58");
    expect(toSupernumerary("32")).toBe("82");
    expect(toSupernumerary("A")).toBe("AS");
    expect(baseOfSupernumerary("58")).toBe("8");
    expect(baseOfSupernumerary("51")).toBe("1");
    expect(baseOfSupernumerary("AS")).toBe("A");
    expect(getTooth("58")?.dentition).toBe("supernumerary-permanent");
    expect(getTooth("TS")?.dentition).toBe("supernumerary-primary");
    expect(toSupernumerary("58")).toBeUndefined();
  });

  it("rejects invalid designations", () => {
    for (const bad of ["0", "33", "48", "50", "83", "U", "AT", "1S", "ZS", ""]) {
      expect(isValidToothId(bad)).toBe(false);
    }
  });

  it("is case-insensitive and trims input", () => {
    expect(getTooth(" a ")?.id).toBe("A");
    expect(getTooth("as")?.id).toBe("AS");
  });
});

describe("allowedSurfaces", () => {
  it("gives anterior teeth I and F, never O or B", () => {
    expect(allowedSurfaces("8")).toEqual(["M", "I", "D", "F", "L"]);
    expect(allowedSurfaces("8")).not.toContain("O");
    expect(allowedSurfaces("E")).toContain("I");
  });

  it("gives posterior teeth O and B, never I or F", () => {
    expect(allowedSurfaces("30")).toEqual(["M", "O", "D", "B", "L"]);
    expect(allowedSurfaces("30")).not.toContain("I");
    expect(allowedSurfaces("A")).toContain("O");
  });

  it("returns empty for an unknown tooth", () => {
    expect(allowedSurfaces("33")).toEqual([]);
  });
});

describe("formatting helpers", () => {
  it("describes teeth grammatically", () => {
    expect(describeTeeth(["3"])).toBe("tooth 3");
    expect(describeTeeth(["3", "14"])).toBe("teeth 3 and 14");
    expect(describeTeeth(["3", "14", "19"])).toBe("teeth 3, 14, and 19");
  });

  it("formats surfaces in canonical compact order", () => {
    expect(formatSurfaces(["D", "M", "O"])).toBe("MOD");
    expect(formatSurfaces(["L", "B", "D", "O", "M"])).toBe("MODBL");
    expect(formatSurfaces(["F", "I"])).toBe("IF");
  });

  it("lists dentition charts in display order", () => {
    const permanent = teethForDentition("permanent");
    expect(permanent).toHaveLength(32);
    expect(permanent[0].id).toBe("1");
    expect(permanent[16].id).toBe("32");
    const superPrimary = teethForDentition("supernumerary-primary");
    expect(superPrimary[0].id).toBe("AS");
  });
});

describe("FDI secondary notation", () => {
  it("maps the permanent landmarks correctly", () => {
    // Universal 1 = UR third molar = FDI 18; 8 = UR central = 11;
    // 9 = UL central = 21; 16 = UL third molar = 28; 17 = LL third = 38;
    // 24 = LL central = 31; 25 = LR central = 41; 32 = LR third = 48.
    const landmarks: Array<[string, string]> = [
      ["1", "18"], ["8", "11"], ["9", "21"], ["16", "28"],
      ["17", "38"], ["24", "31"], ["25", "41"], ["32", "48"],
      ["3", "16"], ["19", "36"], ["30", "46"], ["14", "26"]
    ];
    for (const [universal, fdi] of landmarks) {
      expect(getTooth(universal)?.fdi, `Universal ${universal}`).toBe(fdi);
    }
  });

  it("maps the primary landmarks correctly", () => {
    const landmarks: Array<[string, string]> = [
      ["A", "55"], ["E", "51"], ["F", "61"], ["J", "65"],
      ["K", "75"], ["O", "71"], ["P", "81"], ["T", "85"]
    ];
    for (const [universal, fdi] of landmarks) {
      expect(getTooth(universal)?.fdi, `Universal ${universal}`).toBe(fdi);
    }
  });

  it("supernumerary designations carry no FDI", () => {
    expect(getTooth("51")?.fdi).toBeUndefined();
    expect(getTooth("AS")?.fdi).toBeUndefined();
  });

  it("every non-supernumerary tooth has a unique valid FDI", () => {
    const seen = new Set<string>();
    for (const tooth of TOOTH_TABLE.values()) {
      if (tooth.dentition.startsWith("supernumerary")) continue;
      expect(tooth.fdi, tooth.id).toMatch(/^[1-8][1-8]$/);
      expect(seen.has(tooth.fdi!), `duplicate FDI ${tooth.fdi}`).toBe(false);
      seen.add(tooth.fdi!);
    }
    expect(seen.size).toBe(52); // 32 permanent + 20 primary
  });
});
