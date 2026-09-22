"use client";

import { isSignInEnded, refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import { useEffect, useState } from "react";
import { isRole, meetsRole } from "@/lib/auth/roles";
import { readViewer } from "@/lib/auth/viewer";
import { SessionEnded } from "../session-ended";
import { formatCents } from "@/lib/ledger/format";
import { REASON_KIND_LABEL, REASON_KINDS, type PostingReasonCode, type ReasonCodeRow, type ReasonKind } from "@/lib/ledger/reasons";
import { isLoosening } from "@/lib/ledger/reasonThreshold";

type LoadState =
  | { status: "loading" }
  /** The sign-in is over (Increment 1.81). */
  | { status: "sign_in_ended" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      rows: PostingReasonCode[];
      isAdmin: boolean;
      /**
       * What the practice has decided about each reason (Increment 1.103):
       * the figure above which a posting on it waits for a second person, and
       * how many entries cite it. `null` for a seat below `manager`, which
       * the route answers with the list its forms are built from and nothing
       * further — so the two columns are absent here rather than blank, and
       * the screen cannot render a figure it was not given.
       */
      governance: Map<string, Governance> | null;
    };

type Governance = { requiresApprovalOverCents: number | null; entries: number };

export function ReasonCodesView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [relabelling, setRelabelling] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [threshold, setThreshold] = useState<string | null>(null);
  const [dollars, setDollars] = useState("");
  // What the owner records when the figure they entered lets more through than
  // it used to (Increment 1.47); the service refuses the change without it.
  const [decisionKind, setDecisionKind] = useState("accept_residual");
  const [decisionNote, setDecisionNote] = useState("");
  const [reviewBy, setReviewBy] = useState("");
  const [draft, setDraft] = useState<{ code: string; kind: ReasonKind; label: string }>({
    code: "",
    kind: "write_off",
    label: "",
  });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/reason-codes").then(async (r) => ({
        ok: r.ok,
        status: r.status,
        body: (await r.json().catch(() => ({}))) as { items?: PostingReasonCode[]; error?: string },
      })),
      fetch("/api/me").then(async (r) => readViewer(r.status, await r.json().catch(() => ({})))),
    ])
      .then(([list, viewer]) => {
        if (cancelled) return;
        // This screen read the body and never the status, so an ended session
        // produced no role and the owner's controls quietly disappeared
        // (Increment 1.81). Either answer settles it, because both routes
        // answer 401 for the same reason.
        if (list.status === 401 || viewer.state === "ended") {
          setState({ status: "sign_in_ended" });
          return;
        }
        if (!list.ok) {
          setState({ status: "error", message: list.body.error ?? "Could not load the reason codes." });
          return;
        }
        const role = viewer.state === "present" ? viewer.role : "";
        const rows = list.body.items ?? [];
        /**
         * The route hands a seat below `manager` the list its posting forms
         * are built from, without the threshold or the entry count
         * (Increment 1.103). The screen reads its own rank for the same
         * reason: a column built from a field that is not there would render
         * a blank where a figure belongs, and a blank in a threshold column
         * reads as "no second person needed".
         */
        const governed = isRole(role) && meetsRole(role, "manager");
        setState({
          status: "ready",
          rows,
          isAdmin: isRole(role) && meetsRole(role, "admin"),
          governance: governed
            ? new Map(
                (rows as ReasonCodeRow[]).map((r) => [
                  r.code,
                  { requiresApprovalOverCents: r.requiresApprovalOverCents, entries: r.entries },
                ])
              )
            : null,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Could not load the reason codes." });
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function act(
    action: string,
    code: string,
    extra: Record<string, string> = {},
    label = action,
    extraBody: Record<string, unknown> = {}
  ) {
    setBusy(`${action}:${code}`);
    setNotice(null);
    try {
      const res = await fetch("/api/reason-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, code, ...extra, ...extraBody }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; verb?: string; why?: string };
      refuseIfSignInEnded(res);
      if (!res.ok) throw new Error(body.why ? `${body.verb}: ${body.why}` : (body.error ?? `${label} failed.`));
      setNotice(`${label} succeeded.`);
      setRelabelling(null);
      setThreshold(null);
      setDecisionNote("");
      setReviewBy("");
      setDraft({ code: "", kind: "write_off", label: "" });
      setReload((n) => n + 1);
    } catch (err: unknown) {
      // The sign-in is over, so nothing this screen offers can succeed (Increment 1.83).
      if (isSignInEnded(err)) {
        setState({ status: "sign_in_ended" });
        return;
      }
      setNotice(err instanceof Error ? err.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  }

  /** The figure the form currently holds, in cents, or null for "the channel's own". */
  function enteredCents(): number | null {
    const trimmed = dollars.trim();
    return trimmed === "" ? null : Math.round(Number(trimmed) * 100);
  }

  /** Whether what is typed would let through what used to wait for a second person. */
  function needsDecision(g: Governance | undefined): boolean {
    return isLoosening(g?.requiresApprovalOverCents ?? null, enteredCents());
  }

  if (state.status === "loading") return <p className="text-sm text-[var(--ink-2)]">Loading…</p>;
  if (state.status === "sign_in_ended") return <SessionEnded />;
  if (state.status === "error") return <p className="text-sm text-[var(--ink-2)]">{state.message}</p>;

  const byKind = REASON_KINDS.map((kind) => ({ kind, rows: state.rows.filter((r) => r.kind === kind) })).filter(
    (g) => g.rows.length > 0
  );

  return (
    <>
      {notice && (
        <p className="mb-4 max-w-prose text-sm text-[var(--ink-2)]" aria-live="polite">
          {notice}
        </p>
      )}

      {byKind.map((group) => (
        <section key={group.kind} aria-labelledby={`kind-${group.kind}`} className="mb-6">
          <h2 id={`kind-${group.kind}`} className="mb-2 text-base font-semibold">
            {REASON_KIND_LABEL[group.kind]}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Reads as</th>
                  <th className="px-4 py-3 font-semibold">On the forms</th>
                  {state.governance && <th className="px-4 py-3 font-semibold">Second person over</th>}
                  {state.governance && <th className="px-4 py-3 font-semibold tabular-nums">Entries</th>}
                  {state.isAdmin && <th className="px-4 py-3 font-semibold">Change</th>}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const governance = state.governance?.get(row.code);
                  return (
                  <tr key={row.code} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="px-4 py-3">
                      <code className="text-xs">{row.code}</code>
                      {row.reserved && <span className="ml-2 text-xs text-[var(--ink-3)]">reserved</span>}
                    </td>
                    <td className="px-4 py-3">
                      {relabelling === row.code ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <label className="sr-only" htmlFor={`label-${row.code}`}>
                            New wording for {row.code}
                          </label>
                          <input
                            id={`label-${row.code}`}
                            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                          />
                          <button
                            type="button"
                            className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold disabled:opacity-50"
                            disabled={busy !== null}
                            onClick={() => void act("relabel", row.code, { label }, "Relabel")}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="min-h-[var(--target)] rounded-md border border-[var(--line)] px-3 py-1 text-sm"
                            onClick={() => setRelabelling(null)}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        row.label
                      )}
                    </td>
                    <td className="px-4 py-3">{row.active ? "Offered" : "Retired"}</td>
                    {state.governance && (
                    <td className="px-4 py-3">
                      {threshold === row.code ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <label className="sr-only" htmlFor={`threshold-${row.code}`}>
                            Second person over, in dollars, for {row.code}
                          </label>
                          <input
                            id={`threshold-${row.code}`}
                            className="w-24 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1 tabular-nums"
                            inputMode="decimal"
                            placeholder="none"
                            value={dollars}
                            onChange={(e) => setDollars(e.target.value)}
                          />
                          <button
                            type="button"
                            className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold disabled:opacity-50"
                            // A loosening needs its decision complete before it is worth
                            // sending: the server refuses an incomplete one anyway, and a
                            // form that already knows should say so without the round trip.
                            disabled={busy !== null || (needsDecision(governance) && (!decisionNote.trim() || !reviewBy))}
                            onClick={() => {
                              const cents = enteredCents();
                              if (cents !== null && !Number.isFinite(cents)) return;
                              const decision = needsDecision(governance)
                                ? { kind: decisionKind, note: decisionNote.trim(), reviewBy }
                                : undefined;
                              void act("threshold", row.code, {}, "Set the threshold", { cents, decision });
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="min-h-[var(--target)] rounded-md border border-[var(--line)] px-3 py-1 text-sm"
                            onClick={() => setThreshold(null)}
                          >
                            Cancel
                          </button>
                          {needsDecision(governance) && (
                            <span className="flex w-full flex-wrap items-end gap-2">
                              <span className="w-full max-w-prose text-sm text-[var(--ink-2)]">
                                That lets through what used to wait for a second person. Accept the residual or name
                                what compensates, say why, and set the day the practice looks at this again.
                              </span>
                              <label className="flex flex-col text-sm">
                                <span className="mb-1 font-semibold">Decision</span>
                                <select
                                  className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
                                  value={decisionKind}
                                  onChange={(e) => setDecisionKind(e.target.value)}
                                >
                                  <option value="accept_residual">Accept residual</option>
                                  <option value="compensate">Compensate</option>
                                </select>
                              </label>
                              <label className="flex flex-col text-sm">
                                <span className="mb-1 font-semibold">Why</span>
                                <input
                                  className="w-64 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
                                  value={decisionNote}
                                  onChange={(e) => setDecisionNote(e.target.value)}
                                />
                              </label>
                              <label className="flex flex-col text-sm">
                                <span className="mb-1 font-semibold">Review by</span>
                                <input
                                  className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
                                  type="date"
                                  value={reviewBy}
                                  onChange={(e) => setReviewBy(e.target.value)}
                                />
                              </label>
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="tabular-nums">
                            {governance?.requiresApprovalOverCents == null
                              ? "the channel's figure"
                              : governance.requiresApprovalOverCents === 0
                                ? "every one"
                                : formatCents(governance.requiresApprovalOverCents)}
                          </span>
                          {state.isAdmin && (
                            <button
                              type="button"
                              className="min-h-[var(--target)] rounded-md border border-[var(--line)] px-3 py-1 text-sm"
                              onClick={() => {
                                setThreshold(row.code);
                                setDollars(
                                  governance?.requiresApprovalOverCents == null
                                    ? ""
                                    : (governance.requiresApprovalOverCents / 100).toFixed(2)
                                );
                                setNotice(null);
                              }}
                            >
                              Set threshold for {row.code}
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                    )}
                    {state.governance && <td className="px-4 py-3 tabular-nums">{governance?.entries ?? 0}</td>}
                    {state.isAdmin && (
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="min-h-[var(--target)] rounded-md border border-[var(--line)] px-3 py-1 text-sm"
                            onClick={() => {
                              setRelabelling(row.code);
                              setLabel(row.label);
                              setNotice(null);
                            }}
                          >
                            Relabel {row.code}
                          </button>
                          {row.active ? (
                            <button
                              type="button"
                              className="min-h-[var(--target)] rounded-md border border-[var(--line)] px-3 py-1 text-sm disabled:opacity-50"
                              disabled={busy !== null || row.reserved}
                              title={row.reserved ? "A correction into a closed month must carry this reason." : undefined}
                              onClick={() => void act("retire", row.code, {}, "Retire")}
                            >
                              Retire {row.code}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="min-h-[var(--target)] rounded-md border border-[var(--line)] px-3 py-1 text-sm disabled:opacity-50"
                              disabled={busy !== null}
                              onClick={() => void act("restore", row.code, {}, "Restore")}
                            >
                              Restore {row.code}
                            </button>
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {state.isAdmin ? (
        <section aria-labelledby="add-reason" className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-4">
          <h2 id="add-reason" className="mb-1 text-base font-semibold">
            Adopt a reason
          </h2>
          <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
            The code is written onto every entry that cites it and never changes afterward, so it is worth choosing
            once. The wording beside it is yours to change whenever.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-sm">
              <span className="mb-1 font-semibold">Code</span>
              <input
                className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                value={draft.code}
                placeholder="insurance_adjustment"
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 font-semibold">Kind</span>
              <select
                className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                value={draft.kind}
                onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as ReasonKind }))}
              >
                {REASON_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {REASON_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 font-semibold">Reads as</span>
              <input
                className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                value={draft.label}
                placeholder="Insurance adjustment"
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              />
            </label>
            <button
              type="button"
              className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={busy !== null || !draft.code.trim() || !draft.label.trim()}
              onClick={() => void act("add", draft.code.trim(), { kind: draft.kind, label: draft.label.trim() }, "Adopt")}
            >
              Adopt
            </button>
          </div>
        </section>
      ) : (
        <p className="max-w-prose text-sm text-[var(--ink-2)]">
          Adopting, relabelling, and retiring a reason code is the administrator&apos;s. The list above is what the
          posting forms offer.
        </p>
      )}
    </>
  );
}
