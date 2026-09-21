"use client";

import { isSignInEnded } from "@/lib/auth/guardedFetch";
import { SessionEnded } from "../session-ended";
import { refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import { useCallback, useEffect, useState } from "react";
import type { Thread, ThreadSeat } from "@/lib/cpa/questions";
import type { ThreadRead } from "@/lib/cpa/threadReads";

/**
 * The threads the accountant and the practice hold about one month's package
 * (Increment 1.50).
 *
 * The line is chosen from the ones the package states rather than typed, for
 * the same reason a reason code is chosen rather than typed (Increment 1.39):
 * a question about a figure nobody can find is the thing email already does
 * badly, and the service refuses it anyway.
 */

/**
 * A thread as this screen reads it: the thread itself, whether this seat has
 * anything in it unread, and the last time this seat marked it read
 * (Increment 1.55). Both are computed for the signed-in seat by the route.
 */
type ThreadForSeat = Thread & { unread: boolean; lastRead: ThreadRead | null };

type Loaded = { month: string; items: ThreadForSeat[]; lines: { key: string; label: string }[]; seat: ThreadSeat };

const MIN_BODY = 10;

export function QuestionsView({ month }: { month: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Increment 1.82: this screen keeps its errors as a string, so the one
  // state that is not an error keeps its own flag rather than being folded
  // into a sentence the reader cannot act on.
  const [signInEnded, setSignInEnded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [line, setLine] = useState("");
  const [question, setQuestion] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/cpa/questions?month=${encodeURIComponent(month)}`);
    const body = (await res.json().catch(() => ({}))) as Loaded & { error?: string };
    refuseIfSignInEnded(res);
    if (!res.ok) throw new Error(body.error ?? "Could not load the questions.");
    setData(body);
    setLine((current) => current || (body.lines[0]?.key ?? ""));
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    load().catch((err: unknown) => {
      if (cancelled) return;
      if (isSignInEnded(err)) setSignInEnded(true);
      else setError(err instanceof Error ? err.message : "Could not load the questions.");
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function send(action: "ask" | "reply" | "read", payload: Record<string, unknown>, label: string) {
    setBusy(label);
    setNotice(null);
    try {
      const res = await fetch("/api/cpa/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = (await res.json().catch(() => ({}))) as { why?: string; verb?: string };
      if (!res.ok) {
        setNotice(`${body.verb ?? "Not sent"}: ${body.why ?? "The message was not sent."}`);
        return;
      }
      setQuestion("");
      setReply("");
      setReplyTo(null);
      setNotice(action === "ask" ? "Asked. The practice sees it on the home board." : action === "read" ? "Marked as read." : "Sent.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="max-w-prose text-[var(--ink-2)]">{error}</p>;
  if (!data) return <p className="text-[var(--ink-2)]">Loading the questions…</p>;

  const seatName = data.seat === "accountant" ? "the practice" : "the accountant";
  const unreadCount = data.items.filter((t) => t.unread).length;

  if (signInEnded) return <SessionEnded />;

  return (
    <section aria-labelledby="package-questions" className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 id="package-questions" className="mb-1 text-base font-semibold">
        Questions about this month
      </h2>
      <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
        A question hangs on a line this month&apos;s package states, so both sides are reading the same figure. Nothing here
        is edited or deleted: an answer that was wrong is followed by another message, the way a correction follows a
        posting. {data.items.length === 0 ? "No one has asked about this month yet." : null}
      </p>

      {/* What this seat has not marked as read (Increment 1.55). It is a count
          rather than a badge that never clears: marking a thread read is an act,
          and a later message re-opens it. Shown only when something waits, since
          silence here means nobody is owed a reading rather than an unmeasured
          state -- the opposite of the attestation card, which is always shown. */}
      {unreadCount > 0 && (
        <p className="mb-3 max-w-prose rounded-md border border-[var(--line-strong)] p-2 text-sm text-[var(--ink)]">
          {unreadCount} thread{unreadCount === 1 ? "" : "s"} {seatName} has spoken in since you last marked {unreadCount === 1 ? "it" : "them"} read.
        </p>
      )}

      {notice && (
        <p role="status" className="mb-3 text-sm text-[var(--ink-2)]">
          {notice}
        </p>
      )}

      {data.items.length > 0 && (
        <ul className="mb-4 space-y-3">
          {data.items.map((t) => (
            <li key={t.id} className="rounded-md border border-[var(--line)] p-3">
              <p className="mb-1 text-sm font-semibold">{t.subjectLabel ?? t.subjectKey}</p>
              {/* A thread about a month the practice has since closed (Increment
                  1.54). It sits above the messages rather than under them,
                  because it changes how the next message should be written. */}
              {t.closedMonth && <p className="mb-2 max-w-prose text-xs text-[var(--ink-3)]">{t.closedMonth.sentence}</p>}
              <ol className="mb-2 space-y-1">
                {t.messages.map((m) => (
                  <li key={m.id} className="text-sm">
                    <span className="font-semibold">
                      {m.authorSeat === "accountant" ? "Accountant" : "Practice"} · {m.authorName}
                    </span>{" "}
                    <span className="text-[var(--ink-3)]">{m.createdAt.slice(0, 10)}</span>
                    <br />
                    <span className="text-[var(--ink-2)]">{m.body}</span>
                  </li>
                ))}
              </ol>
              <p className="mb-2 text-xs text-[var(--ink-3)]">
                {t.awaitingPractice ? "Waiting on the practice." : "Waiting on nobody; the practice has answered."}
                {t.lastRead
                  ? ` Marked read by ${t.lastRead.readerName} on ${t.lastRead.readAt.slice(0, 10)}${t.unread ? ", and something has been said since." : "."}`
                  : t.unread
                    ? " You have not marked this read."
                    : ""}
              </p>
              {t.unread && (
                <button
                  type="button"
                  className="mb-2 min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold disabled:opacity-50"
                  disabled={busy !== null}
                  onClick={() => void send("read", { threadId: t.id }, `read:${t.id}`)}
                >
                  {busy === `read:${t.id}` ? "Marking…" : "Mark as read"}
                </button>
              )}
              {replyTo === t.id ? (
                <span className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col text-sm">
                    <span className="mb-1 font-semibold">Your message</span>
                    <input
                      className="w-80 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold disabled:opacity-50"
                    disabled={busy !== null || reply.trim().length < MIN_BODY}
                    onClick={() => void send("reply", { threadId: t.id, body: reply.trim() }, t.id)}
                  >
                    {busy === t.id ? "Sending…" : "Send"}
                  </button>
                  <button
                    type="button"
                    className="min-h-[var(--target)] rounded-md border border-[var(--line)] px-3 py-1 text-sm"
                    onClick={() => setReplyTo(null)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="min-h-[var(--target)] rounded-md border border-[var(--line)] px-3 py-1 text-sm"
                  onClick={() => {
                    setReplyTo(t.id);
                    setReply("");
                    setNotice(null);
                  }}
                >
                  Reply to {seatName}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send("ask", { month: data.month, subjectKey: line, body: question.trim() }, "ask");
        }}
      >
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold">About</span>
          <select
            className="max-w-xs rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
            value={line}
            onChange={(e) => setLine(e.target.value)}
          >
            {data.lines.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold">Question</span>
          <input
            className="w-80 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={busy !== null || !line || question.trim().length < MIN_BODY}
        >
          {busy === "ask" ? "Asking…" : "Ask"}
        </button>
      </form>
    </section>
  );
}
