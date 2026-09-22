
/**
 * What the import screen says (Increment 1.94).
 *
 * `POST /api/import/curve` and `POST /api/import/curve/apply` have existed
 * since Increment 1.3 and no screen ever called them: a repository-wide search
 * for either path finds the route files and nothing else. The bank statement
 * import has a screen — `/reconciliation` posts to it — and the Curve Hero
 * import, which is how a practice's own day sheets reach this ledger, did not.
 *
 * Increment 1.91 made `run_import` a duty a practice can grant. This gives the
 * duty somewhere to be used.
 *
 * The sentences live here rather than in the page so they can be read back by
 * a test without a browser, as Increments 1.90 and 1.93 put theirs.
 */

/**
 * The report kinds, declared here rather than imported from `@pms/import`.
 *
 * The import screen is a client component, and `@pms/import`'s entry point
 * reaches `node:crypto` through the bank-statement validator — webpack refuses
 * it outright, which is how this was found rather than shipped. Increment 1.85
 * met the same wall with `@pms/db/seed-data` and answered it the same way: a
 * small declaration on the app's side of the line.
 *
 * The two lists are pinned to each other by a unit test, which runs in node
 * and can import the package. A kind added there and not here fails that test
 * rather than quietly becoming a kind nobody can choose.
 */
export const IMPORT_REPORT_KINDS = [
  "day_sheet",
  "ar_aging",
  "deposit_slip",
  "patient_header",
  "coverage_header",
] as const;

export type ImportReportKind = (typeof IMPORT_REPORT_KINDS)[number];

export const REPORT_KIND_LABEL: Record<ImportReportKind, string> = {
  day_sheet: "Day sheet",
  ar_aging: "A/R ageing",
  deposit_slip: "Deposit slip",
  patient_header: "Patient header",
  coverage_header: "Coverage header",
};

export type CheckedSummary = {
  status: "validated" | "failed";
  rowCount: number;
  errorCount: number;
};

/**
 * What the file turned out to be.
 *
 * A failed check is not an error in the product: it is the answer the practice
 * asked for, and it says how many rows could not be read rather than only that
 * something was wrong.
 */
export function checkedSentence(summary: CheckedSummary): string {
  const rows = `${summary.rowCount} ${summary.rowCount === 1 ? "row" : "rows"}`;
  if (summary.status === "validated") {
    return `Read ${rows}, none of them refused. Nothing has reached the ledger yet — posting it is the next act, and it is yours to make.`;
  }
  const bad = `${summary.errorCount} ${summary.errorCount === 1 ? "row" : "rows"}`;
  return `Read ${rows} and could not read ${bad}. Nothing has reached the ledger, and nothing will until a file this practice can read replaces this one.`;
}

export type AppliedResult = {
  posted: number;
  skipped: number;
  duplicates: number;
  errors: string[];
};

/**
 * What posting it did.
 *
 * Duplicates are counted separately from skips, because a duplicate is the
 * import meeting a row this ledger already carries — the same file sent twice
 * — and that is a different thing from a row this import had no use for.
 */
export function appliedSentence(result: AppliedResult): string {
  const parts = [`Posted ${result.posted} ${result.posted === 1 ? "entry" : "entries"}`];
  if (result.duplicates > 0) {
    parts.push(`${result.duplicates} already in the ledger and left alone`);
  }
  if (result.skipped > 0) {
    parts.push(`${result.skipped} this import had no use for`);
  }
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} refused`);
  }
  return `${parts.join(", ")}.`;
}
