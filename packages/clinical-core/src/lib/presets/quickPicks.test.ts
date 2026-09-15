import { describe, expect, it } from "vitest";
import { CLINICAL_ROLES } from "@/lib/auth/clinicalRoles";
import { QUICK_PICKS, featuredPicksForRole, quickPicksForRole } from "./quickPicks";
import { MODULES_BY_ID } from "@/lib/modules";

describe("quick picks", () => {
  it("reference only real, non-core add-on modules", () => {
    for (const pick of QUICK_PICKS) {
      expect(pick.moduleIds.length).toBeGreaterThan(0);
      for (const id of pick.moduleIds) {
        const mod = MODULES_BY_ID.get(id);
        expect(mod, `${pick.id} -> ${id}`).toBeDefined();
        expect(mod?.alwaysOn ?? false, `${id} must not be the always-on core`).toBe(false);
      }
    }
  });
  it("have unique ids and no duplicate modules within a pick", () => {
    const ids = QUICK_PICKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pick of QUICK_PICKS) {
      expect(new Set(pick.moduleIds).size).toBe(pick.moduleIds.length);
    }
  });
  it("carry no field values — structural selection only", () => {
    for (const pick of QUICK_PICKS) {
      expect("values" in pick).toBe(false);
    }
  });
  it("exposes at least one featured scaffold for every clinical role", () => {
    for (const role of CLINICAL_ROLES) {
      expect(featuredPicksForRole(role).length, role).toBeGreaterThan(0);
      expect(quickPicksForRole(role).length, role).toBeGreaterThan(0);
    }
  });
});
