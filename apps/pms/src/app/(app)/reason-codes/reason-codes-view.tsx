"use client";

import { useEffect, useState } from "react";
import { isRole, meetsRole } from "@/lib/auth/roles";
import { REASON_KIND_LABEL, REASON_KINDS, type ReasonCodeRow, type ReasonKind } from "@/lib/ledger/reasons";

type Me = { ok: boolean; role?: string };

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: ReasonCodeRow[]; isAdmin: boolean };

export function ReasonCodesView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [relabelling, setRelabelling] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [draft, setDraft] = useState<{ code: string; kind: ReasonKind; label: string }>({
    code: "",
    kind: "write_off",
    label: "",
  });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/reason-codes").then(async (r) => ({ ok: r.ok, body: (await r.json()) as { items?: ReasonCodeRow[]; error?: string } })),
      fetch("/api/me").then(async (r) => ((await r.json()) as Me)),
    ])
      .then(([list, me]) => {
        if (cancelled) return;
        if (!list.ok) {
          setState({ status: "error", message: list.body.error ?? "Could not load the reason codes." });
          return;
        }
        const role = me.role ?? "";
        setState({
          status: "ready",
          rows: list.body.items ?? [],
          isAdmin: isRole(role) && meetsRole(role, "admin"),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Could not load the reason codes." });
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function act(action: string, code: string, extra: Record<string, string> = {}, label = action) {
    setBusy(`${action}:${code}`);
    setNotice(null);
    try {
      const res = await fetch("/api/reason-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, code, ...extra }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; verb?: string; why?: string };
      if (!res.ok) throw new Error(body.why ? `${body.verb}: ${body.why}` : (body.error ?? `${label} failed.`));
      setNotice(`${label} succeeded.`);
      setRelabelling(null);
      setDraft({ code: "", kind: "write_off", label: "" });
      setReload((n) => n + 1);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  }

  if (state.status === "loading") return <p className="text-sm text-[var(--ink-2)]">Loading…</p>;
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
                  <th className="px-4 py-3 font-semibold tabular-nums">Entries</th>
                  {state.isAdmin && <th className="px-4 py-3 font-semibold">Change</th>}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
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
                    <td className="px-4 py-3 tabular-nums">{row.entries}</td>
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
                ))}
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
