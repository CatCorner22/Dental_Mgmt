"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Getting somebody back into their account (Increment 1.77).
 *
 * Its own component, as the delivery panel became in Increment 1.74: Practice
 * Risk is long enough that a section which fetches, refuses and acts belongs
 * beside the page rather than inside it.
 *
 * It reads for a manager and acts for an administrator, which is the split the
 * rest of this screen holds. A manager seeing who is reachable and who may act
 * is not a courtesy — it is how they know whom to ask, which is the whole
 * point of a screen about a person who cannot ask for themselves.
 *
 * The panel asks the route what this practice can do rather than working it
 * out from the rank in the browser. A practice with one administrator meets
 * the refusal here, and `initiateRecoveryCeremony` refuses the same thing
 * again on the act: the screen is the courtesy and the act is the control.
 */

type Candidate = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  enrolled: boolean;
  codesLeft: number;
};

type OpenCeremony = {
  id: string;
  targetName: string;
  initiatedByName: string;
  initiatedAt: string;
  expiresAt: string;
  mine: boolean;
};

type RegainResponse = {
  candidates: Candidate[];
  open: OpenCeremony[];
  eligibleAdmins: number;
  refusal: string[] | null;
  standing: string;
};

function factorSentence(candidate: Candidate): string {
  if (!candidate.enrolled) return "No second factor on the account.";
  if (candidate.codesLeft === 0) return "A second factor, and no recovery codes left.";
  return `A second factor, and ${candidate.codesLeft} recovery ${candidate.codesLeft === 1 ? "code" : "codes"} left.`;
}

