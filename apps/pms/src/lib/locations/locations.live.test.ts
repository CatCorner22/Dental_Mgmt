import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { afterHoursFactsFor } from "../ledger/post";
import { listLocations, updateLocationHours } from "./service";
import type { WeekHoursComplete } from "./hours";

/**
 * Location hours as app_rw against a throwaway database (Increment 1.32):
 * the stored default week, refusals that write nothing, one change that
 * replaces the row and appends one chain event, and the after-hours hold
 * reading the new window on the next posting. Skipped without
 * PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();

const tenant = { id: uuidv7(33_000), name: "Ridgeview Family Dental", slug: "ridgeview-loc" };
const other = { id: uuidv7(33_500), name: "Oakridge Dental", slug: "oakridge-loc" };
const owner = { id: uuidv7(33_001), username: "loc-owner", name: "Riley Owner", role: "admin" };
const location = { id: uuidv7(33_010), name: "Main", timezone: "America/Chicago" };
const otherLocation = { id: uuidv7(33_510), name: "Oak", timezone: "America/Chicago" };
const actor = { id: owner.id, name: owner.name };

const DEFAULT_WEEK: WeekHoursComplete = {
  sun: null,
  mon: ["07:00", "19:00"],
  tue: ["07:00", "19:00"],
  wed: ["07:00", "19:00"],
  thu: ["07:00", "19:00"],
  fri: ["07:00", "17:00"],
  sat: null,
};

/** Friday 2026-09-18 17:30 and 18:30 in Chicago (CDT, UTC-5). */
const FRIDAY_1730 = new Date("2026-09-18T22:30:00Z");
const FRIDAY_1830 = new Date("2026-09-18T23:30:00Z");

describe.skipIf(!adminUrl)("Location hours (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenant.id, owner.id, fn, env);
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
    for (const t of [tenant, other]) {
      await db.admin.query("INSERT INTO tenants (id, name, slug, created_at) VALUES ($1, $2, $3, now())", [t.id, t.name, t.slug]);
    }
    await db.admin.query(
      `INSERT INTO users (id, tenant_id, username, display_name, password_hash, role, clinical_role, mfa_enrolled_at, password_changed_at, created_at)
       VALUES ($1, $2, $3, $4, 'x', $5, 'unset', now(), now(), now() - interval '2 years')`,
      [owner.id, tenant.id, owner.username, owner.name, owner.role]
    );
    for (const [t, loc] of [
      [tenant, location],
      [other, otherLocation],
    ] as const) {
      await db.admin.query("INSERT INTO locations (id, tenant_id, name, timezone, active, created_at) VALUES ($1, $2, $3, $4, true, now())", [
        loc.id,
        t.id,
        loc.name,
        loc.timezone,
      ]);
    }
  }, 60_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("lists the practice's locations with the stored default week, and only the practice's", async () => {
    const items = await tx((d) => listLocations(d, tenant.id));
    expect(items).toEqual([{ id: location.id, name: "Main", timezone: "America/Chicago", active: true, hours: DEFAULT_WEEK }]);
  });

  it("refuses a malformed week and writes nothing", async () => {
    const { sun: _sun, ...noSunday } = DEFAULT_WEEK;
    const missing = await tx((d) => updateLocationHours(d, { tenantId: tenant.id, actor, locationId: location.id, hours: noSunday }));
    expect(missing).toEqual({ ok: false, status: 400, code: "invalid", errors: ["Sunday is missing; give a window or mark it closed."] });
    const backwards = await tx((d) =>
      updateLocationHours(d, { tenantId: tenant.id, actor, locationId: location.id, hours: { ...DEFAULT_WEEK, fri: ["18:00", "17:00"] } })
    );
    expect(backwards).toEqual({ ok: false, status: 400, code: "invalid", errors: ["Friday must open before it closes (18:00 to 17:00)."] });
    const unknown = await tx((d) => updateLocationHours(d, { tenantId: tenant.id, actor, locationId: uuidv7(33_999), hours: DEFAULT_WEEK }));
    expect(unknown).toEqual({ ok: false, status: 404, code: "not_found", errors: ["The location was not found."] });
    // Another practice's location is not this practice's to find, let alone change.
    const foreign = await tx((d) => updateLocationHours(d, { tenantId: tenant.id, actor, locationId: otherLocation.id, hours: DEFAULT_WEEK }));
    expect(foreign).toMatchObject({ ok: false, status: 404 });
    const events = await db.admin.query("SELECT count(*)::int AS n FROM domain_event WHERE tenant_id = $1 AND kind = 'location.hours_changed'", [tenant.id]);
    expect(events.rows[0].n).toBe(0);
    const { rows } = await db.admin.query("SELECT hours FROM locations WHERE id = $1", [location.id]);
    expect(rows[0].hours).toEqual(DEFAULT_WEEK);
  });

  it("moves Friday's close to 18:00 in one row write and one chain event, and the after-hours hold reads the new window", async () => {
    // Before: 17:30 on a Friday is outside the 07:00 to 17:00 window.
    const before = await tx((d) => afterHoursFactsFor(d, tenant.id, location.id, FRIDAY_1730));
    expect(before).toMatchObject({ locationName: "Main", weekday: "fri", hhmm: "17:30", window: ["07:00", "17:00"] });

    const saved = await tx((d) =>
      updateLocationHours(d, { tenantId: tenant.id, actor, locationId: location.id, hours: { ...DEFAULT_WEEK, fri: ["07:00", "18:00"] }, now: new Date("2026-09-17T15:00:00Z") })
    );
    expect(saved).toMatchObject({
      ok: true,
      changed: [{ day: "fri", label: "Friday", before: "07:00 to 17:00", after: "07:00 to 18:00" }],
    });
    if (!saved.ok) return;
    expect(saved.location.hours).toEqual({ ...DEFAULT_WEEK, fri: ["07:00", "18:00"] });

    const { rows } = await db.admin.query("SELECT hours FROM locations WHERE id = $1", [location.id]);
    expect(rows[0].hours).toEqual({ ...DEFAULT_WEEK, fri: ["07:00", "18:00"] });
    const events = await db.admin.query("SELECT payload FROM domain_event WHERE tenant_id = $1 AND kind = 'location.hours_changed'", [tenant.id]);
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].payload).toEqual({
      locationId: location.id,
      locationName: "Main",
      timezone: "America/Chicago",
      days: ["fri"],
      before: ["fri 07:00 to 17:00"],
      after: ["fri 07:00 to 18:00"],
    });

    // After: 17:30 is inside the window; 18:30 is outside it, and the facts say the new window.
    expect(await tx((d) => afterHoursFactsFor(d, tenant.id, location.id, FRIDAY_1730))).toBeNull();
    expect(await tx((d) => afterHoursFactsFor(d, tenant.id, location.id, FRIDAY_1830))).toMatchObject({ hhmm: "18:30", window: ["07:00", "18:00"] });

    // The same week again changes nothing and writes no second event.
    const again = await tx((d) => updateLocationHours(d, { tenantId: tenant.id, actor, locationId: location.id, hours: { ...DEFAULT_WEEK, fri: ["07:00", "18:00"] } }));
    expect(again).toMatchObject({ ok: true, changed: [] });
    const count = await db.admin.query("SELECT count(*)::int AS n FROM domain_event WHERE tenant_id = $1 AND kind = 'location.hours_changed'", [tenant.id]);
    expect(count.rows[0].n).toBe(1);
  });
});
