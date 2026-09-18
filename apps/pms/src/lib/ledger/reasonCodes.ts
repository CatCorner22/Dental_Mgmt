import { and, asc, eq, sql } from "drizzle-orm";
import { ledgerEntries, reasonCodes } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { NEEDS_DECISION_CODE, NEEDS_DECISION_STATUS, RECORD_THE_DECISION } from "../controls/needsDecision";
import { listDecisions, recordDecision, reviewDecision } from "../controls/decisions";
import { decisionPermitsRetirement, latestDecisionFor, type ControlDecision } from "@pms/controls-engine";
import { isLoosening } from "./reasonThreshold";
import { REASON_KINDS, RESERVED_REASON_CODES, type ReasonCodeRow } from "./reasons";

/**
 * The reason codes one practice has adopted (Increment 1.45).
 *
 * `ledger_entries.reason_code` is a foreign key into `(tenant_id, code)`, and
 * that one fact settles what the practice may and may not change:
 *
 * - The **code** never changes. Rewriting it would orphan every entry carrying
 *   it, so a practice that wants different wording changes the label instead.
 * - A code is never **deleted**. Entries already cite it, and the database
 *   would refuse; retiring one clears `active`, which takes it off the forms
 *   and leaves the history readable.
 * - The **label** is free to change, because nothing keys on it.
 *
 * `prior_period` is reserved besides: the closed-month refusal admits a
 * correction only under that reason, so retiring it would leave the practice
 * unable to correct a closed month at all (Increment 1.39 found that the hard
 * way, when it was never seeded).
 *
 * Every change is a chain event, so "when did this practice start writing off
 * under that reason" is answered by the chain rather than by memory.
 */

export type ReasonCodeRefusal = {
  ok: false;
  status: 400 | 404 | 409;
  code: "invalid" | "duplicate" | "not_found" | "reserved" | "unchanged" | "needs_decision";
  verb: string;
  why: string;
};

export type { ReasonCodeRow };
export { isLoosening } from "./reasonThreshold";

export type ReasonCodeResult = { ok: true; row: ReasonCodeRow } | ReasonCodeRefusal;

const CODE_SHAPE = /^[a-z][a-z0-9_]{1,39}$/;

function isReserved(code: string): boolean {
  return (RESERVED_REASON_CODES as readonly string[]).includes(code);
}

/** Every reason code the practice holds, with how many entries cite each. */
export async function listReasonCodes(db: AppDb, tenantId: string): Promise<ReasonCodeRow[]> {
  const rows = await db
    .select({
      code: reasonCodes.code,
      kind: reasonCodes.kind,
      label: reasonCodes.label,
      active: reasonCodes.active,
      requiresApprovalOverCents: reasonCodes.requiresApprovalOverCents,
      entries: sql<number>`(
        SELECT count(*)::int FROM ${ledgerEntries}
        WHERE ${ledgerEntries.tenantId} = ${reasonCodes.tenantId}
          AND ${ledgerEntries.reasonCode} = ${reasonCodes.code}
      )`,
    })
    .from(reasonCodes)
    .where(eq(reasonCodes.tenantId, tenantId))
    .orderBy(asc(reasonCodes.kind), asc(reasonCodes.code));

  return rows.map((r) => ({
    code: r.code,
    kind: r.kind,
    label: r.label,
    active: r.active,
    reserved: isReserved(r.code),
    requiresApprovalOverCents: r.requiresApprovalOverCents === null ? null : Number(r.requiresApprovalOverCents),
    entries: Number(r.entries),
  }));
}

/**
 * The threshold one reason carries, or null where the practice set none
 * (Increment 1.46). The posting paths read this and tighten the policy with it
 * before evaluating, so the service and the database trigger reach the same
 * figure; where they disagree the practice meets a crash instead of a hold.
 */
export async function loadReasonThresholdCents(db: AppDb, tenantId: string, code: string | null): Promise<number | null> {
  if (!code) return null;
  const rows = await db
    .select({ cents: reasonCodes.requiresApprovalOverCents })
    .from(reasonCodes)
    .where(and(eq(reasonCodes.tenantId, tenantId), eq(reasonCodes.code, code)))
    .limit(1);
  const cents = rows[0]?.cents;
  return cents === null || cents === undefined ? null : Number(cents);
}

/** What the owner records when a change lets more through than it used to. */
export type ThresholdDecision = { kind: string; note: string; reviewBy?: string };

/** The figure in words, for a refusal the reader can act on. */
function figurePhrase(cents: number | null): string {
  if (cents === null) return "the channel's own figure";
  if (cents === 0) return "every one of them";
  return `${(cents / 100).toFixed(2)}`;
}

