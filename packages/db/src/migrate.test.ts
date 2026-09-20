import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_MIGRATIONS_DIR,
  checksumSql,
  listMigrationFiles,
  planMigrations,
  type MigrationRecord,
} from "./migrate";

function tempDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "pms-migrations-"));
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
}

function record(version: number, name: string, sql: string): MigrationRecord {
  return { version, name, checksum: checksumSql(sql), appliedAt: new Date(0) };
}

describe("migration files", () => {
  it("numbers the committed migrations contiguously from 0001", () => {
    const files = listMigrationFiles(DEFAULT_MIGRATIONS_DIR);
    expect(files.map((f) => f.version)).toEqual(files.map((_, i) => i + 1));
    expect(files[0].file).toBe("0001_init.sql");
    expect(files.at(-1)?.file).toBe("0050_notice_address_refusals.sql");
  });

  it("refuses a gap in numbering", () => {
    const dir = tempDir({ "0001_a.sql": "select 1;", "0003_c.sql": "select 3;" });
    expect(() => listMigrationFiles(dir)).toThrow(/gap or duplicate/);
  });

  it("refuses a file that is not NNNN_name.sql", () => {
    const dir = tempDir({ "init.sql": "select 1;" });
    expect(() => listMigrationFiles(dir)).toThrow(/NNNN_name\.sql/);
  });
});

describe("migration plan", () => {
  const dir = tempDir({
    "0001_a.sql": "create table a (id int);",
    "0002_b.sql": "create table b (id int);",
  });
  const files = listMigrationFiles(dir);

  it("runs everything against an empty history", () => {
    expect(planMigrations(files, []).pending.map((f) => f.file)).toEqual([
      "0001_a.sql",
      "0002_b.sql",
    ]);
  });

  it("runs only what history lacks", () => {
    const plan = planMigrations(files, [record(1, "a", files[0].sql)]);
    expect(plan.pending.map((f) => f.file)).toEqual(["0002_b.sql"]);
  });

  it("refuses a rewritten historical migration", () => {
    expect(() => planMigrations(files, [record(1, "a", "create table a (id bigint);")])).toThrow(
      /checksum drift/
    );
  });

  it("refuses history that names a file no longer on disk", () => {
    expect(() =>
      planMigrations(files, [
        record(1, "a", files[0].sql),
        record(2, "b", files[1].sql),
        record(3, "gone", "select 3;"),
      ])
    ).toThrow(/no such file/);
  });

  it("refuses out-of-order history", () => {
    expect(() => planMigrations(files, [record(2, "b", files[1].sql)])).toThrow(/out of order/);
  });
});
