import { createHash } from "node:crypto";
import { CHAIN_STEPS } from "./contract";

export interface ChainEvent {
  prevHash: string;
  hash: string;
  tenantId: string;
  /**
   * Who acted, `null` for a system actor. Rows written before the actor
   * joined the digest carry no key here and verify under the legacy digest.
   */
  actorUserId?: string | null;
  kind: string;
  payload: unknown;
  occurredAt: string;
  /** Per-tenant position from 1. Optional so hash fixtures without it still verify. */
  seq?: number;
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

export function expectedHash(event: Omit<ChainEvent, "hash" | "seq">): string {
  const body = [
    event.prevHash,
    event.tenantId,
    ...(event.actorUserId === undefined ? [] : [`actor:${event.actorUserId ?? ""}`]),
    event.kind,
    canonicalize(event.payload),
    event.occurredAt,
  ].join("\n");
  return createHash("sha256").update(body).digest("hex");
}

/**
 * The digest that binds the actor is authoritative. The five-field legacy
 * digest still matches rows sealed before the actor was included; a legacy
 * row's actor is therefore unprotected, and a rewritten actor on an
 * actor-bound row matches neither digest.
 */
export function hashAgrees(event: ChainEvent): boolean {
  if (expectedHash(event) === event.hash) return true;
  if (event.actorUserId === undefined) return false;
  const { actorUserId: _actor, ...legacy } = event;
  return expectedHash(legacy) === event.hash;
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
    if (!hashAgrees(ev)) {
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
    if (ev.seq !== undefined && ev.seq !== i + 1) {
      const step = byId.get("sequence-dense")!;
      objections.push({
        stepId: step.id,
        severity: "refuse",
        says: `Event ${i} carries seq ${ev.seq}; expected ${i + 1}.`,
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
