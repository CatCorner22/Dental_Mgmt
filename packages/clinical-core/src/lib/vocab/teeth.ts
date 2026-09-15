import type { Dentition, Surface, ToothId } from "@/lib/schema/types";

// ADA Universal/National Tooth Designation System.
// Permanent 1-32, primary A-T, supernumerary permanent 51-82 (+50),
// supernumerary primary AS-TS (letter + "S").

export interface Tooth {
  id: ToothId;
  dentition: Dentition;
  arch: "maxillary" | "mandibular";
  side: "right" | "left";
  quadrant: "UR" | "UL" | "LL" | "LR";
  toothClass: "incisor" | "canine" | "premolar" | "molar";
  isAnterior: boolean;
  name: string;
  /**
   * ISO 3950 (FDI) two-digit notation, as a SECONDARY display only.
   *
   * Universal remains the number that enters the record — the audit's
   * FDI-leakage rule stays in force, because a bare "18" in prose is
   * ambiguous between the two systems and that ambiguity is the whole
   * hazard. This field exists so a picker or chart can show "3 (FDI 16)"
   * to staff trained abroad, who otherwise translate in their heads all
   * day — a translation step being exactly where wrong-tooth errors live.
   * Undefined for supernumerary designations (FDI's supernumerary form is
   * not part of the practice's charting standard).
   */
  fdi?: string;
}

type ClassName =
  | "third molar"
  | "second molar"
  | "first molar"
  | "second premolar"
  | "first premolar"
  | "canine"
  | "lateral incisor"
  | "central incisor";

const PERMANENT_CLASS_ORDER: ClassName[] = [
  "third molar",
  "second molar",
  "first molar",
  "second premolar",
  "first premolar",
  "canine",
  "lateral incisor",
  "central incisor"
];

// Primary dentition has no premolars.
const PRIMARY_CLASS_ORDER: ClassName[] = [
  "second molar",
  "first molar",
  "canine",
  "lateral incisor",
  "central incisor"
];

interface QuadrantSeed {
  quadrant: Tooth["quadrant"];
  arch: Tooth["arch"];
  side: Tooth["side"];
  ids: string[]; // distal to mesial, matching the class order above
}

const PERMANENT_QUADRANTS: QuadrantSeed[] = [
  { quadrant: "UR", arch: "maxillary", side: "right", ids: ["1", "2", "3", "4", "5", "6", "7", "8"] },
  { quadrant: "UL", arch: "maxillary", side: "left", ids: ["16", "15", "14", "13", "12", "11", "10", "9"] },
  { quadrant: "LL", arch: "mandibular", side: "left", ids: ["17", "18", "19", "20", "21", "22", "23", "24"] },
  { quadrant: "LR", arch: "mandibular", side: "right", ids: ["32", "31", "30", "29", "28", "27", "26", "25"] }
];

const PRIMARY_QUADRANTS: QuadrantSeed[] = [
  { quadrant: "UR", arch: "maxillary", side: "right", ids: ["A", "B", "C", "D", "E"] },
  { quadrant: "UL", arch: "maxillary", side: "left", ids: ["J", "I", "H", "G", "F"] },
  { quadrant: "LL", arch: "mandibular", side: "left", ids: ["K", "L", "M", "N", "O"] },
  { quadrant: "LR", arch: "mandibular", side: "right", ids: ["T", "S", "R", "Q", "P"] }
];

function classOf(className: ClassName): Tooth["toothClass"] {
  if (className.includes("molar") && !className.includes("premolar")) return "molar";
  if (className.includes("premolar")) return "premolar";
  if (className === "canine") return "canine";
  return "incisor";
}

