import { and, asc, eq } from "drizzle-orm";
import { locations } from "@pms/db";
import type { AppDb } from "../db/client";
import { appendControlEvent } from "../controls/events";
import { changedDays, validateWeekHours, windowPhrase, WEEKDAY_LABEL, type Weekday, type WeekHours, type WeekHoursComplete } from "./hours";

export type LocationRow = {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
  hours: WeekHours;
};

function mapRow(row: typeof locations.$inferSelect): LocationRow {
  return { id: row.id, name: row.name, timezone: row.timezone, active: row.active, hours: (row.hours ?? {}) as WeekHours };
}

/** Every location of the practice, by name. */
export async function listLocations(db: AppDb, tenantId: string): Promise<LocationRow[]> {
  const rows = await db.select().from(locations).where(eq(locations.tenantId, tenantId)).orderBy(asc(locations.name));
  return rows.map(mapRow);
}

export type HoursChange = { day: Weekday; label: string; before: string; after: string };

export type UpdateHoursResult =
  | { ok: true; location: LocationRow; changed: HoursChange[] }
  | { ok: false; status: 400 | 404; code: "invalid" | "not_found"; errors: string[] };

/**
 * Sets a location's business hours (Increment 1.32). The week is validated
 * whole, the row is replaced, and one chain event names the days that
 * changed with their old and new windows, so the register of "when did the
 * hold's window move" is the chain itself. Saving the same week again
 * writes nothing. The route requires the administrator rank.
 */
export async function updateLocationHours(
  db: AppDb,
  input: { tenantId: string; actor: { id: string; name: string }; locationId: string; hours: unknown; now?: Date }
): Promise<UpdateHoursResult> {
  const now = input.now ?? new Date();
  const valid = validateWeekHours(input.hours);
  if (!valid.ok) return { ok: false, status: 400, code: "invalid", errors: valid.errors };
  const next: WeekHoursComplete = valid.hours;

  const rows = await db
    .select()
    .from(locations)
    .where(and(eq(locations.tenantId, input.tenantId), eq(locations.id, input.locationId)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, status: 404, code: "not_found", errors: ["The location was not found."] };
  const current = mapRow(row);

  const changed: HoursChange[] = changedDays(current.hours, next).map((day) => ({
    day,
    label: WEEKDAY_LABEL[day],
    before: windowPhrase(current.hours[day]),
    after: windowPhrase(next[day]),
  }));
  if (changed.length === 0) return { ok: true, location: current, changed };

  await db
    .update(locations)
    .set({ hours: next })
    .where(and(eq(locations.tenantId, input.tenantId), eq(locations.id, input.locationId)));
  await appendControlEvent(
    db,
    input.tenantId,
    input.actor.id,
    "location.hours_changed",
    {
      locationId: current.id,
      locationName: current.name,
      timezone: current.timezone,
      days: changed.map((c) => c.day),
      before: changed.map((c) => `${c.day} ${c.before}`),
      after: changed.map((c) => `${c.day} ${c.after}`),
    },
    now
  );
  return { ok: true, location: { ...current, hours: next }, changed };
}
