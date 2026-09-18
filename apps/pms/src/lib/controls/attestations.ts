import { and, asc, eq } from "drizzle-orm";
import { channelAttestations, uuidv7 } from "@pms/db";
import { RELEASE_CHANNELS } from "@pms/controls-engine";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "./events";
import { ENFORCEMENT } from "./enforcement";

/**
 * The attestation tab (Increment 1.51, docs/13 item 22).
 *
 * Two of the six dual-release channels are `external` in this build: the
 * product holds no vendor payments and no payroll file, so it can evaluate
 * nothing about them. The coverage table has said "attested, never enforced"
 * since Increment 1.12 with nothing behind the word. This is what stands
 * behind it — a dated assertion, by a named person, that someone reviewed
 * that channel's month.
 *
 * **Only a channel the product cannot enforce may be attested.** Attesting an
 * enforced channel is refused rather than accepted and ignored: an attestation
 * beside evidence the product already holds is worth nothing and reads as
 * though it added something. The refusal is the honest version of the claim
 * the coverage table makes.
 *
 * **Who attested is part of what is recorded.** An attestation the practice
 * makes about its own external channel is worth less than one an independent
 * reader makes, and a reader of the coverage table is entitled to tell them
 * apart, so the seat is stored beside the name.
 */

/** The channels this build cannot enforce, and so the only ones an attestation means anything about. */
export const ATTESTABLE_CHANNELS: string[] = RELEASE_CHANNELS.filter((c) => ENFORCEMENT[c] === "external");

export type AttestationSeat = "accountant" | "practice";

export type ChannelAttestation = {
  channel: string;
  month: string;
  note: string;
  seat: AttestationSeat;
  byName: string;
  at: string;
};

/** One external channel's month: attested by someone, or not yet. */
export type AttestationRow = { channel: string; attestation: ChannelAttestation | null };

export type AttestationRefusal = {
  ok: false;
  status: 400 | 409;
  code: "invalid" | "not_external" | "already_attested";
  verb: string;
  why: string;
};

export type AttestationResult = { ok: true; attestation: ChannelAttestation } | AttestationRefusal;

const MIN_NOTE = 10;

function toAttestation(row: typeof channelAttestations.$inferSelect): ChannelAttestation {
  return {
    channel: row.channel,
    month: row.month,
    note: row.note,
    seat: row.attestedSeat === "accountant" ? "accountant" : "practice",
    byName: row.attestedByName,
    at: row.attestedAt.toISOString(),
  };
}

/** Every attestable channel for one month, with its attestation where one stands. */
export async function listMonthAttestations(db: AppDb, tenantId: string, month: string): Promise<AttestationRow[]> {
  const rows = await db
    .select()
    .from(channelAttestations)
    .where(and(eq(channelAttestations.tenantId, tenantId), eq(channelAttestations.month, month)))
    .orderBy(asc(channelAttestations.channel));
  const byChannel = new Map(rows.map((r) => [r.channel, toAttestation(r)]));
  return ATTESTABLE_CHANNELS.map((channel) => ({ channel, attestation: byChannel.get(channel) ?? null }));
}

/**
 * Records that someone reviewed one external channel's month.
 *
 * One per practice, month and channel, and never superseded: an attestation is
 * an assertion made on a date by a person who was willing to make it, so a
 * later opinion is a later month's row rather than an edit of this one.
 */
export async function attestChannelMonth(
  db: AppDb,
  input: {
    tenantId: string;
    actor: { id: string; name: string };
    seat: AttestationSeat;
    month: string;
    channel: string;
    note: string;
    now?: Date;
  }
): Promise<AttestationResult> {
  const now = input.now ?? new Date();
  const note = input.note.trim();
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    return { ok: false, status: 400, code: "invalid", verb: "Choose a month", why: "A month reads as YYYY-MM." };
  }
  if (input.month > now.toISOString().slice(0, 7)) {
    return {
      ok: false,
      status: 400,
      code: "invalid",
      verb: "Choose a month that has begun",
      why: "A month nobody could have reviewed yet cannot be attested.",
    };
  }
  if (note.length < MIN_NOTE) {
    return {
      ok: false,
      status: 400,
      code: "invalid",
      verb: "Say what you reviewed",
      why: `An attestation is at least ${MIN_NOTE} characters: what was reviewed, and against what.`,
    };
  }
  if (!ATTESTABLE_CHANNELS.includes(input.channel)) {
    const known = (RELEASE_CHANNELS as readonly string[]).includes(input.channel);
    return {
      ok: false,
      status: 400,
      code: "not_external",
      verb: "Attest a channel the product cannot hold",
      why: known
        ? `The product enforces or records ${input.channel} itself, so an attestation beside its own evidence would add nothing and read as though it did. Only ${ATTESTABLE_CHANNELS.join(" and ")} are attested.`
        : `${input.channel} is not a release channel.`,
    };
  }

  const existing = await db
    .select()
    .from(channelAttestations)
    .where(
      and(
        eq(channelAttestations.tenantId, input.tenantId),
        eq(channelAttestations.month, input.month),
        eq(channelAttestations.channel, input.channel)
      )
    )
    .limit(1);
  if (existing[0]) {
    const held = toAttestation(existing[0]);
    return {
      ok: false,
      status: 409,
      code: "already_attested",
      verb: "It is attested already",
      why: `${held.byName} attested ${input.channel} for ${input.month} on ${held.at.slice(0, 10)}. An attestation is never rewritten; a later opinion is a later month's.`,
    };
  }

  await db.insert(channelAttestations).values({
    id: uuidv7(now.getTime()),
    tenantId: input.tenantId,
    month: input.month,
    channel: input.channel,
    note,
    attestedSeat: input.seat,
    attestedById: input.actor.id,
    attestedByName: input.actor.name,
    attestedAt: now,
  });
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "control.channel_attested",
    { month: input.month, channel: input.channel, seat: input.seat },
    now
  );
  return {
    ok: true,
    attestation: { channel: input.channel, month: input.month, note, seat: input.seat, byName: input.actor.name, at: now.toISOString() },
  };
}
