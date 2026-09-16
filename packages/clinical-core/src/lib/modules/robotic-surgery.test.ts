import { describe, expect, it } from "vitest";
import { roboticSurgery } from "./robotic-surgery";
import { MODULES_BY_ID, moduleMatches } from "./index";
import { fieldKey } from "@/lib/schema/types";
import type { NoteState } from "@/lib/schema/types";
import { runAudit } from "@/lib/audit/engine";
import { composeNote } from "@/lib/compose/composeNote";

// The robotic record's legal spine: planned vs actual, registration,
// deviations with reasons, and the surgeon-in-control statement. These tests
// hold the required fields required — deleting one later must fail loudly.

describe("robotic-surgery module shape", () => {
  it("is registered and findable by the words staff actually type", () => {
    expect(MODULES_BY_ID.get("robotic-surgery")).toBe(roboticSurgery);
    for (const query of ["yomi", "robot", "navigation", "override"]) {
      expect(moduleMatches(roboticSurgery, query), query).toBe(true);
    }
  });

  it("requires the fields a board reviewer looks for", () => {
    const requiredIds = roboticSurgery.sections
      .flatMap((s) => s.fields)
      .filter((f) => f.required)
      .map((f) => f.id);
    for (const id of [
      "system",
      "guidance-mode",
      "planned-positions",
      "registration",
      "actual-positions",
      "deviations",
      "surgeon-control",
      "verification-method",
      "outcome"
    ]) {
      expect(requiredIds, id).toContain(id);
    }
  });

  it("the surgeon-in-control field cannot be free text — it is confirmed or unresolved", () => {
    const field = roboticSurgery.sections
      .flatMap((s) => s.fields)
      .find((f) => f.id === "surgeon-control");
    expect(field?.type).toBe("select");
  });
});

describe("robotic-surgery composition and audit", () => {
  const filled: NoteState = {
    selectedModuleIds: ["robotic-surgery"],
    values: {
      [fieldKey("robotic-surgery", "system")]: { kind: "text", value: "Guidance platform, release 4.2" },
      [fieldKey("robotic-surgery", "guidance-mode")]: { kind: "select", value: "haptic passive guidance" },
      [fieldKey("robotic-surgery", "plan-source")]: { kind: "select", value: "linked in the EDR" },
      [fieldKey("robotic-surgery", "planned-positions")]: {
        kind: "text",
        value: "Site 30: planned depth 11.5 mm, angulation 4 degrees distal."
      },
      [fieldKey("robotic-surgery", "registration")]: {
        kind: "select",
        value: "verified and accepted by the surgeon"
      },
      [fieldKey("robotic-surgery", "actual-positions")]: {
        kind: "text",
        value: "Site 30: achieved depth 11.5 mm, angulation 4 degrees distal."
      },
      [fieldKey("robotic-surgery", "deviations")]: {
        kind: "text",
        value:
          "Placement followed the digital plan within the system's stated tolerance; no surgeon override occurred."
      },
      [fieldKey("robotic-surgery", "haptic-events")]: { kind: "text", value: "None during the recorded period." },
      [fieldKey("robotic-surgery", "surgeon-control")]: { kind: "select", value: "confirmed" },
      [fieldKey("robotic-surgery", "verification-method")]: {
        kind: "multiselect",
        values: ["post-placement radiograph", "guidance-system placement report"]
      },
      [fieldKey("robotic-surgery", "outcome")]: {
        kind: "text",
        value:
          "No complication was observed during the recorded period; neurosensory status intact at discharge assessment."
      }
    }
  };

  it("a completed robotic record composes and raises no required findings", () => {
    const composed = composeNote(filled, [roboticSurgery], { officeName: null });
    expect(composed).toContain("Registration and execution");
    expect(composed).toContain("surgeon remained in physical control");
    const report = runAudit({ note: filled, modules: [roboticSurgery], composedText: composed });
    expect(report.findings.filter((f) => f.category === "required")).toHaveLength(0);
  });

  it("an empty robotic record is stopped by the required rule", () => {
    const empty: NoteState = { selectedModuleIds: ["robotic-surgery"], values: {} };
    const report = runAudit({
      note: empty,
      modules: [roboticSurgery],
      composedText: composeNote(empty, [roboticSurgery], { officeName: null })
    });
    const required = report.findings.filter((f) => f.category === "required");
    expect(required.length).toBeGreaterThanOrEqual(8);
  });
});
