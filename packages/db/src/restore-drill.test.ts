import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBackupTarget } from "./restore-drill";

describe("checkBackupTarget", () => {
  it("accepts a readable file:// directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "pms-backup-"));
    writeFileSync(join(dir, "latest"), "ok");
    const result = checkBackupTarget(`file://${dir}`);
    expect(result).toEqual({ ok: true });
  });

  it("accepts an s3:// URL without contacting AWS in Phase 0", () => {
    expect(checkBackupTarget("s3://pms-backups/nightly")).toEqual({ ok: true });
  });

  it("refuses an unreadable file:// path", () => {
    const result = checkBackupTarget("file:///tmp/pms-backup-missing-dir");
    expect(result.ok).toBe(false);
  });
});
