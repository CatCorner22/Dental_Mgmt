import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { BankAccountNotFoundError } from "@/lib/bank/accounts";
import { applyStagedDeposits, defaultBankAccountId } from "@/lib/day-close/service";

type ApplyBody = {
  bankAccountId?: string;
};

export const POST = withGuard(
  async (req, ctx) => {
    const body = ((await req.json().catch(() => ({}))) as ApplyBody) ?? {};
    const bankAccountId =
      body.bankAccountId ??
      (await withTenantTransaction(ctx.access.user.tenantId, ctx.access.user.id, (db) =>
        defaultBankAccountId(db, ctx.access.user.tenantId)
      ));

    if (!bankAccountId) {
      return Response.json({ error: "No bank account configured for this tenant." }, { status: 400 });
    }

    try {
      const result = await withTenantTransaction(
        ctx.access.user.tenantId,
        ctx.access.user.id,
        (db) =>
          applyStagedDeposits(db, {
            tenantId: ctx.access.user.tenantId,
            bankAccountId,
            actorUserId: ctx.access.user.id,
            actorName: ctx.access.user.displayName,
          })
      );
      return Response.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof BankAccountNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  },
  { entitlements: ["post_payments"] }
);
