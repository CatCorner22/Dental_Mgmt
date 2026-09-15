import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Plain-SQL migration runner with history.
 *
 * Files are `NNNN_name.sql`, numbered from 0001 without gaps. Each file runs
 * in its own transaction and is recorded in `schema_migrations` with a SHA-256
 * checksum. A recorded file whose checksum no longer matches refuses to run:
 * migrations are edited by adding a new file, never by rewriting an old one.
 */

export const DEFAULT_MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations"
);

export const HISTORY_TABLE = "schema_migrations";

/** Fixed key so two migrators cannot interleave. */
export const MIGRATION_LOCK_KEY = 0x504d5300; // "PMS\0"

export interface MigrationFile {
  version: number;
  name: string;
  file: string;
  sql: string;
  checksum: string;
}

export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface MigrationRecord {
  version: number;
  name: string;
  checksum: string;
  appliedAt: Date;
}

export interface MigrateResult {
  applied: MigrationFile[];
  alreadyApplied: number;
}

const FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;

export function checksumSql(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

export function listMigrationFiles(dir: string = DEFAULT_MIGRATIONS_DIR): MigrationFile[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const out: MigrationFile[] = [];
  for (const file of files) {
    const match = FILE_PATTERN.exec(file);
    if (!match) {
      throw new Error(`Migration file name is not NNNN_name.sql: ${file}`);
    }
    const version = Number(match[1]);
    const expected = out.length + 1;
    if (version !== expected) {
      throw new Error(
        `Migration numbering has a gap or duplicate: expected ${String(expected).padStart(4, "0")}, found ${file}`
      );
    }
    const sql = readFileSync(join(dir, file), "utf8");
    out.push({ version, name: match[2], file, sql, checksum: checksumSql(sql) });
  }
  return out;
}

export const CREATE_HISTORY_SQL = `
CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
  version integer PRIMARY KEY,
  name text NOT NULL,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user
)`;

export async function readHistory(db: Queryable): Promise<MigrationRecord[]> {
  await db.query(CREATE_HISTORY_SQL);
  const { rows } = await db.query(
    `SELECT version, name, checksum, applied_at FROM ${HISTORY_TABLE} ORDER BY version`
  );
  return rows.map((r) => ({
    version: Number(r.version),
    name: String(r.name),
    checksum: String(r.checksum),
    appliedAt: new Date(r.applied_at as string | Date),
  }));
}

/**
 * Compares files on disk to the history table. Throws on drift so a rewritten
 * historical file is caught before anything runs.
 */
export function planMigrations(
  files: MigrationFile[],
  history: MigrationRecord[]
): { pending: MigrationFile[]; applied: MigrationRecord[] } {
  const byVersion = new Map(history.map((h) => [h.version, h]));
  const pending: MigrationFile[] = [];
  for (const file of files) {
    const record = byVersion.get(file.version);
    if (!record) {
      pending.push(file);
      continue;
    }
    if (record.checksum !== file.checksum) {
      throw new Error(
        `Migration ${file.file} was edited after it was applied (checksum drift). Add a new migration instead.`
      );
    }
    if (pending.length > 0) {
      throw new Error(
        `Migration ${file.file} is recorded as applied but an earlier file is pending. History is out of order.`
      );
    }
  }
  for (const record of history) {
    if (!files.some((f) => f.version === record.version)) {
      throw new Error(
        `History records version ${record.version} (${record.name}) but no such file exists on disk.`
      );
    }
  }
  return { pending, applied: history };
}

/**
 * Applies every pending migration. `db` must be a single connection (not a
 * pool): the advisory lock and each BEGIN/COMMIT need to land on the same
 * session.
 */
export async function applyMigrations(
  db: Queryable,
  opts: { dir?: string; log?: (line: string) => void } = {}
): Promise<MigrateResult> {
  const log = opts.log ?? (() => {});
  const files = listMigrationFiles(opts.dir);
  await db.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  try {
    const history = await readHistory(db);
    const { pending } = planMigrations(files, history);
    const applied: MigrationFile[] = [];
    for (const migration of pending) {
      log(`applying ${migration.file}`);
      await db.query("BEGIN");
      try {
        await db.query(migration.sql);
        await db.query(
          `INSERT INTO ${HISTORY_TABLE} (version, name, checksum) VALUES ($1, $2, $3)`,
          [migration.version, migration.name, migration.checksum]
        );
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw new Error(
          `Migration ${migration.file} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      applied.push(migration);
    }
    return { applied, alreadyApplied: history.length };
  } finally {
    await db.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
  }
}

export async function migrationStatus(
  db: Queryable,
  dir: string = DEFAULT_MIGRATIONS_DIR
): Promise<{ file: string; state: "applied" | "pending" | "drift"; appliedAt?: Date }[]> {
  const files = listMigrationFiles(dir);
  const history = await readHistory(db);
  const byVersion = new Map(history.map((h) => [h.version, h]));
  return files.map((f) => {
    const record = byVersion.get(f.version);
    if (!record) return { file: f.file, state: "pending" };
    if (record.checksum !== f.checksum) return { file: f.file, state: "drift", appliedAt: record.appliedAt };
    return { file: f.file, state: "applied", appliedAt: record.appliedAt };
  });
}
