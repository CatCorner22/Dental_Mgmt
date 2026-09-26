import { ReasonCodesView } from "./reason-codes-view";

export const metadata = { title: "Reason codes" };

export default function ReasonCodesPage() {
  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Reason codes</p>
      <h1 className="mb-2">Why money moved</h1>
      <p className="mb-6 max-w-prose text-[var(--ink-2)]">
        Every write-off, adjustment, refund, reversal, and transfer cites one of these, and the posting forms are built
        from this list, so a reason the practice has not adopted never reaches an entry. The code is written onto each
        entry that cites it and never changes; a code in use is retired rather than removed, which takes it off the
        forms and leaves the history readable. Every change here is a chain event.
      </p>
      <ReasonCodesView />
    </main>
  );
}
