import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";
import {
  andon,
  blockedExplanation,
  buildConcerns,
  copyAllowed,
  isValidAttestation,
  openBlocking,
  reconcile,
  resolveItem,
  type FindingLike,
  type QueueItem
} from "./resolution";
import type { Severity } from "@/lib/audit/types";

const finding = (over: Partial<FindingLike> = {}): FindingLike => ({
  ruleId: "vague.tolerated-well",
  category: "vague-phrase",
  severity: "S2",
  message: '"tolerated well" is vague.',
  matchedText: "tolerated well",
  occurrences: 1,
  suggestion: "State the observed response.",
  ...over
});

function items(concerns = buildConcerns(standardize("Pt tolerated tx well"), [finding()])): QueueItem[] {
  return reconcile([], concerns);
}

describe("buildConcerns", () => {
  it("every applied change becomes a blocking review item — nothing is silently accepted", () => {
    const r = standardize("pt reports pain. tx discussed.");
    const concerns = buildConcerns(r, []);
    const changes = concerns.filter((c) => c.source === "change");
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) {
      expect(c.blocking).toBe(true);
      expect(c.attestable).toBe(false);
    }
  });

  it("a truncation can never be attested or escalated — text was lost", () => {
    const long = "word ".repeat(5000);
    const r = standardize(long);
    const concerns = buildConcerns(r, []);
    const trunc = concerns.find((c) => c.key.startsWith("flag:truncated"));
    expect(trunc).toBeDefined();
    expect(trunc?.attestable).toBe(false);
    expect(trunc?.escalatable).toBe(false);
    expect(trunc?.severity).toBe("S0");
  });

  it("a PHI finding is never escalatable — the fragment must not travel", () => {
    const concerns = buildConcerns(standardize("clean text"), [
      finding({ ruleId: "phi.name", category: "phi", severity: "S0", message: "Possible name." })
    ]);
    const phi = concerns.find((c) => c.ruleId === "phi.name");
    expect(phi?.escalatable).toBe(false);
    expect(phi?.attestable).toBe(false);
  });

  it("S3/S4 findings inform but do not block", () => {
    const concerns = buildConcerns(standardize("clean text"), [
      finding({ severity: "S3" }),
      finding({ severity: "S4", ruleId: "info.x" })
    ]);
    expect(concerns.every((c) => c.source !== "finding" || !c.blocking)).toBe(true);
  });

  it("states what, why, and how for every concern", () => {
    for (const c of items().map((i) => i.concern)) {
      expect(c.what.length, c.key).toBeGreaterThan(3);
      expect(c.why.length, c.key).toBeGreaterThan(10);
      expect(c.how.length, c.key).toBeGreaterThan(10);
    }
  });
});

describe("reconcile across re-runs", () => {
  it("a concern that disappeared was fixed; one that persists keeps its state", () => {
    const first = items();
    const attestedKey = first.find((i) => i.concern.source === "finding")!.concern.key;
    const after = resolveItem(first, attestedKey, {
      kind: "attested",
      reason: "the response is documented in the vitals block"
    });

    // Re-run: the finding persists, the flags/changes are gone (user rewrote).
    const nextConcerns = buildConcerns(standardize("Patient tolerated treatment well"), [finding()]);
    const merged = reconcile(after, nextConcerns);
    const persisted = merged.find((i) => i.concern.key === attestedKey);
    expect(persisted?.state.kind).toBe("attested");
    // Old change-items are not in the new queue at all.
    for (const i of merged) {
      expect(nextConcerns.some((c) => c.key === i.concern.key)).toBe(true);
    }
  });
});

describe("gates", () => {
  it("copy is blocked while anything blocking is open", () => {
    const q = items();
    expect(copyAllowed(q)).toBe(false);
    expect(blockedExplanation(q)).toMatch(/unresolved/);
    expect(blockedExplanation(q)).toMatch(/fix|attest|Team Lead/i);
  });

  it("copy unlocks when every blocking item is resolved", () => {
    let q = items();
    for (const i of openBlocking(q)) {
      q = resolveItem(
        q,
        i.concern.key,
        i.concern.source === "change"
          ? { kind: "reviewed" }
          : { kind: "attested", reason: "verified correct against the source record" }
      );
    }
    expect(copyAllowed(q)).toBe(true);
    expect(blockedExplanation(q)).toBe("");
  });

  it("an escalation resolves the item — the disagreement is on record, not overridden", () => {
    let q = items();
    for (const i of openBlocking(q)) {
      q = resolveItem(
        q,
        i.concern.key,
        i.concern.source === "change" ? { kind: "reviewed" } : { kind: "escalated", wishId: 12 }
      );
    }
    expect(copyAllowed(q)).toBe(true);
  });
});

