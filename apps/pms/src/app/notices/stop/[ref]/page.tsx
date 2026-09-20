import type { Metadata } from "next";
import { withTenantTransaction } from "@/lib/db/client";
import { lookUpStop } from "@/lib/notices/stop";
import { parseStopRef, STOP_LIFE_DAYS } from "@/lib/notices/stopLink";
import { StopForm } from "./stop-form";

/**
 * Where somebody who never asked for a message says so (Increment 1.67).
 *
 * The only page in this product outside a session, and the shape follows from
 * that. It reads and does not act, because mail clients and scanners fetch
 * links before a person reads them. It names the practice and never the
 * mailbox, because a reader holding the message already knows which mailbox
 * and a reader holding only a leaked URL should not learn one. It offers
 * nothing else: no sign-in, no account, no other page of this product.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stop these messages",
  description: "Tell a practice that the mailbox it wrote to did not ask for its messages.",
};

type Outcome =
  | { kind: "gone"; why: string }
  | { kind: "offer"; practiceName: string; worksUntil: string; reference: string };

async function read(reference: string): Promise<Outcome> {
  const ref = parseStopRef(reference);
  if (ref === null) {
    return {
      kind: "gone",
      why: "This link is not one we recognise. It may have been copied incompletely, or it may never have been ours.",
    };
  }
  const found = await withTenantTransaction(ref.tenantId, "", (db) => lookUpStop(db, ref.tenantId, ref.secret));
  if (!found.ok) return { kind: "gone", why: found.why };
  return {
    kind: "offer",
    practiceName: found.target.practiceName,
    worksUntil: found.target.worksUntil.slice(0, 10),
    reference,
  };
}

export default async function StopPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const outcome = await read(decodeURIComponent(ref));

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="mb-3 text-navy">Stop these messages</h1>
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
            {outcome.practiceName} sent a code to the mailbox where you found this link, because somebody
            there asked for its reminders to go to that address. If that was not you, say so and{" "}
            {outcome.practiceName} will send nothing further to it.
          </p>
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] ring-1 ring-[var(--line)]">
            <StopForm reference={outcome.reference} />
          </div>
          <p className="max-w-prose text-sm text-[var(--ink-2)]">
            This link works for {STOP_LIFE_DAYS} days from the message that carried it, until{" "}
            {outcome.worksUntil}. It holds no patient record and names no person.
          </p>
        </div>
      )}
    </main>
  );
}
