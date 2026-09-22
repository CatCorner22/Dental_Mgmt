"use client";

import { useCallback, useState } from "react";
import { SessionEnded } from "../session-ended";
import { isSignInEnded, refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import {
  IMPORT_REPORT_KINDS,
  REPORT_KIND_LABEL,
  appliedSentence,
  checkedSentence,
  type AppliedResult,
  type CheckedSummary,
  type ImportReportKind,
} from "@/lib/import/sentences";

/**
 * Bringing a Curve Hero report into this ledger (Increment 1.94).
 *
 * `POST /api/import/curve` and `POST /api/import/curve/apply` have existed
 * since Increment 1.3 and nothing ever called them. The bank statement import
 * has a screen; this one did not, so the practice's own day sheets could reach
 * the ledger only through the CLI or a hand-written request.
 *
 * ## Two acts, not one
 *
 * Checking the file and posting it are separate presses, because they are
 * separate decisions. The check reads the file, says what it found and writes
 * nothing to the ledger; posting is the act that does. A screen that did both
 * on one press would make the practice read the outcome of a decision it had
 * not consciously taken — and this is the door outside data comes through,
 * which is the last place to hurry somebody.
 *
 * Increment 1.94 shipped this screen with the check alone, because applying
 * had never worked: the apply ran every read through the append role, which
 * holds no grant on `patients` or `account_members`. Increment 1.95 split the
 * apply into a plan that reads as `app_rw` and a write that writes as
 * `app_append`, so the post act is real and the append role stayed narrow.
 *
 * ## The run is held here and nowhere else
 *
 * There is no route that lists import runs, so a reload loses the staged run
 * from this screen. The check itself survives on the chain.
 */

type Staged = { runId: string; summary: CheckedSummary; warnings: string[] };

export default function ImportPage() {
  const [reportKind, setReportKind] = useState<ImportReportKind>("day_sheet");
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedResult | null>(null);
  const [ended, setEnded] = useState(false);

  const check = useCallback(async () => {
    setBusy(true);
    setSaid(null);
    setApplied(null);
    setStaged(null);
    try {
      const res = await fetch("/api/import/curve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportKind, content, fileName: fileName.trim() || undefined }),
      });
      refuseIfSignInEnded(res);
      const body = (await res.json().catch(() => ({}))) as {
        runId?: string;
        status?: "validated" | "failed";
        summary?: { rowCount?: number; errorCount?: number };
        warnings?: string[];
        error?: string;
      };
      if (body.runId === undefined || body.status === undefined) {
        setSaid(body.error ?? "That file was not read. Check the report kind and try again.");
        return;
      }
      const summary: CheckedSummary = {
        status: body.status,
        rowCount: body.summary?.rowCount ?? 0,
        errorCount: body.summary?.errorCount ?? 0,
      };
      setStaged({ runId: body.runId, summary, warnings: body.warnings ?? [] });
      setSaid(checkedSentence(summary));
    } catch (error) {
      if (isSignInEnded(error)) setEnded(true);
      else setSaid("That file was not read.");
    } finally {
      setBusy(false);
    }
  }, [content, fileName, reportKind]);

  const post = useCallback(async () => {
    if (!staged) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/import/curve/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: staged.runId }),
      });
      refuseIfSignInEnded(res);
      const body = (await res.json().catch(() => ({}))) as Partial<AppliedResult> & { error?: string };
      if (!res.ok) {
        setSaid(body.error ?? "Nothing was posted.");
        return;
      }
      const result: AppliedResult = {
        posted: body.posted ?? 0,
        skipped: body.skipped ?? 0,
        duplicates: body.duplicates ?? 0,
        errors: (body.errors ?? []).map((e) => (typeof e === "string" ? e : JSON.stringify(e))),
      };
      setApplied(result);
      setSaid(appliedSentence(result));
      // The run is spent. Offering the button again would offer an act whose
      // only outcome is a refusal, which this product does not do.
      setStaged(null);
    } catch (error) {
      if (isSignInEnded(error)) setEnded(true);
      else setSaid("Nothing was posted.");
    } finally {
      setBusy(false);
    }
  }, [staged]);

  if (ended) return <SessionEnded />;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Bring in a Curve Hero report</h1>
      <p className="mb-6 max-w-prose text-sm text-[var(--ink-2)]">
        A report this practice exported from its practice-management system, read here and then posted to the ledger.
        Checking it and posting it are two presses: the first reads the file and writes nothing, the second is the act
        that puts the rows in the books.
      </p>

      <div className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold text-[var(--ink-2)]">Which report</span>
          <select
            id="import-kind"
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 sm:max-w-xs"
            value={reportKind}
            onChange={(e) => setReportKind(e.target.value as ImportReportKind)}
          >
            {IMPORT_REPORT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {REPORT_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold text-[var(--ink-2)]">What the file is called (optional)</span>
          <input
            id="import-file-name"
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 sm:max-w-md"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-semibold text-[var(--ink-2)]">The file itself</span>
          <textarea
            id="import-content"
            className="min-h-[10rem] rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-xs"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            id="import-check"
            type="button"
            className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
            disabled={busy || content.trim() === ""}
            onClick={() => void check()}
          >
            {busy ? "Working…" : "Check this file"}
          </button>
          {staged !== null && staged.summary.status === "validated" && (
            <button
              id="import-post"
              type="button"
              className="min-h-[var(--target)] rounded-md border border-[var(--line-strong)] bg-navy px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void post()}
            >
              Post it to the ledger
            </button>
          )}
        </div>

        {said && (
          <p aria-live="polite" className="max-w-prose text-sm text-[var(--ink-2)]">
            {said}
          </p>
        )}

        {staged !== null && staged.warnings.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-[var(--ink-2)]">
            {staged.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        {staged !== null && (
          <p className="max-w-prose text-xs text-[var(--ink-3)]">
            This check is recorded, and this screen is the only place it is offered for posting. Leaving the page means
            checking the file again before it can post.
          </p>
        )}

        {applied !== null && applied.errors.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-[var(--ink-2)]">
            {applied.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

      </div>
    </main>
  );
}
