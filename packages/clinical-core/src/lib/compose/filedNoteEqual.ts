import type { NoteState } from "@/lib/schema/types";
import { activeModules } from "@/lib/modules";
import { composeNote } from "./composeNote";

// Whether two note states would file the SAME record. The dedup guard that
// stops a duplicate ticket must compare the artifact that actually freezes into
// the ticket — the composed note — NOT the raw NoteState.
//
// composeNote normalizes things raw-state equality treats as different:
// multiselect and surface values are emitted in canonical option order, text is
// trimmed, and a stray select.otherText is ignored unless "__other__" is
// chosen. A raw comparison therefore reports "changed" for edits whose filed
// output is byte-identical — e.g. toggling a multiselect chip off and back on
// reorders its array — which would re-open the submit gate and let a second,
// identical ticket be filed for the same encounter. Comparing composed output
// is provably the record: same composed note (and same modules) => same frozen
// copy and same audit, so nothing is lost by treating them as equal.
export function filedNoteEqual(a: NoteState, b: NoteState): boolean {
  return (
    composeNote(a, activeModules(a.selectedModuleIds)) ===
    composeNote(b, activeModules(b.selectedModuleIds))
  );
}
