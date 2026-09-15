#!/usr/bin/env node
/**
 * Copies the Smile Notes clinical-core libraries into packages/clinical-core
 * and closes @/lib/* import dependencies without pulling Next, the database,
 * assist, gamify, or the EDR paste-target.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2] || "/tmp/source-repos/dental";
const DEST = path.resolve("packages/clinical-core");
const SKIP_PREFIXES = [
  "lib/assist/",
  "lib/db/",
  "lib/gamify/",
  "lib/edr/",
  "lib/wishes/",
  "lib/gpa/",
  "lib/training/",
  "lib/requests/",
  "lib/digest/",
  "lib/learning/",
  "lib/email/",
  "lib/http/",
  "lib/export/",
  "lib/client/",
  "lib/drafts/",
  "lib/tickets/",
  "lib/practice/",
  "lib/review/",
  "lib/status/",
  "lib/stats/",
  "lib/risk/",
  "lib/dictation/",
  "lib/theme/",
  "lib/bytestar/",
  "lib/advisor/",
  "lib/byteaudit/",
  "lib/packs/",
  "lib/state/",
];

const SEED = [
  "lib/audit",
  "lib/vocab",
  "lib/modules",
  "lib/verify",
  "lib/extract",
  "lib/standardize",
  "lib/compose",
  "lib/readback",
  "lib/schema",
  "lib/text",
  "lib/scope",
  "lib/presets",
  "lib/version.ts",
  "lib/auth/clinicalRoles.ts",
];

function shouldSkip(rel) {
  const n = rel.replaceAll("\\", "/");
  return SKIP_PREFIXES.some((p) => n.startsWith(p) || n.includes("/" + p));
}

function copyFile(fromRel) {
  const from = path.join(SRC, "src", fromRel);
  const to = path.join(DEST, "src", fromRel);
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function walkDir(rel) {
  const full = path.join(SRC, "src", rel);
  if (!fs.existsSync(full)) return [];
  const out = [];
  for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
    const next = path.join(rel, ent.name);
    if (ent.isDirectory()) out.push(...walkDir(next));
    else out.push(next);
  }
  return out;
}

function importsOf(file) {
  const text = fs.readFileSync(file, "utf8");
  const found = [];
  const re = /from\s+["']@\/([^"']+)["']/g;
  let m;
  while ((m = re.exec(text))) found.push(m[1]);
  return found;
}

function resolveImport(spec) {
  const candidates = [
    spec + ".ts",
    spec + ".tsx",
    path.join(spec, "index.ts"),
    spec,
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(SRC, "src", c))) return c;
  }
  return null;
}

fs.mkdirSync(path.join(DEST, "src"), { recursive: true });

const queue = [];
for (const seed of SEED) {
  const full = path.join(SRC, "src", seed);
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    queue.push(...walkDir(seed));
  } else {
    queue.push(seed);
  }
}

const copied = new Set();
const missing = [];
while (queue.length) {
  const rel = queue.shift().replaceAll("\\", "/");
  if (copied.has(rel) || shouldSkip(rel)) continue;
  if (!copyFile(rel)) {
    missing.push(rel);
    continue;
  }
  copied.add(rel);
  const destFile = path.join(DEST, "src", rel);
  if (!destFile.endsWith(".ts") && !destFile.endsWith(".tsx")) continue;
  for (const spec of importsOf(destFile)) {
    const resolved = resolveImport(spec);
    if (!resolved) {
      missing.push(spec);
      continue;
    }
    if (!copied.has(resolved) && !shouldSkip(resolved)) queue.push(resolved);
  }
}

let dropped = 0;
for (const rel of [...copied]) {
  if (!rel.includes(".test.")) continue;
  const destFile = path.join(DEST, "src", rel);
  const text = fs.readFileSync(destFile, "utf8");
  if (
    /@\/lib\/(assist|db|gamify|edr|wishes|gpa|bytestar|advisor|byteaudit|packs|state|drafts|tickets)\b/.test(
      text,
    )
  ) {
    fs.unlinkSync(destFile);
    copied.delete(rel);
    dropped += 1;
  }
}

console.log(
  JSON.stringify(
    {
      copied: copied.size,
      droppedTests: dropped,
      missing: [...new Set(missing)].slice(0, 40),
    },
    null,
    2,
  ),
);
