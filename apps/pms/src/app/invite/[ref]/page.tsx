import type { Metadata } from "next";
import { withTenantTransaction } from "@/lib/db/client";
import { lookUpInvite } from "@/lib/auth/invite";
import { parseInviteRef } from "@/lib/auth/inviteLink";
import { InviteForm } from "./invite-form";

/**
 * Where an invited seat opens its account (Increment 1.71).
 *
 * The second page in this product outside a session, and it borrows the first
 * one's shape (Increment 1.67): it reads and does not act, it answers an
 * unknown link and another practice's link in the same words, and it offers
 * nothing else — no sign-in, no other page.
 *
 * It names the practice and the username, because the person holding the link
 * was handed it by that practice and needs to know what to type at a sign-in
 * box. It names no address: this seat has none yet, and saying where to send
 * its messages is the seat's own act (Increment 1.58).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open your seat",
  description: "Set the password for a seat a dental practice invited you to.",
};

type Outcome =
  | { kind: "gone"; why: string }
  | { kind: "offer"; practiceName: string; username: string; displayName: string; worksUntil: string; reference: string };

async function read(reference: string): Promise<Outcome> {
  const ref = parseInviteRef(reference);
  if (ref === null) {
    return {
      kind: "gone",
      why: "This link is not one we recognise. It may have been copied incompletely, or it may never have been ours.",
    };
  }
  const found = await withTenantTransaction(ref.tenantId, "", (db) => lookUpInvite(db, ref.tenantId, ref.secret));
  if (!found.ok) return { kind: "gone", why: found.why };
  return {
    kind: "offer",
    practiceName: found.target.practiceName,
    username: found.target.username,
    displayName: found.target.displayName,
    worksUntil: found.target.expiresAt.slice(0, 10),
    reference,
  };
}

export default async function InvitePage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const outcome = await read(decodeURIComponent(ref));

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="mb-3 text-navy">Open your seat</h1>
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
            {outcome.practiceName} invited {outcome.displayName} to its outside accountant&rsquo;s seat. That seat
            reaches the month-end package and no other screen, and it holds no patient record.
          </p>
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] ring-1 ring-[var(--line)]">
            <InviteForm reference={outcome.reference} username={outcome.username} />
          </div>
          <p className="max-w-prose text-sm text-[var(--ink-2)]">
            This invitation works until {outcome.worksUntil}, and once only.
          </p>
        </div>
      )}
    </main>
  );
}
