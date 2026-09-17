import { and, eq } from "drizzle-orm";
import { bankAccounts } from "@pms/db";
import type { AppDb } from "../db/client";

/** A bank account id that is not one of this tenant's accounts. */
export class BankAccountNotFoundError extends Error {
  readonly code = "bank_account_not_found" as const;
  constructor(readonly bankAccountId: string) {
    super("Bank account not found for this tenant.");
    this.name = "BankAccountNotFoundError";
  }
}

/**
 * Every write keyed by a caller-supplied bank account goes through here:
 * a statement, a deposit or a reconciliation run is only ever attached to
 * an account the writing tenant owns.
 */
export async function requireTenantBankAccount(
  db: AppDb,
  tenantId: string,
  bankAccountId: string
): Promise<{ id: string }> {
  const [row] = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.tenantId, tenantId), eq(bankAccounts.id, bankAccountId)))
    .limit(1);
  if (!row) throw new BankAccountNotFoundError(bankAccountId);
  return row;
}
