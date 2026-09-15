/**
 * The append connection must hold app_append: INSERT on ledger tables and no
 * privilege to rewrite them. SELECT on domain_event is granted so the role can
 * read the chain tip inside a tenant-scoped transaction.
 */

export const APPEND_ROLE = "app_append";

export const APPEND_ROLE_SQL = `
SELECT current_user AS role,
       pg_has_role(current_user, '${APPEND_ROLE}', 'USAGE') AS admitted`;

export const APPEND_UPDATE_PROBE = `
UPDATE domain_event SET hash = hash WHERE false`;

export interface AppendRoleFacts {
  role: string;
  admitted: boolean;
}

export function appendRoleErrors(facts: AppendRoleFacts): string[] {
  const errors: string[] = [];
  if (!facts.admitted) {
    errors.push(`${facts.role} does not hold ${APPEND_ROLE}`);
  }
  return errors;
}

export async function readAppendRole(db: {
  query(text: string): Promise<{ rows: Record<string, unknown>[] }>;
}): Promise<AppendRoleFacts> {
  const { rows } = await db.query(APPEND_ROLE_SQL);
  const row = rows[0];
  return {
    role: row ? String(row.role) : "unknown",
    admitted: row?.admitted === true,
  };
}

export async function assertAppendRole(db: {
  query(text: string): Promise<{ rows: Record<string, unknown>[] }>;
}): Promise<AppendRoleFacts> {
  const facts = await readAppendRole(db);
  const errors = appendRoleErrors(facts);
  if (errors.length) {
    throw new Error(`Append connection refused: ${errors.join("; ")}`);
  }
  const update = await db.query(APPEND_UPDATE_PROBE).catch((error: { code?: string }) => {
    if (error.code === "42501") return null;
    throw error;
  });
  if (update !== null) {
    throw new Error(`Append connection ${facts.role} may UPDATE domain_event`);
  }
  return facts;
}
