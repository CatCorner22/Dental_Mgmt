import { describe, expect, it } from "vitest";
import { chartMarks, chartRegions, contradictions } from "./chart";
import { extractFacts } from "./extract";

const marksFor = (text: string) => chartMarks(extractFacts(text));
const markOn = (text: string, toothId: string) => marksFor(text).find((m) => m.toothId === toothId);

describe("the chart is a record of THIS NOTE, never of the mouth", () => {
  it("leaves a tooth the note never mentioned blank", () => {
    expect(markOn("#14 MOD composite placed", "3")).toBeUndefined();
  });

  it("draws nothing at all from an empty note", () => {
    expect(marksFor("")).toEqual([]);
  });

  it("does not chart a finding about a family member", () => {
    expect(markOn("Father history of extraction #14", "14")?.status).not.toBe("affirmed");
  });
});

describe("what gets painted, and what only gets outlined", () => {
  it("fills an affirmed procedure", () => {
    const mark = markOn("#14 MOD composite placed", "14");
    expect(mark?.status).toBe("affirmed");
    expect(mark?.category).toBe("restorative");
    expect(mark?.surfaces).toEqual(["M", "O", "D"]);
  });

  it("outlines rather than fills a tooth the note cleared", () => {
    // "I looked at 14 and it was clean" must not look like "I never looked".
    expect(markOn("No caries #14", "14")?.status).toBe("negated");
  });

  it("marks a historical restoration as hinted, not as work done today", () => {
    const mark = markOn("Existing amalgam #14 MOD", "14");
    expect(mark?.status).toBe("hinted");
    expect(mark?.hint).toBe("historical");
  });

  it("marks a planned crown as hinted, not as a crown", () => {
    expect(markOn("Will need crown #14 if fracture propagates", "14")?.hint).toBe("hypothetical");
  });

  it("lets an affirmed fact upgrade a cleared one on the same tooth", () => {
    const mark = markOn("No caries #14. #14 MOD composite placed.", "14");
    expect(mark?.status).toBe("affirmed");
  });

  it("keeps the most consequential category when a tooth carries several", () => {
    // An extraction outranks a restoration -- and the pair is also exactly the
    // contradiction we want left visible rather than averaged away.
    expect(markOn("#17 composite placed. #17 extracted.", "17")?.category).toBe("surgical");
  });

  it("carries an impossible surface through to the chart", () => {
    expect(markOn("#8 MOB composite", "8")?.impossibleSurfaces).toContain("O");
  });
});

describe("contradictions stay rare on purpose", () => {
  it("catches a tooth extracted and restored in one note", () => {
    const found = contradictions(extractFacts("#17 MOD composite placed. #17 extracted."));
    expect(found).toHaveLength(1);
    expect(found[0].toothId).toBe("17");
    expect(found[0].id).toBe("consistency.extracted-and-restored");
  });

  it("catches a tooth extracted and root-canalled in one note", () => {
    const found = contradictions(extractFacts("#3 root canal therapy. #3 extracted."));
    expect(found.map((f) => f.id)).toContain("consistency.extracted-and-endo");
  });

  it("does NOT flag a plan, which is not a claim about today", () => {
    // "Extracted 17, will need composite 17" is a treatment sequence, not a
    // contradiction. Flagging it is how a checker earns the override reflex
    // that makes every later flag invisible.
    expect(contradictions(extractFacts("#17 extracted, will need composite #17"))).toEqual([]);
  });

  it("does NOT flag a historical procedure against a current one", () => {
    expect(contradictions(extractFacts("Previous extraction #17. Composite #14 MOD placed."))).toEqual([]);
  });

  it("does NOT flag two different teeth", () => {
    expect(contradictions(extractFacts("#17 extracted. #14 MOD composite placed."))).toEqual([]);
  });

  it("does NOT flag a negated procedure", () => {
    expect(contradictions(extractFacts("#17 extracted. No composite #17."))).toEqual([]);
  });

  it("stays quiet on an ordinary note", () => {
    const note =
      "Prophylaxis completed. #3, 14, 30 sealants placed. No caries. Bitewings taken. Recall 6 months.";
    expect(contradictions(extractFacts(note))).toEqual([]);
  });
});

describe("quadrants are regions, never eight teeth", () => {
  const regionsFor = (text: string) => chartRegions(extractFacts(text));

  it("reads a quadrant treated without a tooth being named", () => {
    expect(regionsFor("SRP UR and LR quads")).toEqual(["UR", "LR"]);
  });

  it("reads the spelled form too", () => {
    expect(regionsFor("Scaling and root planing, upper right and lower left quadrants")).toEqual([
      "UR",
      "LL"
    ]);
  });

  // THE RULE THIS ENFORCES. A quadrant says work happened in a region; it does
  // not say which of eight teeth. Filling them in would put a statement on the
  // chart the note never made.
  it("does not turn a quadrant into tooth marks", () => {
    expect(marksFor("SRP UR quad")).toEqual([]);
  });

  it("drops a quadrant when the note also named teeth in it", () => {
    // The teeth are the more specific statement; drawing both double-counts
    // one finding as two.
    expect(regionsFor("SRP UR quad, #3 and #4 instrumented")).toEqual([]);
  });

  it("ignores lowercase, because 'ur' and 'll' appear in ordinary typing", () => {
    expect(regionsFor("patient will ur and ll return")).toEqual([]);
  });

  it("does not chart a planned or historical quadrant as treated today", () => {
    expect(regionsFor("Will need SRP UR quad if pockets persist")).toEqual([]);
    expect(regionsFor("Previous SRP UR quad")).toEqual([]);
  });

  it("does not chart a negated quadrant", () => {
    expect(regionsFor("No SRP UR quad performed")).toEqual([]);
  });
});

describe("chart marks tolerate anything", () => {
  it.each(["", "   ", "#", "#####", "\u0000", "no", "tooth tooth tooth"])(
    "never throws on %j",
    (text) => {
      expect(() => chartMarks(extractFacts(text))).not.toThrow();
      expect(() => contradictions(extractFacts(text))).not.toThrow();
    }
  );
});