export function RegainPanel({ isAdmin }: { isAdmin: boolean }) {
  const [view, setView] = useState<RegainResponse | null>(null);
  const [target, setTarget] = useState("");
  const [startCode, setStartCode] = useState("");
  const [approveCode, setApproveCode] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [refused, setRefused] = useState<string[] | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/recovery-ceremony", { cache: "no-store" });
    if (!res.ok) return;
    setView((await res.json()) as RegainResponse);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = useCallback(async () => {
    setBusy(true);
    setSaid(null);
    setRefused(null);
    try {
      const res = await fetch("/api/recovery-ceremony", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId: target, totp: startCode }),
      });
      const body = (await res.json()) as { refusal?: string[] };
      if (res.ok) {
        setSaid("Started. A different administrator approves it, and receives the one link to hand over.");
        setStartCode("");
        setTarget("");
        await load();
      } else if (body.refusal) {
        setRefused(body.refusal);
      } else {
        setSaid("That did not start a recovery. Check the code from your authenticator and who you named.");
      }
    } finally {
      setBusy(false);
    }
  }, [load, startCode, target]);

  const approve = useCallback(
    async (ceremonyId: string) => {
      setBusy(true);
      setSaid(null);
      setLink(null);
      try {
        const res = await fetch("/api/recovery-ceremony/approve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ceremonyId, totp: approveCode }),
        });
        const body = (await res.json()) as { link?: string };
        if (res.ok && body.link) {
          setLink(body.link);
          setApproveCode("");
          setApproving(null);
          await load();
        } else {
          setSaid("That did not approve the recovery. Check the code from your authenticator.");
        }
      } finally {
        setBusy(false);
      }
    },
    [approveCode, load]
  );

  if (!view) return null;

  const sentences = refused ?? view.refusal;

  return (
    <section aria-labelledby="regain" className="mb-10">
      <h2 id="regain" className="mb-1 text-lg font-semibold">
        Getting somebody back in
      </h2>
      <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
        Somebody whose authenticator is gone and whose recovery codes are spent cannot sign in, and cannot pair a new
        authenticator either — that screen needs a session they no longer have. Two administrators can set their
        password and remove the second factor from the account, and the next sign-in asks them to pair a new one.
      </p>

      {sentences ? (
        <div role="status" className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:max-w-2xl">
          {sentences.map((line) => (
            <p key={line} className="max-w-prose text-sm text-[var(--ink-2)]">
              {line}
            </p>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:max-w-2xl">
          <p aria-live="polite" className="max-w-prose text-sm text-[var(--ink-2)]">
            {view.standing}
          </p>

          {isAdmin ? (
            <div className="grid gap-3">
              <label htmlFor="regain-target" className="text-sm font-semibold text-[var(--ink)]">
                Who cannot get in
              </label>
              <select
                id="regain-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-2"
              >
                <option value="">Choose a person</option>
                {view.candidates.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.displayName} ({c.username}) — {factorSentence(c)}
                  </option>
                ))}
              </select>
              <label htmlFor="regain-start-code" className="text-sm font-semibold text-[var(--ink)]">
                The code from your own authenticator
              </label>
              <input
                id="regain-start-code"
                value={startCode}
                onChange={(e) => setStartCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-2 sm:max-w-[12rem]"
              />
              <button
                id="regain-start"
                type="button"
                disabled={busy || target === "" || startCode.trim() === ""}
                onClick={start}
                className="justify-self-start rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Working…" : "Start a recovery"}
              </button>
            </div>
          ) : (
            <p className="max-w-prose text-sm text-[var(--ink-2)]">
              An administrator starts this and a different administrator approves it. This screen shows you the state so
              you know whom to ask.
            </p>
          )}

          {view.open.length > 0 ? (
            <div className="grid gap-2 rounded-md border border-[var(--line)] p-3">
              <p className="text-sm font-semibold text-[var(--ink)]">Waiting for a second pair of hands</p>
              <ul className="grid gap-3">
                {view.open.map((c) => (
                  <li key={c.id} className="grid gap-2">
                    <span className="text-sm text-[var(--ink-2)]">
                      {c.targetName}{" "}
                      <span className="text-[var(--ink-3)]">
                        started by {c.initiatedByName} &middot; runs out {c.expiresAt.slice(11, 16)} on{" "}
                        {c.expiresAt.slice(0, 10)}
                      </span>
                    </span>
                    {!isAdmin ? null : c.mine ? (
                      <span className="text-sm text-[var(--ink-3)]">
                        You started this one, so a different administrator approves it.
                      </span>
                    ) : approving === c.id ? (
                      <div className="grid gap-2 sm:max-w-sm">
                        <label htmlFor={`regain-approve-code-${c.id}`} className="text-sm font-semibold text-[var(--ink)]">
                          The code from your own authenticator
                        </label>
                        <input
                          id={`regain-approve-code-${c.id}`}
                          value={approveCode}
                          onChange={(e) => setApproveCode(e.target.value)}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-2"
                        />
                        <button
                          id={`regain-approve-${c.id}`}
                          type="button"
                          disabled={busy || approveCode.trim() === ""}
                          onClick={() => approve(c.id)}
                          className="justify-self-start rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white disabled:opacity-60"
                        >
                          {busy ? "Working…" : "Approve and get the link"}
                        </button>
                      </div>
                    ) : (
                      <button
                        id={`regain-open-${c.id}`}
                        type="button"
                        disabled={busy}
                        onClick={() => setApproving(c.id)}
                        className="justify-self-start rounded-[var(--radius)] border border-[var(--line-strong)] px-3 py-1 text-sm font-semibold text-[var(--link)] disabled:opacity-60"
                      >
                        Approve this
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {said ? (
            <p aria-live="polite" className="max-w-prose text-sm text-[var(--ink-2)]">
              {said}
            </p>
          ) : null}

          {link ? (
            <div aria-live="polite" className="grid gap-2 rounded-md border border-[var(--line)] p-3">
              <p className="max-w-prose text-sm text-[var(--ink-2)]">
                Give this link to the person it is for. It works once, this screen is the only place it appears — the
                practice keeps a hash of it and cannot show it again — and it stops working when the recovery runs out.
              </p>
              <code className="break-all rounded p-2 text-xs">{link}</code>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
