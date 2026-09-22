"use client";

import { useCallback, useState } from "react";
import { SessionEnded } from "../session-ended";
import { isSignInEnded, refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import {
  EXTERNAL_RELEASE_CHANNELS,
  RELEASE_CHANNEL_LABEL,
  enforcementSentence,
  recordedSentence,
  type ExternalReleaseChannel,
} from "@/lib/controls/releaseSentences";

/**
 * Recording a release on a channel the ledger does not carry (Increment 1.98).
 *
 * `POST /api/controls/release/evaluate` has had no screen since it was built.
 * Increment 1.96's sweep put it on the uncalled list with the reason that it
 * wanted a surface of its own; Increment 1.97 made the figure it records
 * readable in the month-end package. This is the surface, and its arrival
 * takes the route off that list — the check fails on an allowlisted path
 * something has started calling, which is how the loop closes itself.
 *
 * ## Its own screen, at its own rank
 *
 * The route opens at `lead`. Practice Risk needs `manager`, so a panel there
 * would be a screen the people this act is for could not reach — Increment
 * 1.93's lesson read backwards. It has a header link of its own at `lead`.
 *
 * ## What it records, and what it does not
 *
 * One person attests that a release happened and what the policy said about
 * it. It does not record that a second person signed: `attestChannelRelease`
 * accepts no second signer, deliberately, because one person asserting two
 * people's participation is a weaker record than none. The screen says so in
 * the answer rather than leaving the reader to assume the opposite.
 */

type Recorded = {
  channel: string;
  amountUsd: number;
  dualRequired: boolean;
  thresholdUsd: number;
  secondsAvailable: number;
  enforcement: string;
  reasons: string[];
};

export default function ReleasesPage() {
  const [channel, setChannel] = useState<ExternalReleaseChannel>("payroll");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<Recorded | null>(null);
  const [ended, setEnded] = useState(false);

  const amountUsd = Number(amount);
  const amountOk = amount.trim() !== "" && Number.isFinite(amountUsd) && amountUsd >= 0;

  const record = useCallback(async () => {
    setBusy(true);
    setSaid(null);
    setRecorded(null);
    try {
      const res = await fetch("/api/controls/release/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel,
          amountUsd,
          payee: payee.trim() || undefined,
          memo: memo.trim() || undefined,
        }),
      });
      refuseIfSignInEnded(res);
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        evaluation?: {
          dualRequired?: boolean;
          thresholdUsd?: number;
          eligibleSeconds?: unknown[];
          reasons?: string[];
        };
        coverage?: { enforcement?: string };
      };
      if (!res.ok || !body.evaluation) {
        setSaid(body.error ?? "That release was not recorded.");
        return;
      }
      const next: Recorded = {
        channel,
        amountUsd,
        dualRequired: body.evaluation.dualRequired === true,
        thresholdUsd: body.evaluation.thresholdUsd ?? 0,
        secondsAvailable: body.evaluation.eligibleSeconds?.length ?? 0,
        enforcement: body.coverage?.enforcement ?? "external",
        reasons: body.evaluation.reasons ?? [],
      };
      setRecorded(next);
      setSaid(recordedSentence(next));
      setAmount("");
      setPayee("");
      setMemo("");
    } catch (error) {
      if (isSignInEnded(error)) setEnded(true);
      else setSaid("That release was not recorded.");
    } finally {
      setBusy(false);
    }
  }, [amountUsd, channel, memo, payee]);

  if (ended) return <SessionEnded />;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Money that left by a channel this product does not hold</h1>
      <p className="mb-6 max-w-prose text-sm text-[var(--ink-2)]">
        A payroll file, or a first payment to a new vendor. The product cannot see these leave, so recording one here is
        how the month-end package learns it happened and what this practice&rsquo;s policy asked for. Write-offs,
        cheques, transfers and deposits are not here: the ledger carries them, and their evidence comes from the posting
        path.
      </p>

      <div className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold text-[var(--ink-2)]">Which channel</span>
          <select
            id="release-channel"
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 sm:max-w-sm"
            value={channel}
            onChange={(e) => setChannel(e.target.value as ExternalReleaseChannel)}
          >
            {EXTERNAL_RELEASE_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {RELEASE_CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold text-[var(--ink-2)]">How much, in dollars</span>
          <input
            id="release-amount"
            inputMode="decimal"
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 sm:max-w-[12rem]"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold text-[var(--ink-2)]">Who it went to (optional)</span>
          <input
            id="release-payee"
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 sm:max-w-md"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
          />
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold text-[var(--ink-2)]">What it was for (optional)</span>
          <input
            id="release-memo"
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 sm:max-w-md"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </label>

        <div>
          <button
            id="release-record"
            type="button"
            className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
            disabled={busy || !amountOk}
            onClick={() => void record()}
          >
            {busy ? "Working…" : "Record this release"}
          </button>
        </div>

        {said && (
          <p aria-live="polite" className="max-w-prose text-sm text-[var(--ink-2)]">
            {said}
          </p>
        )}

        {recorded !== null && (
          <>
            <p className="max-w-prose text-sm text-[var(--ink-2)]">{enforcementSentence(recorded.enforcement)}</p>
            {recorded.reasons.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-[var(--ink-2)]">
                {recorded.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
