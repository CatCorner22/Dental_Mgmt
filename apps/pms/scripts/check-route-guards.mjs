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
 *
 * Since Increment 1.91 it also fails when a guard names an entitlement the
 * control rulebook does not carry. `run_import` guarded three import routes
 * for the product's whole life while belonging to no catalog, so it could be
 * revoked and never granted, and the duty-family matrix scored nobody who
 * held it. A guard naming a duty nothing can confer is a route only the seed
 * can open, and that is the shape this check refuses.
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

/**
 * Every entitlement a guard names must be a duty the rulebook carries.
 *
 * The catalog is read as text rather than imported, because this script is
 * plain node and the catalog is TypeScript. The union type beside it is not
 * read: `isEntitlementId` tests membership of `ENTITLEMENTS`, so the catalog
 * is what decides at run time whether a duty can be granted.
 */
const CATALOG_FILE = path.join(
  ROOT,
  "../../packages/controls-engine/src/sod/conflict-rules.ts"
);
const catalogText = fs.readFileSync(CATALOG_FILE, "utf8");
const catalogBody = catalogText.slice(
  catalogText.indexOf("export const ENTITLEMENTS"),
  catalogText.indexOf("export const CONFLICT_RULES")
);
const CATALOG = new Set([...catalogBody.matchAll(/\bid:\s*"([a-z_]+)"/g)].map((m) => m[1]));
if (CATALOG.size === 0) {
  console.error("Route guard coverage failed: read no entitlements from the control rulebook.");
  process.exit(1);
}

/** `export const NAME = "entitlement"` anywhere under src/lib, for orEntitlement. */
function constantStrings(dir) {
  const out = new Map();
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      for (const [k, v] of constantStrings(full)) out.set(k, v);
    } else if (ent.name.endsWith(".ts")) {
      const text = fs.readFileSync(full, "utf8");
      for (const m of text.matchAll(/export const ([A-Z][A-Z0-9_]*)\s*=\s*"([a-z_]+)"/g)) {
        out.set(m[1], m[2]);
      }
    }
  }
  return out;
}
const CONSTANTS = constantStrings(path.join(ROOT, "src/lib"));

const unknown = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const where = path.relative(ROOT, file);
  for (const m of text.matchAll(/entitlements:\s*\[([^\]]*)\]/g)) {
    for (const id of [...m[1].matchAll(/"([^"]+)"/g)].map((q) => q[1])) {
      if (!CATALOG.has(id)) unknown.push(`${where}: guard names "${id}", which the control rulebook does not carry`);
    }
  }
  for (const m of text.matchAll(/orEntitlement:\s*("([^"]+)"|[A-Za-z_][A-Za-z0-9_]*)/g)) {
    const id = m[2] ?? CONSTANTS.get(m[1]);
    if (id === undefined) {
      unknown.push(`${where}: orEntitlement names ${m[1]}, which is not an exported string constant under src/lib`);
    } else if (!CATALOG.has(id)) {
      unknown.push(`${where}: guard names "${id}", which the control rulebook does not carry`);
    }
  }
}
failures.push(...unknown);

if (failures.length) {
  console.error("Route guard coverage failed:\n" + failures.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}

console.log(
  `Route guard coverage ok (${files.length} files; every guarded entitlement is one of the rulebook's ${CATALOG.size}).`
);
