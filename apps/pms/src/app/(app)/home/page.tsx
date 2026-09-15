export const metadata = { title: "Practice home" };

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="mb-3 text-sm font-semibold tracking-wide text-teal">Practice home</p>
      <h1 className="mb-4 text-navy">Nothing on the Board yet</h1>
      <p className="max-w-prose text-[var(--ink-2)]">
        Increment 0.1 is the trust foundation: tenancy, sessions, mandatory MFA,
        the event chain, and the engines. Patients, the ledger, and encounters
        arrive in later increments. There is no patient chart to open.
      </p>
      <p className="mt-8">
        <a className="font-semibold text-[var(--link)] underline" href="/signin">
          Back to sign in
        </a>
      </p>
    </main>
  );
}
