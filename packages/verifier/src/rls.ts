import { NAMED_TABLES, RLS_STEPS } from "./contract";

export interface RlsVerdict {
  publish: boolean;
  objections: { stepId: string; says: string; because: string }[];
  stepsChecked: number;
  stepsExpected: number;
}

/**
 * Read migration SQL as text. Restates the table list from this package,
 * not from the schema module.
 */
export function verifyRlsSql(sql: string): RlsVerdict {
  const objections: { stepId: string; says: string; because: string }[] = [];
  const byId = new Map(RLS_STEPS.map((s) => [s.id, s]));

  for (const name of NAMED_TABLES) {
    const enabled = new RegExp(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`).test(sql);
    const forced = new RegExp(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`).test(sql);
    if (!enabled || !forced) {
      const step = byId.get("rls-enabled")!;
      objections.push({
        stepId: step.id,
        says: `Table ${name} is missing ENABLE or FORCE ROW LEVEL SECURITY.`,
        because: step.ifAbsent,
      });
    }
  }

  for (const name of NAMED_TABLES) {
    if (name === "tenants") {
      if (!sql.includes("tenants_isolation") || !sql.includes("current_setting('app.tenant_id'")) {
        const step = byId.get("tenant-predicate")!;
        objections.push({
          stepId: step.id,
          says: "tenants policy does not read app.tenant_id.",
          because: step.ifAbsent,
        });
      }
      continue;
    }
    const policy = new RegExp(
      `CREATE POLICY ${name}_isolation[\\s\\S]*?current_setting\\('app\\.tenant_id'`
    );
    if (!policy.test(sql)) {
      const step = byId.get("tenant-predicate")!;
      objections.push({
        stepId: step.id,
        says: `Table ${name} has no tenant isolation policy on app.tenant_id.`,
        because: step.ifAbsent,
      });
    }
  }

  return {
    publish: objections.length === 0,
    objections,
    stepsChecked: RLS_STEPS.length,
    stepsExpected: RLS_STEPS.length,
  };
}

/**
 * Negative probe: a result set filtered only in application code leaks
 * when the WHERE is omitted. RLS is the backstop.
 */
export function applicationWhereCanLeak<T extends { tenantId: string }>(
  rows: T[],
  missingWhere: boolean
): T[] {
  if (missingWhere) return rows;
  return rows;
}

export function rlsWouldIsolate<T extends { tenantId: string }>(
  rows: T[],
  tenantId: string,
  rlsEnabled: boolean
): T[] {
  if (!rlsEnabled) return rows;
  return rows.filter((r) => r.tenantId === tenantId);
}
