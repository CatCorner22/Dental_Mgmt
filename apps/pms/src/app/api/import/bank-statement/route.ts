import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { BankAccountNotFoundError } from "@/lib/bank/accounts";
import { createBankStatementImport } from "@/lib/bank/import";

type ImportBody = {
  bankAccountId?: string;
  content?: string;
  fileName?: string;
};

export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json()) as ImportBody;
    const bankAccountId = body.bankAccountId;
    if (!bankAccountId || typeof bankAccountId !== "string") {
      return Response.json({ error: "bankAccountId is required." }, { status: 400 });
    }
    const content = body.content;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return Response.json({ error: "content is required." }, { status: 400 });
    }

    try {
      const result = await withTenantTransaction(
        ctx.access.user.tenantId,
        ctx.access.user.id,
        async (db) =>
          createBankStatementImport(db, {
            tenantId: ctx.access.user.tenantId,
            bankAccountId,
            content,
            fileName: body.fileName,
            actorUserId: ctx.access.user.id,
            actorName: ctx.access.user.displayName,
          })
      );
      return Response.json(result, { status: result.status === "validated" ? 201 : 422 });
    } catch (error) {
      if (error instanceof BankAccountNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  },
  { entitlements: ["run_import"] }
);
