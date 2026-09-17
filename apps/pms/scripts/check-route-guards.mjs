#!/usr/bin/env node
/**
 * Fails when a route handler or server action is exported without withGuard.
 *
 * Route handlers: every src/app/**\/route.ts. Server actions: every *.action.ts
 * anywhere under src, and every module under src whose first statement is the
 * "use server" directive, since Next exposes each of its async exports as an
 * HTTP endpoint wherever the file lives.
 *
 * Allowlist: /api/health, /api/auth/* (NextAuth transport), the recovery reset
 * exchange, and the login action itself.
 */
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const APP = path.join(SRC, "app");

const ALLOW = [
  path.join(APP, "api/health/route.ts"),
  path.join(APP, "api/auth/[...nextauth]/route.ts"),
  path.join(APP, "api/recovery-ceremony/reset/route.ts"),
  path.join(SRC, "lib/auth/loginAction.ts"),
];

const USE_SERVER = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*(['"])use server\1\s*;?/;

function isTest(name) {
  return /\.(test|spec|e2e\.test)\.(ts|tsx|mts)$/.test(name);
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      out.push(...walk(full));
      continue;
    }
    if (!/\.(ts|tsx|mts)$/.test(ent.name) || isTest(ent.name)) continue;
    const isRoute = ent.name === "route.ts" && full.startsWith(APP + path.sep);
    const isActionFile = ent.name.endsWith(".action.ts");
    if (isRoute || isActionFile) {
      out.push({ file: full, kind: isRoute ? "route" : "action" });
      continue;
    }
    const text = fs.readFileSync(full, "utf8");
    if (USE_SERVER.test(text)) out.push({ file: full, kind: "action" });
  }
  return out;
}

const EXPORT_FN =
  /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;
const EXPORT_CONST =
  /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/;
const ACTION_EXPORT_FN = /export\s+(?:default\s+)?async\s+function\b/;
const ACTION_EXPORT_CONST = /export\s+(?:const|let|var)\s+\w+\s*(?::[^=]*)?=/;
const WITH_GUARD = /withGuard\s*\(/;

const files = walk(SRC);
const failures = [];

for (const { file, kind } of files) {
  const allowed = ALLOW.some((a) => path.resolve(a) === path.resolve(file));
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  if (kind === "route") {
    const hasBareFn = EXPORT_FN.test(text);
    const hasExport = EXPORT_CONST.test(text) || hasBareFn;
    if (!hasExport) continue;
    if (allowed) continue;
    if (hasBareFn) {
      failures.push(`${rel}: bare export async function (must wrap with withGuard)`);
      continue;
    }
    if (!WITH_GUARD.test(text)) {
      failures.push(`${rel}: exported handler is not wrapped in withGuard`);
    }
    continue;
  }
  const hasBareFn = ACTION_EXPORT_FN.test(text);
  const hasExport = ACTION_EXPORT_CONST.test(text) || hasBareFn;
  if (!hasExport) continue;
  if (allowed) continue;
  if (hasBareFn) {
    failures.push(`${rel}: bare exported server action (must wrap with withGuard)`);
    continue;
  }
  if (!WITH_GUARD.test(text)) {
    failures.push(`${rel}: exported server action is not wrapped in withGuard`);
  }
}

if (failures.length) {
  console.error("Route guard coverage failed:\n" + failures.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}

console.log(`Route guard coverage ok (${files.length} files).`);