function buildTable(): Map<ToothId, Tooth> {
  const table = new Map<ToothId, Tooth>();
  // FDI quadrant digits: permanent 1-4, primary 5-8, both clockwise from the
  // patient's upper right. Position counts from the midline (1 = central
  // incisor); the seed ids run distal-to-mesial, so position is the distance
  // from the END of the list.
  const FDI_QUADRANT: Record<"permanent" | "primary", Record<Tooth["quadrant"], number>> = {
    permanent: { UR: 1, UL: 2, LL: 3, LR: 4 },
    primary: { UR: 5, UL: 6, LL: 7, LR: 8 }
  };
  const add = (
    seedQuadrants: QuadrantSeed[],
    classOrder: ClassName[],
    dentition: "permanent" | "primary"
  ) => {
    for (const q of seedQuadrants) {
      q.ids.forEach((id, i) => {
        const className = classOrder[i];
        const toothClass = classOf(className);
        const isAnterior = toothClass === "incisor" || toothClass === "canine";
        const fdi = `${FDI_QUADRANT[dentition][q.quadrant]}${q.ids.length - i}`;
        const tooth: Tooth = {
          id,
          dentition,
          arch: q.arch,
          side: q.side,
          quadrant: q.quadrant,
          toothClass,
          isAnterior,
          name: `${dentition} ${q.arch} ${q.side} ${className}`,
          fdi
        };
        table.set(id, tooth);
        // Derive the supernumerary designation adjacent to this tooth.
        const superId = dentition === "permanent" ? String(Number(id) + 50) : `${id}S`;
        table.set(superId, {
          ...tooth,
          id: superId,
          dentition: dentition === "permanent" ? "supernumerary-permanent" : "supernumerary-primary",
          name: `supernumerary tooth adjacent to ${dentition} ${q.arch} ${q.side} ${className}`,
          fdi: undefined
        });
      });
    }
  };
  add(PERMANENT_QUADRANTS, PERMANENT_CLASS_ORDER, "permanent");
  add(PRIMARY_QUADRANTS, PRIMARY_CLASS_ORDER, "primary");
  return table;
}

export const TOOTH_TABLE: ReadonlyMap<ToothId, Tooth> = buildTable();

export function getTooth(id: string): Tooth | undefined {
  return TOOTH_TABLE.get(id.trim().toUpperCase());
}

export function isValidToothId(id: string): boolean {
  return getTooth(id) !== undefined;
}

export function toSupernumerary(id: ToothId): ToothId | undefined {
  const tooth = getTooth(id);
  if (!tooth) return undefined;
  if (tooth.dentition === "permanent") return String(Number(id) + 50);
  if (tooth.dentition === "primary") return `${tooth.id}S`;
  return undefined;
}

export function baseOfSupernumerary(id: ToothId): ToothId | undefined {
  const tooth = getTooth(id);
  if (!tooth) return undefined;
  if (tooth.dentition === "supernumerary-permanent") return String(Number(id) - 50);
  if (tooth.dentition === "supernumerary-primary") return tooth.id.slice(0, 1);
  return undefined;
}

// Anterior teeth ordinarily take I (incisal); posterior teeth take O (occlusal).
// B (buccal) is the posterior cheek-facing surface; F (facial/labial) the anterior one.
export function allowedSurfaces(id: ToothId): Surface[] {
  const tooth = getTooth(id);
  if (!tooth) return [];
  return tooth.isAnterior ? ["M", "I", "D", "F", "L"] : ["M", "O", "D", "B", "L"];
}

export function describeTeeth(ids: ToothId[]): string {
  if (ids.length === 0) return "";
  const word = ids.length === 1 ? "tooth" : "teeth";
  if (ids.length === 1) return `${word} ${ids[0]}`;
  if (ids.length === 2) return `${word} ${ids[0]} and ${ids[1]}`;
  return `${word} ${ids.slice(0, -1).join(", ")}, and ${ids[ids.length - 1]}`;
}

// Display orders for chart UIs (viewer's left to right).
export const PERMANENT_MAXILLARY_ORDER: ToothId[] = Array.from({ length: 16 }, (_, i) => String(i + 1));
export const PERMANENT_MANDIBULAR_ORDER: ToothId[] = Array.from({ length: 16 }, (_, i) => String(32 - i));
export const PRIMARY_MAXILLARY_ORDER: ToothId[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
export const PRIMARY_MANDIBULAR_ORDER: ToothId[] = ["T", "S", "R", "Q", "P", "O", "N", "M", "L", "K"];

export function teethForDentition(dentition: Dentition): Tooth[] {
  const order: ToothId[] =
    dentition === "permanent" || dentition === "supernumerary-permanent"
      ? [...PERMANENT_MAXILLARY_ORDER, ...PERMANENT_MANDIBULAR_ORDER]
      : [...PRIMARY_MAXILLARY_ORDER, ...PRIMARY_MANDIBULAR_ORDER];
  return order.map((baseId) => {
    const id =
      dentition === "supernumerary-permanent"
        ? String(Number(baseId) + 50)
        : dentition === "supernumerary-primary"
          ? `${baseId}S`
          : baseId;
    const tooth = TOOTH_TABLE.get(id);
    if (!tooth) throw new Error(`missing tooth ${id}`);
    return tooth;
  });
}
