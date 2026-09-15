import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { POSTABLE_KINDS, type PostableKind, postLedgerEntry } from "@/lib/ledger/post";

type PostBody = {
  accountId?: string;
  patientId?: string;
  kind?: string;
  amountCents?: number;
  effectiveDate?: string;
  reasonCode?: string | null;
  memo?: string | null;
  procedureId?: string | null;
  tender?: string | null;
};

function parseKind(value: string | undefined): PostableKind | null {
  if (!value) return null;
  return (POSTABLE_KINDS as readonly string[]).includes(value) ? (value as PostableKind) : null;
}

export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as PostBody;
    const kind = parseKind(body.kind);
    if (!kind) {
      return Response.json({ error: "Invalid or missing kind." }, { status: 400 });
    }
    const accountId = body.accountId?.trim();
    const patientId = body.patientId?.trim();
    const effectiveDate = body.effectiveDate?.trim();
    if (!accountId || !patientId) {
      return Response.json({ error: "accountId and patientId are required." }, { status: 400 });
    }
    if (typeof body.amountCents !== "number" || !Number.isFinite(body.amountCents)) {
      return Response.json({ error: "amountCents must be a number." }, { status: 400 });
    }
    if (!effectiveDate) {
      return Response.json({ error: "effectiveDate is required." }, { status: 400 });
    }

    const amountCents = body.amountCents;
    const result = await withTenantTransaction(
      ctx.access.user.tenantId,
      ctx.access.user.id,
      (db) =>
        postLedgerEntry(db, {
          tenantId: ctx.access.user.tenantId,
          actorId: ctx.access.user.id,
          actorName: ctx.access.user.displayName,
          post: {
            accountId,
            patientId,
            kind,
            amountCents,
            effectiveDate,
            reasonCode: body.reasonCode ?? null,
            memo: body.memo ?? null,
            procedureId: body.procedureId ?? null,
            tender:
              body.tender === "cash" ||
              body.tender === "check" ||
              body.tender === "card" ||
              body.tender === "ach" ||
              body.tender === "eft"
                ? body.tender
                : null,
          },
        })
    );

    if (result.ok) {
      return Response.json(
        {
          ok: true,
          status: result.status,
          entryId: result.entryId,
          duplicate: result.duplicate ?? false,
        },
        { status: result.duplicate ? 200 : 201 }
      );
    }

    if (result.status === "needs_second") {
      return Response.json(
        {
          ok: false,
          status: result.status,
          approvalRequestId: result.approvalRequestId,
          verb: result.verb,
          control: result.control,
          why: result.why,
        },
        { status: 202 }
      );
    }

    return Response.json(
      {
        ok: false,
        status: result.status,
        code: result.code,
        verb: result.verb,
        control: result.control,
        why: result.why,
      },
      { status: 403 }
    );
  },
  { entitlements: ["post_payments"] }
);
