"use client";

import { readViewer, SESSION_ENDED_VERB, type Viewer } from "@/lib/auth/viewer";
import { useEffect, useState } from "react";

/**
 * The one line on the practice home that names who is reading it.
 *
 * This screen already held the right answer before Increment 1.81 — it was the
 * only one that read a failed `/api/me` as "not signed in" and the only one
 * that offered a way back. What it lacked was the rest of the product agreeing
 * with it, and a link that returns the reader to the screen they were on. Both
 * now come from `lib/auth/viewer`, so one state wears one sentence wherever it
 * is reported.
 */
export function SessionStatus() {
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then(async (res) => readViewer(res.status, await res.json().catch(() => ({}))))
      .then((read) => {
        if (!cancelled) setViewer(read);
      })
      .catch(() => {
        if (!cancelled) setViewer({ state: "unknown", why: "Could not read the session." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (viewer === null) {
    return <p className="text-sm text-[var(--ink-2)]">Checking session…</p>;
  }
  if (viewer.state === "ended") {
    // This line states; it does not act. The board above it carries the
    // refusal with the way back, and the header carries the door, so a third
    // control here would be three ways to do one thing on one screen. What
    // this owes the reader is the same sentence the other two use, which is
    // why the words come from `lib/auth/viewer` rather than from here.
    return <p className="text-sm text-[var(--ink-2)]">{SESSION_ENDED_VERB}</p>;
  }
  if (viewer.state === "unknown") {
    return <p className="text-sm text-[var(--ink-2)]">{viewer.why}</p>;
  }
  return (
    <p className="text-sm text-[var(--ink-2)]">
      Signed in as <strong className="text-[var(--ink)]">{viewer.displayName}</strong> ({viewer.username},{" "}
      {viewer.role}).
    </p>
  );
}