/**
 * Sets or clears what one reason requires (Increment 1.46), under the rule
 * Increment 1.47 adds: tightening is a settings change, loosening is a control
 * decision.
 *
 * Loosening means letting through what used to wait — raising the figure, or
 * clearing it so the channel's own figure governs again. That is the same act
 * as switching the after-hours hold off (Increment 1.31), so it takes the same
 * thing: an accept-residual or compensate decision, with a note and the day
 * the practice looks at it again. The decision and the change are written in
 * the caller's one transaction, so neither lands without the other.
 *
 * Tightening back retires that decision, because the control stands again and
 * nothing is left to accept.
 */
export async function setReasonThreshold(
  db: AppDb,
  input: {
    tenantId: string;
    actor: { id: string; name: string };
    code: string;
    cents: number | null;
    decision?: ThresholdDecision;
    now?: Date;
  }
): Promise<ReasonCodeResult> {
  const now = input.now ?? new Date();
  const asOf = now.toISOString().slice(0, 10);
  if (input.cents !== null && (!Number.isInteger(input.cents) || input.cents < 0)) {
    return { ok: false, status: 400, code: "invalid", verb: "Enter a figure", why: "A threshold is a whole number of cents, or none at all." };
  }
  const row = await loadOne(db, input.tenantId, input.code);
  if (!row) return { ok: false, status: 404, code: "not_found", verb: "Choose a code", why: "This practice holds no such reason code." };
  const before = await loadReasonThresholdCents(db, input.tenantId, input.code);
  if (before === input.cents) {
    return { ok: false, status: 400, code: "unchanged", verb: "Change the figure", why: "That is what it requires already." };
  }

  const loosened = isLoosening(before, input.cents);
  if (loosened && !input.decision) {
    // 409, not 400: the figure was well formed and the request was fine; the
    // practice's current state is what refuses it until a decision stands
    // beside it. `retireException` answers the same way in the same words
    // (Increment 1.48).
    return {
      ok: false,
      status: NEEDS_DECISION_STATUS,
      code: NEEDS_DECISION_CODE,
      verb: "Record a decision",
      why: `Moving "${row.code}" from ${figurePhrase(before)} to ${figurePhrase(input.cents)} lets through what used to wait for a second person. ${RECORD_THE_DECISION}`,
    };
  }
  if (loosened && input.decision) {
    const permitted = decisionPermitsRetirement(input.decision, asOf);
    if (!permitted.ok) {
      return { ok: false, status: 400, code: "invalid", verb: "Record a decision", why: permitted.errors.join(" ") };
    }
  }

  // The decision first: refused, nothing else is written.
  let decision: ControlDecision | undefined;
  if (loosened && input.decision) {
    const recorded = await recordDecision(db, {
      tenantId: input.tenantId,
      actor: input.actor,
      subjectKind: "reason_code",
      subjectId: row.code,
      kind: input.decision.kind,
      note: input.decision.note,
      reviewBy: input.decision.reviewBy,
      now,
    });
    if (!recorded.ok) return { ok: false, status: 400, code: "invalid", verb: "Record a decision", why: recorded.errors.join(" ") };
    decision = recorded.decision;
  }

  // Tightening back ends the decision that licensed the loosening: the control
  // stands again, so there is nothing left to accept.
  if (!loosened) {
    const governing = latestDecisionFor(await listDecisions(db, input.tenantId), "reason_code", row.code);
    if (governing) {
      const ended = await reviewDecision(db, {
        tenantId: input.tenantId,
        actor: input.actor,
        decisionId: governing.id,
        action: "retire",
        note: `"${row.code}" holds at ${figurePhrase(input.cents)} again; nothing is left to accept.`,
        now,
      });
      if (!ended.ok) return { ok: false, status: 400, code: "invalid", verb: "Tighten it", why: ended.errors.join(" ") };
      decision = ended.decision;
    }
  }

  await db
    .update(reasonCodes)
    .set({ requiresApprovalOverCents: input.cents })
    .where(and(eq(reasonCodes.tenantId, input.tenantId), eq(reasonCodes.code, input.code)));
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "reason_code.threshold_changed",
    {
      code: row.code,
      beforeCents: before ?? -1,
      afterCents: input.cents ?? -1,
      loosened,
      decisionId: decision?.id ?? "",
    },
    now
  );
  return { ok: true, row: { ...row, requiresApprovalOverCents: input.cents } };
}


