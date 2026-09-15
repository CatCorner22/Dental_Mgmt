/**
 * FORCE ROW LEVEL SECURITY is only a control if the application's connection
 * is an ordinary role. A superuser or BYPASSRLS role reads every tenant; a
 * table owner can ALTER the policies away. This asks the live connection who
 * it is and refuses production if the answer is any of those.
 */

export interface RuntimeRoleFacts {
  role: string;
  superuser: boolean;
  bypassRls: boolean;
  ownedTables: string[];
}

export const RUNTIME_ROLE_SQL = `
SELECT r.rolname AS role,
       r.rolsuper AS superuser,
       r.rolbypassrls AS bypass_rls,
       COALESCE(
         (SELECT array_agg(c.relname::text ORDER BY c.relname)
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relowner = r.oid),
         ARRAY[]::text[]
       ) AS owned_tables
  FROM pg_roles r
 WHERE r.rolname = current_user`;

export function runtimeRoleErrors(facts: RuntimeRoleFacts): string[] {
  const errors: string[] = [];
  if (facts.superuser) errors.push(`${facts.role} is a superuser and bypasses row-level security`);
  if (facts.bypassRls) errors.push(`${facts.role} has BYPASSRLS`);
  if (facts.ownedTables.length) {
    errors.push(`${facts.role} owns ${facts.ownedTables.length} table(s) and could drop their policies`);
  }
  return errors;
}

export async function readRuntimeRole(db: {
  query(text: string): Promise<{ rows: Record<string, unknown>[] }>;
}): Promise<RuntimeRoleFacts> {
  const { rows } = await db.query(RUNTIME_ROLE_SQL);
  const row = rows[0];
  if (!row) throw new Error("current_user is not in pg_roles.");
  return {
    role: String(row.role),
    superuser: Boolean(row.superuser),
    bypassRls: Boolean(row.bypass_rls),
    ownedTables: (row.owned_tables as string[]) ?? [],
  };
}

export async function assertRuntimeRole(db: {
  query(text: string): Promise<{ rows: Record<string, unknown>[] }>;
}): Promise<RuntimeRoleFacts> {
  const facts = await readRuntimeRole(db);
  const errors = runtimeRoleErrors(facts);
  if (errors.length) {
    throw new Error(`Production refused to boot: ${errors.join("; ")}`);
  }
  return facts;
}
