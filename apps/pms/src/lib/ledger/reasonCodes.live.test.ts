import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS, SEED_LEDGER } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { listDecisions } from "../controls/decisions";
import { addReasonCode, listReasonCodes, loadReasonThresholdCents, renameReasonCode, setReasonCodeActive, setReasonThreshold } from "./reasonCodes";

/**
 * The practice's reason codes as app_rw (Increment 1.45). The code is a
 * foreign key target, so it never changes and a code in use is retired
 * rather than removed; `prior_period` is reserved besides, because the
 * closed-month refusal admits a correction only under it. Every change is
 * a chain event. Skipped without PMS_TEST_POSTGRES_URL; mandatory under
 * PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const actor = { id: owner.id, name: owner.displayName };

describe.skipIf(!adminUrl)("Reason codes (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  async function events(kind: string) {
    const { rows } = await db.admin.query("SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = $2 ORDER BY seq", [tenantId, kind]);
    return rows.map((r) => r.payload as Record<string, unknown>);
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("reads the seeded codes with how many entries cite each, and marks the reserved one", async () => {
    const rows = await tx((d) => listReasonCodes(d, tenantId));
    expect(rows.map((r) => r.code).sort()).toEqual(["contractual_ppo", "correction", "courtesy", "prior_period"]);
    expect(rows.every((r) => r.active)).toBe(true);
    expect(rows.find((r) => r.code === "prior_period")).toMatchObject({ reserved: true, kind: "adjustment" });
    expect(rows.find((r) => r.code === "courtesy")).toMatchObject({ reserved: false, kind: "write_off" });
    // The seed posts two charges and one payment, none of which cites a reason,
    // so every count starts at zero. The count is read from the rows either way.
    expect(rows.every((r) => r.entries === 0)).toBe(true);
  });

  it("adopts a code, refuses a second one by the same name, and refuses a shape the column would not read back", async () => {
    const added = await tx((d) => addReasonCode(d, { tenantId, actor, code: "Insurance_Adjustment", kind: "adjustment", label: "Insurance adjustment" }));
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    // The code is lowercased on the way in: it is a key, and one casing of a key is enough.
    expect(added.row).toMatchObject({ code: "insurance_adjustment", kind: "adjustment", active: true, entries: 0, reserved: false });
    expect(await events("reason_code.added")).toEqual([{ code: "insurance_adjustment", kind: "adjustment", label: "Insurance adjustment" }]);

    const again = await tx((d) => addReasonCode(d, { tenantId, actor, code: "insurance_adjustment", kind: "adjustment", label: "Something else" }));
    expect(again).toMatchObject({ ok: false, status: 409, code: "duplicate" });

    for (const bad of ["9lives", "has space", "a", "UPPER-CASE!"]) {
      const refused = await tx((d) => addReasonCode(d, { tenantId, actor, code: bad, kind: "write_off", label: "No" }));
      expect(refused, bad).toMatchObject({ ok: false, status: 400, code: "invalid" });
    }
    const wrongKind = await tx((d) => addReasonCode(d, { tenantId, actor, code: "nonsense", kind: "not_a_kind", label: "No" }));
    expect(wrongKind).toMatchObject({ ok: false, code: "invalid" });
    expect(wrongKind.ok === false && wrongKind.why).toMatch(/adjustment, write_off, refund, reversal, transfer, variance/);
  });

  it("changes the wording without touching the key, and refuses wording that changes nothing", async () => {
    const renamed = await tx((d) => renameReasonCode(d, { tenantId, actor, code: "courtesy", label: "Goodwill adjustment" }));
    expect(renamed).toMatchObject({ ok: true });
    const rows = await tx((d) => listReasonCodes(d, tenantId));
    expect(rows.find((r) => r.code === "courtesy")).toMatchObject({ label: "Goodwill adjustment" });
    expect(await events("reason_code.relabelled")).toEqual([
      { code: "courtesy", before: "Courtesy adjustment", after: "Goodwill adjustment" },
    ]);
    // The entries citing it are untouched: the label is not what they carry.
    const entries = await db.admin.query("SELECT count(*)::int AS n FROM ledger_entries WHERE tenant_id = $1 AND reason_code = 'courtesy'", [tenantId]);
    expect(entries.rows[0].n).toBe(rows.find((r) => r.code === "courtesy")!.entries);

    expect(await tx((d) => renameReasonCode(d, { tenantId, actor, code: "courtesy", label: "Goodwill adjustment" }))).toMatchObject({
      ok: false,
      code: "unchanged",
    });
    expect(await tx((d) => renameReasonCode(d, { tenantId, actor, code: "nope", label: "x" }))).toMatchObject({ ok: false, status: 404 });
  });

  it("retires a code in use without removing it, and restores it", async () => {
    // Put the code into use first: retiring one nothing cites would prove nothing.
    //
    // These inserts go straight at the table to prove a foreign key and a count,
    // so they meet the after-hours hold (Increment 1.30), which refuses a
    // write-off or an adjustment posted outside the location's week whatever the
    // amount. `now()` therefore made these cases pass by day and fail by night,
    // here and in CI, which runs at every hour. Midweek at 14:00 in the
    // location's own timezone -- read from the row rather than written twice --
    // is inside every seeded window, and the Wednesday before this week's Monday
    // is always in the past. The fourth insert below needs it too: a case that
    // asserts a foreign-key refusal has to meet that refusal and not the hold.
    //
    // The `::timestamp` cast is the whole of it: `date_trunc` on a date returns
    // timestamptz, and `AT TIME ZONE` on a timestamptz converts the other way --
    // UTC to local rather than local to UTC -- which lands the row at 09:00 UTC,
    // 04:00 in Chicago, before the window opens. The cast makes 14:00 mean 14:00
    // where the location is.
    const cited = uuidv7(38_000);
    await db.admin.query(
      `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                   effective_date, posted_at, created_by_id, created_by_name, reason_code, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, 'write_off', 'patient_ar', -1500, current_date, (((date_trunc('week', current_date) - interval '5 days') + interval '14 hours')::timestamp AT TIME ZONE (SELECT timezone FROM locations WHERE id = $5)), $6, 'Riley Owner', 'courtesy', $7, now())`,
      [cited, tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, owner.id, `rc-${cited}`]
    );
    const before = (await tx((d) => listReasonCodes(d, tenantId))).find((r) => r.code === "courtesy")!;
    expect(before.entries).toBe(1);

    const retired = await tx((d) => setReasonCodeActive(d, { tenantId, actor, code: "courtesy", active: false }));
    expect(retired).toMatchObject({ ok: true });
    const after = (await tx((d) => listReasonCodes(d, tenantId))).find((r) => r.code === "courtesy")!;
    expect(after).toMatchObject({ active: false, entries: before.entries });
    expect((await events("reason_code.retired"))[0]).toMatchObject({ code: "courtesy", entries: before.entries });

    // The row is still there and the entries still read: retiring is not deleting,
    // and the database would refuse a delete anyway while an entry cites it.
    await expect(db.admin.query("DELETE FROM reason_codes WHERE tenant_id = $1 AND code = 'courtesy'", [tenantId])).rejects.toThrow(
      /ledger_entries_reason_fk|violates foreign key/
    );

    expect(await tx((d) => setReasonCodeActive(d, { tenantId, actor, code: "courtesy", active: false }))).toMatchObject({
      ok: false,
      code: "unchanged",
    });
    expect(await tx((d) => setReasonCodeActive(d, { tenantId, actor, code: "courtesy", active: true }))).toMatchObject({ ok: true });
    expect((await tx((d) => listReasonCodes(d, tenantId))).find((r) => r.code === "courtesy")).toMatchObject({ active: true });
    expect(await events("reason_code.restored")).toHaveLength(1);
  });

  it("refuses to retire the reason a correction into a closed month must carry", async () => {
    const refused = await tx((d) => setReasonCodeActive(d, { tenantId, actor, code: "prior_period", active: false }));
    expect(refused).toMatchObject({ ok: false, status: 409, code: "reserved" });
    expect(refused.ok === false && refused.why).toMatch(/unable to correct a closed month at all/);
    expect((await tx((d) => listReasonCodes(d, tenantId))).find((r) => r.code === "prior_period")).toMatchObject({ active: true });

    // Its wording is still the practice's to change.
    expect(await tx((d) => renameReasonCode(d, { tenantId, actor, code: "prior_period", label: "Prior period (accountant)" }))).toMatchObject({
      ok: true,
    });
  });

  it("carries no threshold until the practice sets one, and refuses a figure that is not one", async () => {
    // Every row backfilled to NULL in migration 0035: nothing had ever read the
    // column, so no practice had expressed a rule through it.
    const rows = await tx((d) => listReasonCodes(d, tenantId));
    expect(rows.every((r) => r.requiresApprovalOverCents === null)).toBe(true);
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "courtesy"))).toBeNull();
    // And a code the practice does not hold carries none either, rather than raising.
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "never_adopted"))).toBeNull();
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, null))).toBeNull();

    for (const cents of [-1, 12.5]) {
      expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents })), String(cents)).toMatchObject({
        ok: false,
        status: 400,
        code: "invalid",
      });
    }
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "nope", cents: 100 }))).toMatchObject({ ok: false, status: 404 });
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: null }))).toMatchObject({
      ok: false,
      code: "unchanged",
    });
  });

  it("records a tightening on the chain as a settings change, needing nothing else", async () => {
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: 5_000 }))).toMatchObject({ ok: true });
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "courtesy"))).toBe(5_000);
    expect((await events("reason_code.threshold_changed"))[0]).toMatchObject({
      code: "courtesy",
      beforeCents: -1,
      afterCents: 5_000,
      loosened: false,
      decisionId: "",
    });

    // Tightening further is a settings change too.
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: 2_500 }))).toMatchObject({ ok: true });
    expect((await events("reason_code.threshold_changed"))[1]).toMatchObject({ beforeCents: 5_000, afterCents: 2_500, loosened: false });
  });

  it("refuses a loosening with no decision behind it, and writes neither without the other (Increment 1.47)", async () => {
    const refused = await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: 9_000 }));
    // 409 rather than 400: the figure was fine; the state is what refuses it.
    expect(refused).toMatchObject({ ok: false, status: 409, code: "needs_decision" });
    expect(refused.ok === false && refused.why).toMatch(/lets through what used to wait for a second person/);
    expect(refused.ok === false && refused.why).toMatch(/from 25\.00 to 90\.00/);
    // Nothing moved, and no decision was recorded.
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "courtesy"))).toBe(2_500);
    expect(await tx((d) => listDecisions(d, tenantId))).toEqual([]);

    // A decision of the wrong kind, or one with no review date, is refused the same way.
    for (const decision of [
      { kind: "monitor", note: "Watching it.", reviewBy: "2026-12-01" },
      { kind: "accept_residual", note: "The evening clinic runs with two people present." },
    ]) {
      const bad = await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: 9_000, decision }));
      expect(bad, decision.kind).toMatchObject({ ok: false, status: 400, code: "invalid" });
    }
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "courtesy"))).toBe(2_500);
    expect(await tx((d) => listDecisions(d, tenantId))).toEqual([]);
  });

  it("writes the decision and the loosening together, and ends the decision when it is tightened back", async () => {
    const loosened = await tx((d) =>
      setReasonThreshold(d, {
        tenantId,
        actor,
        code: "courtesy",
        cents: 9_000,
        decision: { kind: "accept_residual", note: "Courtesy write-offs run small; the weekly digest carries the count.", reviewBy: "2026-12-01" },
      })
    );
    expect(loosened).toMatchObject({ ok: true });
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "courtesy"))).toBe(9_000);

    const decisions = await tx((d) => listDecisions(d, tenantId));
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ subjectKind: "reason_code", subjectId: "courtesy", kind: "accept_residual", reviewBy: "2026-12-01" });
    // The chain event names the decision that licensed it, so the two are one story.
    expect((await events("reason_code.threshold_changed")).at(-1)).toMatchObject({
      beforeCents: 2_500,
      afterCents: 9_000,
      loosened: true,
      decisionId: decisions[0]!.id,
    });

    // Tightening back retires it: the control stands again, so nothing is left to accept.
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: 1_000 }))).toMatchObject({ ok: true });
    const after = await tx((d) => listDecisions(d, tenantId));
    expect(after).toHaveLength(2);
    const retirement = after.find((r) => r.supersedesDecisionId === decisions[0]!.id)!;
    expect(retirement).toMatchObject({ subjectKind: "reason_code", subjectId: "courtesy", kind: "retire" });
    expect(retirement.note).toMatch(/holds at 10\.00 again; nothing is left to accept/);

    // And clearing it now needs a fresh decision, because it loosens again.
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "courtesy", cents: null }))).toMatchObject({
      ok: false,
      code: "needs_decision",
    });
    expect(
      await tx((d) =>
        setReasonThreshold(d, {
          tenantId,
          actor,
          code: "courtesy",
          cents: null,
          decision: { kind: "compensate", note: "The channel's own $150 governs, and the digest counts the write-offs.", reviewBy: "2026-11-01" },
        })
      )
    ).toMatchObject({ ok: true });
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "courtesy"))).toBeNull();
  });

  it("tightens the channel at the database, and never loosens it", async () => {
    // The seeded policy holds the writeoff channel to a second person above $150.
    const policy = await db.admin.query("SELECT policy FROM control_policies WHERE tenant_id = $1 ORDER BY version DESC LIMIT 1", [tenantId]);
    const rule = (policy.rows[0].policy as { rules: { channel: string; thresholdUsd: number }[] }).rules.find((r) => r.channel === "writeoff")!;
    expect(rule.thresholdUsd).toBe(150);

    async function writeOff(seq: number, cents: number, code: string) {
      const id = uuidv7(38_100 + seq);
      return db.admin.query(
        `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                     effective_date, posted_at, created_by_id, created_by_name, reason_code, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, 'write_off', 'patient_ar', $6, current_date, (((date_trunc('week', current_date) - interval '5 days') + interval '14 hours')::timestamp AT TIME ZONE (SELECT timezone FROM locations WHERE id = $5)), $7, 'Riley Owner', $8, $9, now())`,
        [id, tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, cents, owner.id, code, `rt-${id}`]
      );
    }

    // With no reason rule, $100 sits under the channel's $150 and posts.
    expect(await tx((d) => loadReasonThresholdCents(d, tenantId, "contractual_ppo"))).toBeNull();
    await expect(writeOff(1, -10_000, "contractual_ppo")).resolves.toBeTruthy();

    // Hold that same reason to $50 and the same figure now needs a second person.
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "contractual_ppo", cents: 5_000 }))).toMatchObject({ ok: true });
    await expect(writeOff(2, -10_000, "contractual_ppo")).rejects.toThrow(/dual_release_required[\s\S]*exceeds 5000 cents/);
    // And one under the tightened figure still posts.
    await expect(writeOff(3, -4_000, "contractual_ppo")).resolves.toBeTruthy();

    // Zero holds every one of them, however small.
    expect(await tx((d) => setReasonThreshold(d, { tenantId, actor, code: "contractual_ppo", cents: 0 }))).toMatchObject({ ok: true });
    await expect(writeOff(4, -100, "contractual_ppo")).rejects.toThrow(/dual_release_required[\s\S]*exceeds 0 cents/);

    // A reason set ABOVE the channel never loosens it: least() is the whole rule,
    // or a practice could undo dual release by inventing a reason. Raising it is
    // itself a loosening of what this reason required, so it takes a decision
    // (Increment 1.47) — the two rules compose rather than replacing one another.
    expect(
      await tx((d) =>
        setReasonThreshold(d, {
          tenantId,
          actor,
          code: "contractual_ppo",
          cents: 90_000,
          decision: { kind: "accept_residual", note: "PPO write-offs are contractual; the channel's own figure is the control.", reviewBy: "2026-12-01" },
        })
      )
    ).toMatchObject({ ok: true });
    await expect(writeOff(5, -20_000, "contractual_ppo")).rejects.toThrow(/dual_release_required[\s\S]*exceeds 15000 cents/);
    // $100 is under the channel's own figure, so it posts, exactly as it did before.
    await expect(writeOff(6, -10_000, "contractual_ppo")).resolves.toBeTruthy();

    // Put it back, so what follows reads the seeded practice. Clearing it hands
    // the row to the channel, which loosens what this reason required, so it takes
    // a decision too.
    expect(
      await tx((d) =>
        setReasonThreshold(d, {
          tenantId,
          actor,
          code: "contractual_ppo",
          cents: null,
          decision: { kind: "compensate", note: "The channel's own $150 governs these again.", reviewBy: "2026-12-01" },
        })
      )
    ).toMatchObject({ ok: true });
  });

  it("lets an adopted code reach an entry, which is the whole point of adopting one", async () => {
    // The column is a foreign key, so this insert is the proof that adopting worked.
    const id = uuidv7(38_001);
    await db.admin.query(
      `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                   effective_date, posted_at, created_by_id, created_by_name, reason_code, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, 'adjustment', 'patient_ar', -500, current_date, (((date_trunc('week', current_date) - interval '5 days') + interval '14 hours')::timestamp AT TIME ZONE (SELECT timezone FROM locations WHERE id = $5)), $6, 'Riley Owner', 'insurance_adjustment', $7, now())`,
      [id, tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, owner.id, `rc-${id}`]
    );
    expect((await tx((d) => listReasonCodes(d, tenantId))).find((r) => r.code === "insurance_adjustment")!.entries).toBe(1);

    // And one the practice never adopted cannot.
    await expect(
      db.admin.query(
        `INSERT INTO ledger_entries (id, tenant_id, account_id, patient_id, location_id, kind, gl_bucket, amount_cents,
                                     effective_date, posted_at, created_by_id, created_by_name, reason_code, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, $5, 'adjustment', 'patient_ar', -500, current_date, (((date_trunc('week', current_date) - interval '5 days') + interval '14 hours')::timestamp AT TIME ZONE (SELECT timezone FROM locations WHERE id = $5)), $6, 'Riley Owner', 'never_adopted', $7, now())`,
        [uuidv7(38_002), tenantId, SEED_LEDGER.accountDoeId, SEED_LEDGER.patientJaneId, SEED_LEDGER.locationId, owner.id, "rc-never"]
      )
    ).rejects.toThrow(/ledger_entries_reason_fk|violates foreign key/);
  });
});
