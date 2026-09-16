import type { Surface } from "@/lib/schema/types";

export const ALL_SURFACES: Surface[] = ["M", "O", "I", "D", "B", "F", "L"];

export const SURFACE_NAMES: Record<Surface, string> = {
  M: "mesial",
  O: "occlusal",
  I: "incisal",
  D: "distal",
  B: "buccal",
  F: "facial (labial)",
  L: "lingual"
};

// Compact claim-style code, e.g. "MOD". Canonical order follows ALL_SURFACES.
export function formatSurfaces(surfaces: Surface[]): string {
  return [...surfaces]
    .sort((a, b) => ALL_SURFACES.indexOf(a) - ALL_SURFACES.indexOf(b))
    .join("");
}