describe("andon", () => {
  it("red while S1+ open, amber for S2-only, green when clear", () => {
    const q = items();
    expect(andon(q).state).toBe("red"); // flags sit at S1
    // resolve everything except the S2 finding
    let amberQ = q;
    for (const i of openBlocking(q)) {
      if (i.concern.source === "finding") continue;
      amberQ = resolveItem(
        amberQ,
        i.concern.key,
        i.concern.source === "change"
          ? { kind: "reviewed" }
          : { kind: "attested", reason: "verified correct against the source record" }
      );
    }
    expect(andon(amberQ).state).toBe("amber");
    let greenQ = amberQ;
    for (const i of openBlocking(amberQ)) {
      greenQ = resolveItem(greenQ, i.concern.key, {
        kind: "attested",
        reason: "verified correct against the source record"
      });
    }
    expect(andon(greenQ).state).toBe("green");
  });
});

describe("attestation substance", () => {
  it("shares the PHI bar: real words, not filler", () => {
    expect(isValidAttestation("ok")).toBe(false);
    expect(isValidAttestation("asdf asdf asdf asdf asdf")).toBe(false);
    expect(isValidAttestation("the response is recorded in the vitals block")).toBe(true);
  });
});

describe("serving a note builder as well as a paste box", () => {
  const empty = { applied: [], flags: [] };

  it("keeps two required-missing findings in different fields apart", () => {
    // The bug this exists to stop: required.missing carries no matched text, so
    // every one of a note's thirteen produced the identical key. The reconcile
    // Map collapsed them to one, and resolving any one of them resolved all
    // thirteen — thirteen open required fields reported as done.
    const required = (moduleId: string, fieldId: string): FindingLike => ({
      ruleId: "required.missing",
      category: "required",
      severity: "S1",
      message: `"${fieldId}" is required and empty.`,
      matchedText: null,
      occurrences: 1,
      fieldRef: { moduleId, fieldId }
    });
    const concerns = buildConcerns(empty, [
      required("universal-core", "visit-purpose"),
      required("universal-core", "diagnosis")
    ]);
    expect(concerns).toHaveLength(2);
    expect(new Set(concerns.map((c) => c.key)).size).toBe(2);

    // And resolving one leaves the other open.
    const q = reconcile([], concerns);
    const after = resolveItem(q, concerns[0].key, { kind: "attested", reason: "n/a" });
    expect(after.filter((i) => i.state.kind === "open")).toHaveLength(1);
  });

  it("never offers an attestation on a missing required field", () => {
    // The server re-runs computeGates at submit and returns 422 on any open S1.
    // An attestation here would turn the row green and then be refused — a dead
    // end built on purpose.
    const [concern] = buildConcerns(empty, [
      {
        ruleId: "required.missing",
        category: "required",
        severity: "S1",
        message: '"Visit purpose" is required and empty.',
        matchedText: null,
        occurrences: 1,
        fieldRef: { moduleId: "universal-core", fieldId: "visit-purpose" }
      }
    ]);
    expect(concern.attestable).toBe(false);
  });

  it("still lets an ordinary S1 be attested", () => {
    const [concern] = buildConcerns(empty, [
      finding({ ruleId: "medsafe.interaction", severity: "S1", category: "medication-safety" })
    ]);
    expect(concern.attestable).toBe(true);
  });

  it("takes the caller's definition of blocking", () => {
    // The paste box blocks on S0/S1/S2. The note builder blocks on what
    // computeGates blocks on, or the panel would demand work the filing gate
    // does not want on a note that is one click from ready.
    const findings = [finding({ severity: "S2" })];
    expect(buildConcerns(empty, findings)[0].blocking).toBe(true);
    const builderRule = buildConcerns(empty, findings, {
      blockingSeverities: new Set<Severity>(["S0", "S1"])
    });
    expect(builderRule[0].blocking).toBe(false);
  });

  it("leaves the paste box's own behaviour untouched by default", () => {
    // No options passed must mean exactly what it meant before.
    const concerns = buildConcerns(standardize("Pt tolerated tx well"), [finding()]);
    expect(concerns.some((c) => c.source === "finding" && c.blocking)).toBe(true);
  });
});
