"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttestationRow, AttestationSeat } from "@/lib/controls/attestations";

/**
 * The attestation tab (Increment 1.51, docs/13 item 22).
 *
 * Only the channels this build cannot enforce appear: an attestation beside
 * evidence the product already holds adds nothing and reads as though it did.
 * The service refuses the rest, and this screen never offers them.
 */

type Loaded = { month: string; items: AttestationRow[]; seat: AttestationSeat };

const MIN_NOTE = 10;

const CHANNEL_LABEL: Record<string, string> = {
  vendor_new: "New vendors",
  payroll: "Payroll",
};

export function AttestView({ month }: { month: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/controls/attestations?month=${encodeURIComponent(month)}`);
    const body = (await res.json().catch(() => ({}))) as Loaded & { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Could not load the attestations.");
    setData(body);
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    load().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the attestations.");
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function attest(channel: string) {
    setBusy(channel);
    setNotice(null);
    try {
      const res = await fetch("/api/controls/attestations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month, channel, note: note.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { why?: string; verb?: string };
      if (!res.ok) {
        setNotice(`${body.verb ?? "Not recorded"}: ${body.why ?? "The attestation was not recorded."}`);
        return;
      }
      setOpen(null);
      setNote("");
      setNotice(`Attested: ${CHANNEL_LABEL[channel] ?? channel} for ${month}. It is on the chain and in the month's package.`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="max-w-prose text-[var(--ink-2)]">{error}</p>;
  if (!data) return <p className="text-[var(--ink-2)]">Loading the attestations…</p>;

  return (
    <section aria-labelledby="package-attest" className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 id="package-attest" className="mb-1 text-base font-semibold">
        Attest the channels the product cannot hold
      </h2>
      <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
        This build holds no vendor payments and no payroll file, so it can enforce nothing about them and the coverage
        table calls them attested rather than enforced. This is what stands behind that word: a dated note, by a named
        person, that someone reviewed the channel&apos;s month. It is never rewritten — a later opinion is a later
        month&apos;s.
      </p>

      {notice && (
        <p role="status" className="mb-3 text-sm text-[var(--ink-2)]">
          {notice}
        </p>
      )}

      <ul className="space-y-3">
        {data.items.map((row) => (
          <li key={row.channel} className="rounded-md border border-[var(--line)] p-3">
            <p className="text-sm font-semibold">{CHANNEL_LABEL[row.channel] ?? row.channel}</p>
            {row.attestation ? (
              <p className="mt-1 text-sm text-[var(--ink-2)]">
                Reviewed for {row.attestation.month} by{" "}
                <span className="font-semibold text-[var(--ink)]">{row.attestation.byName}</span> (
                {row.attestation.seat === "accountant" ? "the accountant" : "the practice"}) on{" "}
                {row.attestation.at.slice(0, 10)}. {row.attestation.note}
              </p>
            ) : open === row.channel ? (
              <span className="mt-2 flex flex-wrap items-end gap-2">
                <label className="flex flex-col text-sm">
                  <span className="mb-1 font-semibold">What you reviewed, and against what</span>
                  <input
                    className="w-96 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold disabled:opacity-50"
                  disabled={busy !== null || note.trim().length < MIN_NOTE}
                  onClick={() => void attest(row.channel)}
                >
                  {busy === row.channel ? "Recording…" : "Reviewed this month"}
                </button>
                <button
                  type="button"
                  className="min-h-[var(--target)] rounded-md border border-[var(--line)] px-3 py-1 text-sm"
                  onClick={() => setOpen(null)}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--ink-2)]">Nobody has reviewed this channel for {month}.</span>
                <button
                  type="button"
                  className="min-h-[var(--target)] rounded-md border border-[var(--line)] px-3 py-1 text-sm"
                  onClick={() => {
                    setOpen(row.channel);
                    setNote("");
                    setNotice(null);
                  }}
                >
                  Attest {CHANNEL_LABEL[row.channel] ?? row.channel}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
