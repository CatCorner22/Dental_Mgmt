"use client";

import { loadFailure } from "../session-ended";
import { isSignInEnded, refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import { useEffect, useState } from "react";
import { isRole, meetsRole } from "@/lib/auth/roles";
import { readViewer } from "@/lib/auth/viewer";
import { SessionEnded } from "../session-ended";
import { validateWeekHours, WEEKDAY_LABEL, WEEKDAYS, type Weekday, type WeekHoursComplete } from "@/lib/locations/hours";
import type { HoursChange, LocationRow } from "@/lib/locations/service";

type LoadState =
  | { status: "loading" }
  /** The sign-in is over (Increment 1.81). Not the same fact as the one below. */
  | { status: "sign_in_ended" }
  | { status: "not_for_seat" }
  | { status: "error"; message: string }
  | { status: "ready"; items: LocationRow[]; isAdmin: boolean };

/** A stored week, filled out so every weekday has an entry the form can edit. */
function complete(hours: LocationRow["hours"]): WeekHoursComplete {
  const out = {} as WeekHoursComplete;
  for (const d of WEEKDAYS) out[d] = hours[d] ?? null;
  return out;
}

async function loadLocations(): Promise<LocationRow[]> {
  const res = await fetch("/api/locations");
  const body = (await res.json().catch(() => ({}))) as { items?: LocationRow[]; error?: string };
  refuseIfSignInEnded(res);
  if (!res.ok) throw new Error(body.error ?? "Could not load the locations.");
  return body.items ?? [];
}

export function LocationsView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [drafts, setDrafts] = useState<Record<string, WeekHoursComplete>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // A 401 is the sign-in ending, never the seat lacking rank (Increment
      // 1.81). The old test was `!meRes.ok`, which is true of both, and told a
      // person whose session had timed out that this screen was not for their
      // seat — pointing them at a header the same fact had just emptied.
      const meRes = await fetch("/api/me");
      const viewer = readViewer(meRes.status, await meRes.json().catch(() => ({})));
      if (viewer.state !== "present") {
        if (!cancelled) {
          setState(viewer.state === "ended" ? { status: "sign_in_ended" } : { status: "error", message: viewer.why });
        }
        return;
      }
      const role = isRole(viewer.role) ? viewer.role : undefined;
      if (!meetsRole(role, "manager")) {
        if (!cancelled) setState({ status: "not_for_seat" });
        return;
      }
      const items = await loadLocations();
      if (cancelled) return;
      setDrafts(Object.fromEntries(items.map((l) => [l.id, complete(l.hours)])));
      setState({ status: "ready", items, isAdmin: meetsRole(role, "admin") });
    })().catch((err: unknown) => {
      if (!cancelled) setState(loadFailure(err, "Could not load the locations."));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setDay(locationId: string, day: Weekday, window: [string, string] | null) {
    setDrafts((d) => ({ ...d, [locationId]: { ...d[locationId]!, [day]: window } }));
  }

  async function save(location: LocationRow) {
    if (state.status !== "ready") return;
    setMessage(null);
    // The same validator the server runs, so an obvious mistake never makes the round trip.
    const valid = validateWeekHours(drafts[location.id]);
    if (!valid.ok) {
      setMessage(valid.errors.join(" "));
      return;
    }
    setBusy(location.id);
    try {
      const res = await fetch(`/api/locations/${location.id}/hours`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours: drafts[location.id] }),
      });
      const body = (await res.json().catch(() => ({}))) as { location?: LocationRow; changed?: HoursChange[]; error?: string; errors?: string[] };
      refuseIfSignInEnded(res);
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      const changed = body.changed ?? [];
      const items = await loadLocations();
      setDrafts(Object.fromEntries(items.map((l) => [l.id, complete(l.hours)])));
      setState({ ...state, items });
      setMessage(
        changed.length === 0
          ? `No change to ${location.name}: the week is as it was.`
          : `Saved ${location.name}: ${changed.map((c) => `${c.label} ${c.before} → ${c.after}`).join("; ")}. The after-hours hold reads these hours from the next posting.`
      );
    } catch (err: unknown) {
      // The sign-in is over, so nothing this screen offers can succeed (Increment 1.83).
      if (isSignInEnded(err)) {
        setState({ status: "sign_in_ended" });
        return;
      }
      setMessage(err instanceof Error ? err.message : "The hours were not saved.");
    } finally {
      setBusy(null);
    }
  }

  if (state.status === "loading") return <p className="text-sm text-[var(--ink-2)]">Reading the locations…</p>;
  if (state.status === "sign_in_ended") return <SessionEnded />;
  if (state.status === "not_for_seat") {
    return <p className="max-w-prose text-[var(--ink-2)]">Location hours are for the manager and owner seats. Your seat works from the links in the header.</p>;
  }
  if (state.status === "error") return <p className="text-sm text-[var(--ink-2)]">{state.message}</p>;

  return (
    <div className="grid gap-6">
      {message && (
        <p className="text-sm text-[var(--ink-2)]" aria-live="polite">
          {message}
        </p>
      )}
      {state.items.length === 0 && <p className="text-sm text-[var(--ink-2)]">No locations yet.</p>}
      {state.items.map((location) => {
        const draft = drafts[location.id] ?? complete(location.hours);
        const headingId = `location-${location.id}`;
        return (
          <section key={location.id} aria-labelledby={headingId} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
            <h2 id={headingId} className="text-lg font-semibold">
              {location.name}
            </h2>
            <p className="mb-3 text-sm text-[var(--ink-2)]">
              Timezone {location.timezone}
              {location.active ? "" : " · inactive"}
            </p>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--ink-2)]">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Day</th>
                  <th className="py-2 pr-4 font-semibold">Closed</th>
                  <th className="py-2 pr-4 font-semibold">Opens</th>
                  <th className="py-2 pr-4 font-semibold">Closes</th>
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((day) => {
                  const window = draft[day];
                  const closed = window === null;
                  return (
                    <tr key={day} className="border-b border-[var(--line)] last:border-0">
                      <th scope="row" className="py-2 pr-4 font-normal">
                        {WEEKDAY_LABEL[day]}
                      </th>
                      <td className="py-2 pr-4">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          aria-label={`${location.name} ${WEEKDAY_LABEL[day]} closed`}
                          checked={closed}
                          disabled={!state.isAdmin || busy !== null}
                          onChange={(e) => setDay(location.id, day, e.target.checked ? null : ["07:00", "17:00"])}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="time"
                          className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1 disabled:opacity-50"
                          aria-label={`${location.name} ${WEEKDAY_LABEL[day]} opens`}
                          value={window?.[0] ?? ""}
                          disabled={!state.isAdmin || closed || busy !== null}
                          onChange={(e) => setDay(location.id, day, [e.target.value, window?.[1] ?? "17:00"])}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="time"
                          className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1 disabled:opacity-50"
                          aria-label={`${location.name} ${WEEKDAY_LABEL[day]} closes`}
                          value={window?.[1] ?? ""}
                          disabled={!state.isAdmin || closed || busy !== null}
                          onChange={(e) => setDay(location.id, day, [window?.[0] ?? "07:00", e.target.value])}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {state.isAdmin ? (
              <button
                type="button"
                className="mt-3 min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={busy !== null}
                onClick={() => void save(location)}
              >
                {busy === location.id ? "Saving…" : `Save ${location.name}`}
              </button>
            ) : (
              <p className="mt-3 text-xs text-[var(--ink-3)]">The owner seat edits these hours.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
