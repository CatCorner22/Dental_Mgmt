#!/usr/bin/env node
/* Parse every prototype and harness file. Two merges (07f65f1, 39ab168) concatenated both
   sides of the same JS files and shipped a tree that could not boot; this gate fails the
   run on the first SyntaxError instead of discovering it in a Playwright timeout.
   node scripts/syntax-check.mjs
   Exit 0 only when every selected file parses. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = [
  path.join(ROOT, 'prototype', 'js'),
  path.join(ROOT, 'scripts'),
];

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(js|mjs|cjs)$/.test(name)) acc.push(p);
  }
  return acc;
}

const files = ROOTS.flatMap((d) => walk(d));
const failures = [];
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').trim().split('\n')[0] || ('exit ' + r.status);
    failures.push({ file: path.relative(ROOT, file), error: err });
  }
}

console.log('syntax     files   failures');
console.log('parse'.padEnd(10), String(files.length).padEnd(7), failures.length);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log('  - ' + f.file + ': ' + f.error);
  process.exit(1);
}
console.log('\n' + files.length + ' files parse.');
