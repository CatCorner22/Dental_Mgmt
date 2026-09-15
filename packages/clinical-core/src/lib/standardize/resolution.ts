import type { RaisedFlag, StandardizeResult } from "./standardize";
import type { Severity } from "@/lib/audit/types";
import { isValidPhiAttestation } from "@/lib/audit/attestation";

// FIX-OR-ATTEST: the resolution model for everything the transformer catches.
//
// The governing rule, stated once: THE TOOL NEVER AUTO-CORRECTS AND THE USER
// NEVER OVERRIDES. Every concern the pass raises must end in exactly one of:
//
//   FIXED     — the user edited the text and a re-run no longer raises it.
//   REVIEWED  — for the deterministic rewrites only: a human read the
//               itemised change and accepted it. The rewrite was language-
//               only, but "language-only" is this module's claim, and a claim
//               nobody checks is how the NKA→NKDA class of bug shipped.
//   ATTESTED  — the user states, in real words, why the flagged text is
//               correct as written. Same substance bar as the PHI override:
//               friction plus a named record is the enforceable part.
//   ESCALATED — the user genuinely disagrees with the RULE, not the catch.
//               That is not an override: the disagreement goes to a Team Lead
//               (a rule-disagreement wish) for final resolution, and the
//               record of it survives either way.
//
// Nothing leaves the tool while a blocking concern is open. That is the whole
// jidoka posture: the line stops, the reason is stated in cold logic, and the
// person is given the exact ways forward.

export type ConcernSource = "change" | "flag" | "finding";

export interface FindingLike {
  ruleId: string;
  category: string;
  severity: Severity;
  message: string;
  matchedText: string | null;
  occurrences: number;
  suggestion?: string | null;
  /**
   * Which field raised it, when the caller has fields.
   *
   * Load-bearing for identity, not just for display. The paste screen audits
   * one string, so a rule id plus the matched text names a finding uniquely
   * there. The note builder audits a note with sixty controls, and its
   * "required.missing" findings carry no matched text at all — every one of the
   * thirteen produced exactly the same key, the reconcile Map collapsed them to
   * one, and resolving any one of them resolved all thirteen.
   */
  fieldRef?: { moduleId: string; fieldId: string } | null;
}

export interface BuildConcernsOptions {
  /**
   * Which severities stop the line. Defaults to the paste screen's rule
   * (S0/S1/S2), which is deliberately stricter than the note builder's gate.
   *
   * The builder passes its own, because computeGates blocks export on S0 and
   * email on S0+S1 and nothing else — and it is the SERVER re-running
   * computeGates that decides whether a note may be filed. A panel that
   * demanded resolution of every S2 would be asking for work the filing gate
   * does not want, on a note that is one click from ready.
   */
  blockingSeverities?: ReadonlySet<Severity>;
}

const DEFAULT_BLOCKING: ReadonlySet<Severity> = new Set<Severity>(["S0", "S1", "S2"]);

export interface Concern {
  /** Stable across re-runs, so a fixed concern disappears and an attested one keeps its state. */
  key: string;
  source: ConcernSource;
  severity: Severity;
  blocking: boolean;
  /** What was found — the cold WHAT. */
  what: string;
  /** Why the line stops here — the cold WHY. */
  why: string;
  /** The exact ways forward — the cold HOW. */
  how: string;
  matchedText?: string;
  ruleId?: string;
  occurrences: number;
  /** False where an attestation can never make the text right (a truncation, a wrong-site stop). */
  attestable: boolean;
  /** False where sending the content to a wish would itself be wrong (PHI fragments). */
  escalatable: boolean;
  /**
   * Suggested reading for ambiguous shorthand — display only. The writer must
   * still type the expansion; nothing here is applied to the note.
   */
  proposal?: { suggested: string; rationale: string };
}

export type ResolutionState =
  | { kind: "open" }
  | { kind: "reviewed" }
  | { kind: "attested"; reason: string }
  | { kind: "escalated"; wishId: number };

export interface QueueItem {
  concern: Concern;
  state: ResolutionState;
}

// Attestation substance bar: shared with the PHI override so the two dialogs
// can never disagree about what counts as a reason.
export const ATTESTATION_RULE =
  "State why the flagged text is correct as written, in at least four words (20 characters or more).";
export function isValidAttestation(reason: string): boolean {
  return isValidPhiAttestation(reason);
}

// ---------------------------------------------------------------------------
// Building concerns from a standardize result + audit findings.

function flagWhy(flag: RaisedFlag): string {
  switch (flag.kind) {
    case "medication-spelling":
      return "A drug name is never corrected automatically: 'almost certainly' is not a standard a medication is allowed to be corrected on.";
    case "ambiguous-shorthand":
      return "The shorthand has more than one real reading. Choosing one would put a clinical claim in the note that the writer never made.";
    case "implausible-quantity":
      return "The number as written cannot be right. The tool will not guess what it should be — a documentation tool that proposes a dose has become a clinical decision-support system.";
    case "truncated":
      return "Text was LOST. Nothing can attest away missing clinical content.";
    case "vague-phrase":
      return "Vague wording is what fails in a deposition. The specific fact exists; only the writer knows it.";
    case "stale-text":
      return "Relative time words rot: 'today' means nothing to a reader in three years. The record needs the durable form.";
    case "stigmatizing":
      return "The wording characterizes the patient rather than documenting the visit. A later reader — or a jury — reads it as bias.";
    default:
      return "The correct wording depends on facts the note is hiding.";
  }
}

