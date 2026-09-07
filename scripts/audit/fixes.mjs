#!/usr/bin/env node
/* Derives the fix state of every confirmed root cause from the regression harness rather than from a claim.
   A root cause counts as fixed only when the check written for it by its adversarial verifier — the same check
   that reproduced the defect before the fix — reports NOT reproduced on the current tree.

   Inputs:
     --plan  <path>   fix-plan.json: {"<file>": [{root_id, sev, check, title}, ...], ...}
     --repro <path>   reproduce.json from `node scripts/beta/reproduce.mjs --json <path>`
     --notes <path>   optional {root_id: {status:'wontfix'|'open', note}} for a root cause deliberately declined
   Output:
     --out   <path>   fixes.json in the shape scripts/audit/report.mjs reads with --fixes

   node scripts/audit/fixes.mjs --plan <plan> --repro <repro> [--notes <notes>] --out <fixes> */
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const need = (k) => { if (!args[k]) { console.error(`fixes: --${k} is required`); process.exit(2); } return args[k]; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const plan = readJson(need('plan'));
const repro = readJson(need('repro'));
const notes = args.notes && fs.existsSync(args.notes) ? readJson(args.notes) : {};
const result = new Map((repro.results || repro).map((r) => [r.id, r]));
// A check's evidence is an object, not a sentence; keep it readable in the fixes file.
const ev = (r) => { const e = r.evidence; return (typeof e === 'string' ? e : JSON.stringify(e)).slice(0, 200); };

const out = {};
const counts = { fixed: 0, open: 0, wontfix: 0, no_check: 0 };
for (const [file, entries] of Object.entries(plan)) {
  for (const e of entries) {
    const declined = notes[e.root_id];
    if (declined && declined.status === 'wontfix') { out[e.root_id] = { status: 'wontfix', check: e.check, note: declined.note, file }; counts.wontfix++; continue; }
    const r = result.get(e.check);
    if (!r) { out[e.root_id] = { status: 'open', check: e.check, note: 'the check did not run', file }; counts.no_check++; continue; }
    if (r.reproduced) { out[e.root_id] = { status: 'open', check: e.check, note: 'still reproduced: ' + ev(r), file }; counts.open++; continue; }
    out[e.root_id] = { status: 'fixed', check: e.check, note: ev(r), file };
    counts.fixed++;
  }
}

fs.writeFileSync(need('out'), JSON.stringify(out, null, 1));
console.error(`fixes: ${Object.keys(out).length} root causes — ${counts.fixed} fixed, ${counts.open} open, ${counts.wontfix} declined, ${counts.no_check} without a check result`);
if (counts.no_check) console.error('fixes: without a check result — ' + Object.entries(out).filter(([, v]) => v.note === 'the check did not run').map(([k, v]) => k + ' (' + v.check + ')').join(', '));
