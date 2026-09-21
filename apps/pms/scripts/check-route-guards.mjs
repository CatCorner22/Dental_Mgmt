#!/usr/bin/env node
/**
 * Fails when a route handler or server action is exported without withGuard.
 * Allowlist: /api/health and /api/auth/* (NextAuth transport).
 *
 * It used to carry a third entry, api/recovery-ceremony/reset/route.ts, which
 * Increment 1.77 deleted: the act it performed is now a server action, which
 * is where this codebase puts every act no session stands behind (Increments
 * 1.67, 1.71 and 1.77). So "every route under /api passes through withGuard"
 * is held by the two transport exemptions alone, and an exemption that once
 * stood for a product decision no longer does.
 */
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "src/app");

const ALLOW = [
  path.join(APP, "api/health/route.ts"),
  path.join(APP, "api/auth/[...nextauth]/route.ts"),
];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else if (ent.name === "route.ts" || ent.name.endsWith(".action.ts")) out.push(full);
  }
  return out;
}

const EXPORT_FN =
  /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;
const EXPORT_CONST =
  /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/;
const WITH_GUARD = /withGuard\s*\(/;

const files = walk(APP);
const failures = [];

for (const file of files) {
  const allowed = ALLOW.some((a) => path.resolve(a) === path.resolve(file));
  const text = fs.readFileSync(file, "utf8");
  const hasBareFn = EXPORT_FN.test(text);
  const hasExport = EXPORT_CONST.test(text) || hasBareFn;
  if (!hasExport) continue;
  if (allowed) continue;
  if (hasBareFn) {
    failures.push(`${path.relative(ROOT, file)}: bare export async function (must wrap with withGuard)`);
    continue;
  }
  if (!WITH_GUARD.test(text)) {
    failures.push(`${path.relative(ROOT, file)}: exported handler is not wrapped in withGuard`);
  }
}

if (failures.length) {
  console.error("Route guard coverage failed:\n" + failures.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}

console.log(`Route guard coverage ok (${files.length} files).`);
