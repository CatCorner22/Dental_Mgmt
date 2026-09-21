"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Who holds which rank, and changing one (Increment 1.78).
 *
 * Its own component, as the delivery and recovery panels are: Practice Risk
 * is long enough that a section which fetches, refuses and acts belongs
 * beside the page rather than inside it.
 *
 * It shows the control role beside the rank because that label, not the rank,
 * is what the dual-release rules name. A reader who cannot see that
 * "administrator" becomes "Owner / Dentist" to those rules cannot see why a
 * promotion is a control change rather than a convenience.
 */

type Person = {
  userId: string;
  displayName: string;
  rank: string;
  controlRole: string;
  entitlements: string[];
  mine: boolean;
};

type RanksResponse = {
  people: Person[];
  administrators: number;
  ranks: string[];
};

type Refusal = { why: string; nextSteps: string[] };

/**
 * What the change moved, in the practice's own words.
 *
 * A rank grants no entitlement and creates no segregation-of-duties conflict
 * — the rulebook scores duty combinations from live grants and infers nothing
 * from a label. What it moves is signing power, so that is what is reported.
 */
function shiftSentence(
  toRank: string,
  shift?: { gainedInitiate: string[]; gainedSecond: string[]; lostInitiate: string[]; lostSecond: string[] }
): string {
  const parts: string[] = [];
  if (shift?.gainedSecond.length) parts.push(`may now second a release on ${shift.gainedSecond.join(", ")}`);
  if (shift?.gainedInitiate.length) parts.push(`may now start one on ${shift.gainedInitiate.join(", ")}`);
  if (shift?.lostSecond.length) parts.push(`may no longer second one on ${shift.lostSecond.join(", ")}`);
  if (shift?.lostInitiate.length) parts.push(`may no longer start one on ${shift.lostInitiate.join(", ")}`);
  if (parts.length === 0) return `Changed to ${toRank}. No release channel changed hands.`;
  return `Changed to ${toRank}. They ${parts.join("; ")}.`;
}

export function RanksPanel({ isAdmin }: { isAdmin: boolean }) {
  const [view, setView] = useState<RanksResponse | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [rank, setRank] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/controls/ranks", { cache: "no-store" });
    if (!res.ok) return;
    setView((await res.json()) as RanksResponse);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (userId: string) => {
      setBusy(true);
      setSaid(null);
      try {
        const res = await fetch("/api/controls/ranks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetUserId: userId, rank }),
        });
        const body = (await res.json()) as {
          error?: string;
          nextSteps?: string[];
          toRank?: string;
          shift?: { gainedInitiate: string[]; gainedSecond: string[]; lostInitiate: string[]; lostSecond: string[] };
        };
        if (res.ok) {
          setSaid(shiftSentence(body.toRank ?? "", body.shift));
          setRefusal(null);
          setEditing(null);
          setRank("");
          await load();
        } else {
          setRefusal({ why: body.error ?? "That change was refused.", nextSteps: body.nextSteps ?? [] });
        }
      } finally {
        setBusy(false);
      }
    },
    [load, rank]
  );

  if (!view) return null;

  return (
    <section aria-labelledby="ranks" className="mb-10">
      <h2 id="ranks" className="mb-1 text-lg font-semibold">
        Who holds which rank
      </h2>
      <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
        A rank decides which screens open. It also decides what the release rules call somebody: an administrator is
        &ldquo;Owner / Dentist&rdquo; to those rules, so a promotion moves duties the same way a grant does and meets
        the same refusal. This practice has {view.administrators} administrator
        {view.administrators === 1 ? "" : "s"}
        {view.administrators === 1
          ? ", which is why the controls needing two people cannot run here yet."
          : "."}
      </p>

      <ul className="grid gap-3 sm:max-w-2xl">
        {view.people.map((p) => (
          <li key={p.userId} className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-[var(--ink)]">{p.displayName}</span>
              <span className="text-sm text-[var(--ink-2)]">
                {p.rank} &middot; <span className="text-[var(--ink-3)]">{p.controlRole}</span>
              </span>
            </div>
            {!isAdmin ? null : p.mine ? (
              <span className="text-sm text-[var(--ink-3)]">
                Your own rank. A different administrator changes it, for the reason a grant may not license its own
                conflict.
              </span>
            ) : editing === p.userId ? (
              <div className="grid gap-2 sm:max-w-sm">
                <label htmlFor={`rank-${p.userId}`} className="text-sm font-semibold text-[var(--ink)]">
                  New rank
                </label>
                <select
                  id={`rank-${p.userId}`}
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-2"
                >
                  <option value="">Choose a rank</option>
                  {view.ranks
                    .filter((r) => r !== p.rank)
                    .map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                </select>
                <button
                  id={`rank-submit-${p.userId}`}
                  type="button"
                  disabled={busy || rank === ""}
                  onClick={() => submit(p.userId)}
                  className="justify-self-start rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Working…" : "Change this rank"}
                </button>
              </div>
            ) : (
              <button
                id={`rank-open-${p.userId}`}
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(p.userId);
                  setRank("");
                  setRefusal(null);
                }}
                className="justify-self-start rounded-[var(--radius)] border border-[var(--line-strong)] px-3 py-1 text-sm font-semibold text-[var(--link)] disabled:opacity-60"
              >
                Change rank
              </button>
            )}
          </li>
        ))}
      </ul>

      {refusal ? (
        <div role="alert" className="mt-3 grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:max-w-2xl">
          <p className="max-w-prose text-sm text-[var(--ink-2)]">{refusal.why}</p>
          {refusal.nextSteps.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-[var(--ink-2)]">
              {refusal.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {said ? (
        <p aria-live="polite" className="mt-3 max-w-prose text-sm text-[var(--ink-2)]">
          {said}
        </p>
      ) : null}
    </section>
  );
}
