import type { AuditFinding } from "../types";
import type { ModuleDef, NoteState, Surface } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldVisible } from "@/lib/schema/conditions";
import { allowedSurfaces, getTooth, isValidToothId } from "@/lib/vocab/teeth";

// Wrong-site risk is an S0 STOP. Mixed dentition and buccal/facial usage are
// clinician-review items, not stops.

export function runAnatomyStateRule(state: NoteState, modules: ModuleDef[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (!isFieldVisible(field, mod.id, state)) continue;
        const value = state.values[fieldKey(mod.id, field.id)];
        if (!value) continue;
        const fieldRef = { moduleId: mod.id, fieldId: field.id };

        if (value.kind === "teeth") {
          const dentitions = new Set<string>();
          for (const id of value.teeth) {
            const tooth = getTooth(id);
            if (!tooth) {
              findings.push({
                ruleId: "anatomy.invalid-tooth",
                category: "anatomy",
                severity: "S0",
                message: `"${id}" is not a valid ADA Universal tooth designation.`,
                matchedText: id,
                fieldRef
              });
              continue;
            }
            dentitions.add(tooth.dentition.replace("supernumerary-", ""));
          }
          if (dentitions.size > 1) {
            findings.push({
              ruleId: "anatomy.mixed-dentition",
              category: "anatomy",
              severity: "S2",
              message:
                "Primary and permanent designations appear in one field. This is real in mixed dentition; a clinician confirms it is intended.",
              fieldRef
            });
          }
        }

        if (value.kind === "surfaces") {
          // Wrong-site guard: surfaces must belong to a tooth the linked tooth
          // field actually lists. Changing or clearing the tooth after picking
          // surfaces would otherwise leave the note asserting work on a tooth
          // it never names.
          if (field.type === "surfacePicker") {
            const linked = state.values[fieldKey(mod.id, field.linkedToothFieldId)];
            const linkedTeeth = linked?.kind === "teeth" ? linked.teeth : [];
            const toothLabel =
              section.fields.find((f) => f.id === field.linkedToothFieldId)?.label ?? "the tooth field";
            for (const [toothId, surfaces] of Object.entries(value.byTooth)) {
              if ((surfaces as Surface[]).length === 0) continue;
              if (linkedTeeth.includes(toothId)) continue;
              findings.push({
                ruleId: "anatomy.surface-orphan",
                category: "anatomy",
                severity: "S0",
                message: `Surfaces are recorded for tooth ${toothId}, but "${toothLabel}" does not list that tooth. Correct the site before this entry leaves the tool.`,
                matchedText: toothId,
                fieldRef
              });
            }
          }

          for (const [toothId, surfaces] of Object.entries(value.byTooth)) {
            const tooth = getTooth(toothId);
            if (!tooth) {
              findings.push({
                ruleId: "anatomy.invalid-tooth",
                category: "anatomy",
                severity: "S0",
                message: `"${toothId}" is not a valid ADA Universal tooth designation.`,
                matchedText: toothId,
                fieldRef
              });
              continue;
            }
            const allowed = allowedSurfaces(toothId);
            for (const s of surfaces as Surface[]) {
              if (allowed.includes(s)) continue;
              const hardStop =
                (s === "O" && tooth.isAnterior) || (s === "I" && !tooth.isAnterior);
              findings.push({
                ruleId: hardStop ? "anatomy.surface-stop" : "anatomy.surface-review",
                category: "anatomy",
                severity: hardStop ? "S0" : "S2",
                message: hardStop
                  ? `Surface ${s} is not valid on ${tooth.name} (tooth ${toothId}). Anterior teeth take I; posterior teeth take O.`
                  : `Surface ${s} on ${tooth.name} (tooth ${toothId}) mixes buccal and facial usage. Use the exact surface the clinical or claim context requires.`,
                matchedText: `${toothId}:${s}`,
                fieldRef
              });
            }
          }
        }
      }
    }
  }
  return findings;
}

// Free-text cross-check: catches impossible Universal numbers and probable
// FDI leakage in narrative text.
//
// The tooth marker is deliberately broader than the word "tooth". Staff write
// "#19", "No. 19", and "teeth 3, 4" interchangeably, and the structured
// wrong-site guard only covers the four modules that have a tooth picker — so
// on every other module the site arrives as narrative, and a rule that only
// fired on the literal word "tooth" let "#36" (FDI leakage) pass silently
// while "tooth 36" was stopped. The same clinical error must not depend on
// which word the writer chose.
//
// A number immediately followed by a unit of time or measurement is not a
// tooth, so the lookahead ends the tooth run there. Without it, "tooth 30,
// 45 minutes total" would flag 45 as an invalid tooth and block.
const NOT_A_UNIT =
  "(?!\\s*(?:minutes?|mins?|seconds?|secs?|hours?|hrs?|days?|weeks?|months?|years?|mm|cm|ml|mg|%)\\b)";

