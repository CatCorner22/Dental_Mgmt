import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("verifier purity", () => {
  it("does not import apps or @pms/db", () => {
    const violations: string[] = [];
    for (const file of walk(srcRoot)) {
      const text = readFileSync(file, "utf8");
      if (/from\s+["']@pms\/db/.test(text) || /from\s+["'][^"']*apps\//.test(text)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});
