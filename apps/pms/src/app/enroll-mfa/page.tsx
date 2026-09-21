import { EnrollMfaForm } from "./enroll-form";

export const metadata = { title: "Your authenticator" };

/**
 * One screen for both acts (Increment 1.76): the first pairing an account must
 * finish before it may do anything, and the re-pairing a person reaches for
 * when the phone changes or the recovery codes run low. The form asks the
 * route which one this is rather than the page guessing, because only the
 * database knows whether a factor already works.
 */
export default function EnrollMfaPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-3 text-navy">Your authenticator</h1>
      <p className="mb-8 max-w-prose text-[var(--ink-2)]">
        Pairing an authenticator here replaces whatever this account used before, and issues a new
        set of recovery codes. The one you are using now keeps working until a code from the new one
        comes back, so nothing is lost if you stop part-way.
      </p>
      <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-8 shadow-[var(--shadow)] ring-1 ring-[var(--line)]">
        <EnrollMfaForm />
      </div>
    </main>
  );
}
