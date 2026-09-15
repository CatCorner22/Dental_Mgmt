import { sanitizeCallbackPath } from "@/lib/auth/loginFormState";
import { SignInForm } from "./signin-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).callbackUrl;
  const callbackUrl = sanitizeCallbackPath(typeof raw === "string" ? raw : undefined);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="mb-3 text-sm font-semibold tracking-wide text-teal">Increment 0.3</p>
      <h1 className="mb-3 text-navy">Sign in</h1>
      <p className="mb-8 max-w-prose text-[var(--ink-2)]">
        Authenticator codes are required. Recovery codes work in the same field.
        This shell holds no patient records.
      </p>
      <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-8 shadow-[var(--shadow)] ring-1 ring-[var(--line)]">
        <span
          aria-hidden
          className="mb-6 block h-1 rounded-full bg-gradient-to-r from-navy via-[#2B6CB8] to-teal"
        />
        <SignInForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
