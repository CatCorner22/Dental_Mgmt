import type { Unit } from "@/lib/schema/types";

export const ALL_UNITS: Unit[] = [
  "mm",
  "mL",
  "mg",
  "mcg",
  "%",
  "mm Hg",
  "L/min",
  "bpm",
  "breaths/min",
  "°C",
  "kg",
  "min"
];

export const UNIT_LABELS: Record<Unit, string> = {
  mm: "millimeters",
  mL: "milliliters",
  mg: "milligrams",
  mcg: "micrograms",
  "%": "percent",
  "mm Hg": "millimeters of mercury",
  "L/min": "liters per minute",
  bpm: "beats per minute",
  "breaths/min": "breaths per minute",
  "°C": "degrees Celsius",
  kg: "kilograms",
  min: "minutes"
};

export function formatMeasurement(value: number, unit: Unit): string {
  return `${value} ${unit}`;
}
