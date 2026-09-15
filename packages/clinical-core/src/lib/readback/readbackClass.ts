import { canonical } from "@/lib/verify/normalize";
import { isFormattingOnly } from "@/lib/diff/tokenDiff";

/**
 * Scoped safety tokens for Accept-path readback (ICAO-style).
 *
 * `verifyMeaning()` remains the software hearback / refuse gate for AI.
 * This module is the human checklist: tooth, surface, laterality, drug, dose,
 * unit — confirmed on Apply, not inferred as clinical facts.
 *
 * See knowledge/sources/high-stakes-documentation-patterns.md § Aviation.
 */

export type ReadbackKind = "tooth" | "surface" | "site" | "drug" | "dose" | "unit" | "time";

export interface ReadbackToken {
  kind: ReadbackKind;
  /** Human-facing label for the checklist. */
  label: string;
  /** Normalized multiset key. */
  key: string;
}

export type ReadbackChangeStatus = "added" | "removed" | "unchanged";

export interface ReadbackChange {
  token: ReadbackToken;
  status: ReadbackChangeStatus;
}

export interface ReadbackDiff {
  changes: ReadbackChange[];
  /** After-side tokens that changed — what the clinician must confirm. */
  confirmItems: ReadbackToken[];
  requiresConfirm: boolean;
}

const SITE =
  /\b(?:left|right|upper|lower|maxillary|mandibular|bilateral|unilateral|anterior|posterior)\b/gi;

const SURFACE = /\b([MODBFLIP]{2,5})\b/gi;

const DRUG =
  /\b(?:amoxicillin|penicillin|clindamycin|azithromycin|metronidazole|lidocaine|articaine|septocaine|mepivacaine|bupivacaine|marcaine|epinephrine|ibuprofen|acetaminophen|hydrocodone|oxycodone|midazolam|diazepam|nitrous)\b/gi;

const UNIT_ONLY = /\b(?:mg|mcg|µg|kg|g|mL|ml|L|mm|cm|carpules?|units?|%)\b/gi;

const DOSE =
  /\b(\d+(?:\.\d+)?)\s*(carpules?|carps?|cartridges?|mg|mcg|µg|mL|ml|g|units?)\b|\b(\d+(?:\.\d+)?)\s*%/gi;

const TOOTH_NUM =
  /\b(?:tooth|teeth|#)\s*(\d{1,2})\b|\bteeth?\s+(\d{1,2})\b/gi;

const TOOTH_LETTER =
  /\b(?:tooth|teeth)\s+([A-T])\b/gi;

const TIME = /\b(\d{1,2}:\d{2}\s*(?:am|pm)?|\d+\s*(?:min|mins|minutes|hrs?|hours))\b/gi;

const MAX_CONFIRM = 8;

function pushUnique(out: ReadbackToken[], token: ReadbackToken): void {
  if (out.some((t) => t.key === token.key)) return;
  out.push(token);
}

function normUnit(u: string): string {
  const x = u.toLowerCase();
  if (/^carp/.test(x) || x === "cartridge" || x === "cartridges") return "carpule";
  if (x === "ml") return "ml";
  if (x === "µg") return "mcg";
  return x.replace(/s$/, "");
}

/** Extract READBACK_CLASS tokens from clinical prose. */
export function extractReadback(text: string): ReadbackToken[] {
  const c = canonical(text);
  const out: ReadbackToken[] = [];

  for (const m of c.matchAll(TOOTH_NUM)) {
    const n = m[1] || m[2];
    if (!n) continue;
    const num = Number(n);
    // ADA permanent 1–32 and common supernumerary band; reject years/phones.
    if (num < 1 || num > 82) continue;
    pushUnique(out, { kind: "tooth", label: `tooth ${n}`, key: `tooth:${n}` });
  }
  for (const m of c.matchAll(TOOTH_LETTER)) {
    const letter = m[1].toUpperCase();
    pushUnique(out, { kind: "tooth", label: `tooth ${letter}`, key: `tooth:${letter}` });
  }

  for (const m of c.matchAll(SURFACE)) {
    const raw = m[1].toUpperCase();
    const code = [...raw].sort().join("");
    pushUnique(out, { kind: "surface", label: raw, key: `surface:${code}` });
  }

  for (const m of c.matchAll(SITE)) {
    const s = m[0].toLowerCase();
    pushUnique(out, { kind: "site", label: s, key: `site:${s}` });
  }

  for (const m of c.matchAll(DRUG)) {
    const d = m[0].toLowerCase();
    pushUnique(out, { kind: "drug", label: d, key: `drug:${d}` });
  }

  for (const m of c.matchAll(DOSE)) {
    const amount = m[1] || m[3];
    const unitRaw = m[1] ? m[2] : "%";
    if (!amount || !unitRaw) continue;
    const unit = normUnit(unitRaw);
    const nice =
      unit === "carpule"
        ? `${amount} ${amount === "1" ? "carpule" : "carpules"}`
        : unit === "%"
          ? `${amount}%`
          : `${amount} ${unit}`;
    pushUnique(out, { kind: "dose", label: nice, key: `dose:${amount}:${unit}` });
  }

  // Bare units not already captured as doses (rare; still safety-class).
  for (const m of c.matchAll(UNIT_ONLY)) {
    const u = normUnit(m[0]);
    if (out.some((t) => t.kind === "dose" && t.key.endsWith(`:${u}`))) continue;
    pushUnique(out, { kind: "unit", label: u, key: `unit:${u}` });
  }

  for (const m of c.matchAll(TIME)) {
    const t = m[1].toLowerCase().replace(/\s+/g, "");
    pushUnique(out, { kind: "time", label: m[1].trim(), key: `time:${t}` });
  }

  return out;
}

function multiset(tokens: ReadbackToken[]): Map<string, ReadbackToken> {
  const map = new Map<string, ReadbackToken>();
  for (const t of tokens) map.set(t.key, t);
  return map;
}

/**
 * Diff before/after for the Accept checklist.
 *
 * Formatting-only rewrites (e.g. `400mg` → `400 mg`) do not require confirm.
 * When no READBACK_CLASS token changes, Apply stays one-click.
 */
export function diffReadback(before: string, after: string): ReadbackDiff {
  if (before === after || isFormattingOnly(before, after)) {
    return { changes: [], confirmItems: [], requiresConfirm: false };
  }

  const beforeMap = multiset(extractReadback(before));
  const afterMap = multiset(extractReadback(after));
  const changes: ReadbackChange[] = [];

  for (const [key, token] of afterMap) {
    if (!beforeMap.has(key)) changes.push({ token, status: "added" });
    else changes.push({ token, status: "unchanged" });
  }
  for (const [key, token] of beforeMap) {
    if (!afterMap.has(key)) changes.push({ token, status: "removed" });
  }

  const confirmItems = changes
    .filter((c) => c.status === "added" || c.status === "removed")
    .map((c) =>
      c.status === "removed"
        ? { ...c.token, label: `was ${c.token.label}` }
        : c.token
    )
    .slice(0, MAX_CONFIRM);

  return {
    changes,
    confirmItems,
    requiresConfirm: confirmItems.length > 0
  };
}