async function loadOne(db: AppDb, tenantId: string, code: string): Promise<ReasonCodeRow | null> {
  const all = await listReasonCodes(db, tenantId);
  return all.find((r) => r.code === code) ?? null;
}

/** Adds a code the practice has decided to use. The code is permanent from here. */
export async function addReasonCode(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; code: string; kind: string; label: string; now?: Date }
): Promise<ReasonCodeResult> {
  const now = input.now ?? new Date();
  const code = input.code.trim().toLowerCase();
  const label = input.label.trim();

  if (!CODE_SHAPE.test(code)) {
    return {
      ok: false,
      status: 400,
      code: "invalid",
      verb: "Choose a code",
      why: "A code is 2 to 40 characters, starts with a letter, and holds lowercase letters, digits, and underscores. It is written on every entry that cites it and never changes afterward, so it is worth choosing once.",
    };
  }
  if (!label) {
    return { ok: false, status: 400, code: "invalid", verb: "Name it", why: "The label is what the front desk reads on the form." };
  }
  if (!(REASON_KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, status: 400, code: "invalid", verb: "Choose a kind", why: `A reason code belongs to one of: ${REASON_KINDS.join(", ")}.` };
  }

  const existing = await loadOne(db, input.tenantId, code);
  if (existing) {
    return {
      ok: false,
      status: 409,
      code: "duplicate",
      verb: "Use the one you have",
      why: existing.active
        ? `This practice already uses "${code}" for ${existing.label}.`
        : `This practice retired "${code}" (${existing.label}). Restore it rather than adding it again, so the entries already citing it keep one meaning.`,
    };
  }

  await db.insert(reasonCodes).values({ tenantId: input.tenantId, code, kind: input.kind, label, createdAt: now });
  await appendControlEvent(db, input.tenantId, input.actor.id, "reason_code.added", { code, kind: input.kind, label }, now);
  return { ok: true, row: (await loadOne(db, input.tenantId, code))! };
}

/** Changes what the form reads. Nothing keys on the label, so this is free. */
export async function renameReasonCode(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; code: string; label: string; now?: Date }
): Promise<ReasonCodeResult> {
  const now = input.now ?? new Date();
  const label = input.label.trim();
  if (!label) return { ok: false, status: 400, code: "invalid", verb: "Name it", why: "The label is what the front desk reads on the form." };

  const row = await loadOne(db, input.tenantId, input.code);
  if (!row) return { ok: false, status: 404, code: "not_found", verb: "Choose a code", why: "This practice holds no such reason code." };
  if (row.label === label) {
    return { ok: false, status: 400, code: "unchanged", verb: "Change the wording", why: `"${row.label}" is what it reads already.` };
  }

  await db
    .update(reasonCodes)
    .set({ label })
    .where(and(eq(reasonCodes.tenantId, input.tenantId), eq(reasonCodes.code, input.code)));
  await appendControlEvent(db, input.tenantId, input.actor.id, "reason_code.relabelled", { code: input.code, before: row.label, after: label }, now);
  return { ok: true, row: { ...row, label } };
}

/**
 * Retires a code or restores one. Retiring takes it off the forms and leaves
 * every entry citing it alone, which is the only thing the foreign key permits
 * and also the only honest treatment of history.
 */
export async function setReasonCodeActive(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; code: string; active: boolean; now?: Date }
): Promise<ReasonCodeResult> {
  const now = input.now ?? new Date();
  const row = await loadOne(db, input.tenantId, input.code);
  if (!row) return { ok: false, status: 404, code: "not_found", verb: "Choose a code", why: "This practice holds no such reason code." };

  if (!input.active && row.reserved) {
    return {
      ok: false,
      status: 409,
      code: "reserved",
      verb: "Keep it",
      why: `"${row.code}" is the reason a correction into a closed month must carry. Retiring it would leave this practice unable to correct a closed month at all. Its label is yours to change.`,
    };
  }
  if (row.active === input.active) {
    return {
      ok: false,
      status: 400,
      code: "unchanged",
      verb: input.active ? "Already in use" : "Already retired",
      why: `"${row.code}" is ${row.active ? "already offered on the forms" : "already off the forms"}.`,
    };
  }

  await db
    .update(reasonCodes)
    .set({ active: input.active })
    .where(and(eq(reasonCodes.tenantId, input.tenantId), eq(reasonCodes.code, input.code)));
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    input.active ? "reason_code.restored" : "reason_code.retired",
    { code: row.code, kind: row.kind, label: row.label, entries: row.entries },
    now
  );
  return { ok: true, row: { ...row, active: input.active } };
}
