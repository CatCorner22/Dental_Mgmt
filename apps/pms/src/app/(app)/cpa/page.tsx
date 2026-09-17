import { PackageView } from "./package-view";

export const metadata = { title: "Month-end package" };

export default function CpaPage() {
  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Month-end</p>
      <h1 className="mb-2">The month, for the accountant</h1>
      <p className="mb-6 max-w-prose text-[var(--ink-2)]">
        One calendar month of the practice&apos;s rows, aggregate and hash-stamped: the journal by ledger bucket and kind,
        adjustments and write-offs by reason code with how many cited an approval, the deposit register, the counts the
        weekly digest keeps, the controls in force, the chain head, and a tie-out sheet. Every export is recorded on the
        chain with its hash, so a changed month shows. Nothing here names a patient or a poster.
      </p>
      <PackageView />
    </main>
  );
}
