import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS, SEED_LEDGER } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { evaluateRelease } from "@pms/controls-engine";
import type { PostEntryInput } from "@pms/ledger";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { createApprovalRequest } from "../controls/approvals";
import { loadActivePolicy } from "../controls/policy";
import { loadStaff } from "../controls/staff";
import { computeDigest, periodEnding } from "../digest/digest";
import { afterHoursFactsFor } from "../ledger/post";
import { acknowledgeHardEvent, attachAcks, loadHardEventAcks, summarizeAcks } from "./acks";
import { HARD_EVENT_DAYS, listHardEvents } from "./hardEvents";

/**
 * Acknowledging a hard event on the seeded Ridgeview tenant, as app_rw
 * (Increment 1.33): refusals that write nothing, one acknowledgment that
 * writes one row and one chain event and reads back on the card, a second
 * one refused, and the digest counting both it and an after-hours hold.
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;
const actor = { id: owner.id, name: owner.displayName };

describe.skipIf(!adminUrl)("Hard-event acknowledgments (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  const backdatedId = uuidv7(35_001);
  const now = new Date();
  const since = new Date(now.getTime() - HARD_EVENT_DAYS * 86_400_000);
  const window = { since, now };

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
    // A $10 write-off effective 71 days ago, posted now: a retroactive-dated entry. Planted with the dual-release
    // trigger off so the suite reads the same whatever the wall clock says about the location's hours.
    const effective = new Date(now.getTime() - 71 * 86_400_000).toISOString().slice(0, 10);
    await db.admin.query("ALTER TABLE ledger_entries DISABLE TRIGGER ledger_entries_dual_release");
    try {
      await db.admin.query(
        `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                     effective_date, posted_at, created_by_id, created_by_name, reason_code, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, 'write_off', 'patient_ar', -1000, $6, $7, $8, 'Riley Owner', 'courtesy', $9, $7)`,
        [backdatedId, tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, effective, now.toISOString(), owner.id, `ack-${backdatedId}`]
      );
    } finally {
      await db.admin.query("ALTER TABLE ledger_entries ENABLE TRIGGER ledger_entries_dual_release");
    }
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("refuses an unknown kind, a short note, and an event the card does not show, writing nothing", async () => {
    const kind = await tx((d) => acknowledgeHardEvent(d, { tenantId, actor, kind: "meteor", subjectKind: "ledger_entry", subjectId: backdatedId, note: "Looked at it carefully." }));
    expect(kind).toMatchObject({ ok: false, status: 400, errors: ["The hard event kind is not one of the six."] });
    const short = await tx((d) => acknowledgeHardEvent(d, { tenantId, actor, kind: "retroactive_entry", subjectKind: "ledger_entry", subjectId: backdatedId, note: "ok" }));
    expect(short).toMatchObject({ ok: false, status: 400, errors: ["Say what was done about it, in at least 10 characters."] });
    const missing = await tx((d) =>
      acknowledgeHardEvent(d, { tenantId, actor, kind: "retroactive_entry", subjectKind: "ledger_entry", subjectId: uuidv7(35_999), note: "Looked at it carefully." })
    );
    expect(missing).toMatchObject({ ok: false, status: 404 });
    if (missing.ok) return;
    expect(missing.errors[0]).toMatch(/^No such hard event in the last 7 days/);
    const rows = await db.admin.query("SELECT count(*)::int AS n FROM hard_event_acks WHERE tenant_id = $1", [tenantId]);
    expect(rows.rows[0].n).toBe(0);
  });

  it("acknowledges the retroactive entry once: one row, one chain event, read back on the card; a second time is refused", async () => {
    const events = await tx((d) => listHardEvents(d, tenantId, window));
    const target = events.find((e) => e.kind === "retroactive_entry" && e.subjectId === backdatedId);
    expect(target).toBeDefined();
    expect(summarizeAcks(attachAcks(events, await tx((d) => loadHardEventAcks(d, tenantId, since))))).toMatchObject({ acknowledged: 0 });

    const first = await tx((d) =>
      acknowledgeHardEvent(d, { tenantId, actor, kind: "retroactive_entry", subjectKind: "ledger_entry", subjectId: backdatedId, note: "  Courtesy write-off entered late from a paper note; the front desk now posts the same day.  " })
    );
    expect(first).toMatchObject({ ok: true });
    if (!first.ok) return;
    expect(first.ack).toMatchObject({
      kind: "retroactive_entry",
      subjectKind: "ledger_entry",
      subjectId: backdatedId,
      eventAt: target!.at,
      note: "Courtesy write-off entered late from a paper note; the front desk now posts the same day.",
      acknowledgedByName: owner.displayName,
    });
    const chain = await db.admin.query("SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = 'hard_event.acknowledged'", [tenantId]);
    expect(chain.rows).toHaveLength(1);
    expect(chain.rows[0].payload).toEqual({ ackId: first.ack.id, kind: "retroactive_entry", subjectKind: "ledger_entry", subjectId: backdatedId, eventAt: target!.at });

    const withAcks = attachAcks(await tx((d) => listHardEvents(d, tenantId, window)), await tx((d) => loadHardEventAcks(d, tenantId, since)));
    const shown = withAcks.find((e) => e.subjectId === backdatedId);
    expect(shown?.ack).toMatchObject({ acknowledgedByName: owner.displayName, note: /front desk now posts the same day/ });
    expect(summarizeAcks(withAcks).acknowledged).toBe(1);

    const again = await tx((d) =>
      acknowledgeHardEvent(d, { tenantId, actor, kind: "retroactive_entry", subjectKind: "ledger_entry", subjectId: backdatedId, note: "Looked at it a second time." })
    );
    expect(again).toMatchObject({ ok: false, status: 409 });
    if (again.ok) return;
    expect(again.errors[0]).toMatch(new RegExp(`^This event was already acknowledged by ${owner.displayName} on \\d{4}-\\d{2}-\\d{2}\\.$`));
    const rows = await db.admin.query("SELECT count(*)::int AS n FROM hard_event_acks WHERE tenant_id = $1", [tenantId]);
    expect(rows.rows[0].n).toBe(1);
    // Append-only: the row cannot be changed or removed, even by the administrator.
    await expect(db.admin.query("UPDATE hard_event_acks SET note = 'x' WHERE id = $1", [first.ack.id])).rejects.toThrow(/append-only/);
    await expect(db.admin.query("DELETE FROM hard_event_acks WHERE id = $1", [first.ack.id])).rejects.toThrow(/append-only/);
  });

  it("counts the acknowledgment and an after-hours hold in the week's digest", async () => {
    // Close the location for the moment so the held request carries the hours fact whatever the clock says.
    const { rows } = await db.admin.query("SELECT hours FROM locations WHERE id = $1", [SEED_LEDGER.locationId]);
    await db.admin.query("UPDATE locations SET hours = '{}'::jsonb WHERE id = $1", [SEED_LEDGER.locationId]);
    await db.admin.query(
      "INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from) VALUES ($1, $2, $3, 'approve_writeoffs', now())",
      [uuidv7(35_040), tenantId, front.id]
    );
    try {
      await tx(async (d) => {
        const facts = await afterHoursFactsFor(d, tenantId, SEED_LEDGER.locationId, new Date());
        const active = await loadActivePolicy(d, tenantId);
        const { people } = await loadStaff(d, tenantId);
        const payload: PostEntryInput = {
          tenantId,
          accountId: SEED_LEDGER.accountDoeId,
          patientId: SEED_LEDGER.patientJaneId,
          locationId: SEED_LEDGER.locationId,
          kind: "refund",
          glBucket: "patient_ar",
          amountCents: 1_200,
          reasonCode: "overpayment",
          effectiveDate: new Date().toISOString().slice(0, 10),
          postedAt: new Date().toISOString(),
          createdById: front.id,
          createdByName: front.displayName,
          afterHours: facts,
        };
        const evaluation = evaluateRelease(active!.policy, { channel: "check", amountUsd: 12, initiatorPersonId: front.id, outsideBusinessHours: true }, people);
        await createApprovalRequest(d, { tenantId, channel: "check", amountCents: 1_200, heldPayload: payload, evaluation, requesterId: front.id, requesterName: front.displayName });
      });
      const digest = await tx((d) => computeDigest(d, tenantId, periodEnding(new Date().toISOString().slice(0, 10))));
      // Increment 1.100 added two release counts to this block; this practice
      // has attested none, which is what makes them zero here.
      expect(digest.alerts).toEqual({
        afterHoursHolds: 1,
        hardEventsAcknowledged: 1,
        channelsAttested: 0,
        releasesAttested: 0,
        releasesNeedingSecond: 0,
      });
      expect(digest.chain.otherKinds.map((k) => k.key)).not.toContain("hard_event.acknowledged");
    } finally {
      await db.admin.query("UPDATE locations SET hours = $2::jsonb WHERE id = $1", [SEED_LEDGER.locationId, JSON.stringify(rows[0].hours)]);
    }
  });
});
