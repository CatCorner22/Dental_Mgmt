#!/usr/bin/env node
/**
 * Fails when a route handler or server action is exported without withGuard.
 *
 * Route handlers: every src/app/**\/route.ts. Server actions: every *.action.ts
 * anywhere under src, and every module under src whose first statement is the
 * "use server" directive, since Next exposes each of its async exports as an
 * HTTP endpoint wherever the file lives.
 *
 * Allowlist: /api/health and /api/auth/* (NextAuth transport), and the server
 * actions no session stands behind, each named in ALLOW with its reason.
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
const SRC = path.join(ROOT, "src");
const APP = path.join(SRC, "app");

const ALLOW = [
  path.join(APP, "api/health/route.ts"),
  path.join(APP, "api/auth/[...nextauth]/route.ts"),
  // Server actions no session stands behind. Each is authorised by the secret
  // the caller holds (credentials, a mailed stop link, an invitation, a reset
  // token), and the check for it is the lookup itself.
  path.join(SRC, "lib/auth/loginAction.ts"),
  path.join(SRC, "lib/notices/stopAction.ts"),
  path.join(SRC, "lib/auth/inviteAction.ts"),
  path.join(SRC, "lib/auth/regainAction.ts"),
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

/**
 * Every entitlement a guard names must be a duty the rulebook carries.
 *
 * The catalog is read as text rather than imported, because this script is
 * plain node and the catalog is TypeScript. The union type beside it is not
 * read: `isEntitlementId` tests membership of `ENTITLEMENTS`, so the catalog
 * is what decides at run time whether a duty can be granted.
 */
/** Every route in this app, as the URL it serves and the file that serves it. */
const routes = files
  .filter((f) => f.kind === "route")
  .map((f) => ["/" + path.relative(APP, path.dirname(f.file)).split(path.sep).join("/"), f.file]);

/**
 * Every other .ts/.tsx file in the app, comments stripped, tests left out.
 *
 * Both exclusions are the check (Increment 1.96). A path named in a doc
 * comment is prose, and a gate prose can satisfy is not a gate — the first
 * draft of this check passed because Increments 1.94 and 1.95 had written
 * these very paths into comments explaining that nothing called them. And a
 * route only a test calls is precisely the defect: the recovery ceremony, the
 * tenant-wide revoke and the Curve Hero import each had tests and no screen,
 * and each was broken in a way only a real caller could show.
 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}
function readAll(dir) {
  let out = "";
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "e2e") continue;
      out += readAll(full);
      continue;
    }
    if (!ent.name.endsWith(".ts") && !ent.name.endsWith(".tsx")) continue;
    if (ent.name === "route.ts") continue;
    if (/\.test\.tsx?$/.test(ent.name)) continue;
    out += stripComments(fs.readFileSync(full, "utf8"));
  }
  return out;
}
const SOURCE = readAll(path.join(ROOT, "src"));

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
for (const { file } of files) {
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

/**
 * A route nothing calls must say why (Increment 1.96).
 *
 * Three increments in a row found the same defect and each found it the same
 * way. Increment 1.90: the tenant-wide session revoke had existed since 0.8
 * and no screen called it. Increment 1.94: the Curve Hero import had no screen
 * since 1.3, and giving it one showed that applying had never worked at all —
 * the append role held a grant on none of the tables it read. Migration 0055
 * had already written the lesson down for the recovery ceremony: **nothing
 * caught it because nothing called it.**
 *
 * So the sweep those increments ran by hand runs here. A route whose path
 * appears nowhere else in the app's own source is either a defect or a
 * decision, and this makes the difference a line somebody had to write.
 *
 * The allowlist is the same device the transport exemptions above are: an
 * entry is a claim, and a route that leaves the list takes its claim with it.
 */
const UNCALLED = new Map([
  [
    "/api/controls/policy",
    "Reads the active control policy. Practice Risk reads the same material through /api/controls/risk, so no screen needs this one; it is kept as the plain read of a policy by version, and Increment 1.96 raised it from `user` to `manager` to match the screen rather than sit a rank below it.",
  ],
]);

const uncalled = [];
for (const [url, file] of routes) {
  if (url.startsWith("/api/auth") || url === "/api/health") continue;
  const staticPrefix = url.split("/[")[0];
  if (SOURCE.includes(staticPrefix)) continue;
  const why = UNCALLED.get(url);
  if (why === undefined) {
    uncalled.push(
      `${path.relative(ROOT, file)}: nothing in this app names ${url}. A route with no caller is a route nobody has run — give it a screen, or name it in UNCALLED with the reason it has none.`
    );
  } else if (why.length < 40) {
    uncalled.push(`${url}: its UNCALLED entry says too little to be a reason.`);
  }
}
for (const url of UNCALLED.keys()) {
  const known = routes.some(([u]) => u === url);
  if (!known) uncalled.push(`${url} is named in UNCALLED and is not a route in this app.`);
  else if (SOURCE.includes(url.split("/[")[0])) {
    uncalled.push(`${url} is named in UNCALLED and something now calls it. Take it off the list.`);
  }
}
failures.push(...uncalled);

if (failures.length) {
  console.error("Route guard coverage failed:\n" + failures.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}

console.log(
  `Route guard coverage ok (${files.length} files; every guarded entitlement is one of the rulebook's ${CATALOG.size}; ` +
    `${UNCALLED.size} ${UNCALLED.size === 1 ? "route" : "routes"} nothing calls, each with its reason).`
);
