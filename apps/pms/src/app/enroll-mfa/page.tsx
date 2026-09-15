import { EnrollMfaForm } from "./enroll-form";

export const metadata = { title: "Enroll authenticator" };

export default function EnrollMfaPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="mb-3 text-sm font-semibold tracking-wide text-teal">Increment 0.5</p>
      <h1 className="mb-3 text-navy">Set up your authenticator</h1>
      <p className="mb-8 max-w-prose text-[var(--ink-2)]">
        MFA is required before you can use the practice shell. Save your recovery codes when
        enrollment finishes — you will need them if you lose your phone.
      </p>
      <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-8 shadow-[var(--shadow)] ring-1 ring-[var(--line)]">
        <EnrollMfaForm />
      </div>
    </main>
  );
}
