import { describe, expect, it } from "vitest";
import { runTextAudit } from "@pms/clinical-core";
import { advise } from "./advisor";
import { KNOWLEDGE, detectPassive } from "./knowledge";

describe("Byte's knowledge base holds itself to the practice's standards", () => {
  it("every entry cites a source", () => {
    for (const entry of KNOWLEDGE) {
      expect(entry.source.length, entry.id).toBeGreaterThan(10);
    }
  });

  it("ids are unique and namespaced", () => {
    const ids = KNOWLEDGE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^byte\./);
  });

  it("no advice text contains judgement words about people", () => {
    const banned = /\b(lazy|sloppy|careless|bad|worst|failure|stupid|wrong of you)\b/i;
    for (const entry of KNOWLEDGE) {
      expect(entry.say, entry.id).not.toMatch(banned);
      expect(entry.why, entry.id).not.toMatch(banned);
    }
  });

  it("Byte's own words pass the practice's blocking audit", () => {
    for (const entry of KNOWLEDGE) {
      const blocking = runTextAudit(`${entry.say} ${entry.why}`).filter(
        (f) => f.severity === "S0" || f.severity === "S1"
      );
      expect(blocking, `${entry.id}: ${blocking.map((f) => f.ruleId).join(", ")}`).toEqual([]);
    }
  });

  it("every predicate is total — junk input never throws", () => {
    for (const text of ["", "\u0000", "#".repeat(200), "no no no", "was was was"]) {
      expect(() => advise(text)).not.toThrow();
    }
  });
});

describe("active voice coaching — encourage active, discourage passive", () => {
  it("detects the passive that hides an actor", () => {
    expect(detectPassive("2 carpules were administered.")).toHaveLength(1);
    expect(detectPassive("The tooth was extracted and instructions were given.")).toHaveLength(2);
  });

  it("accepts passive that NAMES the actor — the coaching point is attribution", () => {
    expect(detectPassive("2 carpules were administered by Dr. M.")).toEqual([]);
  });

  it("does not flag active voice", () => {
    expect(detectPassive("Dr. M administered 2 carpules. The patient reports pain.")).toEqual([]);
  });

  it("surfaces the active-voice advice on a passive-heavy note", () => {
    const report = advise("#14 MOD composite. The restoration was placed and instructions were given.");
    expect(report.advice.some((a) => a.id === "byte.active-voice")).toBe(true);
  });
});

describe("the advisor engine", () => {
  it("stays silent on an empty page, with an idle mood", () => {
    const report = advise("");
    expect(report.advice).toEqual([]);
    expect(report.mood).toBe("idle");
  });

  it("raises the dose-context advice when a computable dose appears", () => {
    const report = advise("2 carp lido 2% w epi administered by Dr. M");
    expect(report.advice.some((a) => a.id === "byte.dose-context")).toBe(true);
    expect(report.gauges.dose?.drug).toBe("lidocaine");
    expect(report.gauges.dose?.mg).toBeCloseTo(72);
    expect(report.gauges.dose?.maxMg).toBe(300);
  });

  it("asks about allergy status when a prescription has no allergy line", () => {
    const report = advise("Rx ibuprofen 600 mg prescribed by Dr. M");
    expect(report.advice.some((a) => a.id === "byte.allergy-status")).toBe(true);
  });

  it("stands down on allergies once the note answers", () => {
    const report = advise("NKDA verified. Rx ibuprofen 600 mg prescribed by Dr. M");
    expect(report.advice.some((a) => a.id === "byte.allergy-status")).toBe(false);
  });

  it("teaches the Schwarcz lesson on an extraction without aftercare", () => {
    const report = advise("#17 extracted by Dr. M.");
    const lesson = report.advice.find((a) => a.id === "byte.extraction-aftercare");
    expect(lesson).toBeDefined();
    expect(lesson!.source).toContain("Schwarcz");
  });

  it("stands down once post-operative instructions appear", () => {
    const report = advise("#17 extracted by Dr. M. Post-op instructions given verbally and in writing.");
    expect(report.advice.some((a) => a.id === "byte.extraction-aftercare")).toBe(false);
  });

  it("wants the radiograph interpretation Tennessee counts as part of the record", () => {
    const report = advise("4 bitewing radiographs acquired.");
    expect(report.advice.some((a) => a.id === "byte.radiograph-interpretation")).toBe(true);
  });

  it("never shows more than three pieces of advice", () => {
    const messy =
      "#17 extracted. 4 bitewing radiographs acquired. Rx ibuprofen 600 mg. consent form signed. The tooth was removed.";
    expect(advise(messy).advice.length).toBeLessThanOrEqual(3);
  });

  it("orders safety above law above craft", () => {
    const report = advise("2 carp lido 2%. 4 bitewing radiographs acquired. The crown was cemented.");
    expect(report.advice[0].id).toBe("byte.dose-context");
  });

  it("coaches clinical rationale when a procedure has no documented why", () => {
    const report = advise("Crown prep on tooth 14 completed. Patient tolerated well.");
    expect(report.advice.some((a) => a.id === "byte.clinical-rationale")).toBe(true);
  });

  it("coaches prescription indication and bounded negatives from the integrity digest", () => {
    expect(
      advise("Prescribed amoxicillin 500 mg three times daily for 7 days.").advice.some(
        (a) => a.id === "byte.rx-indication"
      )
    ).toBe(true);
    expect(advise("Crown seated. No problems.").advice.some((a) => a.id === "byte.bounded-negatives")).toBe(
      true
    );
  });

  it("tracks the defensibility pillars only when treatment happened", () => {
    expect(advise("Periodic exam. No caries.").gauges.pillars.applicable).toBe(false);
    const treated = advise("#14 MOD composite placed by Dr. M. Post-op instructions given. Recall 6 months.");
    expect(treated.gauges.pillars.applicable).toBe(true);
    expect(treated.gauges.pillars.instructions).toBe(true);
    expect(treated.gauges.pillars.followUp).toBe(true);
  });

  it("moods follow the numbers: safety advice reads concerned", () => {
    expect(advise("#17 extracted by Dr. M.").mood).toBe("concerned");
  });

  it("is deterministic", () => {
    const text = "#14 MOD comp, 2 carp lido 2%, pt tol well";
    expect(JSON.stringify(advise(text))).toBe(JSON.stringify(advise(text)));
  });

  it("is fast enough for every pause in typing", () => {
    const note = "#14 MOD composite placed by Dr. M, 2 carp lido 2% w epi. No caries #18. ".repeat(30);
    const started = performance.now();
    for (let i = 0; i < 20; i++) advise(note);
    expect((performance.now() - started) / 20).toBeLessThan(25);
  });

  it("gauges never report a confidence percentage", () => {
    const report = advise("2 carp lido 2% w epi administered by Dr. M");
    expect(JSON.stringify(report.gauges)).not.toMatch(/confidence/i);
    expect(report.gauges.pillars.consent).toBeTypeOf("boolean");
  });
});
