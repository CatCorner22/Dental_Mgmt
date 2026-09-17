import { DigestView } from "./digest-view";

export const metadata = { title: "Weekly digest" };

export default function DigestPage() {
  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Weekly digest</p>
      <h1 className="mb-2">The week, counted</h1>
      <p className="mb-6 max-w-prose text-[var(--ink-2)]">
        Seven days of the practice&apos;s rows: what the ledger took, what needed a second person, what the bank confirmed,
        what the detectors opened and closed, what was decided, who signed in and which duties moved, and how far the
        chain grew. Batched, never alerting. Nothing here names a person.
      </p>
      <DigestView />
    </main>
  );
}
