import { createHash } from "node:crypto";

export function canonicalizeEventPayload(payload: unknown): string {
  return JSON.stringify(payload, Object.keys(payload as object).sort());
}

export function hashDomainEvent(input: {
  prevHash: string;
  tenantId: string;
  kind: string;
  payload: unknown;
  occurredAt: string;
}): string {
  const body = [
    input.prevHash,
    input.tenantId,
    input.kind,
    canonicalizeEventPayload(input.payload),
    input.occurredAt,
  ].join("\n");
  return createHash("sha256").update(body).digest("hex");
}

export const GENESIS_HASH = "0".repeat(64);
