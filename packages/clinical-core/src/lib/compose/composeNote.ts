import type { Field, FieldValue, ModuleDef, NoteState, Surface } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldVisible, isValueEmpty } from "@/lib/schema/conditions";
import { describeTeeth } from "@/lib/vocab/teeth";
import { formatSurfaces } from "@/lib/vocab/surfaces";

// The composer walks modules in canonical order, so every note comes out in
// the same standardized sequence no matter how it was entered.
// Empty optional fields are omitted: a blank never silently becomes normal,
// and required blanks surface as audit findings instead.

// Neutralize markdown structure in user-entered free text so a typed
// "## Submission record" can never forge a heading, a table, or a code fence
// in the frozen note or audit report — the real stamp uses those exact
// markers, and the frozen .md is EMAILED as an attachment and opened in real
// markdown viewers, which is where a forgery would be believed.
//
// This used to escape leading "#" within 0-3 spaces, plus runs of 3+ -*_.
// That is an allowlist of two against a grammar with a dozen block starters,
// and it lost five ways, every one of them typable into an ordinary textarea:
//
//   FOUR SPACES   the escape window was 0-3, so one more space walked past it
//                 - and inside the "- Label:" list item the extra indent put
//                 "##" at relative column zero, a genuine H2.
//   SETEXT        "Submission record" then "--" is an H2 in pure markdown.
//                 The old rule needed 3+ dashes; a setext underline needs one.
//   RAW HTML      nothing escaped "<" at all.
//   <!--          an UNTERMINATED comment erases the entire rest of the
//                 document: the allergy block, the diagnosis, the plan, and
//                 the genuine Submission record all vanish from the rendered
//                 attachment while the file still "contains" them.
//   FENCES        an unterminated ``` or ~~~ swallows the rest as sample code,
//                 which works even in renderers that strip HTML.
//
// So the rule is inverted: escape anything that can START a block, and escape
// "<" everywhere. Ordinary prose and real bullet lists are left alone — a
// leading "- " with content after it is a list item and harmless; what is
// escaped is a line made ONLY of underline/rule characters.
function sanitizeUserText(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      // "<" first, and everywhere rather than only at line start: it is the
      // one character that can erase the remainder of the document, and it
      // does not need to be at the beginning of a line to do it.
      let out = line.replace(/</g, "\\<");
      // Indented code blocks need 4 spaces; three can never start a block, and
      // clamping here is also what closes the "one more space" heading bypass.
      out = out.replace(/^[ \t]+/, (ws) => " ".repeat(Math.min(3, ws.length)));
      // Headings, blockquotes, table rows, and fences.
      out = out.replace(/^( {0,3})([#>|]|`{3,}|~{3,})/, (_m, ws, tok) => `${ws}\\${tok}`);
      // A line made only of underline or rule characters: setext H1 ("="),
      // setext H2 ("-", any count), and thematic breaks.
      out = out.replace(/^( {0,3})([=\-*_])([=\-*_\s]*)$/, (_m, ws, first, rest) =>
        `${ws}\\${first}${rest}`
      );
      return out;
    })
    .join("\n");
}

function formatValue(field: Field, value: FieldValue): string {
  switch (value.kind) {
    case "select":
      // Option values are sanitized too, not just the "other" free text: a
      // tampered client can PATCH any string into a select, and drafts stored
      // before option-set validation existed may still hold one.
      return value.value === "__other__"
        ? sanitizeUserText((value.otherText ?? "").trim())
        : sanitizeUserText(value.value);
    case "multiselect": {
      const joiner = field.type === "multiselect" ? (field.joiner ?? "; ") : "; ";
      // Compose in the field's canonical option order, not the user's click
      // order, so the same selections always render identically (standard work).
      const order =
        field.type === "multiselect"
          ? new Map(field.options.map((o, i) => [o.value, i]))
          : null;
      const values = order
        ? [...value.values].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
        : value.values;
      return values.map(sanitizeUserText).join(joiner);
    }
    case "text":
      return sanitizeUserText(value.value.trim());
    case "teeth":
      return describeTeeth(value.teeth);
    case "surfaces": {
      const parts = Object.entries(value.byTooth)
        .filter(([, surfaces]) => surfaces.length > 0)
        .map(([tooth, surfaces]) => `tooth ${tooth} (${formatSurfaces(surfaces as Surface[])})`);
      return parts.join("; ");
    }
    case "measurement":
      return value.value === null ? "" : `${value.value} ${value.unit}`;
  }
}

export interface NoteContext {
  /** The office this encounter happened at, already resolved to a name. */
  officeName?: string | null;
}

export function composeNote(
  state: NoteState,
  modules: ModuleDef[],
  context: NoteContext = {}
): string {
  const lines: string[] = ["# De-identified Smile Note draft", ""];
  // Location goes at the TOP, with the encounter identity, not in the footer.
  // A reader checking they have the right chart open scans the first lines;
  // "which office was this" is part of that check, and a wrong-office paste is
  // exactly the error the header exists to make visible. Omitted entirely when
  // unknown, rather than printed as "Unknown" — a placeholder reads like a
  // finding about the visit instead of a gap in the record.
  if (context.officeName) {
    // Sanitized and bounded like every other string that reaches this document.
    // The office name is DB-supplied rather than typed into the note, which is
    // why this is precaution rather than a live hole — but an office called
    // "X\n\n## Submission record" would otherwise forge the frozen stamp's own
    // heading, and a name field with no admin UI today will have one tomorrow.
    // Collapsed to one line first: a heading forged on line two is still a
    // forged heading.
    const office = sanitizeUserText(context.officeName.replace(/\s+/g, " ").trim()).slice(0, 120);
    if (office) lines.push(`**Office:** ${office}`, "");
  }
  const ordered = [...modules].sort((a, b) => a.order - b.order);

  for (const mod of ordered) {
    const moduleLines: string[] = [];
    for (const section of mod.sections) {
      const sectionLines: string[] = [];
      for (const field of section.fields) {
        if (!isFieldVisible(field, mod.id, state)) continue;
        const value = state.values[fieldKey(mod.id, field.id)];
        if (isValueEmpty(value)) continue;
        const text = formatValue(field, value as FieldValue);
        if (!text) continue;
        sectionLines.push(`- ${field.label}: ${text}`);
      }
      if (sectionLines.length > 0) {
        sectionLines.unshift(`### ${section.title}`, "");
        sectionLines.push("");
        moduleLines.push(...sectionLines);
      }
    }
    if (moduleLines.length > 0) {
      lines.push(`## ${mod.title}`, "", ...moduleLines);
    }
  }

  lines.push(
    "---",
    "",
    "Complete identities, exact dates, times, signatures, permits, codes, and record links only in the EDR.",
    "A licensed clinician must compare every fact with the source record, resolve every flag, and sign in the EDR."
  );
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

// Plain-text variant for .txt export: same content, markdown markers stripped.
export function composeNoteText(
  state: NoteState,
  modules: ModuleDef[],
  context: NoteContext = {}
): string {
  return composeNote(state, modules, context)
    .replace(/^#{1,3} /gm, "")
    .replace(/^- /gm, "  ")
    // The office line is bold in markdown; the plain-text copy is what gets
    // pasted into Curve Hero, so the asterisks must not travel with it.
    .replace(/^\*\*(.+?):\*\* /gm, "$1: ");
}

export function suggestedFilename(state: NoteState, modules: ModuleDef[]): string {
  const active = modules
    .filter((m) => !m.alwaysOn && state.selectedModuleIds.includes(m.id))
    .sort((a, b) => a.order - b.order);
  const slug = active.length === 0 ? "universal-core" : active[0].id;
  return `dental-note-draft-${slug}`;
}
