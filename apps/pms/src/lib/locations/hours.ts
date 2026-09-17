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
