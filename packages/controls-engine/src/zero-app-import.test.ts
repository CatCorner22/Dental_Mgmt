import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = dirname(fileURLToPath(import.meta.url));

function walkProductionTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(srcRoot, full).replace(/\\/g, "/");
    if (statSync(full).isDirectory()) {
      if (rel === "fixtures" || rel.startsWith("fixtures/")) continue;
      out.push(...walkProductionTs(full));
      continue;
    }
    if (!name.endsWith(".ts")) continue;
    if (name.endsWith(".test.ts")) continue;
    out.push(full);
  }
  return out;
}

const IMPORT_RE =
  /(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;

describe("production import purity", () => {
  it("does not import apps/ or demo-data", () => {
    const files = walkProductionTs(srcRoot);
    expect(files.length).toBeGreaterThan(5);

    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = relative(srcRoot, file).replace(/\\/g, "/");
      for (const match of text.matchAll(IMPORT_RE)) {
        const spec = match[1];
        if (spec.includes("apps/") || spec.includes("demo-data") || spec.includes("fixtures/")) {
          violations.push(`${rel} imports ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
