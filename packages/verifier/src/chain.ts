import { createHash } from "node:crypto";
import { CHAIN_STEPS } from "./contract";

export interface ChainEvent {
  prevHash: string;
  hash: string;
  tenantId: string;
  kind: string;
  payload: unknown;
  occurredAt: string;
}

export type Severity = "refuse" | "concern";

export interface Objection {
  stepId: string;
  severity: Severity;
  says: string;
  because: string;
}

export interface ChainVerdict {
  publish: boolean;
  objections: Objection[];
  stepsChecked: number;
  stepsExpected: number;
}

const GENESIS = "0".repeat(64);

function canonicalize(payload: unknown): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return JSON.stringify(payload, Object.keys(payload as object).sort());
  }
  return JSON.stringify(payload);
}

export function expectedHash(event: Omit<ChainEvent, "hash">): string {
  const body = [
    event.prevHash,
    event.tenantId,
    event.kind,
    canonicalize(event.payload),
    event.occurredAt,
  ].join("\n");
  return createHash("sha256").update(body).digest("hex");
}

export function verifyChain(events: ChainEvent[]): ChainVerdict {
  const objections: Objection[] = [];
  const byId = new Map(CHAIN_STEPS.map((s) => [s.id, s]));

  if (events.length > 0) {
    if (events[0].prevHash !== GENESIS) {
      const step = byId.get("genesis-known")!;
      objections.push({
        stepId: step.id,
        severity: "refuse",
        says: "The first event does not follow the published genesis hash.",
        because: step.ifAbsent,
      });
    }
  }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const recomputed = expectedHash(ev);
    if (recomputed !== ev.hash) {
      const step = byId.get("hash-agrees")!;
      objections.push({
        stepId: step.id,
        severity: "refuse",
        says: `Event ${i} hash does not match the restated digest.`,
        because: step.ifAbsent,
      });
    }
    if (i > 0 && ev.prevHash !== events[i - 1].hash) {
      const step = byId.get("links-hold")!;
      objections.push({
        stepId: step.id,
        severity: "refuse",
        says: `Event ${i} does not name the previous event's hash.`,
        because: step.ifAbsent,
      });
    }
  }

  return {
    publish: objections.every((o) => o.severity !== "refuse"),
    objections,
    stepsChecked: CHAIN_STEPS.length,
    stepsExpected: CHAIN_STEPS.length,
  };
}
