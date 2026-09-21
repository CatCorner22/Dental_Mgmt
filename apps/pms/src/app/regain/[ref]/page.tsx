import type { Metadata } from "next";
import { getAuthStore } from "@/lib/auth/resolveStore";
import { parseRegainRef } from "@/lib/auth/regainLink";
import { RegainForm } from "./regain-form";

/**
 * Where somebody locked out of their account gets back in (Increment 1.77).
 *
 * The third page in this product outside a session, and it borrows the shape
 * the first two settled (Increments 1.67 and 1.71): it reads and does not act,
 * it answers a link that ran out and a link that was never ours in the same
 * words, and it offers nothing else — no sign-in, no other page.
 *
 * It names the person the link is for, because an administrator who hands the
 * wrong link to the wrong person should find that out here rather than after
 * somebody else's password has been set. It names nothing about the account
 * beyond that: no address, no role, no practice figures.
 *
 * The GET shows and the POST acts, as the invitation's does. A link that
 * changed a password on being fetched would hand every mail scanner a button
 * it presses on its owner's behalf.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get back into your account",
  description: "Set a new password for an account two administrators have approved for recovery.",
};

type Outcome = { kind: "gone"; why: string } | { kind: "offer"; displayName: string; reference: string };

const GONE =
  "This link no longer works. It may have run out, it may have been used already, the two administrators may not have finished approving it, or it may never have been ours.";

async function read(reference: string): Promise<Outcome> {
  const ref = parseRegainRef(reference);
  if (ref === null) return { kind: "gone", why: GONE };

  const store = await getAuthStore();
  if (!store) return { kind: "gone", why: GONE };

  const row = await store.getRecoveryCeremonyByTokenHash(ref);
  // Every reason to refuse, in one answer. `consumeRecoveryCeremony` checks
  // each of these again on the act itself; this only decides what to draw.
  if (!row || !row.approvedBy || row.consumedAt || row.expiresAt.getTime() <= Date.now()) {
    return { kind: "gone", why: GONE };
  }
  const target = await store.getUserById(row.targetUserId);
  if (!target || !target.active) return { kind: "gone", why: GONE };

  return { kind: "offer", displayName: target.displayName, reference: ref };
}

export default async function RegainPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const outcome = await read(decodeURIComponent(ref));

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="mb-3 text-navy">Get back into your account</h1>
      {outcome.kind === "gone" ? (
        <p
          role="status"
          className="rounded-[var(--radius)] bg-[var(--surface)] p-4 text-[var(--ink-2)] ring-1 ring-[var(--line)]"
        >
          {outcome.why}
        </p>
      ) : (
        <div className="grid gap-6">
          <p className="max-w-prose text-[var(--ink-2)]">
            Two administrators of your practice approved this recovery for {outcome.displayName}. Setting a password
            here also removes the second factor from the account, so the next sign-in asks you to pair an
            authenticator.
          </p>
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] ring-1 ring-[var(--line)]">
            <RegainForm reference={outcome.reference} displayName={outcome.displayName} />
          </div>
          <p className="max-w-prose text-sm text-[var(--ink-2)]">
            This link works once, and only until the recovery runs out. If it stops working, ask the practice to start
            again.
          </p>
        </div>
      )}
    </main>
  );
}
