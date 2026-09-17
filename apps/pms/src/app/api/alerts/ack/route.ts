import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { acknowledgeHardEvent } from "@/lib/alerts/acks";

type Body = { kind?: string; subjectKind?: string; subjectId?: string; note?: string };

/**
 * The owner marks a hard event as seen and says what was done about it
 * (Increment 1.33): one append-only row and one chain event. Administrator
 * rank; only an event the card currently shows can be acknowledged.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const user = ctx.access.user;
    const result = await withTenantTransaction(user.tenantId, user.id, (db) =>
      acknowledgeHardEvent(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        kind: String(body.kind ?? ""),
        subjectKind: String(body.subjectKind ?? ""),
        subjectId: String(body.subjectId ?? ""),
        note: String(body.note ?? ""),
      })
    );
    if (!result.ok) {
      return Response.json({ error: "The hard event was not acknowledged.", errors: result.errors }, { status: result.status });
    }
    return Response.json(result.ack, { status: 201 });
  },
  { minRank: "admin" }
);
