import {
  isDisclosureChannel,
  isDisclosurePurpose,
  type DisclosureChannel,
  type DisclosurePurpose,
} from "@pms/db";
import type { AuthStore } from "../auth/store";

export interface RecordDisclosureInput {
  tenantId: string;
  patientId: string;
  channel: DisclosureChannel;
  recipient: string;
  recordIds: string[];
  purpose: DisclosurePurpose;
  actorUserId: string;
  actorName: string;
  documentId?: string | null;
  at: Date;
}

export type RecordDisclosureResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid_channel" | "invalid_purpose" | "empty_records" };

export async function recordDisclosure(
  store: AuthStore,
  input: RecordDisclosureInput
): Promise<RecordDisclosureResult> {
  if (!isDisclosureChannel(input.channel)) return { ok: false, reason: "invalid_channel" };
  if (!isDisclosurePurpose(input.purpose)) return { ok: false, reason: "invalid_purpose" };
  if (!input.recordIds.length) return { ok: false, reason: "empty_records" };
  const id = await store.recordDisclosure({
    tenantId: input.tenantId,
    patientId: input.patientId,
    channel: input.channel,
    recipient: input.recipient.trim(),
    recordIds: input.recordIds,
    purpose: input.purpose,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    documentId: input.documentId ?? null,
    at: input.at,
  });
  return { ok: true, id };
}
