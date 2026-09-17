import { LocationsView } from "./locations-view";

export const metadata = { title: "Locations" };

export default function LocationsPage() {
  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Locations</p>
      <h1 className="mb-2">Business hours</h1>
      <p className="mb-6 max-w-prose text-[var(--ink-2)]">
        Each location&apos;s week, in its own timezone, read from the server clock. A refund, adjustment, or write-off
        posted outside these hours is held for a second person whatever the amount (the after-hours hold), and the hard
        event names the window. Every change here is a chain event and counts in the weekly digest.
      </p>
      <LocationsView />
    </main>
  );
}