export function buildConcerns(
  result: Pick<StandardizeResult, "applied" | "flags">,
  findings: FindingLike[],
  opts: BuildConcernsOptions = {}
): Concern[] {
  const blockingSeverities = opts.blockingSeverities ?? DEFAULT_BLOCKING;
  const concerns: Concern[] = [];

  for (const change of result.applied) {
    concerns.push({
      key: `change:${change.kind}:${change.from}`,
      source: "change",
      severity: "S3",
      blocking: true,
      what:
        change.kind === "formatting"
          ? `Formatting normalized: ${change.why}`
          : `Rewrote "${change.from}" as "${change.to}"${change.count > 1 ? ` (${change.count}×)` : ""}.`,
      why: change.why,
      how: "Read the change. Accept it if it says exactly what you wrote — reject everything and edit by hand if it does not.",
      occurrences: change.count,
      attestable: false,
      escalatable: false
    });
  }

  for (const flag of result.flags) {
    const truncated = flag.kind === "truncated";
    concerns.push({
      key: `flag:${flag.kind}:${flag.display}`,
      source: "flag",
      severity: truncated ? "S0" : "S1",
      blocking: true,
      what: `${flag.display}${flag.count > 1 ? ` (${flag.count}×)` : ""}`,
      why: flagWhy(flag),
      how: flag.guidance,
      occurrences: flag.count,
      attestable: !truncated,
      escalatable: !truncated,
      ...(flag.proposal
        ? {
            proposal: {
              suggested: flag.proposal.suggested,
              rationale: flag.proposal.rationale
            }
          }
        : {})
    });
  }

  for (const f of findings) {
    const blocking = blockingSeverities.has(f.severity);
    const phi = f.category === "phi";
    const field = f.fieldRef ? `${f.fieldRef.moduleId}.${f.fieldRef.fieldId}` : "";
    concerns.push({
      key: `finding:${f.ruleId}:${field}:${f.matchedText ?? ""}`,
      source: "finding",
      severity: f.severity,
      blocking,
      what: f.message,
      why:
        f.severity === "S0"
          ? "A STOP finding means the note as written must not reach the record — not by copy, not by paste."
          : f.severity === "S1"
            ? "A REQUIRED finding is a fact the record cannot stand without, or a documented harm pattern."
            : "A REVIEW finding needs a clinician's judgment before the note is defensible.",
      how: f.suggestion ?? "Edit the text so the finding no longer applies, then re-check.",
      matchedText: f.matchedText ?? undefined,
      ruleId: f.ruleId,
      occurrences: f.occurrences,
      // A PHI stop has its own attested-override path in the builder; on the
      // paste screen it is fix-only, because copying an identifier out of the
      // tool is the exact harm. Non-PHI S0 (wrong site, invalid tooth) is
      // fix-only everywhere.
      //
      // A missing REQUIRED field is fix-only too, and for a harder reason: the
      // server re-runs runAudit and computeGates at submit and returns 422 on
      // any open S1. Offering an attestation would let someone write a reason,
      // watch the row go green, press Submit and be refused — a dead end built
      // on purpose. The field is empty; the only thing that resolves it is
      // filling it in.
      attestable: f.severity !== "S0" && f.ruleId !== "required.missing",
      // Escalating a PHI catch would copy the flagged fragment into a wish.
      escalatable: !phi
    });
  }

  return concerns;
}

// ---------------------------------------------------------------------------
// Reconciling states across re-runs: a concern that disappeared was FIXED; a
// concern that persists keeps whatever the user already did about it.

export function reconcile(prev: QueueItem[], next: Concern[]): QueueItem[] {
  const prevByKey = new Map(prev.map((i) => [i.concern.key, i]));
  return next.map((concern) => {
    const before = prevByKey.get(concern.key);
    return { concern, state: before ? before.state : { kind: "open" as const } };
  });
}

export function resolveItem(items: QueueItem[], key: string, state: ResolutionState): QueueItem[] {
  return items.map((i) => (i.concern.key === key ? { ...i, state } : i));
}

// ---------------------------------------------------------------------------
// Gates and the andon.

export function openBlocking(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.concern.blocking && i.state.kind === "open");
}

export function copyAllowed(items: QueueItem[]): boolean {
  return openBlocking(items).length === 0;
}

export type AndonState = "red" | "amber" | "green";

export function andon(items: QueueItem[]): { state: AndonState; open: number; total: number } {
  const blocking = items.filter((i) => i.concern.blocking);
  const open = openBlocking(items);
  if (open.some((i) => i.concern.severity === "S0" || i.concern.severity === "S1")) {
    return { state: "red", open: open.length, total: blocking.length };
  }
  if (open.length > 0) return { state: "amber", open: open.length, total: blocking.length };
  return { state: "green", open: 0, total: blocking.length };
}

/** The cold-logic line under a disabled Copy button. States the count, the reason, and the ways out. */
export function blockedExplanation(items: QueueItem[]): string {
  const open = openBlocking(items);
  if (open.length === 0) return "";
  const stops = open.filter((i) => i.concern.severity === "S0").length;
  const parts: string[] = [];
  parts.push(
    `${open.length} item${open.length === 1 ? " is" : "s are"} unresolved, so this note does not leave the tool yet.`
  );
  if (stops > 0) {
    parts.push(
      `${stops} of them ${stops === 1 ? "is a STOP" : "are STOPs"} that can only be fixed in the text.`
    );
  }
  parts.push("For each item: fix the text and re-check, attest why it is correct, or send the disagreement to a Team Lead.");
  return parts.join(" ");
}
