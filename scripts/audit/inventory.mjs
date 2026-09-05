#!/usr/bin/env node
/* Lists every named function in prototype/js: declarations, arrow and function-expression assignments,
   and object methods, with file and line. The function audit (docs/15) takes this list as its universe.
   node scripts/audit/inventory.mjs            → table by file
   node scripts/audit/inventory.mjs --json     → { "<file>": [{name, kind, line}] } */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } })(path.join(ROOT, 'prototype', 'js'));

const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'else', 'do', 'try', 'typeof', 'new', 'await', 'in', 'of']);
const PATTERNS = [
  { kind: 'decl', re: /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/ },
  { kind: 'arrow', re: /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/ },
  { kind: 'fnexpr', re: /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/ },
  { kind: 'method', re: /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/ },
  { kind: 'prop-fn', re: /^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)/ },
];

const out = {};
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const found = [];
  lines.forEach((line, i) => {
    for (const { kind, re } of PATTERNS) {
      const m = line.match(re);
      if (!m) continue;
      const name = m[1];
      if (KEYWORDS.has(name)) continue;
      found.push({ name, kind, line: i + 1 });
      break;
    }
  });
  out[rel] = found;
}

if (process.argv.includes('--json')) { process.stdout.write(JSON.stringify(out, null, 1)); }
else {
  let total = 0;
  for (const [f, fns] of Object.entries(out)) { total += fns.length; console.log(f.padEnd(36), String(fns.length).padStart(4)); }
  console.log('total'.padEnd(36), String(total).padStart(4));
}
