/**
 * A location's business hours (Increment 1.29 stored them; Increment 1.30
 * enforces on them). One window per weekday as ["HH:MM", "HH:MM"] in the
 * location's own timezone, or null for a closed day. Every reading here is
 * from the server clock, never the browser's.
 */
export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type WeekHours = Partial<Record<Weekday, [string, string] | null>>;

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

/** The weekday and wall clock of an instant in a timezone. */
export function localClock(at: Date, timeZone: string): { weekday: Weekday; hhmm: string; date: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday").toLowerCase().slice(0, 3) as Weekday;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { weekday, hhmm: `${hour}:${get("minute")}`, date: `${get("year")}-${get("month")}-${get("day")}` };
}

/** Whether a wall-clock moment falls outside the day's window; a null window is a closed day. */
export function isOutsideHours(hours: WeekHours, weekday: Weekday, hhmm: string): { outside: boolean; window: [string, string] | null } {
  const window = hours[weekday] ?? null;
  if (!window) return { outside: true, window: null };
  return { outside: hhmm < window[0] || hhmm >= window[1], window };
}

/** "Main is open 07:00 to 19:00 that day" or "Main is closed that day". */
export function hoursPhrase(locationName: string, window: [string, string] | null): string {
  return window ? `${locationName} is open ${window[0]} to ${window[1]} that day` : `${locationName} is closed that day`;
}

/** A complete week: every weekday present, each a window or null (closed). */
export type WeekHoursComplete = Record<Weekday, [string, string] | null>;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:MM" on a 24-hour clock. */
export function isHHMM(value: unknown): value is string {
  return typeof value === "string" && HHMM.test(value);
}

/**
 * Validates a week as the owner submits it (Increment 1.32). Every weekday
 * must be present, as a ["HH:MM", "HH:MM"] window that opens before it
 * closes or null for a closed day; nothing else is stored. The after-hours
 * hold reads exactly this shape, so nothing malformed may reach the row.
 */
export function validateWeekHours(input: unknown): { ok: true; hours: WeekHoursComplete } | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Hours must be an object with one entry per weekday."] };
  }
  const obj = input as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of Object.keys(obj)) {
    if (!(WEEKDAYS as readonly string[]).includes(key)) errors.push(`Unknown weekday "${key}".`);
  }
  const out = {} as WeekHoursComplete;
  for (const day of WEEKDAYS) {
    if (!(day in obj)) {
      errors.push(`${WEEKDAY_LABEL[day]} is missing; give a window or mark it closed.`);
      continue;
    }
    const v = obj[day];
    if (v === null) {
      out[day] = null;
      continue;
    }
    if (!Array.isArray(v) || v.length !== 2 || !isHHMM(v[0]) || !isHHMM(v[1])) {
      errors.push(`${WEEKDAY_LABEL[day]} must be an opening and a closing time as HH:MM on a 24-hour clock, or closed.`);
      continue;
    }
    if (v[0] >= v[1]) {
      errors.push(`${WEEKDAY_LABEL[day]} must open before it closes (${v[0]} to ${v[1]}).`);
      continue;
    }
    out[day] = [v[0], v[1]];
  }
  return errors.length ? { ok: false, errors } : { ok: true, hours: out };
}

/** "07:00 to 17:00" or "closed". */
export function windowPhrase(window: [string, string] | null | undefined): string {
  return window ? `${window[0]} to ${window[1]}` : "closed";
}

/** The weekdays whose window differs between two weeks, in week order. */
export function changedDays(before: WeekHours, after: WeekHours): Weekday[] {
  return WEEKDAYS.filter((d) => JSON.stringify(before[d] ?? null) !== JSON.stringify(after[d] ?? null));
}
