import { and, eq, gte } from "drizzle-orm";
import { hardEventAcks, uuidv7 } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { HARD_EVENT_DAYS, HARD_EVENT_KINDS, listHardEvents, type HardEvent, type HardEventKind } from "./hardEvents";

/**
 * The owner's acknowledgment of a hard event (Increment 1.33). The events
 * themselves are computed from rows on every read; the acknowledgment is
 * the one thing stored: which event, what was done about it, who, when.
 * One per event, append-only, and a chain event beside it.
 */
export type HardEventAck = {
  id: string;
  kind: HardEventKind;
  subjectKind: string;
  subjectId: string;
  /** ISO timestamp the event happened. */
  eventAt: string;
  note: string;
  acknowledgedById: string;
  acknowledgedByName: string;
  /** ISO timestamp. */
  acknowledgedAt: string;
};

export const ACK_NOTE_MIN = 10;

export function ackKey(kind: string, subjectKind: string, subjectId: string): string {
  return `${kind}|${subjectKind}|${subjectId}`;
}

function mapAck(row: typeof hardEventAcks.$inferSelect): HardEventAck {
  return {
    id: row.id,
    kind: row.kind as HardEventKind,
    subjectKind: row.subjectKind,
    subjectId: row.subjectId,
    eventAt: row.eventAt.toISOString(),
    note: row.note,
    acknowledgedById: row.acknowledgedById,
    acknowledgedByName: row.acknowledgedByName,
    acknowledgedAt: row.acknowledgedAt.toISOString(),
  };
}

/** Acknowledgments of events that happened at or after `since`. */
export async function loadHardEventAcks(db: AppDb, tenantId: string, since: Date): Promise<HardEventAck[]> {
  const rows = await db
    .select()
    .from(hardEventAcks)
    .where(and(eq(hardEventAcks.tenantId, tenantId), gte(hardEventAcks.eventAt, since)));
  return rows.map(mapAck);
}

export type HardEventWithAck = HardEvent & {
  ack: { acknowledgedByName: string; acknowledgedAt: string; note: string } | null;
};

/** Each event with its acknowledgment, if the owner has recorded one. */
export function attachAcks(items: HardEvent[], acks: HardEventAck[]): HardEventWithAck[] {
  const byKey = new Map(acks.map((a) => [ackKey(a.kind, a.subjectKind, a.subjectId), a]));
  return items.map((item) => {
    const a = byKey.get(ackKey(item.kind, item.subjectKind, item.subjectId));
    return { ...item, ack: a ? { acknowledgedByName: a.acknowledgedByName, acknowledgedAt: a.acknowledgedAt, note: a.note } : null };
  });
}

export function summarizeAcks(items: HardEventWithAck[]): { total: number; acknowledged: number; waiting: number } {
  const acknowledged = items.filter((i) => i.ack).length;
  return { total: items.length, acknowledged, waiting: items.length - acknowledged };
}

export type AcknowledgeHardEventResult =
  | { ok: true; ack: HardEventAck }
  | { ok: false; status: 400 | 404 | 409; errors: string[] };

/**
 * Records that the owner saw a hard event and says what was done. Refuses
 * an unknown kind, an empty subject, a note under ten characters, an event
 * that is not among the last seven days' hard events (the card is the
 * source of truth, so nothing else is acknowledgeable), and a second
 * acknowledgment of the same event. One append-only row and one chain
 * event, in the caller's transaction.
 */
export async function acknowledgeHardEvent(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; kind: string; subjectKind: string; subjectId: string; note: string; now?: Date }
): Promise<AcknowledgeHardEventResult> {
  const now = input.now ?? new Date();
  const errors: string[] = [];
  if (!(HARD_EVENT_KINDS as readonly string[]).includes(input.kind)) errors.push("The hard event kind is not one of the six.");
  if (!input.subjectKind?.trim() || !input.subjectId?.trim()) errors.push("The acknowledgment must name the row the event is about.");
  const note = input.note?.trim() ?? "";
  if (note.length < ACK_NOTE_MIN) errors.push(`Say what was done about it, in at least ${ACK_NOTE_MIN} characters.`);
  if (errors.length) return { ok: false, status: 400, errors };

  const since = new Date(now.getTime() - HARD_EVENT_DAYS * 86_400_000);
  const current = (await listHardEvents(db, input.tenantId, { since, now })).find(
    (e) => e.kind === input.kind && e.subjectKind === input.subjectKind && e.subjectId === input.subjectId
  );
  if (!current) {
    return { ok: false, status: 404, errors: [`No such hard event in the last ${HARD_EVENT_DAYS} days; only what the card shows can be acknowledged.`] };
  }

  const existing = (await loadHardEventAcks(db, input.tenantId, since)).find(
    (a) => a.kind === input.kind && a.subjectKind === input.subjectKind && a.subjectId === input.subjectId
  );
  if (existing) {
    return {
      ok: false,
      status: 409,
      errors: [`This event was already acknowledged by ${existing.acknowledgedByName} on ${existing.acknowledgedAt.slice(0, 10)}.`],
    };
  }

  const id = uuidv7(now.getTime());
  await db.insert(hardEventAcks).values({
    id,
    tenantId: input.tenantId,
    kind: input.kind,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    eventAt: new Date(current.at),
    note,
    acknowledgedById: input.actor.id,
    acknowledgedByName: input.actor.name,
    acknowledgedAt: now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "hard_event.acknowledged",
    { ackId: id, kind: input.kind, subjectKind: input.subjectKind, subjectId: input.subjectId, eventAt: current.at },
    now
  );
  const rows = await db.select().from(hardEventAcks).where(eq(hardEventAcks.id, id));
  return { ok: true, ack: mapAck(rows[0]!) };
}
