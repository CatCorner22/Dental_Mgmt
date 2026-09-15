import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SEVERITY_CHIP,
  SEVERITY_CLASS,
  SEVERITY_RAIL,
  SEVERITY_SHAPE,
  STATUS_CLASS,
  SEVERITY_ORDER
} from "./types";
import type { OverallStatus } from "./types";

// Severity is this app's core safety vocabulary. S0 means stop; S3 means style.
// The ramp that renders it existed TWICE — `SEVERITY_STYLES` in AuditPanel.tsx
// and `SEV_CLASS` in Standardizer.tsx — and the two had quietly drifted apart
// at S3 and S4. The same finding rendered blue in the note builder and grey on
// the Standardize page, telling a clinician that an informational item was a
// different KIND of item depending on which screen they were looking at.
//
// These tests exist so it cannot happen again: one ramp, complete, and no
// component may define a second one.

// Every surface that renders a severity. The standardize screen was retired;
// the two surfaces that show findings now are the note's audit panel and the
// paste intake, and both must read the shared ramp rather than restate it.
const COMPONENTS = [
  "src/components/builder/AuditPanel.tsx",
  "src/components/builder/PasteIntake.tsx"
];

const STATUSES: OverallStatus[] = [
  "BLOCKED",
  "NEEDS CLINICIAN ACTION",
  "READY FOR CLINICIAN REVIEW",
  "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED"
];

describe("one severity ramp, shared", () => {
  it("styles every severity the audit can emit", () => {
    for (const s of SEVERITY_ORDER) {
      expect(SEVERITY_CLASS[s], `no style for ${s}`).toBeTruthy();
    }
    expect(Object.keys(SEVERITY_CLASS).sort()).toEqual([...SEVERITY_ORDER].sort());
  });

  it("styles every overall status", () => {
    for (const s of STATUSES) {
      expect(STATUS_CLASS[s], `no style for ${s}`).toBeTruthy();
    }
  });

  it("gives each severity a distinct appearance, in every ramp", () => {
    // Two severities that look identical are two severities a reader cannot
    // tell apart, which defeats the point of grading them. Applied to EVERY ramp,
    // so a second presentation of the same vocabulary cannot quietly collapse two
    // levels that the first one distinguished.
    for (const [name, ramp] of [
      ["SEVERITY_CLASS", SEVERITY_CLASS],
      ["SEVERITY_RAIL", SEVERITY_RAIL],
      ["SEVERITY_CHIP", SEVERITY_CHIP],
      ["SEVERITY_SHAPE", SEVERITY_SHAPE]
    ] as const) {
      expect(new Set(Object.values(ramp)).size, `${name} has two identical entries`).toBe(
        SEVERITY_ORDER.length
      );
      expect(Object.keys(ramp).sort(), `${name} is missing a severity`).toEqual(
        [...SEVERITY_ORDER].sort()
      );
    }
  });

  it("no component defines its own ramp", () => {
    // The drift was possible because the mapping lived in the components.
    for (const rel of COMPONENTS) {
      const src = readFileSync(path.join(process.cwd(), rel), "utf8");
      // ANY of the shared ramps counts. The guard's point is that the mapping
      // must not live in the component, not that there is only ever one
      // presentation of it — the audit panel renders severity as a rail and a chip
      // rather than a filled box, and both of those ramps are defined in
      // lib/audit/types beside the original.
      const RAMPS = ["SEVERITY_CLASS", "SEVERITY_RAIL", "SEVERITY_CHIP"];
      expect(
        RAMPS.some((r) => src.includes(r)),
        `${rel} must import a shared severity ramp (one of ${RAMPS.join(", ")})`
      ).toBe(true);
      for (const localName of ["SEVERITY_STYLES", "SEV_CLASS", "STATUS_STYLES"]) {
        expect(
          src.includes(`const ${localName}`),
          `${rel} re-declares ${localName} — use the shared ramp in lib/audit/types`
        ).toBe(false);
      }
    }
  });

  it("keeps the severity ordering the audit sorts by", () => {
    expect(SEVERITY_ORDER).toEqual(["S0", "S1", "S2", "S3", "S4"]);
  });
});