// ...and not an INSTRUMENT either. "#" introduces a tooth number by convention,
// but it also introduces a bur, a file, a blade, and a suture gauge — and those
// numbers run far past 32, so "#557 carbide bur" read as an impossible ADA tooth
// designation and raised S0, blocking copy, download, and email on one of the
// commonest tokens in a restorative note. The precision corpus caught it.
//
// A tooth number and an instrument number are told apart by the noun that
// follows, which is how a reader tells them apart too. The residual risk is a
// wrong-site error phrased as "tooth #36 diamond"; that is not a sentence anyone
// writes, and trading a near-impossible miss for a frequent false stop is the
// right way round.
const NOT_AN_INSTRUMENT =
  "(?!\\s*(?:carbide|diamond|round|tapered|safe[\\s-]?end)?\\s*" +
  "(?:burs?|burrs?|blades?|files?|reamers?|spreaders?|pluggers?|curettes?|scalers?|" +
  "explorers?|mirrors?|needles?|gauge|sutures?|strips?|bands?|matrix|matrices|sensors?|" +
  "cassettes?|handpieces?|elevators?|forceps|luxators?)\\b)";

// The markers that introduce a tooth number. "no." keeps its period so ordinary
// prose ("no other findings", "no 3 canals seen") does not read as a tooth ref;
// "#" is a tooth number in a dental note by convention. Only the word forms can
// introduce a comma list.
const TOOTH_MARK = "(?:\\btooth|\\bteeth|#|\\bno\\.)";
const TOOTH_LIST = new RegExp(
  `${TOOTH_MARK}\\s*#?\\s*(\\d{1,3}${NOT_A_UNIT}${NOT_AN_INSTRUMENT}(?:[\\s,]*(?:and|&|through|to|or|-)?[\\s,]*#?\\d{1,3}${NOT_A_UNIT}${NOT_AN_INSTRUMENT})*)`,
  "gi"
);

// A tooth number written next to a surface that its class cannot have. This is
// the free-text twin of the structured anatomy.surface-stop (S0): occlusal on
// an anterior tooth, incisal on a posterior one. Only these two are hard stops,
// because every other surface is legal somewhere. The word forms are matched
// case-insensitively; the bare letters O / I only in upper case and only as
// whole tokens, so "or", "in", and "is" cannot be read as a surface.
const SURF_WORD = new RegExp(`${TOOTH_MARK}\\s*#?\\s*(\\d{1,3})\\s+(occlusal|incisal)\\b`, "gi");
const SURF_CODE = new RegExp(`${TOOTH_MARK}\\s*#?\\s*(\\d{1,3})\\s+(O|I)\\b`, "g");

export function runAnatomyTextRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const seen = new Map<string, number>();
  // A tooth keyword can introduce a list ("teeth 3, 36, and 40"), so every
  // number in the run is checked, not just the first.
  for (const m of text.matchAll(TOOTH_LIST)) {
    for (const numMatch of m[1].matchAll(/\d{1,3}/g)) {
      const num = numMatch[0];
      if (isValidToothId(num)) continue;
      seen.set(num, (seen.get(num) ?? 0) + 1);
    }
  }
  for (const [num, count] of seen) {
    const n = Number(num);
    const fdi = n >= 11 && n <= 48;
    findings.push({
      ruleId: "anatomy.text-tooth",
      category: "anatomy",
      severity: "S0",
      message: fdi
        ? `Tooth ${num} is not a valid ADA Universal designation. It may be FDI notation; this office uses ADA Universal (1-32, A-T).`
        : `Tooth ${num} is not a valid ADA Universal designation.`,
      matchedText: num,
      occurrences: count
    });
  }

  // Surface-vs-class check. Runs over VALID teeth only — an invalid number is
  // already an S0 above, and its class is unknown anyway.
  const surfSeen = new Map<string, number>();
  const scan = (re: RegExp, normalize: (s: string) => "O" | "I") => {
    for (const m of text.matchAll(re)) {
      const num = m[1];
      const tooth = getTooth(num);
      if (!tooth) continue;
      const surface = normalize(m[2]);
      const hardStop = (surface === "O" && tooth.isAnterior) || (surface === "I" && !tooth.isAnterior);
      if (!hardStop) continue;
      const key = `${num}:${surface}`;
      surfSeen.set(key, (surfSeen.get(key) ?? 0) + 1);
    }
  };
  scan(SURF_WORD, (s) => (s.toLowerCase() === "occlusal" ? "O" : "I"));
  scan(SURF_CODE, (s) => (s === "O" ? "O" : "I"));
  for (const [key, count] of surfSeen) {
    const [num, surface] = key.split(":");
    const tooth = getTooth(num)!;
    findings.push({
      ruleId: "anatomy.text-surface-stop",
      category: "anatomy",
      severity: "S0",
      message: `Surface ${surface} is not valid on ${tooth.name} (tooth ${num}). Anterior teeth take I; posterior teeth take O. Correct the site before this entry leaves the tool.`,
      matchedText: `${num} ${surface}`,
      occurrences: count
    });
  }
  return findings;
}
