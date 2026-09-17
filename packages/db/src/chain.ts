import { createHash } from "node:crypto";

export function canonicalizeEventPayload(payload: unknown): string {
  return JSON.stringify(payload, Object.keys(payload as object).sort());
}

export interface DomainEventHashInput {
  prevHash: string;
  tenantId: string;
  /**
   * Who acted. Part of the digest so a rewritten actor breaks the hash;
   * `null` is a system actor. Omitting it altogether yields the legacy
   * five-field digest, which the verifier only accepts as a legacy row.
   */
  actorUserId?: string | null;
  kind: string;
  payload: unknown;
  occurredAt: string;
}

export function hashDomainEvent(input: DomainEventHashInput): string {
  const body = [
    input.prevHash,
    input.tenantId,
    ...(input.actorUserId === undefined ? [] : [`actor:${input.actorUserId ?? ""}`]),
    input.kind,
    canonicalizeEventPayload(input.payload),
    input.occurredAt,
  ].join("\n");
  return createHash("sha256").update(body).digest("hex");
}

export const GENESIS_HASH = "0".repeat(64);
